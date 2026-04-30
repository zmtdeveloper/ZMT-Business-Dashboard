import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { formatCurrency, formatDate, daysUntil, getMonthKey, getMonthLabel } from "@/lib/format";
import {
  getOrderCostsForMonth,
  getOrderCostsTotal,
  getPendingTotal,
  getReceivedForMonth,
  getReceivedTotal,
  getSalesForMonth,
  getSalesTotal,
} from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, ShoppingCart, PackageOpen, CalendarClock, TrendingUp, TrendingDown, Wallet, Clock,
  AlertCircle, Receipt, CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { clients, orders, payments, expenses, products } = useData();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlySales = useMemo(() =>
    getSalesForMonth(orders, currentMonth),
    [orders, currentMonth]
  );

  const totalSales = useMemo(() =>
    getSalesTotal(orders),
    [orders]
  );

  const monthlyReceived = useMemo(() =>
    getReceivedForMonth(orders, payments, currentMonth),
    [orders, payments, currentMonth]
  );

  const totalReceived = useMemo(() =>
    getReceivedTotal(orders, payments),
    [orders, payments]
  );

  const monthlyExpenses = useMemo(() =>
    expenses.filter(e => getMonthKey(e.expenseDate) === currentMonth).reduce((sum, e) => sum + e.amount, 0),
    [expenses, currentMonth]
  );

  const monthlyOrderCosts = useMemo(() =>
    getOrderCostsForMonth(orders, products, currentMonth),
    [orders, products, currentMonth]
  );

  const totalExpenses = useMemo(() =>
    expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const totalOrderCosts = useMemo(() =>
    getOrderCostsTotal(orders, products),
    [orders, products]
  );

  const monthlyBusinessExpenses = monthlyExpenses + monthlyOrderCosts;
  const totalBusinessExpenses = totalExpenses + totalOrderCosts;

  const pendingPayments = useMemo(() => getPendingTotal(orders), [orders]);

  const pendingOrders = orders.filter(o => o.orderStatus === "Pending").length;
  const completedOrders = orders.filter(o => o.orderStatus === "Completed").length;

  const expiringOrders = useMemo(() =>
    orders.filter(o => {
      if (!o.expiryDate) return false;
      const days = daysUntil(o.expiryDate);
      return days <= 30 && o.orderStatus !== "Cancelled" && o.orderStatus !== "Renewed";
    }).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)),
    [orders]
  );

  const recentOrders = useMemo(() =>
    [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
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
    }));
  }, [orders, payments, expenses, products]);

  const topExpenses = useMemo(() => {
    const byCategory: Record<string, number> = {};
    expenses.filter(e => getMonthKey(e.expenseDate) === currentMonth).forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    const productCosts = getOrderCostsForMonth(orders, products, currentMonth);
    if (productCosts > 0) byCategory["Product Cost"] = (byCategory["Product Cost"] || 0) + productCosts;
    return Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [expenses, orders, products, currentMonth]);

  const stats = [
    { label: "Total Clients", value: clients.length, icon: Users, color: "text-cyan-600", bg: "bg-cyan-50", trend: "All time" },
    { label: "Total Sales", value: formatCurrency(totalSales), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", trend: `${formatCurrency(monthlySales)} this month` },
    { label: "Total Received", value: formatCurrency(totalReceived), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", trend: `${formatCurrency(monthlyReceived)} this month` },
    { label: "Pending Payments", value: formatCurrency(pendingPayments), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", trend: `${orders.filter(o => o.paymentStatus !== "Paid" && o.orderStatus !== "Cancelled").length} orders` },
    { label: "Pending Orders", value: pendingOrders, icon: PackageOpen, color: "text-amber-600", bg: "bg-amber-50", trend: "Action needed" },
    { label: "Renewal Alerts", value: expiringOrders.length, icon: CalendarClock, color: "text-rose-600", bg: "bg-rose-50", trend: "Expired or within 30 days" },
    { label: "Total Expenses", value: formatCurrency(totalBusinessExpenses), icon: TrendingDown, color: "text-slate-600", bg: "bg-slate-100", trend: `${formatCurrency(monthlyBusinessExpenses)} this month` },
    { label: "Net Profit", value: formatCurrency(totalReceived - totalBusinessExpenses), icon: Wallet, color: totalReceived - totalBusinessExpenses >= 0 ? "text-cyan-600" : "text-rose-600", bg: totalReceived - totalBusinessExpenses >= 0 ? "bg-cyan-50" : "bg-rose-50", trend: totalReceived > 0 ? `${Math.round(((totalReceived - totalBusinessExpenses) / totalReceived) * 100)}% margin` : "N/A" },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground">Welcome back - here's your business summary.</p>
        </div>
        <Link href="/orders">
          <Button data-testid="btn-new-order" className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium">
            + New Order
          </Button>
        </Link>
      </header>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div>
          <h1 className="text-base font-bold">Overview</h1>
          <p className="text-xs text-muted-foreground">Your business summary</p>
        </div>
        <Link href="/orders">
          <Button data-testid="btn-new-order-mobile" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
            + Order
          </Button>
        </Link>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg, trend }) => (
            <Card key={label} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 mr-2">
                    <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                    <p data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-lg sm:text-2xl font-bold text-foreground mt-1 truncate">
                      {typeof value === "number" ? value.toLocaleString() : value}
                    </p>
                  </div>
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {/* Chart */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-semibold">Sales, Received & Expenses</CardTitle>
                <CardDescription>Last 6 months performance from order totals and paid amounts</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="h-52 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickFormatter={v => `Rs ${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                        formatter={(v: number) => [formatCurrency(v), ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" />
                      <Bar dataKey="sales" name="Sales" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="received" name="Received" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="expenses" name="Expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent orders */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
                  <CardDescription>Latest orders across all clients</CardDescription>
                </div>
                <Link href="/orders">
                  <Button variant="outline" size="sm" className="text-xs shrink-0">View All</Button>
                </Link>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Order</TableHead>
                      <TableHead className="text-xs font-semibold">Client</TableHead>
                      <TableHead className="text-xs font-semibold">Amount</TableHead>
                      <TableHead className="text-xs font-semibold">Payment</TableHead>
                      <TableHead className="text-xs font-semibold hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No orders yet</TableCell>
                      </TableRow>
                    ) : recentOrders.map(order => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <p className="font-medium text-sm text-foreground truncate max-w-28 sm:max-w-40">{order.productName}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.deliveryDate)}</p>
                        </TableCell>
                        <TableCell className="text-sm font-medium whitespace-nowrap">{order.clientName}</TableCell>
                        <TableCell className="text-sm font-semibold whitespace-nowrap">{formatCurrency(order.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            order.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            order.paymentStatus === "Partial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                          }>
                            {order.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1.5 text-sm">
                            {order.orderStatus === "Completed"
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                            <span className="text-muted-foreground">{order.orderStatus}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Renewal alerts */}
            <Card className="shadow-sm border-t-4 border-t-amber-400 overflow-hidden">
              <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm font-semibold">Renewal Alerts</CardTitle>
                </div>
                <CardDescription className="text-amber-700/70 text-xs">Expired or expiring within 30 days</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {expiringOrders.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No renewals due soon</div>
                ) : (
                  <div className="divide-y divide-border">
                    {expiringOrders.slice(0, 4).map(o => {
                      const days = daysUntil(o.expiryDate);
                      return (
                        <div key={o.id} data-testid={`renewal-${o.id}`} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 mr-3">
                            <p className="font-semibold text-sm truncate">{o.clientName}</p>
                            <p className="text-xs text-muted-foreground truncate">{o.productName}</p>
                            <p className="text-xs font-semibold mt-0.5" style={{ color: days < 0 || days <= 7 ? "#dc2626" : "#d97706" }}>
                              {days === 0 ? "Expires today" : days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
                            </p>
                          </div>
                          <Link href="/orders">
                            <Button size="sm" className={days < 0 ? "bg-rose-100 text-rose-800 hover:bg-rose-200 shadow-none font-semibold text-xs px-2.5 shrink-0" : "bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-none font-semibold text-xs px-2.5 shrink-0"}>
                              {days < 0 ? "Renew Now" : "Renew"}
                            </Button>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top expenses */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Top Expenses This Month</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {topExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No expenses this month</p>
                ) : topExpenses.map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate flex-1 mr-2">{category}</p>
                    <p className="font-semibold text-sm shrink-0">{formatCurrency(amount)}</p>
                  </div>
                ))}
                <Link href="/expenses">
                  <Button variant="ghost" className="w-full text-cyan-600 hover:bg-cyan-50 text-xs mt-1">
                    View All Expenses
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
