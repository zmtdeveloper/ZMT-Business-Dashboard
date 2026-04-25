import { env } from "@/config/env";

const SCRIPT_URL = env.appsScriptUrl;
const TOKEN = env.appsScriptToken;

export const isSheetsConfigured = !!SCRIPT_URL;

export async function syncToSheets(action: string, sheet: string, data: unknown) {
  if (!SCRIPT_URL) return { success: false, reason: "not_configured" };
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action, sheet, token: TOKEN, data }),
    });
    return await response.json();
  } catch {
    return { success: false, reason: "network_error" };
  }
}

export async function loadFromSheets(sheet: string) {
  if (!SCRIPT_URL) return null;
  try {
    const url = `${SCRIPT_URL}?action=getAll&sheet=${sheet}&token=${TOKEN}`;
    const response = await fetch(url);
    const json = await response.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function loadAllFromSheets() {
  if (!SCRIPT_URL) return null;
  try {
    const url = `${SCRIPT_URL}?action=getAllSheets&token=${TOKEN}`;
    const response = await fetch(url);
    const json = await response.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function syncAllToSheets(allData: Record<string, unknown[]>) {
  if (!SCRIPT_URL) return { success: false, reason: "not_configured" };
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "syncAll", token: TOKEN, data: allData }),
    });
    return await response.json();
  } catch {
    return { success: false, reason: "network_error" };
  }
}
