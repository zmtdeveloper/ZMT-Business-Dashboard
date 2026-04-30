import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { isSheetsConfigured, loadAllFromSheets, syncToSheets } from "@/services/sheetsSync";

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

interface DataContextType {
  clients: Client[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  expenses: Expense[];
  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (c: Client) => void;
  deleteClient: (id: string) => void;
  addProduct: (p: Omit<Product, "id" | "createdAt">) => Product;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  addOrder: (o: Omit<Order, "id" | "createdAt">, initialPaymentMethod?: Payment["method"]) => Order;
  updateOrder: (o: Order) => void;
  deleteOrder: (id: string) => void;
  addPayment: (p: Omit<Payment, "id" | "createdAt">) => Payment;
  updatePayment: (p: Payment) => void;
  deletePayment: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Expense;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  lastSynced: Date | null;
}

const DataContext = createContext<DataContextType | null>(null);

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

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const toText = (value: unknown, fallback = "") => String(value ?? fallback);

const toNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
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

function createSheetIdSets() {
  return {
    Clients: new Set<string>(),
    Products: new Set<string>(),
    Orders: new Set<string>(),
    Payments: new Set<string>(),
    Expenses: new Set<string>(),
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

const SHEET_NAMES = ["Clients", "Products", "Orders", "Payments", "Expenses"] as const;
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

  return { clients, products, orders, payments, expenses };
}

function seedIfEmpty() {
  if (!localStorage.getItem("zmt_clients")) save("zmt_clients", SEED_CLIENTS);
  if (!localStorage.getItem("zmt_products")) save("zmt_products", SEED_PRODUCTS);
  if (!localStorage.getItem("zmt_orders")) save("zmt_orders", SEED_ORDERS);
  if (!localStorage.getItem("zmt_payments")) save("zmt_payments", SEED_PAYMENTS);
  if (!localStorage.getItem("zmt_expenses")) save("zmt_expenses", SEED_EXPENSES);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  seedIfEmpty();

  const [clients, setClients] = useState<Client[]>(() => load("zmt_clients", []));
  const [products, setProducts] = useState<Product[]>(() => load("zmt_products", []));
  const [payments, setPayments] = useState<Payment[]>(() => load<Payment>("zmt_payments", []));
  const [orders, setOrders] = useState<Order[]>(() =>
    normalizeOrders(load<Order>("zmt_orders", []), load<Payment>("zmt_payments", []), load<Product>("zmt_products", []))
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => load("zmt_expenses", []));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const deletedIdsRef = useRef(createSheetIdSets());

  const applySheetPayload = useCallback((payload: SheetPayload, preserveLocal = false) => {
    const normalized = normalizeSheetPayload(payload);
    if (preserveLocal) {
      setClients(prev => mergeRowsById(normalized.clients, prev, deletedIdsRef.current.Clients));
      setProducts(prev => mergeRowsById(normalized.products, prev, deletedIdsRef.current.Products));
      setOrders(prev => mergeRowsById(normalized.orders, prev, deletedIdsRef.current.Orders));
      setPayments(prev => mergeRowsById(normalized.payments, prev, deletedIdsRef.current.Payments));
      setExpenses(prev => mergeRowsById(normalized.expenses, prev, deletedIdsRef.current.Expenses));
    } else {
      setClients(normalized.clients.filter(row => !deletedIdsRef.current.Clients.has(row.id)));
      setProducts(normalized.products.filter(row => !deletedIdsRef.current.Products.has(row.id)));
      setOrders(normalized.orders.filter(row => !deletedIdsRef.current.Orders.has(row.id)));
      setPayments(normalized.payments.filter(row => !deletedIdsRef.current.Payments.has(row.id)));
      setExpenses(normalized.expenses.filter(row => !deletedIdsRef.current.Expenses.has(row.id)));
    }
    setLastSynced(new Date());
  }, []);

  const refreshFromSheets = useCallback(async (preserveLocal = false) => {
    if (!isSheetsConfigured) return;
    const payload = await loadAllFromSheets();
    if (payload) applySheetPayload(payload, preserveLocal);
  }, [applySheetPayload]);

  const syncNow = useCallback(async () => {
    if (!isSheetsConfigured) return;
    setIsSyncing(true);
    try {
      await refreshFromSheets(false);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshFromSheets]);

  const refreshAfterWrite = useCallback(async (writes: Promise<unknown> | Promise<unknown>[]) => {
    if (!isSheetsConfigured) return;
    setIsSyncing(true);
    try {
      const results = await Promise.all(Array.isArray(writes) ? writes : [writes]);
      if (results.every(isSuccessfulSyncResult)) {
        await refreshFromSheets(true);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [refreshFromSheets]);

  useEffect(() => { save("zmt_clients", clients); }, [clients]);
  useEffect(() => { save("zmt_products", products); }, [products]);
  useEffect(() => { save("zmt_orders", orders); }, [orders]);
  useEffect(() => { save("zmt_payments", payments); }, [payments]);
  useEffect(() => { save("zmt_expenses", expenses); }, [expenses]);

  useEffect(() => {
    if (!isSheetsConfigured) return;
    syncNow();
  }, [syncNow]);

  const addClient = useCallback((data: Omit<Client, "id" | "createdAt">): Client => {
    const c = { ...data, id: genId(), createdAt: now() };
    setClients(prev => [...prev, c]);
    void refreshAfterWrite(syncToSheets("insert", "Clients", c));
    return c;
  }, [refreshAfterWrite]);

  const updateClient = useCallback((c: Client) => {
    setClients(prev => prev.map(x => x.id === c.id ? c : x));
    void refreshAfterWrite(syncToSheets("update", "Clients", c));
  }, [refreshAfterWrite]);

  const deleteClient = useCallback((id: string) => {
    deletedIdsRef.current.Clients.add(id);
    setClients(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(syncToSheets("delete", "Clients", { id }));
  }, [refreshAfterWrite]);

  const addProduct = useCallback((data: Omit<Product, "id" | "createdAt">): Product => {
    const p = { ...data, id: genId(), createdAt: now() };
    setProducts(prev => [...prev, p]);
    void refreshAfterWrite(syncToSheets("insert", "Products", p));
    return p;
  }, [refreshAfterWrite]);

  const updateProduct = useCallback((p: Product) => {
    setProducts(prev => prev.map(x => x.id === p.id ? p : x));
    void refreshAfterWrite(syncToSheets("update", "Products", p));
  }, [refreshAfterWrite]);

  const deleteProduct = useCallback((id: string) => {
    deletedIdsRef.current.Products.add(id);
    setProducts(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(syncToSheets("delete", "Products", { id }));
  }, [refreshAfterWrite]);

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

    const writes = [syncToSheets("insert", "Orders", o)];
    if (initialPayment) {
      writes.push(syncToSheets("insert", "Payments", initialPayment));
    }
    void refreshAfterWrite(writes);
    return o;
  }, [products, refreshAfterWrite]);

  const updateOrder = useCallback((o: Order) => {
    const linkedPayments = payments.filter(payment => payment.orderId === o.id);
    const linkedPaid = linkedPayments.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
    const updatedOrder = normalizeOrderAmounts(o, linkedPayments, products);
    const missingPaidAmount = Math.max(0, updatedOrder.paidAmount - linkedPaid);

    setOrders(prev => prev.map(x => x.id === updatedOrder.id ? updatedOrder : x));
    const writes = [syncToSheets("update", "Orders", updatedOrder)];

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
      writes.push(syncToSheets("insert", "Payments", adjustmentPayment));
    }
    void refreshAfterWrite(writes);
  }, [payments, products, refreshAfterWrite]);

  const deleteOrder = useCallback((id: string) => {
    deletedIdsRef.current.Orders.add(id);
    setOrders(prev => prev.filter(x => x.id !== id));
    const linkedPayments = payments.filter(payment => payment.orderId === id);
    linkedPayments.forEach(payment => deletedIdsRef.current.Payments.add(payment.id));
    setPayments(prev => {
      return prev.filter(payment => payment.orderId !== id);
    });
    void refreshAfterWrite([
      syncToSheets("delete", "Orders", { id }),
      ...linkedPayments.map(payment => syncToSheets("delete", "Payments", { id: payment.id })),
    ]);
  }, [payments, refreshAfterWrite]);

  const addPayment = useCallback((data: Omit<Payment, "id" | "createdAt">): Payment => {
    const p = { ...data, id: genId(), createdAt: now() };
    const order = orders.find(o => o.id === data.orderId);
    const updatedOrder = order ? normalizeOrderAmounts({ ...order, paidAmount: order.paidAmount + data.amount }, [], products) : null;
    setPayments(prev => [...prev, p]);
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    }
    const writes = [syncToSheets("insert", "Payments", p)];
    if (updatedOrder) writes.push(syncToSheets("update", "Orders", updatedOrder));
    void refreshAfterWrite(writes);
    return p;
  }, [orders, products, refreshAfterWrite]);

  const updatePayment = useCallback((p: Payment) => {
    const nextPayments = payments.map(x => x.id === p.id ? p : x);
    const writes = [syncToSheets("update", "Payments", p)];
    const nextOrders = orders.map(order => {
      const hasCurrentPayment = nextPayments.some(payment => payment.id === p.id && payment.orderId === order.id);
      const hadPreviousPayment = payments.some(payment => payment.id === p.id && payment.orderId === order.id);
      if (!hasCurrentPayment && !hadPreviousPayment) return order;
      const linkedPayments = nextPayments.filter(payment => payment.orderId === order.id);
      const paidAmount = linkedPayments.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
      const updated = normalizeOrderAmounts({ ...order, paidAmount }, linkedPayments, products);
      writes.push(syncToSheets("update", "Orders", updated));
      return updated;
    });
    setPayments(nextPayments);
    setOrders(nextOrders);
    void refreshAfterWrite(writes);
  }, [orders, payments, products, refreshAfterWrite]);

  const deletePayment = useCallback((id: string) => {
    deletedIdsRef.current.Payments.add(id);
    const payment = payments.find(p => p.id === id);
    const remainingPayments = payments.filter(p => p.id !== id);
    const writes = [syncToSheets("delete", "Payments", { id })];

    setPayments(remainingPayments);
    if (payment) {
      const linkedPayments = remainingPayments.filter(p => p.orderId === payment.orderId);
      const newPaid = linkedPayments.reduce((sum, p) => sum + p.amount, 0);
      const order = orders.find(o => o.id === payment.orderId);
      if (order) {
        const updatedOrder = normalizeOrderAmounts({ ...order, paidAmount: newPaid }, linkedPayments, products);
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        writes.push(syncToSheets("update", "Orders", updatedOrder));
      }
    }

    void refreshAfterWrite(writes);
  }, [orders, payments, products, refreshAfterWrite]);

  const addExpense = useCallback((data: Omit<Expense, "id" | "createdAt">): Expense => {
    const e = { ...data, id: genId(), createdAt: now() };
    setExpenses(prev => [...prev, e]);
    void refreshAfterWrite(syncToSheets("insert", "Expenses", e));
    return e;
  }, [refreshAfterWrite]);

  const updateExpense = useCallback((e: Expense) => {
    setExpenses(prev => prev.map(x => x.id === e.id ? e : x));
    void refreshAfterWrite(syncToSheets("update", "Expenses", e));
  }, [refreshAfterWrite]);

  const deleteExpense = useCallback((id: string) => {
    deletedIdsRef.current.Expenses.add(id);
    setExpenses(prev => prev.filter(x => x.id !== id));
    void refreshAfterWrite(syncToSheets("delete", "Expenses", { id }));
  }, [refreshAfterWrite]);

  return (
    <DataContext.Provider value={{
      clients, products, orders, payments, expenses,
      addClient, updateClient, deleteClient,
      addProduct, updateProduct, deleteProduct,
      addOrder, updateOrder, deleteOrder,
      addPayment, updatePayment, deletePayment,
      addExpense, updateExpense, deleteExpense,
      syncNow, isSyncing, lastSynced,
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
