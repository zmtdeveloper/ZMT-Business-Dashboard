import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useData } from "@/context/DataContext";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { openWhatsAppReminder, printOrderInvoice, printPaymentReceipt } from "@/lib/businessActions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, CalendarClock, CreditCard, MessageCircle, Printer, Repeat2, UserRound, Wallet,
} from "lucide-react";

export default function ClientDetail() {
  const [location] = useLocation();
  const clientId = decodeURIComponent(location.split("/").pop() || "");
  const { clients, orders, payments, renewOrder } = useData();
  const { toast } = useToast();

  const client = clients.find(item => item.id === clientId);

  const clientOrders = useMemo(() =>
    orders
      .filter(order => order.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, clientId]
  );

  const clientPayments = useMemo(() =>
    payments
      .filter(payment => payment.clientId === clientId)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
    [payments, clientId]
  );

  const pendingOrders = clientOrders.filter(order => order.remainingAmount > 0 && order.orderStatus !== "Cancelled");
  const totalSales = clientOrders.filter(order => order.orderStatus !== "Cancelled").reduce((sum, order) => sum + order.totalAmount, 0);
  const totalPaid = clientPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const pendingBalance = pendingOrders.reduce((sum, order) => sum + order.remainingAmount, 0);

  const timeline = useMemo(() => {
    const events = clientOrders.flatMap(order => {
      const orderPayments = clientPayments.filter(payment => payment.orderId === order.id);
      return [
        { date: order.createdAt, title: "Order created", detail: `${order.productName} - ${formatCurrency(order.totalAmount)}` },
        { date: order.deliveryDate, title: "Delivery date", detail: order.productName },
        ...orderPayments.map(payment => ({
          date: payment.paymentDate,
          title: "Payment received",
          detail: `${formatCurrency(payment.amount)} via ${payment.method}`,
        })),
        ...(order.orderStatus === "Completed" || order.orderStatus === "Renewed"
          ? [{ date: order.expiryDate || order.createdAt, title: `Order ${order.orderStatus.toLowerCase()}`, detail: order.productName }]
          : []),
      ];
    });

    return events
      .filter(event => event.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);
  }, [clientOrders, clientPayments]);

  function handleRenew(orderId: string) {
    const order = renewOrder(orderId);
    if (order) toast({ title: "Order renewed", description: `${order.clientName} - ${order.productName}` });
  }

  if (!client) {
    return (
      <div className="flex-1 p-8">
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">Client not found.</p>
            <Link href="/clients"><Button variant="outline">Back to Clients</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/clients">
            <Button variant="ghost" size="icon" className="w-8 h-8"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <UserRound className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="text-xs text-muted-foreground">{client.phone || client.email || "Client profile"}</p>
          </div>
        </div>
        {pendingOrders[0] && (
          <Button onClick={() => openWhatsAppReminder(pendingOrders[0], client)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp Reminder
          </Button>
        )}
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <Link href="/clients"><Button variant="ghost" size="icon" className="w-8 h-8"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1 min-w-0 px-2">
          <p className="text-sm font-bold truncate">{client.name}</p>
          <p className="text-xs text-muted-foreground truncate">{client.phone || client.email || "Client profile"}</p>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Sales", value: formatCurrency(totalSales), icon: Wallet, sub: `${clientOrders.length} orders` },
            { label: "Total Paid", value: formatCurrency(totalPaid), icon: CreditCard, sub: `${clientPayments.length} payments` },
            { label: "Pending Balance", value: formatCurrency(pendingBalance), icon: CalendarClock, sub: `${pendingOrders.length} unpaid orders` },
            { label: "Last Order", value: clientOrders[0] ? formatDate(clientOrders[0].deliveryDate) : "-", icon: UserRound, sub: clientOrders[0]?.productName || "No orders" },
          ].map(({ label, value, icon: Icon, sub }) => (
            <Card key={label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg sm:text-xl font-bold truncate">{value}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Order History</CardTitle>
              <CardDescription>Orders, renewals, pending balance, and quick actions</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Order</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No orders for this client.</TableCell></TableRow>
                  ) : clientOrders.map(order => {
                    const orderPayments = clientPayments.filter(payment => payment.orderId === order.id);
                    const expiryDays = daysUntil(order.expiryDate);
                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell>
                          <p className="font-semibold text-sm">{order.productName}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.deliveryDate)}</p>
                        </TableCell>
                        <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(order.totalAmount)}</TableCell>
                        <TableCell className={order.remainingAmount > 0 ? "font-semibold text-rose-600 whitespace-nowrap" : "font-semibold text-emerald-600 whitespace-nowrap"}>{formatCurrency(order.remainingAmount)}</TableCell>
                        <TableCell><Badge variant="outline">{order.orderStatus} / {order.paymentStatus}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(order.expiryDate)}
                          <span className="block text-xs">{expiryDays < 0 ? `Expired ${Math.abs(expiryDays)}d` : `${expiryDays}d left`}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {order.remainingAmount > 0 && (
                              <Button variant="ghost" size="icon" className="w-8 h-8" title="WhatsApp reminder" onClick={() => openWhatsAppReminder(order, client)}>
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="w-8 h-8" title="Print invoice" onClick={() => printOrderInvoice(order, orderPayments)}>
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                            {expiryDays <= 30 && order.orderStatus !== "Renewed" && order.orderStatus !== "Cancelled" && (
                              <Button variant="ghost" size="icon" className="w-8 h-8 text-cyan-700" title="Renew order" onClick={() => handleRenew(order.id)}>
                                <Repeat2 className="w-3.5 h-3.5" />
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

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Status Timeline</CardTitle>
              <CardDescription>Created, paid, completed, and renewed events</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No timeline yet.</p>
              ) : timeline.map((event, index) => (
                <div key={`${event.title}-${event.date}-${index}`} className="flex gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            <CardDescription>Receipts and payment records</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No payments for this client.</TableCell></TableRow>
                ) : clientPayments.map(payment => (
                  <TableRow key={payment.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{payment.orderDescription}</TableCell>
                    <TableCell className="font-semibold text-emerald-600">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell><Badge variant="outline">{payment.method}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => printPaymentReceipt(payment)}>
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
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
