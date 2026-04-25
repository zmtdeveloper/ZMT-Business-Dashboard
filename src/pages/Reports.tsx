import { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { formatCurrency, formatDate, daysUntil, getMonthKey, getMonthLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, Wallet, Clock, AlertCircle } from "lucide-react";

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
  const { orders, payments, expenses } = useData();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const monthOptions = getMonthOptions();

  const monthPayments = useMemo(() =>
    payments.filter(p => getMonthKey(p.paymentDate) === selectedMonth), [payments, selectedMonth]);
  const monthExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.expenseDate) === selectedMonth), [expenses, selectedMonth]);
  const monthOrders = useMemo(() =>
    orders.filter(o => getMonthKey(o.deliveryDate) === selectedMonth), [orders, selectedMonth]);

  const totalReceived = monthPayments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalSales = monthOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalPending = monthOrders.reduce((s, o) => s + o.remainingAmount, 0);
  const netProfit = totalReceived - totalExpenses;

  const topProducts = useMemo(() => {
    const byProduct: Record<string, { name: string; revenue: number; orders: number }> = {};
    monthOrders.forEach(o => {
      if (!byProduct[o.productId]) byProduct[o.productId] = { name: o.productName, revenue: 0, orders: 0 };
      byProduct[o.productId].revenue += o.totalAmount;
      byProduct[o.productId].orders += 1;
    });
    return Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [monthOrders]);

  const topClients = useMemo(() => {
    const byClient: Record<string, { name: string; revenue: number; orders: number }> = {};
    monthOrders.forEach(o => {
      if (!byClient[o.clientId]) byClient[o.clientId] = { name: o.clientName, revenue: 0, orders: 0 };
      byClient[o.clientId].revenue += o.totalAmount;
      byClient[o.clientId].orders += 1;
    });
    return Object.values(byClient).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [monthOrders]);

  const expiringOrders = useMemo(() =>
    orders.filter(o => {
      if (!o.expiryDate) return false;
      const days = daysUntil(o.expiryDate);
      return days >= 0 && days <= 30 && o.orderStatus === "Pending";
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
      income: payments.filter(p => getMonthKey(p.paymentDate) === mk).reduce((s, p) => s + p.amount, 0),
      expenses: expenses.filter(e => getMonthKey(e.expenseDate) === mk).reduce((s, e) => s + e.amount, 0),
    }));
  }, [payments, expenses]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Sales", value: formatCurrency(totalSales), icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50", sub: `${monthOrders.length} orders` },
            { label: "Total Received", value: formatCurrency(totalReceived), icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50", sub: `${monthPayments.length} payments` },
            { label: "Total Pending", value: formatCurrency(totalPending), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", sub: "Outstanding" },
            { label: "Total Expenses", value: formatCurrency(totalExpenses), icon: TrendingDown, color: "text-slate-600", bg: "bg-slate-100", sub: `${monthExpenses.length} records` },
            { label: "Net Profit", value: formatCurrency(netProfit), icon: Wallet, color: netProfit >= 0 ? "text-emerald-600" : "text-rose-600", bg: netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50", sub: totalReceived > 0 ? `${Math.round((netProfit / totalReceived) * 100)}% margin` : "N/A" },
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
            <CardTitle className="text-base font-semibold">6-Month Income vs Expenses</CardTitle>
            <CardDescription>Financial performance trend</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={v => `₨${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" />
                  <Bar dataKey="income" name="Income" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" name="Expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
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
                    <p className="text-xs text-muted-foreground">{p.orders} order{p.orders !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{formatCurrency(p.revenue)}</p>
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

          <Card className="shadow-sm border-t-4 border-t-amber-400">
            <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">Upcoming Renewals</CardTitle>
              </div>
              <CardDescription className="text-amber-700/70 text-xs">Within 30 days</CardDescription>
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
                          {days === 0 ? "Today" : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
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
