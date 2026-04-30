import type { Order, Payment, Product } from "@/context/DataContext";
import { getMonthKey } from "@/lib/format";

const toAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const isActiveOrder = (order: Order) => order.orderStatus !== "Cancelled";

const getOrderDate = (order: Order) => order.deliveryDate || order.createdAt;

const isOrderInMonth = (order: Order, monthKey: string) =>
  getMonthKey(getOrderDate(order)) === monthKey;

const getOrderTotal = (order: Order) =>
  Math.max(toAmount(order.totalAmount), toAmount(order.paidAmount));

const getOrderPaid = (order: Order) =>
  Math.min(toAmount(order.paidAmount), getOrderTotal(order));

export function getSalesForMonth(orders: Order[], monthKey: string) {
  return orders
    .filter(order => isActiveOrder(order) && isOrderInMonth(order, monthKey))
    .reduce((sum, order) => sum + getOrderTotal(order), 0);
}

export function getSalesTotal(orders: Order[]) {
  return orders
    .filter(isActiveOrder)
    .reduce((sum, order) => sum + getOrderTotal(order), 0);
}

export function getReceivedForMonth(orders: Order[], _payments: Payment[], monthKey: string) {
  return orders
    .filter(order => isActiveOrder(order) && isOrderInMonth(order, monthKey))
    .reduce((sum, order) => sum + getOrderPaid(order), 0);
}

export function getReceivedTotal(orders: Order[], _payments: Payment[]) {
  return orders
    .filter(isActiveOrder)
    .reduce((sum, order) => sum + getOrderPaid(order), 0);
}

export function getPendingForMonth(orders: Order[], monthKey: string) {
  return orders
    .filter(order => isActiveOrder(order) && isOrderInMonth(order, monthKey))
    .reduce((sum, order) => sum + Math.max(0, getOrderTotal(order) - getOrderPaid(order)), 0);
}

export function getPendingTotal(orders: Order[]) {
  return orders
    .filter(isActiveOrder)
    .reduce((sum, order) => sum + Math.max(0, getOrderTotal(order) - getOrderPaid(order)), 0);
}

export function getOrderCost(order: Order, products: Product[]) {
  if (order.orderStatus === "Cancelled") return 0;
  const product = products.find(item => item.id === order.productId) ??
    products.find(item => item.name.toLowerCase() === order.productName.toLowerCase());
  return toAmount(product?.costPrice) * Math.max(1, Number(order.quantity) || 1);
}

export function getOrderCostsForMonth(orders: Order[], products: Product[], monthKey: string) {
  return orders
    .filter(order => getMonthKey(order.deliveryDate || order.createdAt) === monthKey)
    .reduce((sum, order) => sum + getOrderCost(order, products), 0);
}

export function getOrderCostsTotal(orders: Order[], products: Product[]) {
  return orders.reduce((sum, order) => sum + getOrderCost(order, products), 0);
}
