import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSheetsConfigured, loadAllFromSheets, syncAllToSheets, syncToSheets } from "@/services/sheetsSync";

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  salePrice: number;
  costPrice: number;
  durationDays: number;
  status: "Active" | "Inactive";
  notes: string;
  createdAt: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveryDate: string;
  expiryDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  orderStatus: "Pending" | "Completed" | "Cancelled" | "Renewed";
  notes: string;
  createdAt: string;
  renewedFromOrderId?: string;
  renewedToOrderId?: string;
  renewedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  clientId: string;
  clientName: string;
  orderDescription: string;
  amount: number;
  method: "Cash" | "Bank Transfer" | "JazzCash" | "Easypaisa" | "Other";
  paymentDate: string;
  notes: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  category: "Product Cost" | "Delivery" | "Marketing / Ads" | "Salary" | "Office" | "Software / Tools" | "Other";
  amount: number;
  expenseDate: string;
  notes: string;
  createdAt: string;
}

export interface PersonalExpense {
  id: string;
  title: string;
  category: "Food" | "Fuel" | "Home" | "Family" | "Rent" | "Utilities" | "Travel" | "Personal" | "Health" | "Other";
  amount: number;
  expenseDate: string;
  method: "Cash" | "Bank Transfer" | "JazzCash" | "Easypaisa" | "Other";
  notes: string;
  createdAt: string;
}

export interface DataSnapshot {
  version: 1;
  exportedAt: string;
  clients: Client[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  personalExpenses: PersonalExpense[];
}

type DeletedRecord =
  | { label: string; sheet: "Clients"; data: Client }
  | { label: string; sheet: "Products"; data: Product }
  | { label: string; sheet: "Orders"; data: Order; linkedPayments: Payment[] }
  | { label: string; sheet: "Payments"; data: Payment }
  | { label: string; sheet: "Expenses"; data: Expense }
  | { label: string; sheet: "PersonalExpenses"; data: PersonalExpense };

interface DataContextType {
  clients: Client[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  personalExpenses: PersonalExpense[];
  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (c: Client) => void;
  deleteClient: (id: string) => boolean;
  addProduct: (p: Omit<Product, "id" | "createdAt">) => Product;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => boolean;
  addOrder: (o: Omit<Order, "id" | "createdAt">, initialPaymentMethod?: Payment["method"]) => Order;
  updateOrder: (o: Order) => void;
  deleteOrder: (id: string) => void;
  addPayment: (p: Omit<Payment, "id" | "createdAt">) => Payment;
  updatePayment: (p: Payment) => void;
  deletePayment: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Expense;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  addPersonalExpense: (e: Omit<PersonalExpense, "id" | "createdAt">) => PersonalExpense;
  updatePersonalExpense: (e: PersonalExpense) => void;
  deletePersonalExpense: (id: string) => void;
  renewOrder: (id: string) => Order | null;
  exportData: () => DataSnapshot;
  importData: (snapshot: unknown) => boolean;
  undoLastDelete: () => boolean;
  lastDeletedLabel: string | null;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  lastSynced: Date | null;
  lastSyncError: string | null;
  isSheetSyncEnabled: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

type StorageKeys = {
  clients: string;
  products: string;
  orders: string;
  payments: string;
  expenses: string;
  personalExpenses: string;
};

type SeedData = {
  clients: Client[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  personalExpenses: PersonalExpense[];
};

function createStorageKeys(prefix: "" | "showcase"): StorageKeys {
  const scoped = (name: string) => prefix ? `zmt_${prefix}_${name}` : `zmt_${name}`;
  return {
    clients: scoped("clients"),
    products: scoped("products"),
    orders: scoped("orders"),
    payments: scoped("payments"),
    expenses: scoped("expenses"),
    personalExpenses: scoped("owner_wallet_costs"),
  };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function load<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadPersonalExpenses(keys: StorageKeys) {
  return load<PersonalExpense>(keys.personalExpenses, []);
}

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const toText = (value: unknown, fallback = "") => String(value ?? fallback);

const toNumber = (value: unknown, fallback = 0) => {
  const normalizedValue = typeof value === "string"
    ? value.replace(/,/g, "").replace(/[^\d.-]/g, "")
    : value;
  const numberValue = Number(normalizedValue);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toMoney = (value: unknown, fallback = 0) => Math.max(0, toNumber(value, fallback));

function getPaymentStatus(totalAmount: number, paidAmount: number): Order["paymentStatus"] {
  if (totalAmount <= 0) return paidAmount > 0 ? "Paid" : "Unpaid";
  if (paidAmount >= totalAmount) return "Paid";
  if (paidAmount > 0) return "Partial";
  return "Unpaid";
}

function findOrderProduct(order: Order, products: Product[] = []) {
  const orderProductName = order.productName.toLowerCase();
  return products.find(product => product.id === order.productId) ??
    products.find(product => product.name.toLowerCase() === orderProductName);
}

function getProductOrderTotal(order: Order, products: Product[] = []) {
  const product = findOrderProduct(order, products);
  const quantity = Math.max(1, toNumber(order.quantity, 1));
  return product ? toMoney(product.salePrice) * quantity : 0;
}

function normalizeOrderAmounts(order: Order, linkedPayments: Payment[] = [], products: Product[] = []): Order {
  const quantity = Math.max(1, toNumber(order.quantity, 1));
  const linkedPaid = linkedPayments.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
  const paidAmount = Math.max(toMoney(order.paidAmount), linkedPaid);
  const recordedTotal = toMoney(order.totalAmount);
  const productTotal = getProductOrderTotal(order, products);
  const totalAmount = Math.max(recordedTotal || productTotal, paidAmount);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  return {
    ...order,
    quantity,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus: getPaymentStatus(totalAmount, paidAmount),
  };
}

function normalizeOrders(orders: Order[], payments: Payment[] = [], products: Product[] = []) {
  const paymentsByOrder = payments.reduce<Record<string, Payment[]>>((acc, payment) => {
    if (!payment.orderId) return acc;
    acc[payment.orderId] = acc[payment.orderId] ?? [];
    acc[payment.orderId].push(payment);
    return acc;
  }, {});

  return orders.map(order => normalizeOrderAmounts(order, paymentsByOrder[order.id] ?? [], products));
}

function isSuccessfulSyncResult(result: unknown) {
  return !!result && typeof result === "object" && (result as { success?: unknown }).success === true;
}

function getSyncFailureMessage(failedResults: unknown[]) {
  const firstFailure = failedResults.find(result => result && typeof result === "object") as
    | { sheet?: unknown; message?: unknown; reason?: unknown }
    | undefined;

  const sheet = typeof firstFailure?.sheet === "string" ? firstFailure.sheet : "";
  const detail = typeof firstFailure?.message === "string"
    ? firstFailure.message
    : typeof firstFailure?.reason === "string"
      ? firstFailure.reason
      : "";

  if (sheet === "PersonalExpenses") {
    return detail
      ? `Owner Wallet sync failed. ${detail}`
      : "Owner Wallet sync failed. The Google Sheet must have a PersonalExpenses tab with the required header row.";
  }

  return detail ? `Some changes could not sync to Google Sheets. ${detail}` : "Some changes could not sync to Google Sheets.";
}

function createSheetIdSets() {
  return {
    Clients: new Set<string>(),
    Products: new Set<string>(),
    Orders: new Set<string>(),
    Payments: new Set<string>(),
    Expenses: new Set<string>(),
    PersonalExpenses: new Set<string>(),
  } satisfies Record<SheetName, Set<string>>;
}

function mergeRowsById<T extends { id: string }>(remoteRows: T[], localRows: T[], deletedIds: Set<string>) {
  const merged = new Map<string, T>();
  remoteRows.forEach(row => {
    if (!deletedIds.has(row.id)) merged.set(row.id, row);
  });
  localRows.forEach(row => {
    if (!deletedIds.has(row.id)) merged.set(row.id, row);
  });
  return Array.from(merged.values());
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function isDataSnapshot(value: unknown): value is Partial<DataSnapshot> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Record<keyof DataSnapshot, unknown>>;
  return Array.isArray(candidate.clients) &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.payments) &&
    Array.isArray(candidate.expenses);
}

const toDateInputValue = (value: unknown, fallback = today()) => {
  const textValue = toText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(textValue)) return textValue;

  const date = new Date(textValue);
  if (Number.isNaN(date.getTime())) return fallback;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toIsoDateTime = (value: unknown, fallback = now()) => {
  const date = new Date(toText(value));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const SEED_CLIENTS: Client[] = [
  { id: "c1", name: "Ahmed Ali", phone: "0321-1234567", email: "ahmed@example.com", address: "Lahore, Punjab", notes: "Regular client", createdAt: "2024-01-10T10:00:00.000Z" },
  { id: "c2", name: "Fatima Khan", phone: "0333-9876543", email: "fatima@example.com", address: "Karachi, Sindh", notes: "Referred by Ahmed", createdAt: "2024-02-15T10:00:00.000Z" },
  { id: "c3", name: "Hassan Raza", phone: "0300-5551234", email: "hassan@example.com", address: "Islamabad", notes: "", createdAt: "2024-03-05T10:00:00.000Z" },
  { id: "c4", name: "Zainab Tariq", phone: "0312-8887765", email: "zainab@example.com", address: "Faisalabad", notes: "New client", createdAt: "2024-04-01T10:00:00.000Z" },
  { id: "c5", name: "Usman Sheikh", phone: "0345-1112233", email: "usman@example.com", address: "Multan", notes: "VIP client", createdAt: "2024-05-20T10:00:00.000Z" },
];

const SEED_PRODUCTS: Product[] = [
  { id: "p1", name: "Social Media Package", salePrice: 15000, costPrice: 3000, durationDays: 30, status: "Active", notes: "Monthly retainer", createdAt: "2024-01-01T10:00:00.000Z" },
  { id: "p2", name: "SEO Services", salePrice: 25000, costPrice: 5000, durationDays: 30, status: "Active", notes: "Includes keyword research", createdAt: "2024-01-01T10:00:00.000Z" },
  { id: "p3", name: "Website Design", salePrice: 80000, costPrice: 20000, durationDays: 90, status: "Active", notes: "Full design + development", createdAt: "2024-01-01T10:00:00.000Z" },
  { id: "p4", name: "Logo Branding", salePrice: 12000, costPrice: 2000, durationDays: 14, status: "Active", notes: "Includes 3 revisions", createdAt: "2024-01-01T10:00:00.000Z" },
];

const SEED_ORDERS: Order[] = [
  { id: "o1", clientId: "c1", clientName: "Ahmed Ali", productId: "p1", productName: "Social Media Package", quantity: 1, deliveryDate: "2024-03-01", expiryDate: "2024-03-31", totalAmount: 15000, paidAmount: 15000, remainingAmount: 0, paymentStatus: "Paid", orderStatus: "Completed", notes: "", createdAt: "2024-03-01T10:00:00.000Z" },
  { id: "o2", clientId: "c2", clientName: "Fatima Khan", productId: "p2", productName: "SEO Services", quantity: 1, deliveryDate: "2024-03-05", expiryDate: "2024-04-04", totalAmount: 25000, paidAmount: 12500, remainingAmount: 12500, paymentStatus: "Partial", orderStatus: "Pending", notes: "Remaining to be paid next month", createdAt: "2024-03-05T10:00:00.000Z" },
  { id: "o3", clientId: "c3", clientName: "Hassan Raza", productId: "p3", productName: "Website Design", quantity: 1, deliveryDate: "2024-03-10", expiryDate: "2024-06-08", totalAmount: 80000, paidAmount: 0, remainingAmount: 80000, paymentStatus: "Unpaid", orderStatus: "Pending", notes: "", createdAt: "2024-03-10T10:00:00.000Z" },
  { id: "o4", clientId: "c4", clientName: "Zainab Tariq", productId: "p4", productName: "Logo Branding", quantity: 1, deliveryDate: "2024-03-15", expiryDate: "2024-03-29", totalAmount: 12000, paidAmount: 12000, remainingAmount: 0, paymentStatus: "Paid", orderStatus: "Completed", notes: "", createdAt: "2024-03-15T10:00:00.000Z" },
  { id: "o5", clientId: "c5", clientName: "Usman Sheikh", productId: "p1", productName: "Social Media Package", quantity: 3, deliveryDate: "2024-04-01", expiryDate: "2024-04-30", totalAmount: 45000, paidAmount: 20000, remainingAmount: 25000, paymentStatus: "Partial", orderStatus: "Pending", notes: "3 months package", createdAt: "2024-04-01T10:00:00.000Z" },
  { id: "o6", clientId: "c1", clientName: "Ahmed Ali", productId: "p2", productName: "SEO Services", quantity: 1, deliveryDate: "2024-04-01", expiryDate: "2024-04-30", totalAmount: 25000, paidAmount: 25000, remainingAmount: 0, paymentStatus: "Paid", orderStatus: "Completed", notes: "", createdAt: "2024-04-01T10:00:00.000Z" },
  { id: "o7", clientId: "c2", clientName: "Fatima Khan", productId: "p1", productName: "Social Media Package", quantity: 1, deliveryDate: "2024-12-01", expiryDate: addDays("2024-12-01", 30), totalAmount: 15000, paidAmount: 0, remainingAmount: 15000, paymentStatus: "Unpaid", orderStatus: "Pending", notes: "Expiring soon", createdAt: "2024-12-01T10:00:00.000Z" },
  { id: "o8", clientId: "c3", clientName: "Hassan Raza", productId: "p2", productName: "SEO Services", quantity: 1, deliveryDate: "2024-12-05", expiryDate: addDays("2024-12-05", 30), totalAmount: 25000, paidAmount: 10000, remainingAmount: 15000, paymentStatus: "Partial", orderStatus: "Pending", notes: "Renewal due", createdAt: "2024-12-05T10:00:00.000Z" },
];

const SEED_PAYMENTS: Payment[] = [
  { id: "py1", orderId: "o1", clientId: "c1", clientName: "Ahmed Ali", orderDescription: "Social Media Package", amount: 15000, method: "Bank Transfer", paymentDate: "2024-03-01", notes: "", createdAt: "2024-03-01T10:00:00.000Z" },
  { id: "py2", orderId: "o2", clientId: "c2", clientName: "Fatima Khan", orderDescription: "SEO Services", amount: 12500, method: "JazzCash", paymentDate: "2024-03-05", notes: "Advance payment", createdAt: "2024-03-05T10:00:00.000Z" },
  { id: "py3", orderId: "o4", clientId: "c4", clientName: "Zainab Tariq", orderDescription: "Logo Branding", amount: 12000, method: "Cash", paymentDate: "2024-03-15", notes: "", createdAt: "2024-03-15T10:00:00.000Z" },
  { id: "py4", orderId: "o5", clientId: "c5", clientName: "Usman Sheikh", orderDescription: "Social Media Package x3", amount: 20000, method: "Easypaisa", paymentDate: "2024-04-01", notes: "Partial advance", createdAt: "2024-04-01T10:00:00.000Z" },
  { id: "py5", orderId: "o6", clientId: "c1", clientName: "Ahmed Ali", orderDescription: "SEO Services", amount: 25000, method: "Bank Transfer", paymentDate: "2024-04-01", notes: "", createdAt: "2024-04-01T10:00:00.000Z" },
];

const SEED_EXPENSES: Expense[] = [
  { id: "e1", title: "Facebook Ads - March", category: "Marketing / Ads", amount: 15000, expenseDate: "2024-03-01", notes: "", createdAt: "2024-03-01T10:00:00.000Z" },
  { id: "e2", title: "Adobe Creative Cloud", category: "Software / Tools", amount: 8000, expenseDate: "2024-03-05", notes: "Annual subscription", createdAt: "2024-03-05T10:00:00.000Z" },
  { id: "e3", title: "Office Internet Bill", category: "Office", amount: 3500, expenseDate: "2024-03-10", notes: "", createdAt: "2024-03-10T10:00:00.000Z" },
  { id: "e4", title: "Freelancer Salary - April", category: "Salary", amount: 25000, expenseDate: "2024-04-01", notes: "Content writer", createdAt: "2024-04-01T10:00:00.000Z" },
  { id: "e5", title: "Google Ads Campaign", category: "Marketing / Ads", amount: 12000, expenseDate: "2024-04-05", notes: "PPC for client leads", createdAt: "2024-04-05T10:00:00.000Z" },
  { id: "e6", title: "Hosting Renewal", category: "Software / Tools", amount: 6000, expenseDate: "2024-04-10", notes: "Annual hosting plan", createdAt: "2024-04-10T10:00:00.000Z" },
];

const DEMO_CLIENTS: Client[] = [
  { id: "demo-c1", name: "Nova Cafe", phone: "0300-1112233", email: "hello@novacafe.test", address: "Lahore", notes: "Demo client for monthly social work", createdAt: "2026-02-10T10:00:00.000Z" },
  { id: "demo-c2", name: "Urban Clinic", phone: "0312-2223344", email: "admin@urbanclinic.test", address: "Karachi", notes: "Prefers WhatsApp reminders", createdAt: "2026-03-05T10:00:00.000Z" },
  { id: "demo-c3", name: "Pixel Studio", phone: "0333-3334455", email: "team@pixelstudio.test", address: "Islamabad", notes: "Design retainer prospect", createdAt: "2026-04-12T10:00:00.000Z" },
];

const DEMO_PRODUCTS: Product[] = [
  { id: "demo-p1", name: "Social Media Starter", salePrice: 18000, costPrice: 4500, durationDays: 30, status: "Active", notes: "Monthly content package", createdAt: "2026-02-01T10:00:00.000Z" },
  { id: "demo-p2", name: "Website Care Plan", salePrice: 32000, costPrice: 8000, durationDays: 30, status: "Active", notes: "Maintenance and updates", createdAt: "2026-02-01T10:00:00.000Z" },
  { id: "demo-p3", name: "Ads Management", salePrice: 25000, costPrice: 6000, durationDays: 30, status: "Active", notes: "Meta and Google campaign management", createdAt: "2026-02-01T10:00:00.000Z" },
  { id: "demo-p4", name: "Branding Kit", salePrice: 45000, costPrice: 12000, durationDays: 14, status: "Active", notes: "Logo, colors, and basic brand assets", createdAt: "2026-02-01T10:00:00.000Z" },
];

const DEMO_ORDERS: Order[] = [
  { id: "demo-o1", clientId: "demo-c1", clientName: "Nova Cafe", productId: "demo-p1", productName: "Social Media Starter", quantity: 1, deliveryDate: "2026-03-01", expiryDate: "2026-03-31", totalAmount: 18000, paidAmount: 18000, remainingAmount: 0, paymentStatus: "Paid", orderStatus: "Completed", notes: "Demo completed order", createdAt: "2026-03-01T10:00:00.000Z" },
  { id: "demo-o2", clientId: "demo-c2", clientName: "Urban Clinic", productId: "demo-p2", productName: "Website Care Plan", quantity: 1, deliveryDate: "2026-04-05", expiryDate: "2026-05-05", totalAmount: 32000, paidAmount: 20000, remainingAmount: 12000, paymentStatus: "Partial", orderStatus: "Pending", notes: "Demo renewal due", createdAt: "2026-04-05T10:00:00.000Z" },
  { id: "demo-o3", clientId: "demo-c3", clientName: "Pixel Studio", productId: "demo-p4", productName: "Branding Kit", quantity: 1, deliveryDate: "2026-05-02", expiryDate: "2026-05-16", totalAmount: 45000, paidAmount: 45000, remainingAmount: 0, paymentStatus: "Paid", orderStatus: "Completed", notes: "Ready for upsell", createdAt: "2026-05-02T10:00:00.000Z" },
  { id: "demo-o4", clientId: "demo-c1", clientName: "Nova Cafe", productId: "demo-p3", productName: "Ads Management", quantity: 1, deliveryDate: "2026-05-10", expiryDate: "2026-06-09", totalAmount: 25000, paidAmount: 0, remainingAmount: 25000, paymentStatus: "Unpaid", orderStatus: "Pending", notes: "Waiting for first payment", createdAt: "2026-05-10T10:00:00.000Z" },
];

const DEMO_PAYMENTS: Payment[] = [
  { id: "demo-py1", orderId: "demo-o1", clientId: "demo-c1", clientName: "Nova Cafe", orderDescription: "Social Media Starter", amount: 18000, method: "Bank Transfer", paymentDate: "2026-03-01", notes: "", createdAt: "2026-03-01T10:00:00.000Z" },
  { id: "demo-py2", orderId: "demo-o2", clientId: "demo-c2", clientName: "Urban Clinic", orderDescription: "Website Care Plan", amount: 20000, method: "JazzCash", paymentDate: "2026-04-05", notes: "Advance", createdAt: "2026-04-05T10:00:00.000Z" },
  { id: "demo-py3", orderId: "demo-o3", clientId: "demo-c3", clientName: "Pixel Studio", orderDescription: "Branding Kit", amount: 45000, method: "Cash", paymentDate: "2026-05-02", notes: "", createdAt: "2026-05-02T10:00:00.000Z" },
];

const DEMO_EXPENSES: Expense[] = [
  { id: "demo-e1", title: "Design tools", category: "Software / Tools", amount: 6500, expenseDate: "2026-05-01", notes: "Demo software cost", createdAt: "2026-05-01T10:00:00.000Z" },
  { id: "demo-e2", title: "Freelancer content support", category: "Salary", amount: 12000, expenseDate: "2026-05-06", notes: "Demo project help", createdAt: "2026-05-06T10:00:00.000Z" },
  { id: "demo-e3", title: "Campaign testing", category: "Marketing / Ads", amount: 7000, expenseDate: "2026-04-20", notes: "Demo ad spend", createdAt: "2026-04-20T10:00:00.000Z" },
];

const DEMO_PERSONAL_EXPENSES: PersonalExpense[] = [
  { id: "demo-pe1", title: "Fuel", category: "Fuel", amount: 4000, expenseDate: "2026-05-03", method: "Cash", notes: "Demo owner cost", createdAt: "2026-05-03T10:00:00.000Z" },
  { id: "demo-pe2", title: "Lunch meetings", category: "Food", amount: 2500, expenseDate: "2026-05-07", method: "Cash", notes: "Demo meals", createdAt: "2026-05-07T10:00:00.000Z" },
  { id: "demo-pe3", title: "Home groceries", category: "Home", amount: 9000, expenseDate: "2026-05-11", method: "Bank Transfer", notes: "Demo household spend", createdAt: "2026-05-11T10:00:00.000Z" },
  { id: "demo-pe4", title: "Family support", category: "Family", amount: 6000, expenseDate: "2026-04-25", method: "Easypaisa", notes: "Demo personal transfer", createdAt: "2026-04-25T10:00:00.000Z" },
];

function getSeedData(isShowcase: boolean): SeedData {
  return isShowcase
    ? {
        clients: DEMO_CLIENTS,
        products: DEMO_PRODUCTS,
        orders: DEMO_ORDERS,
        payments: DEMO_PAYMENTS,
        expenses: DEMO_EXPENSES,
        personalExpenses: DEMO_PERSONAL_EXPENSES,
      }
    : {
        clients: SEED_CLIENTS,
        products: SEED_PRODUCTS,
        orders: SEED_ORDERS,
        payments: SEED_PAYMENTS,
        expenses: SEED_EXPENSES,
        personalExpenses: [],
      };
}

const SHEET_NAMES = ["Clients", "Products", "Orders", "Payments", "Expenses", "PersonalExpenses"] as const;
type SheetName = typeof SHEET_NAMES[number];
type SheetPayload = Partial<Record<SheetName, unknown[]>>;

function normalizeSheetPayload(payload: SheetPayload) {
  const clients = (payload.Clients ?? []).map((row: any): Client => ({
    id: toText(row.id),
    name: toText(row.name),
    phone: toText(row.phone),
    email: toText(row.email),
    address: toText(row.address),
    notes: toText(row.notes),
    createdAt: toIsoDateTime(row.createdAt),
  })).filter(row => row.id);

  const products = (payload.Products ?? []).map((row: any): Product => ({
    id: toText(row.id),
    name: toText(row.name),
    salePrice: toNumber(row.salePrice),
    costPrice: toNumber(row.costPrice),
    durationDays: toNumber(row.durationDays, 30),
    status: row.status === "Inactive" ? "Inactive" : "Active",
    notes: toText(row.notes),
    createdAt: toIsoDateTime(row.createdAt),
  })).filter(row => row.id);

  const payments = (payload.Payments ?? []).map((row: any): Payment => ({
    id: toText(row.id),
    orderId: toText(row.orderId),
    clientId: toText(row.clientId),
    clientName: toText(row.clientName),
    orderDescription: toText(row.orderDescription),
    amount: toNumber(row.amount),
    method: ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Other"].includes(row.method) ? row.method : "Other",
    paymentDate: toDateInputValue(row.paymentDate),
    notes: toText(row.notes),
    createdAt: toIsoDateTime(row.createdAt),
  })).filter(row => row.id);

  const rawOrders = (payload.Orders ?? []).map((row: any): Order => ({
    id: toText(row.id),
    clientId: toText(row.clientId),
    clientName: toText(row.clientName),
    productId: toText(row.productId),
    productName: toText(row.productName),
    quantity: toNumber(row.quantity, 1),
    deliveryDate: toDateInputValue(row.deliveryDate),
    expiryDate: toDateInputValue(row.expiryDate),
    totalAmount: toNumber(row.totalAmount),
    paidAmount: toNumber(row.paidAmount),
    remainingAmount: toNumber(row.remainingAmount),
    paymentStatus: row.paymentStatus === "Paid" || row.paymentStatus === "Partial" ? row.paymentStatus : "Unpaid",
    orderStatus: ["Pending", "Completed", "Cancelled", "Renewed"].includes(row.orderStatus) ? row.orderStatus : "Pending",
    notes: toText(row.notes),
    createdAt: toIsoDateTime(row.createdAt),
    renewedFromOrderId: toText(row.renewedFromOrderId) || undefined,
    renewedToOrderId: toText(row.renewedToOrderId) || undefined,
    renewedAt: toText(row.renewedAt) ? toIsoDateTime(row.renewedAt) : undefined,
  })).filter(row => row.id);
  const orders = normalizeOrders(rawOrders, payments, products);

  const expenses = (payload.Expenses ?? []).map((row: any): Expense => ({
    id: toText(row.id),
    title: toText(row.title),
    category: ["Product Cost", "Delivery", "Marketing / Ads", "Salary", "Office", "Software / Tools", "Other"].includes(row.category) ? row.category : "Other",
    amount: toNumber(row.amount),
    expenseDate: toDateInputValue(row.expenseDate),
    notes: toText(row.notes),
    createdAt: toIsoDateTime(row.createdAt),
  })).filter(row => row.id);

  const personalExpenseRows = payload.PersonalExpenses ?? [];

  const personalExpenses = personalExpenseRows.map((row: any, index): PersonalExpense => {
    const title = toText(row.title, "Personal cost");
    const amount = toNumber(row.amount);
    const expenseDate = toDateInputValue(row.expenseDate);
    const fallbackId = `personal-${expenseDate}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;

    return {
      id: toText(row.id) || fallbackId,
      title,
      category: ["Food", "Fuel", "Home", "Family", "Rent", "Utilities", "Travel", "Personal", "Health", "Other"].includes(row.category) ? row.category : "Other",
      amount,
      expenseDate,
      method: ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Other"].includes(row.method) ? row.method : "Other",
      notes: toText(row.notes),
      createdAt: toIsoDateTime(row.createdAt),
    };
  }).filter(row => row.title || row.amount > 0);

  return { clients, products, orders, payments, expenses, personalExpenses };
}

function seedIfEmpty(keys: StorageKeys, seedData: SeedData) {
  if (!localStorage.getItem(keys.clients)) save(keys.clients, seedData.clients);
  if (!localStorage.getItem(keys.products)) save(keys.products, seedData.products);
  if (!localStorage.getItem(keys.orders)) save(keys.orders, seedData.orders);
  if (!localStorage.getItem(keys.payments)) save(keys.payments, seedData.payments);
  if (!localStorage.getItem(keys.expenses)) save(keys.expenses, seedData.expenses);
  if (!localStorage.getItem(keys.personalExpenses)) {
    save(keys.personalExpenses, seedData.personalExpenses);
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const storageKeys = createStorageKeys(currentUser?.storagePrefix ?? "");
  const seedData = getSeedData(currentUser?.role === "showcase");
  const canUseSheets = isSheetsConfigured && currentUser?.canSyncSheets === true;

  seedIfEmpty(storageKeys, seedData);

  const [clients, setClients] = useState<Client[]>(() => load(storageKeys.clients, []));
  const [products, setProducts] = useState<Product[]>(() => load(storageKeys.products, []));
  const [payments, setPayments] = useState<Payment[]>(() => load<Payment>(storageKeys.payments, []));
  const [orders, setOrders] = useState<Order[]>(() =>
    normalizeOrders(load<Order>(storageKeys.orders, []), load<Payment>(storageKeys.payments, []), load<Product>(storageKeys.products, []))
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => load(storageKeys.expenses, []));
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>(() => loadPersonalExpenses(storageKeys));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<DeletedRecord | null>(null);
  const deletedIdsRef = useRef(createSheetIdSets());

  const writeSheet = useCallback((action: string, sheet: string, data: unknown) => {
    return canUseSheets ? syncToSheets(action, sheet, data) : Promise.resolve({ success: true, skipped: true, sheet });
  }, [canUseSheets]);

  const writeAllSheets = useCallback((allData: Record<string, unknown[]>) => {
    return canUseSheets ? syncAllToSheets(allData) : Promise.resolve({ success: true, skipped: true });
  }, [canUseSheets]);

  const applySheetPayload = useCallback((payload: SheetPayload, preserveLocal = false) => {
    const normalized = normalizeSheetPayload(payload);
    const hasPersonalExpensesSheet = Object.prototype.hasOwnProperty.call(payload, "PersonalExpenses");
    if (preserveLocal) {
      setClients(prev => mergeRowsById(normalized.clients, prev, deletedIdsRef.current.Clients));
      setProducts(prev => mergeRowsById(normalized.products, prev, deletedIdsRef.current.Products));
      setOrders(prev => mergeRowsById(normalized.orders, prev, deletedIdsRef.current.Orders));
      setPayments(prev => mergeRowsById(normalized.payments, prev, deletedIdsRef.current.Payments));
      setExpenses(prev => mergeRowsById(normalized.expenses, prev, deletedIdsRef.current.Expenses));
      if (hasPersonalExpensesSheet) {
        setPersonalExpenses(prev => mergeRowsById(normalized.personalExpenses, prev, deletedIdsRef.current.PersonalExpenses));
      }
    } else {
      setClients(normalized.clients.filter(row => !deletedIdsRef.current.Clients.has(row.id)));
      setProducts(normalized.products.filter(row => !deletedIdsRef.current.Products.has(row.id)));
      setOrders(normalized.orders.filter(row => !deletedIdsRef.current.Orders.has(row.id)));
      setPayments(normalized.payments.filter(row => !deletedIdsRef.current.Payments.has(row.id)));
      setExpenses(normalized.expenses.filter(row => !deletedIdsRef.current.Expenses.has(row.id)));
      if (hasPersonalExpensesSheet) {
        const nextPersonalExpenses = normalized.personalExpenses.filter(row => !deletedIdsRef.current.PersonalExpenses.has(row.id));
        setPersonalExpenses(prev => nextPersonalExpenses.length > 0 || prev.length === 0 ? nextPersonalExpenses : prev);
      }
    }
    setLastSynced(new Date());
  }, []);

  const refreshFromSheets = useCallback(async (preserveLocal = false) => {
    if (!canUseSheets) return;
    const payload = await loadAllFromSheets();
    if (payload) {
      applySheetPayload(payload, preserveLocal);
      setLastSyncError(null);
    } else {
      setLastSyncError("Could not load data from Google Sheets.");
    }
  }, [applySheetPayload, canUseSheets]);

  const syncNow = useCallback(async () => {
    if (!canUseSheets) return;
    setIsSyncing(true);
    try {
      await refreshFromSheets(false);
    } finally {
      setIsSyncing(false);
    }
  }, [canUseSheets, refreshFromSheets]);

  const refreshAfterWrite = useCallback(async (writes: Promise<unknown> | Promise<unknown>[]) => {
    if (!canUseSheets) return;
    setIsSyncing(true);
    try {
      const results = await Promise.all(Array.isArray(writes) ? writes : [writes]);
      const failedResults = results.filter(result => !isSuccessfulSyncResult(result));
      if (failedResults.length === 0) {
        setLastSyncError(null);
        await refreshFromSheets(true);
      } else {
        setLastSyncError(getSyncFailureMessage(failedResults));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [canUseSheets, refreshFromSheets]);

  useEffect(() => { save(storageKeys.clients, clients); }, [clients, storageKeys.clients]);
  useEffect(() => { save(storageKeys.products, products); }, [products, storageKeys.products]);
  useEffect(() => { save(storageKeys.orders, orders); }, [orders, storageKeys.orders]);
  useEffect(() => { save(storageKeys.payments, payments); }, [payments, storageKeys.payments]);
  useEffect(() => { save(storageKeys.expenses, expenses); }, [expenses, storageKeys.expenses]);
  useEffect(() => {
    save(storageKeys.personalExpenses, personalExpenses);
  }, [personalExpenses, storageKeys.personalExpenses]);

  useEffect(() => {
    if (!canUseSheets) return;
    syncNow();
  }, [canUseSheets, syncNow]);

  const addClient = useCallback((data: Omit<Client, "id" | "createdAt">): Client => {
    const c = { ...data, id: genId(), createdAt: now() };
    setClients(prev => [...prev, c]);
    void refreshAfterWrite(writeSheet("insert", "Clients", c));
    return c;
  }, [refreshAfterWrite, writeSheet]);

  const updateClient = useCallback((c: Client) => {
    setClients(prev => prev.map(x => x.id === c.id ? c : x));
    void refreshAfterWrite(writeSheet("update", "Clients", c));
  }, [refreshAfterWrite, writeSheet]);

  const deleteClient = useCallback((id: string) => {
    if (orders.some(order => order.clientId === id)) return false;
    const client = clients.find(x => x.id === id);
    if (!client) return false;
    setLastDeleted({ label: client.name || "client", sheet: "Clients", data: client });
    deletedIdsRef.current.Clients.add(id);
    setClients(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(writeSheet("delete", "Clients", { id }));
    return true;
  }, [clients, orders, refreshAfterWrite, writeSheet]);

  const addProduct = useCallback((data: Omit<Product, "id" | "createdAt">): Product => {
    const p = { ...data, id: genId(), createdAt: now() };
    setProducts(prev => [...prev, p]);
    void refreshAfterWrite(writeSheet("insert", "Products", p));
    return p;
  }, [refreshAfterWrite, writeSheet]);

  const updateProduct = useCallback((p: Product) => {
    setProducts(prev => prev.map(x => x.id === p.id ? p : x));
    void refreshAfterWrite(writeSheet("update", "Products", p));
  }, [refreshAfterWrite, writeSheet]);

  const deleteProduct = useCallback((id: string) => {
    if (orders.some(order => order.productId === id)) return false;
    const product = products.find(x => x.id === id);
    if (!product) return false;
    setLastDeleted({ label: product.name || "product", sheet: "Products", data: product });
    deletedIdsRef.current.Products.add(id);
    setProducts(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(writeSheet("delete", "Products", { id }));
    return true;
  }, [orders, products, refreshAfterWrite, writeSheet]);

  const addOrder = useCallback((data: Omit<Order, "id" | "createdAt">, initialPaymentMethod: Payment["method"] = "Cash"): Order => {
    const o = normalizeOrderAmounts({ ...data, id: genId(), createdAt: now() }, [], products);
    setOrders(prev => [...prev, o]);
    const initialPayment = o.paidAmount > 0
      ? {
          id: genId(),
          orderId: o.id,
          clientId: o.clientId,
          clientName: o.clientName,
          orderDescription: o.quantity > 1 ? `${o.productName} x${o.quantity}` : o.productName,
          amount: o.paidAmount,
          method: initialPaymentMethod,
          paymentDate: o.deliveryDate,
          notes: "Initial payment",
          createdAt: o.createdAt,
        } satisfies Payment
      : null;

    if (initialPayment) {
      setPayments(prev => [...prev, initialPayment]);
    }

    const writes = [writeSheet("insert", "Orders", o)];
    if (initialPayment) {
      writes.push(writeSheet("insert", "Payments", initialPayment));
    }
    void refreshAfterWrite(writes);
    return o;
  }, [products, refreshAfterWrite, writeSheet]);

  const updateOrder = useCallback((o: Order) => {
    const linkedPayments = payments.filter(payment => payment.orderId === o.id);
    const linkedPaid = linkedPayments.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
    const updatedOrder = normalizeOrderAmounts(o, linkedPayments, products);
    const missingPaidAmount = Math.max(0, updatedOrder.paidAmount - linkedPaid);

    setOrders(prev => prev.map(x => x.id === updatedOrder.id ? updatedOrder : x));
    const writes = [writeSheet("update", "Orders", updatedOrder)];

    if (missingPaidAmount > 0) {
      const adjustmentPayment: Payment = {
        id: genId(),
        orderId: updatedOrder.id,
        clientId: updatedOrder.clientId,
        clientName: updatedOrder.clientName,
        orderDescription: updatedOrder.quantity > 1 ? `${updatedOrder.productName} x${updatedOrder.quantity}` : updatedOrder.productName,
        amount: missingPaidAmount,
        method: "Other",
        paymentDate: updatedOrder.deliveryDate || today(),
        notes: "Payment added from order edit",
        createdAt: now(),
      };
      setPayments(prev => [...prev, adjustmentPayment]);
      writes.push(writeSheet("insert", "Payments", adjustmentPayment));
    }
    void refreshAfterWrite(writes);
  }, [payments, products, refreshAfterWrite, writeSheet]);

  const deleteOrder = useCallback((id: string) => {
    const order = orders.find(x => x.id === id);
    const linkedPayments = payments.filter(payment => payment.orderId === id);
    if (order) {
      setLastDeleted({ label: `${order.clientName} - ${order.productName}`, sheet: "Orders", data: order, linkedPayments });
    }
    deletedIdsRef.current.Orders.add(id);
    setOrders(prev => prev.filter(x => x.id !== id));
    linkedPayments.forEach(payment => deletedIdsRef.current.Payments.add(payment.id));
    setPayments(prev => {
      return prev.filter(payment => payment.orderId !== id);
    });
    void refreshAfterWrite([
      writeSheet("delete", "Orders", { id }),
      ...linkedPayments.map(payment => writeSheet("delete", "Payments", { id: payment.id })),
    ]);
  }, [orders, payments, refreshAfterWrite, writeSheet]);

  const addPayment = useCallback((data: Omit<Payment, "id" | "createdAt">): Payment => {
    const p = { ...data, id: genId(), createdAt: now() };
    const order = orders.find(o => o.id === data.orderId);
    const updatedOrder = order ? normalizeOrderAmounts({ ...order, paidAmount: order.paidAmount + data.amount }, [], products) : null;
    setPayments(prev => [...prev, p]);
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    }
    const writes = [writeSheet("insert", "Payments", p)];
    if (updatedOrder) writes.push(writeSheet("update", "Orders", updatedOrder));
    void refreshAfterWrite(writes);
    return p;
  }, [orders, products, refreshAfterWrite, writeSheet]);

  const updatePayment = useCallback((p: Payment) => {
    const nextPayments = payments.map(x => x.id === p.id ? p : x);
    const writes = [writeSheet("update", "Payments", p)];
    const nextOrders = orders.map(order => {
      const hasCurrentPayment = nextPayments.some(payment => payment.id === p.id && payment.orderId === order.id);
      const hadPreviousPayment = payments.some(payment => payment.id === p.id && payment.orderId === order.id);
      if (!hasCurrentPayment && !hadPreviousPayment) return order;
      const linkedPayments = nextPayments.filter(payment => payment.orderId === order.id);
      const paidAmount = linkedPayments.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
      const updated = normalizeOrderAmounts({ ...order, paidAmount }, linkedPayments, products);
      writes.push(writeSheet("update", "Orders", updated));
      return updated;
    });
    setPayments(nextPayments);
    setOrders(nextOrders);
    void refreshAfterWrite(writes);
  }, [orders, payments, products, refreshAfterWrite, writeSheet]);

  const deletePayment = useCallback((id: string) => {
    deletedIdsRef.current.Payments.add(id);
    const payment = payments.find(p => p.id === id);
    if (payment) {
      setLastDeleted({ label: `${payment.clientName} payment`, sheet: "Payments", data: payment });
    }
    const remainingPayments = payments.filter(p => p.id !== id);
    const writes = [writeSheet("delete", "Payments", { id })];

    setPayments(remainingPayments);
    if (payment) {
      const linkedPayments = remainingPayments.filter(p => p.orderId === payment.orderId);
      const newPaid = linkedPayments.reduce((sum, p) => sum + p.amount, 0);
      const order = orders.find(o => o.id === payment.orderId);
      if (order) {
        const updatedOrder = normalizeOrderAmounts({ ...order, paidAmount: newPaid }, linkedPayments, products);
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        writes.push(writeSheet("update", "Orders", updatedOrder));
      }
    }

    void refreshAfterWrite(writes);
  }, [orders, payments, products, refreshAfterWrite, writeSheet]);

  const addExpense = useCallback((data: Omit<Expense, "id" | "createdAt">): Expense => {
    const e = { ...data, id: genId(), createdAt: now() };
    setExpenses(prev => [...prev, e]);
    void refreshAfterWrite(writeSheet("insert", "Expenses", e));
    return e;
  }, [refreshAfterWrite, writeSheet]);

  const updateExpense = useCallback((e: Expense) => {
    setExpenses(prev => prev.map(x => x.id === e.id ? e : x));
    void refreshAfterWrite(writeSheet("update", "Expenses", e));
  }, [refreshAfterWrite, writeSheet]);

  const deleteExpense = useCallback((id: string) => {
    const expense = expenses.find(x => x.id === id);
    if (expense) {
      setLastDeleted({ label: expense.title || "expense", sheet: "Expenses", data: expense });
    }
    deletedIdsRef.current.Expenses.add(id);
    setExpenses(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(writeSheet("delete", "Expenses", { id }));
  }, [expenses, refreshAfterWrite, writeSheet]);

  const addPersonalExpense = useCallback((data: Omit<PersonalExpense, "id" | "createdAt">): PersonalExpense => {
    const e = { ...data, id: genId(), createdAt: now() };
    setPersonalExpenses(prev => [...prev, e]);
    void refreshAfterWrite(writeSheet("insert", "PersonalExpenses", e));
    return e;
  }, [refreshAfterWrite, writeSheet]);

  const updatePersonalExpense = useCallback((e: PersonalExpense) => {
    setPersonalExpenses(prev => prev.map(x => x.id === e.id ? e : x));
    void refreshAfterWrite(writeSheet("update", "PersonalExpenses", e));
  }, [refreshAfterWrite, writeSheet]);

  const deletePersonalExpense = useCallback((id: string) => {
    const expense = personalExpenses.find(x => x.id === id);
    if (expense) {
      setLastDeleted({ label: expense.title || "personal cost", sheet: "PersonalExpenses", data: expense });
    }
    deletedIdsRef.current.PersonalExpenses.add(id);
    setPersonalExpenses(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(writeSheet("delete", "PersonalExpenses", { id }));
  }, [personalExpenses, refreshAfterWrite, writeSheet]);

  const renewOrder = useCallback((id: string): Order | null => {
    const source = orders.find(order => order.id === id);
    if (!source || source.orderStatus === "Cancelled") return null;
    if (source.renewedToOrderId) {
      return orders.find(order => order.id === source.renewedToOrderId) ?? null;
    }

    const product = findOrderProduct(source, products);
    const deliveryDate = today();
    const renewedAt = now();
    const totalAmount = getProductOrderTotal(source, products) || source.totalAmount;
    const nextOrderId = genId();
    const renewedSource = {
      ...source,
      orderStatus: "Renewed" as const,
      renewedAt,
      renewedToOrderId: nextOrderId,
    };
    const nextOrder = normalizeOrderAmounts({
      ...source,
      id: nextOrderId,
      deliveryDate,
      expiryDate: addDays(deliveryDate, product?.durationDays ?? 30),
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      paymentStatus: "Unpaid",
      orderStatus: "Pending",
      renewedFromOrderId: source.id,
      renewedToOrderId: undefined,
      renewedAt: undefined,
      notes: source.notes ? `Renewal of ${source.id}. ${source.notes}` : `Renewal of ${source.id}`,
      createdAt: renewedAt,
    }, [], products);

    setOrders(prev => prev.map(order => order.id === source.id ? renewedSource : order).concat(nextOrder));
    void refreshAfterWrite([
      writeSheet("update", "Orders", renewedSource),
      writeSheet("insert", "Orders", nextOrder),
    ]);
    return nextOrder;
  }, [orders, products, refreshAfterWrite, writeSheet]);

  const exportData = useCallback((): DataSnapshot => ({
    version: 1,
    exportedAt: now(),
    clients,
    products,
    orders,
    payments,
    expenses,
    personalExpenses,
  }), [clients, products, orders, payments, expenses, personalExpenses]);

  const importData = useCallback((snapshot: unknown) => {
    if (!isDataSnapshot(snapshot)) return false;

    const nextClients = toArray<Client>(snapshot.clients);
    const nextProducts = toArray<Product>(snapshot.products);
    const nextPayments = toArray<Payment>(snapshot.payments);
    const nextOrders = normalizeOrders(toArray<Order>(snapshot.orders), nextPayments, nextProducts);
    const nextExpenses = toArray<Expense>(snapshot.expenses);
    const nextPersonalExpenses = toArray<PersonalExpense>(snapshot.personalExpenses);

    deletedIdsRef.current = createSheetIdSets();
    setLastDeleted(null);
    setClients(nextClients);
    setProducts(nextProducts);
    setPayments(nextPayments);
    setOrders(nextOrders);
    setExpenses(nextExpenses);
    setPersonalExpenses(nextPersonalExpenses);

    void refreshAfterWrite(writeAllSheets({
      Clients: nextClients,
      Products: nextProducts,
      Orders: nextOrders,
      Payments: nextPayments,
      Expenses: nextExpenses,
      PersonalExpenses: nextPersonalExpenses,
    }));
    return true;
  }, [refreshAfterWrite, writeAllSheets]);

  const undoLastDelete = useCallback(() => {
    if (!lastDeleted) return false;

    const writes: Promise<unknown>[] = [];

    if (lastDeleted.sheet === "Clients") {
      deletedIdsRef.current.Clients.delete(lastDeleted.data.id);
      setClients(prev => prev.some(item => item.id === lastDeleted.data.id) ? prev : [...prev, lastDeleted.data]);
      writes.push(writeSheet("insert", "Clients", lastDeleted.data));
    }

    if (lastDeleted.sheet === "Products") {
      deletedIdsRef.current.Products.delete(lastDeleted.data.id);
      setProducts(prev => prev.some(item => item.id === lastDeleted.data.id) ? prev : [...prev, lastDeleted.data]);
      writes.push(writeSheet("insert", "Products", lastDeleted.data));
    }

    if (lastDeleted.sheet === "Orders") {
      deletedIdsRef.current.Orders.delete(lastDeleted.data.id);
      lastDeleted.linkedPayments.forEach(payment => deletedIdsRef.current.Payments.delete(payment.id));
      setOrders(prev => prev.some(item => item.id === lastDeleted.data.id) ? prev : [...prev, lastDeleted.data]);
      setPayments(prev => {
        const existing = new Set(prev.map(payment => payment.id));
        return [...prev, ...lastDeleted.linkedPayments.filter(payment => !existing.has(payment.id))];
      });
      writes.push(writeSheet("insert", "Orders", lastDeleted.data));
      lastDeleted.linkedPayments.forEach(payment => writes.push(writeSheet("insert", "Payments", payment)));
    }

    if (lastDeleted.sheet === "Payments") {
      const payment = lastDeleted.data;
      deletedIdsRef.current.Payments.delete(payment.id);
      const linkedPayments = [...payments.filter(item => item.orderId === payment.orderId), payment];
      const paidAmount = linkedPayments.reduce((sum, item) => sum + toMoney(item.amount), 0);
      const order = orders.find(item => item.id === payment.orderId);
      const updatedOrder = order ? normalizeOrderAmounts({ ...order, paidAmount }, linkedPayments, products) : null;

      setPayments(prev => prev.some(item => item.id === payment.id) ? prev : [...prev, payment]);
      if (updatedOrder) {
        setOrders(prev => prev.map(item => item.id === updatedOrder.id ? updatedOrder : item));
      }

      writes.push(writeSheet("insert", "Payments", payment));
      if (updatedOrder) writes.push(writeSheet("update", "Orders", updatedOrder));
    }

    if (lastDeleted.sheet === "Expenses") {
      deletedIdsRef.current.Expenses.delete(lastDeleted.data.id);
      setExpenses(prev => prev.some(item => item.id === lastDeleted.data.id) ? prev : [...prev, lastDeleted.data]);
      writes.push(writeSheet("insert", "Expenses", lastDeleted.data));
    }

    if (lastDeleted.sheet === "PersonalExpenses") {
      deletedIdsRef.current.PersonalExpenses.delete(lastDeleted.data.id);
      setPersonalExpenses(prev => prev.some(item => item.id === lastDeleted.data.id) ? prev : [...prev, lastDeleted.data]);
      writes.push(writeSheet("insert", "PersonalExpenses", lastDeleted.data));
    }

    setLastDeleted(null);
    void refreshAfterWrite(writes);
    return true;
  }, [lastDeleted, orders, payments, products, refreshAfterWrite, writeSheet]);

  return (
    <DataContext.Provider value={{
      clients, products, orders, payments, expenses, personalExpenses,
      addClient, updateClient, deleteClient,
      addProduct, updateProduct, deleteProduct,
      addOrder, updateOrder, deleteOrder,
      addPayment, updatePayment, deletePayment,
      addExpense, updateExpense, deleteExpense,
      addPersonalExpense, updatePersonalExpense, deletePersonalExpense,
      renewOrder,
      exportData, importData,
      undoLastDelete, lastDeletedLabel: lastDeleted?.label ?? null,
      syncNow, isSyncing, lastSynced, lastSyncError, isSheetSyncEnabled: canUseSheets,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

export { addDays, today };
