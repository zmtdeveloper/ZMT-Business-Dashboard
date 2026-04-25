import { createContext, useContext, useState, useEffect, useCallback } from "react";
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

  const orders = (payload.Orders ?? []).map((row: any): Order => ({
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
  const [orders, setOrders] = useState<Order[]>(() => load("zmt_orders", []));
  const [payments, setPayments] = useState<Payment[]>(() => load("zmt_payments", []));
  const [expenses, setExpenses] = useState<Expense[]>(() => load("zmt_expenses", []));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const applySheetPayload = useCallback((payload: SheetPayload) => {
    const normalized = normalizeSheetPayload(payload);
    setClients(normalized.clients);
    setProducts(normalized.products);
    setOrders(normalized.orders);
    setPayments(normalized.payments);
    setExpenses(normalized.expenses);
    setLastSynced(new Date());
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSheetsConfigured) return;
    setIsSyncing(true);
    try {
      const payload = await loadAllFromSheets();
      if (payload) applySheetPayload(payload);
    } finally {
      setIsSyncing(false);
    }
  }, [applySheetPayload]);

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
    syncToSheets("insert", "Clients", c);
    return c;
  }, []);

  const updateClient = useCallback((c: Client) => {
    setClients(prev => prev.map(x => x.id === c.id ? c : x));
    syncToSheets("update", "Clients", c);
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(x => x.id !== id));
    syncToSheets("delete", "Clients", { id });
  }, []);

  const addProduct = useCallback((data: Omit<Product, "id" | "createdAt">): Product => {
    const p = { ...data, id: genId(), createdAt: now() };
    setProducts(prev => [...prev, p]);
    syncToSheets("insert", "Products", p);
    return p;
  }, []);

  const updateProduct = useCallback((p: Product) => {
    setProducts(prev => prev.map(x => x.id === p.id ? p : x));
    syncToSheets("update", "Products", p);
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(x => x.id !== id));
    syncToSheets("delete", "Products", { id });
  }, []);

  const addOrder = useCallback((data: Omit<Order, "id" | "createdAt">, initialPaymentMethod: Payment["method"] = "Cash"): Order => {
    const o = { ...data, id: genId(), createdAt: now() };
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

    syncToSheets("insert", "Orders", o).then(() => {
      if (initialPayment) {
        syncToSheets("insert", "Payments", initialPayment);
      }
    });
    return o;
  }, []);

  const updateOrder = useCallback((o: Order) => {
    setOrders(prev => prev.map(x => x.id === o.id ? o : x));
    syncToSheets("update", "Orders", o);
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setOrders(prev => prev.filter(x => x.id !== id));
    syncToSheets("delete", "Orders", { id });
  }, []);

  const addPayment = useCallback((data: Omit<Payment, "id" | "createdAt">): Payment => {
    const p = { ...data, id: genId(), createdAt: now() };
    setPayments(prev => [...prev, p]);
    // Update the linked order's paid/remaining amounts
    setOrders(prev => prev.map(o => {
      if (o.id !== data.orderId) return o;
      const newPaid = o.paidAmount + data.amount;
      const newRemaining = Math.max(0, o.totalAmount - newPaid);
      const newStatus: Order["paymentStatus"] = newRemaining === 0 ? "Paid" : newPaid > 0 ? "Partial" : "Unpaid";
      const updated = { ...o, paidAmount: newPaid, remainingAmount: newRemaining, paymentStatus: newStatus };
      syncToSheets("update", "Orders", updated);
      return updated;
    }));
    syncToSheets("insert", "Payments", p);
    return p;
  }, []);

  const updatePayment = useCallback((p: Payment) => {
    setPayments(prev => prev.map(x => x.id === p.id ? p : x));
    syncToSheets("update", "Payments", p);
  }, []);

  const deletePayment = useCallback((id: string) => {
    setPayments(prev => {
      const payment = prev.find(p => p.id === id);
      if (payment) {
        const remainingPayments = prev.filter(p => p.id !== id && p.orderId === payment.orderId);
        const newPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
        setOrders(orList => orList.map(o => {
          if (o.id !== payment.orderId) return o;
          const newRemaining = Math.max(0, o.totalAmount - newPaid);
          const newStatus: Order["paymentStatus"] = newRemaining === 0 ? "Paid" : newPaid > 0 ? "Partial" : "Unpaid";
          const updated = { ...o, paidAmount: newPaid, remainingAmount: newRemaining, paymentStatus: newStatus };
          syncToSheets("update", "Orders", updated);
          return updated;
        }));
      }
      return prev.filter(x => x.id !== id);
    });
    syncToSheets("delete", "Payments", { id });
  }, []);

  const addExpense = useCallback((data: Omit<Expense, "id" | "createdAt">): Expense => {
    const e = { ...data, id: genId(), createdAt: now() };
    setExpenses(prev => [...prev, e]);
    syncToSheets("insert", "Expenses", e);
    return e;
  }, []);

  const updateExpense = useCallback((e: Expense) => {
    setExpenses(prev => prev.map(x => x.id === e.id ? e : x));
    syncToSheets("update", "Expenses", e);
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(x => x.id !== id));
    syncToSheets("delete", "Expenses", { id });
  }, []);

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
