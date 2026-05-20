import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useData, Order } from "@/context/DataContext";
import { daysUntil, formatCurrency, formatDate, getMonthKey } from "@/lib/format";
import { openWhatsAppRenewalReminder, printOrderInvoice } from "@/lib/businessActions";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle, CalendarClock, CheckCircle2, ExternalLink, MessageCircle, Printer, Repeat2, Search,
  TrendingUp, XCircle,
} from "lucide-react";

type RenewalFilter = "due" | "expired" | "week" | "month" | "renewed" | "cancelled";

const FILTER_LABELS: Record<RenewalFilter, string> = {
  due: "All Due",
  expired: "Expired",
  week: "Due in 7 Days",
  month: "Due in 30 Days",
  renewed: "Renewed",
  cancelled: "Lost / Cancelled",
};

function isRenewableOrder(order: Order) {
  return !!order.expiryDate &&
    order.orderStatus !== "Cancelled" &&
    order.orderStatus !== "Renewed" &&
    !order.renewedToOrderId;
}

function getRenewalStatus(order: Order) {
  const days = daysUntil(order.expiryDate);
  if (order.orderStatus === "Cancelled") return { label: "Lost", className: "bg-slate-100 text-slate-700 border-slate-200" };
  if (order.orderStatus === "Renewed" || order.renewedToOrderId) return { label: "Renewed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (days < 0) return { label: `Expired ${Math.abs(days)}d`, className: "bg-rose-50 text-rose-700 border-rose-200" };
  if (days === 0) return { label: "Due today", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (days <= 7) return { label: `${days}d left`, className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: `${days}d left`, className: "bg-cyan-50 text-cyan-700 border-cyan-200" };
}

export default function Renewals() {
  const { orders, payments, clients, renewOrder, updateOrder } = useData();
  const { toast } = useToast();
  const [filter, setFilter] = useState<RenewalFilter>("due");
  const [search, setSearch] = useState("");

  const currentMonth = new Date().toISOString().slice(0, 7);

  const dueOrders = useMemo(() =>
    orders
      .filter(order => isRenewableOrder(order) && daysUntil(order.expiryDate) <= 30)
      .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)),
    [orders]
  );

  const renewedSourceOrders = useMemo(() =>
    orders
      .filter(order => order.orderStatus === "Renewed" || !!order.renewedToOrderId)
      .sort((a, b) => new Date(b.renewedAt || b.createdAt).getTime() - new Date(a.renewedAt || a.createdAt).getTime()),
    [orders]
  );

  const cancelledOrders = useMemo(() =>
    orders
      .filter(order => order.orderStatus === "Cancelled")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const rows = useMemo(() => {
    let base: Order[];
    if (filter === "renewed") {
      base = renewedSourceOrders;
    } else if (filter === "cancelled") {
      base = cancelledOrders;
    } else {
      base = dueOrders.filter(order => {
        const days = daysUntil(order.expiryDate);
        if (filter === "expired") return days < 0;
        if (filter === "week") return days >= 0 && days <= 7;
        if (filter === "month") return days >= 0 && days <= 30;
        return true;
      });
    }

    const query = search.trim().toLowerCase();
    if (!query) return base;

    return base.filter(order =>
      order.clientName.toLowerCase().includes(query) ||
      order.productName.toLowerCase().includes(query) ||
      order.paymentStatus.toLowerCase().includes(query)
    );
  }, [cancelledOrders, dueOrders, filter, renewedSourceOrders, search]);

  const history = useMemo(() => {
    const sourceEntries = renewedSourceOrders.map(source => {
      const next = source.renewedToOrderId ? orders.find(order => order.id === source.renewedToOrderId) : undefined;
      return { source, next };
    });

    const nextOnlyEntries = orders
      .filter(order => order.renewedFromOrderId && !sourceEntries.some(entry => entry.next?.id === order.id))
      .map(next => ({ source: orders.find(order => order.id === next.renewedFromOrderId) ?? next, next }));

    return [...sourceEntries, ...nextOnlyEntries]
      .sort((a, b) => new Date(b.next?.createdAt || b.source.renewedAt || b.source.createdAt).getTime() - new Date(a.next?.createdAt || a.source.renewedAt || a.source.createdAt).getTime())
      .slice(0, 12);
  }, [orders, renewedSourceOrders]);

  const expiredCount = dueOrders.filter(order => daysUntil(order.expiryDate) < 0).length;
  const dueWeekCount = dueOrders.filter(order => {
    const days = daysUntil(order.expiryDate);
    return days >= 0 && days <= 7;
  }).length;
  const dueMonthCount = dueOrders.filter(order => {
    const days = daysUntil(order.expiryDate);
    return days >= 0 && days <= 30;
  }).length;
  const renewedThisMonth = history.filter(({ source, next }) =>
    getMonthKey(source.renewedAt || next?.createdAt || source.createdAt) === currentMonth
  ).length;
  const expectedRenewalValue = dueOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  function handleRenew(order: Order) {
    const renewed = renewOrder(order.id);
    if (renewed) {
      toast({ title: "Order renewed", description: `${renewed.clientName} - ${renewed.productName}` });
    } else {
      toast({ title: "Renewal skipped", description: "This order is already renewed or cancelled.", variant: "destructive" });
    }
  }

  function handleLost(order: Order) {
    updateOrder({
      ...order,
      orderStatus: "Cancelled",
      notes: order.notes ? `${order.notes}\nLost renewal on ${new Date().toISOString().slice(0, 10)}` : `Lost renewal on ${new Date().toISOString().slice(0, 10)}`,
    });
    toast({ title: "Renewal marked lost", description: `${order.clientName} - ${order.productName}` });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Repeat2 className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Renewals</h1>
            <p className="text-xs text-muted-foreground">Track expired services, upcoming renewals, and renewal history.</p>
          </div>
        </div>
        <Link href="/orders">
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">New Order</Button>
        </Link>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div>
          <h1 className="text-base font-bold">Renewals</h1>
          <p className="text-xs text-muted-foreground">{dueOrders.length} due</p>
        </div>
        <Link href="/orders">
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">New Order</Button>
        </Link>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Expired", value: expiredCount, icon: AlertCircle, bg: "bg-rose-50", color: "text-rose-600", sub: "Need urgent action" },
            { label: "Due in 7 Days", value: dueWeekCount, icon: CalendarClock, bg: "bg-amber-50", color: "text-amber-600", sub: "This week" },
            { label: "Due in 30 Days", value: dueMonthCount, icon: CalendarClock, bg: "bg-cyan-50", color: "text-cyan-600", sub: "Upcoming" },
            { label: "Renewed This Month", value: renewedThisMonth, icon: CheckCircle2, bg: "bg-emerald-50", color: "text-emerald-600", sub: currentMonth },
            { label: "Expected Value", value: formatCurrency(expectedRenewalValue), icon: TrendingUp, bg: "bg-blue-50", color: "text-blue-600", sub: "Due renewal value" },
          ].map(({ label, value, icon: Icon, bg, color, sub }) => (
            <Card key={label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg sm:text-2xl font-bold truncate">{typeof value === "number" ? value.toLocaleString() : value}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Renewal Queue</CardTitle>
                <CardDescription>Filter due, expired, renewed, and lost renewals</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="input-search-renewals"
                    placeholder="Search client or product..."
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    className="pl-9 sm:w-72"
                  />
                </div>
                <Select value={filter} onValueChange={value => setFilter(value as RenewalFilter)}>
                  <SelectTrigger data-testid="select-renewal-filter" className="sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FILTER_LABELS) as RenewalFilter[]).map(key => (
                      <SelectItem key={key} value={key}>{FILTER_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client / Product</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No renewals found for this filter.
                    </TableCell>
                  </TableRow>
                ) : rows.map(order => {
                  const client = clients.find(item => item.id === order.clientId);
                  const status = getRenewalStatus(order);
                  const orderPayments = payments.filter(payment => payment.orderId === order.id);
                  const canRenew = isRenewableOrder(order);

                  return (
                    <TableRow key={order.id} data-testid={`row-renewal-${order.id}`} className="hover:bg-muted/30">
                      <TableCell>
                        <Link href={`/clients/${order.clientId}`} className="font-semibold text-sm text-cyan-700 hover:underline">{order.clientName}</Link>
                        <p className="text-xs text-muted-foreground">{order.productName}</p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <p className="font-medium">{formatDate(order.expiryDate)}</p>
                        <p className="text-xs text-muted-foreground">{daysUntil(order.expiryDate) < 0 ? `${Math.abs(daysUntil(order.expiryDate))}d expired` : `${daysUntil(order.expiryDate)}d left`}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          order.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          order.paymentStatus === "Partial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
                        }>
                          {order.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell><Badge variant="outline" className={status.className}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canRenew && (
                            <Button data-testid={`btn-renew-renewal-${order.id}`} variant="ghost" size="icon" className="w-8 h-8 text-cyan-700" title="Renew now" onClick={() => handleRenew(order)}>
                              <Repeat2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canRenew && (
                            <Button data-testid={`btn-renewal-whatsapp-${order.id}`} variant="ghost" size="icon" className="w-8 h-8 text-emerald-700" title="WhatsApp renewal reminder" onClick={() => openWhatsAppRenewalReminder(order, client)}>
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Link href={`/clients/${order.clientId}`}>
                            <Button variant="ghost" size="icon" className="w-8 h-8" title="Open client">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="w-8 h-8" title="Print invoice" onClick={() => printOrderInvoice(order, orderPayments)}>
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          {canRenew && (
                            <Button data-testid={`btn-lost-renewal-${order.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" title="Mark lost" onClick={() => handleLost(order)}>
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Renewal History</CardTitle>
            <CardDescription>Old orders linked to newly created renewal orders</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Old Order</TableHead>
                  <TableHead>New Order</TableHead>
                  <TableHead>Renewed Date</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">No renewal history yet.</TableCell>
                  </TableRow>
                ) : history.map(({ source, next }) => (
                  <TableRow key={`${source.id}-${next?.id ?? "source"}`} className="hover:bg-muted/30">
                    <TableCell>
                      <Link href={`/clients/${source.clientId}`} className="font-semibold text-cyan-700 hover:underline">{source.clientName}</Link>
                      <p className="text-xs text-muted-foreground">{source.productName}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{source.id}</p>
                      <p className="text-xs text-muted-foreground">Expired {formatDate(source.expiryDate)}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{next?.id ?? source.renewedToOrderId ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{next ? `New expiry ${formatDate(next.expiryDate)}` : "New order not found"}</p>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(source.renewedAt || next?.createdAt || source.createdAt)}</TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(next?.totalAmount ?? source.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
