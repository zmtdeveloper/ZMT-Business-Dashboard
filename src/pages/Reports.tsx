import { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { formatCurrency, formatDate, daysUntil, getMonthKey, getMonthLabel } from "@/lib/format";
import { getOrderCost, getOrderCostsForMonth, getPendingForMonth, getReceivedForMonth, getSalesForMonth } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, Wallet, Clock, AlertCircle, Users, PackageOpen, CreditCard } from "lucide-react";

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: getMonthLabel(key) });
  }
  return options;
}

export default function Reports() {
  const { orders, payments, expenses, products, personalExpenses } = useData();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const monthOptions = getMonthOptions();

  const monthExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.expenseDate) === selectedMonth), [expenses, selectedMonth]);
  const monthOrders = useMemo(() =>
    orders.filter(o => getMonthKey(o.deliveryDate) === selectedMonth && o.orderStatus !== "Cancelled"), [orders, selectedMonth]);
  const monthOrderCosts = useMemo(() =>
    getOrderCostsForMonth(orders, products, selectedMonth), [orders, products, selectedMonth]);

  const totalReceived = getReceivedForMonth(orders, payments, selectedMonth);
  const cashflowReceived = payments
    .filter(payment => getMonthKey(payment.paymentDate) === selectedMonth)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0) + monthOrderCosts;
  const monthPersonalCosts = personalExpenses
    .filter(expense => getMonthKey(expense.expenseDate) === selectedMonth)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const totalSales = getSalesForMonth(orders, selectedMonth);
  const totalPending = getPendingForMonth(orders, selectedMonth);
  const netProfit = totalReceived - totalExpenses;
  const actualSaving = cashflowReceived - totalExpenses - monthPersonalCosts;
  const paidOrderCount = monthOrders.filter(o => o.paidAmount > 0).length;

  const topProducts = useMemo(() => {
    const byProduct: Record<string, { name: string; revenue: number; profit: number; orders: number }> = {};
    monthOrders.forEach(o => {
      if (!byProduct[o.productId]) byProduct[o.productId] = { name: o.productName, revenue: 0, profit: 0, orders: 0 };
      byProduct[o.productId].revenue += o.totalAmount;
      byProduct[o.productId].profit += o.totalAmount - getOrderCost(o, products);
      byProduct[o.productId].orders += 1;
    });
    return Object.values(byProduct).sort((a, b) => b.profit - a.profit).slice(0, 5);
  }, [monthOrders, products]);

  const topClients = useMemo(() => {
    const byClient: Record<string, { name: string; revenue: number; orders: number }> = {};
    monthOrders.forEach(o => {
      if (!byClient[o.clientId]) byClient[o.clientId] = { name: o.clientName, revenue: 0, orders: 0 };
      byClient[o.clientId].revenue += o.totalAmount;
      byClient[o.clientId].orders += 1;
    });
    return Object.values(byClient).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [monthOrders]);

  const lifetimeClients = useMemo(() => {
    const byClient: Record<string, { name: string; revenue: number; paid: number; pending: number; orders: number }> = {};
    orders.filter(order => order.orderStatus !== "Cancelled").forEach(order => {
      if (!byClient[order.clientId]) byClient[order.clientId] = { name: order.clientName, revenue: 0, paid: 0, pending: 0, orders: 0 };
      byClient[order.clientId].revenue += order.totalAmount;
      byClient[order.clientId].paid += order.paidAmount;
      byClient[order.clientId].pending += order.remainingAmount;
      byClient[order.clientId].orders += 1;
    });
    return Object.values(byClient).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const pendingAging = useMemo(() => {
    const buckets = [
      { label: "0-7 days", min: 0, max: 7, amount: 0, count: 0 },
      { label: "8-30 days", min: 8, max: 30, amount: 0, count: 0 },
      { label: "31+ days", min: 31, max: Number.POSITIVE_INFINITY, amount: 0, count: 0 },
    ];

    orders
      .filter(order => order.orderStatus !== "Cancelled" && order.remainingAmount > 0)
      .forEach(order => {
        const age = Math.max(0, -daysUntil(order.deliveryDate));
        const bucket = buckets.find(item => age >= item.min && age <= item.max) ?? buckets[buckets.length - 1];
        bucket.amount += order.remainingAmount;
        bucket.count += 1;
      });

    return buckets;
  }, [orders]);

  const expiringOrders = useMemo(() =>
    orders.filter(o => {
      if (!o.expiryDate) return false;
      const days = daysUntil(o.expiryDate);
      return days <= 30 && o.orderStatus !== "Cancelled" && o.orderStatus !== "Renewed";
    }).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)),
    [orders]
  );

  const chartData = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map(mk => ({
      month: getMonthLabel(mk),
      sales: getSalesForMonth(orders, mk),
      received: getReceivedForMonth(orders, payments, mk),
      expenses: expenses.filter(e => getMonthKey(e.expenseDate) === mk).reduce((s, e) => s + e.amount, 0) + getOrderCostsForMonth(orders, products, mk),
      personal: personalExpenses.filter(e => getMonthKey(e.expenseDate) === mk).reduce((s, e) => s + e.amount, 0),
      saving: getReceivedForMonth(orders, payments, mk)
        - (expenses.filter(e => getMonthKey(e.expenseDate) === mk).reduce((s, e) => s + e.amount, 0) + getOrderCostsForMonth(orders, products, mk))
        - personalExpenses.filter(e => getMonthKey(e.expenseDate) === mk).reduce((s, e) => s + e.amount, 0),
    }));
  }, [orders, payments, expenses, products, personalExpenses]);

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Reports</h1>
            <p className="text-xs text-muted-foreground">Monthly business performance analysis</p>
          </div>
        </div>
        <select
          data-testid="select-report-month"
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </header>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border gap-3">
        <p className="text-sm font-semibold text-muted-foreground shrink-0">Month:</p>
        <select
          data-testid="select-report-month"
          className="flex-1 text-sm border border-border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-8 gap-3">
          {[
            { label: "Total Sales", value: formatCurrency(totalSales), icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50", sub: `${monthOrders.length} orders` },
            { label: "Total Received", value: formatCurrency(totalReceived), icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50", sub: `${paidOrderCount} paid orders` },
            { label: "Cash In", value: formatCurrency(cashflowReceived), icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50", sub: "By payment date" },
            { label: "Total Pending", value: formatCurrency(totalPending), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", sub: "Outstanding" },
            { label: "Total Expenses", value: formatCurrency(totalExpenses), icon: TrendingDown, color: "text-slate-600", bg: "bg-slate-100", sub: monthOrderCosts > 0 ? `${monthExpenses.length} records + product costs` : `${monthExpenses.length} records` },
            { label: "Personal Costs", value: formatCurrency(monthPersonalCosts), icon: Users, color: "text-rose-600", bg: "bg-rose-50", sub: "Owner Wallet" },
            { label: "Net Profit", value: formatCurrency(netProfit), icon: Wallet, color: netProfit >= 0 ? "text-emerald-600" : "text-rose-600", bg: netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50", sub: totalReceived > 0 ? `${Math.round((netProfit / totalReceived) * 100)}% margin` : "N/A" },
            { label: "Actual Saving", value: formatCurrency(actualSaving), icon: PackageOpen, color: actualSaving >= 0 ? "text-cyan-600" : "text-rose-600", bg: actualSaving >= 0 ? "bg-cyan-50" : "bg-rose-50", sub: "Cash in minus all costs" },
          ].map(({ label, value, icon: Icon, color, bg, sub }) => (
            <Card key={label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                  <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                </div>
                <p data-testid={`report-stat-${label.toLowerCase().replace(/\s+/g, "-")}`} className="text-base sm:text-lg font-bold truncate">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">6-Month Sales, Received & Expenses</CardTitle>
            <CardDescription>Sales come from orders; received comes from paid amounts</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={v => `Rs ${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" />
                  <Bar dataKey="sales" name="Sales" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="received" name="Received" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" name="Expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="personal" name="Personal" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="saving" name="Saving" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Monthly Comparison</CardTitle>
            <CardDescription>Sales, cash received, business expenses, personal costs, and actual saving</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Month</th>
                  <th className="px-4 py-3 text-left font-semibold">Sales</th>
                  <th className="px-4 py-3 text-left font-semibold">Received</th>
                  <th className="px-4 py-3 text-left font-semibold">Business Expenses</th>
                  <th className="px-4 py-3 text-left font-semibold">Personal Costs</th>
                  <th className="px-4 py-3 text-left font-semibold">Actual Saving</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(row => (
                  <tr key={row.month} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium">{row.month}</td>
                    <td className="px-4 py-3">{formatCurrency(row.sales)}</td>
                    <td className="px-4 py-3 text-emerald-700 font-medium">{formatCurrency(row.received)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(row.expenses)}</td>
                    <td className="px-4 py-3 text-rose-600">{formatCurrency(row.personal)}</td>
                    <td className={`px-4 py-3 font-semibold ${row.saving >= 0 ? "text-cyan-700" : "text-rose-700"}`}>{formatCurrency(row.saving)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Bottom cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No orders this month</p>
              ) : topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-cyan-600 w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.orders} order{p.orders !== 1 ? "s" : ""} - Revenue {formatCurrency(p.revenue)}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{formatCurrency(p.profit)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold">Top Clients</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {topClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No orders this month</p>
              ) : topClients.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-cyan-600 w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.orders} order{c.orders !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{formatCurrency(c.revenue)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold">Lifetime Client Value</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {lifetimeClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No client value yet</p>
              ) : lifetimeClients.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-cyan-600 w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.orders} orders - Paid {formatCurrency(c.paid)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(c.revenue)}</p>
                    {c.pending > 0 && <p className="text-xs text-rose-600">{formatCurrency(c.pending)} due</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold">Pending Aging</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {pendingAging.map(bucket => (
                <div key={bucket.label} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{bucket.label}</p>
                    <p className="text-xs text-muted-foreground">{bucket.count} order{bucket.count !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-bold text-amber-700">{formatCurrency(bucket.amount)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t-4 border-t-amber-400">
            <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">Renewal Alerts</CardTitle>
              </div>
              <CardDescription className="text-amber-700/70 text-xs">Expired or within 30 days</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {expiringOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">No renewals due soon</p>
              ) : (
                <div className="divide-y divide-border">
                  {expiringOrders.slice(0, 5).map(o => {
                    const days = daysUntil(o.expiryDate);
                    return (
                      <div key={o.id} className="p-3 flex items-center justify-between">
                        <div className="min-w-0 mr-2">
                          <p className="font-semibold text-sm truncate">{o.clientName}</p>
                          <p className="text-xs text-muted-foreground truncate">{o.productName}</p>
                        </div>
                        <Badge variant="outline" className={days <= 7 ? "bg-rose-50 text-rose-700 border-rose-200 text-xs shrink-0" : "bg-amber-50 text-amber-700 border-amber-200 text-xs shrink-0"}>
                          {days === 0 ? "Today" : days < 0 ? `Expired ${Math.abs(days)}d` : `${days}d`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
