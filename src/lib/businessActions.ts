import type { Client, Order, Payment } from "@/context/DataContext";
import { formatCurrency, formatDate } from "@/lib/format";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return digits;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getWhatsAppReminderHref(order: Order, client?: Client) {
  const phone = normalizePhone(client?.phone || "");
  const text = [
    `Assalam o Alaikum ${order.clientName},`,
    `Your payment for ${order.productName} is pending.`,
    `Total: ${formatCurrency(order.totalAmount)}`,
    `Paid: ${formatCurrency(order.paidAmount)}`,
    `Remaining: ${formatCurrency(order.remainingAmount)}`,
    "Please confirm when you can clear it. Thank you.",
  ].join("\n");

  const encoded = encodeURIComponent(text);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function openWhatsAppReminder(order: Order, client?: Client) {
  window.open(getWhatsAppReminderHref(order, client), "_blank", "noopener,noreferrer");
}

export function getWhatsAppRenewalHref(order: Order, client?: Client) {
  const phone = normalizePhone(client?.phone || "");
  const text = [
    `Assalam o Alaikum ${order.clientName},`,
    `Your ${order.productName} service ${new Date(order.expiryDate) < new Date() ? "has expired" : "is due for renewal soon"}.`,
    `Expiry: ${formatDate(order.expiryDate)}`,
    `Renewal amount: ${formatCurrency(order.totalAmount)}`,
    "Please confirm if you want to renew it. Thank you.",
  ].join("\n");

  const encoded = encodeURIComponent(text);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function openWhatsAppRenewalReminder(order: Order, client?: Client) {
  window.open(getWhatsAppRenewalHref(order, client), "_blank", "noopener,noreferrer");
}

function printHtml(title: string, body: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;

  win.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0891b2; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 24px; font-weight: 800; color: #075985; }
    .muted { color: #64748b; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #ecfeff; color: #075985; font-size: 13px; }
    .totals { margin-left: auto; margin-top: 24px; width: 320px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .strong { font-weight: 800; }
    @media print { button { display: none; } body { margin: 18mm; } }
  </style>
</head>
<body>
  ${body}
  <button onclick="window.print()" style="margin-top:24px;padding:10px 14px;border:0;border-radius:6px;background:#0891b2;color:white;font-weight:700;cursor:pointer;">Print / Save PDF</button>
</body>
</html>`);
  win.document.close();
  win.focus();
}

export function printOrderInvoice(order: Order, payments: Payment[] = []) {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0) || order.paidAmount;
  const remaining = Math.max(0, order.totalAmount - paid);

  printHtml(`Invoice ${order.id}`, `
    <div class="header">
      <div>
        <div class="brand">ZMT Business</div>
        <div class="muted">Invoice / Order Statement</div>
      </div>
      <div>
        <div class="strong">Invoice: ${escapeHtml(order.id)}</div>
        <div class="muted">Date: ${escapeHtml(formatDate(order.deliveryDate))}</div>
        <div class="muted">Status: ${escapeHtml(order.paymentStatus)}</div>
      </div>
    </div>
    <div>
      <div class="strong">Bill To</div>
      <div>${escapeHtml(order.clientName)}</div>
    </div>
    <table>
      <thead><tr><th>Product</th><th>Quantity</th><th>Expiry</th><th>Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>${escapeHtml(order.productName)}</td>
          <td>${order.quantity}</td>
          <td>${escapeHtml(formatDate(order.expiryDate))}</td>
          <td>${escapeHtml(formatCurrency(order.totalAmount))}</td>
        </tr>
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Total</span><span>${escapeHtml(formatCurrency(order.totalAmount))}</span></div>
      <div class="row"><span>Paid</span><span>${escapeHtml(formatCurrency(paid))}</span></div>
      <div class="row strong"><span>Remaining</span><span>${escapeHtml(formatCurrency(remaining))}</span></div>
    </div>
  `);
}

export function printPaymentReceipt(payment: Payment) {
  printHtml(`Receipt ${payment.id}`, `
    <div class="header">
      <div>
        <div class="brand">ZMT Business</div>
        <div class="muted">Payment Receipt</div>
      </div>
      <div>
        <div class="strong">Receipt: ${escapeHtml(payment.id)}</div>
        <div class="muted">Date: ${escapeHtml(formatDate(payment.paymentDate))}</div>
      </div>
    </div>
    <table>
      <tbody>
        <tr><th>Client</th><td>${escapeHtml(payment.clientName)}</td></tr>
        <tr><th>Order</th><td>${escapeHtml(payment.orderDescription)}</td></tr>
        <tr><th>Amount</th><td>${escapeHtml(formatCurrency(payment.amount))}</td></tr>
        <tr><th>Method</th><td>${escapeHtml(payment.method)}</td></tr>
        <tr><th>Notes</th><td>${escapeHtml(payment.notes || "-")}</td></tr>
      </tbody>
    </table>
  `);
}
