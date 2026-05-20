/**
 * ZMT Business Dashboard - Google Apps Script
 * =============================================
 * This script acts as the API bridge between your React dashboard
 * and Google Sheets database.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with the following tabs:
 *    Clients | Products | Orders | Payments | Expenses | PersonalExpenses
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire file into the editor
 * 4. Set your secret token:
 *    Go to Project Settings > Script Properties > Add property:
 *    Key: APP_TOKEN   Value: (your secret token, same as VITE_APPS_SCRIPT_TOKEN in .env)
 * 5. Click Deploy > New Deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL and paste it into your .env as VITE_APPS_SCRIPT_URL
 *
 * Sheet Column Structure (must match exactly):
 * Clients:  id | name | phone | email | address | notes | createdAt
 * Products: id | name | salePrice | costPrice | durationDays | status | notes | createdAt
 * Orders:   id | clientId | clientName | productId | productName | quantity | deliveryDate | expiryDate | totalAmount | paidAmount | remainingAmount | paymentStatus | orderStatus | notes | createdAt | renewedFromOrderId | renewedToOrderId | renewedAt
 * Payments: id | orderId | clientId | clientName | orderDescription | amount | method | paymentDate | notes | createdAt
 * Expenses: id | title | category | amount | expenseDate | notes | createdAt
 * PersonalExpenses: id | title | category | amount | expenseDate | method | notes | createdAt
 */


// Token validation

function validateToken(token) {
  const stored = PropertiesService.getScriptProperties().getProperty("APP_TOKEN");
  if (!stored) {
    // If no token is set in script properties, skip validation (dev mode)
    return true;
  }
  return token === stored;
}


// Sheet helpers

const SHEET_HEADERS = {
  Clients:  ["id", "name", "phone", "email", "address", "notes", "createdAt"],
  Products: ["id", "name", "salePrice", "costPrice", "durationDays", "status", "notes", "createdAt"],
  Orders:   ["id", "clientId", "clientName", "productId", "productName", "quantity", "deliveryDate", "expiryDate", "totalAmount", "paidAmount", "remainingAmount", "paymentStatus", "orderStatus", "notes", "createdAt", "renewedFromOrderId", "renewedToOrderId", "renewedAt"],
  Payments: ["id", "orderId", "clientId", "clientName", "orderDescription", "amount", "method", "paymentDate", "notes", "createdAt"],
  Expenses: ["id", "title", "category", "amount", "expenseDate", "notes", "createdAt"],
  PersonalExpenses: ["id", "title", "category", "amount", "expenseDate", "method", "notes", "createdAt"]
};

const SHEET_ALIASES = {
  PersonalExpenses: ["Personal Expenses", "Owner Wallet", "OwnerWallet", "Personal Costs"]
};

function getCanonicalSheetName(sheetName) {
  if (SHEET_HEADERS[sheetName]) return sheetName;
  const names = Object.keys(SHEET_ALIASES);
  for (let i = 0; i < names.length; i++) {
    const canonical = names[i];
    if (SHEET_ALIASES[canonical].indexOf(sheetName) !== -1) return canonical;
  }
  return sheetName;
}

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const canonicalName = getCanonicalSheetName(sheetName);
  const aliases = SHEET_ALIASES[canonicalName] || [];
  let sheet = ss.getSheetByName(canonicalName);
  if (!sheet) {
    for (let i = 0; i < aliases.length; i++) {
      sheet = ss.getSheetByName(aliases[i]);
      if (sheet) break;
    }
  }
  if (!sheet) {
    sheet = ss.insertSheet(canonicalName);
  }
  const headers = SHEET_HEADERS[canonicalName];
  if (headers) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetToObjects(sheet, sheetName) {
  const headers = SHEET_HEADERS[getCanonicalSheetName(sheetName || sheet.getName())];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data
    .filter(row => row.some(cell => cell !== "" && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((key, i) => {
        let value = row[i];
        // Convert numbers back from sheet
        if (typeof value === "number") value = value;
        // Convert dates from sheet
        if (value instanceof Date) value = value.toISOString();
        obj[key] = value;
      });
      return obj;
    });
}

function findRowById(sheet, id, sheetName) {
  const headers = SHEET_HEADERS[getCanonicalSheetName(sheetName || sheet.getName())];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const idx = ids.indexOf(id);
  return idx === -1 ? -1 : idx + 2; // 1-indexed row number
}

function objectToRow(sheetName, obj) {
  const headers = SHEET_HEADERS[getCanonicalSheetName(sheetName)];
  return headers.map(key => obj[key] !== undefined ? obj[key] : "");
}


// Sheet setup

function setupSheets() {
  Object.keys(SHEET_HEADERS).forEach(name => getOrCreateSheet(name));
  return { success: true, message: "All sheets created successfully" };
}


// CRUD operations

function getAllRows(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  return sheetToObjects(sheet, sheetName);
}

function insertRow(sheetName, data) {
  const sheet = getOrCreateSheet(sheetName);
  const row = objectToRow(sheetName, data);
  sheet.appendRow(row);
  return { success: true, id: data.id };
}

function updateRow(sheetName, data) {
  const sheet = getOrCreateSheet(sheetName);
  const rowNum = findRowById(sheet, data.id, sheetName);
  if (rowNum === -1) return { success: false, message: "Row not found: " + data.id };
  const headers = SHEET_HEADERS[getCanonicalSheetName(sheetName)];
  const row = objectToRow(sheetName, data);
  sheet.getRange(rowNum, 1, 1, headers.length).setValues([row]);
  return { success: true, id: data.id };
}

function deleteRow(sheetName, id) {
  const sheet = getOrCreateSheet(sheetName);
  const rowNum = findRowById(sheet, id, sheetName);
  if (rowNum === -1) return { success: false, message: "Row not found: " + id };
  sheet.deleteRow(rowNum);
  return { success: true, id: id };
}

function replaceAllRows(sheetName, rows) {
  const sheet = getOrCreateSheet(sheetName);
  const headers = SHEET_HEADERS[getCanonicalSheetName(sheetName)];
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (rows.length > 0) {
    const values = rows.map(obj => objectToRow(sheetName, obj));
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }
  return { success: true, count: rows.length };
}


// Read endpoint

function doGet(e) {
  const params = e ? e.parameter : {};
  const token = params.token || "";
  const action = params.action || "getAll";
  const sheet = params.sheet || "";

  if (!validateToken(token)) {
    return jsonResponse({ success: false, message: "Invalid token" });
  }

  try {
    if (action === "setup") {
      return jsonResponse(setupSheets());
    }

    if (action === "getAll" && sheet) {
      const data = getAllRows(sheet);
      return jsonResponse({ success: true, sheet: sheet, data: data, count: data.length });
    }

    if (action === "getAllSheets") {
      const allData = {};
      Object.keys(SHEET_HEADERS).forEach(name => {
        allData[name] = getAllRows(name);
      });
      return jsonResponse({ success: true, data: allData });
    }

    return jsonResponse({ success: false, message: "Unknown action: " + action });

  } catch (err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}


// Write endpoint

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, message: "Invalid JSON body" });
  }

  const token = body.token || "";
  const action = body.action || "";
  const sheet = body.sheet || "";
  const data = body.data;

  if (!validateToken(token)) {
    return jsonResponse({ success: false, message: "Invalid token" });
  }

  try {
    if (action === "insert") {
      return jsonResponse(insertRow(sheet, data));
    }

    if (action === "update") {
      return jsonResponse(updateRow(sheet, data));
    }

    if (action === "delete") {
      const id = data && data.id ? data.id : body.id;
      return jsonResponse(deleteRow(sheet, id));
    }

    if (action === "replaceAll") {
      const rows = Array.isArray(data) ? data : [];
      return jsonResponse(replaceAllRows(sheet, rows));
    }

    if (action === "bulkInsert") {
      const rows = Array.isArray(data) ? data : [];
      let inserted = 0;
      rows.forEach(row => {
        try {
          insertRow(sheet, row);
          inserted++;
        } catch(e) {}
      });
      return jsonResponse({ success: true, inserted: inserted });
    }

    if (action === "syncAll") {
      // Sync all sheets at once: body.data = { Clients: [...], Products: [...], ... }
      const results = {};
      Object.keys(data).forEach(sheetName => {
        if (SHEET_HEADERS[sheetName]) {
          results[sheetName] = replaceAllRows(sheetName, data[sheetName]);
        }
      });
      return jsonResponse({ success: true, results: results });
    }

    if (action === "setup") {
      return jsonResponse(setupSheets());
    }

    return jsonResponse({ success: false, message: "Unknown action: " + action });

  } catch (err) {
    return jsonResponse({ success: false, message: err.toString(), stack: err.stack });
  }
}


// Response helper

function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}


// Manual test functions

function testSetup() {
  const result = setupSheets();
  Logger.log(JSON.stringify(result));
}

function testInsertClient() {
  const result = insertRow("Clients", {
    id: "test-001",
    name: "Ahmed Ali",
    phone: "0321-1234567",
    email: "ahmed@example.com",
    address: "Lahore, Pakistan",
    notes: "Test client",
    createdAt: new Date().toISOString()
  });
  Logger.log(JSON.stringify(result));
}

function testGetAllClients() {
  const result = getAllRows("Clients");
  Logger.log(JSON.stringify(result));
}

function testDeleteClient() {
  const result = deleteRow("Clients", "test-001");
  Logger.log(JSON.stringify(result));
}
