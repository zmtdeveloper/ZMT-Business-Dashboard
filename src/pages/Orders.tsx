import { useState, useMemo } from "react";
import { useData, Order, Payment } from "@/context/DataContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Pencil, Trash2, ShoppingCart } from "lucide-react";

const emptyForm = {
  clientId: "", productId: "", quantity: "1", deliveryDate: new Date().toISOString().slice(0, 10),
  paidAmount: "0", paymentMethod: "Cash" as Payment["method"], orderStatus: "Pending" as Order["orderStatus"], notes: "",
};

const PAYMENT_METHODS: Payment["method"][] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Other"];

const ORDER_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  Renewed: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
  Unpaid: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Orders() {
  const { orders, clients, products, addOrder, updateOrder, deleteOrder } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    orders.filter(o => {
      const matchSearch = o.clientName.toLowerCase().includes(search.toLowerCase()) ||
        o.productName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || o.orderStatus === statusFilter;
      return matchSearch && matchStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, search, statusFilter]
  );

  const selectedProduct = products.find(p => p.id === form.productId);
  const calcTotalAmount = () => (selectedProduct?.salePrice || 0) * (Number(form.quantity) || 1);
  const calcRemainingAmount = () => Math.max(0, calcTotalAmount() - (Number(form.paidAmount) || 0));
  const calcPaymentStatus = (): Order["paymentStatus"] => {
    const total = calcTotalAmount();
    const paid = Number(form.paidAmount) || 0;
    if (paid >= total) return "Paid";
    if (paid > 0) return "Partial";
    return "Unpaid";
  };
  const calcExpiryDate = () => {
    if (!form.deliveryDate || !selectedProduct) return "";
    const d = new Date(form.deliveryDate);
    d.setDate(d.getDate() + selectedProduct.durationDays);
    return d.toISOString().slice(0, 10);
  };

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(o: Order) {
    setEditTarget(o);
    setForm({
      clientId: o.clientId, productId: o.productId, quantity: String(o.quantity),
      deliveryDate: o.deliveryDate, paidAmount: String(o.paidAmount), paymentMethod: "Cash", orderStatus: o.orderStatus, notes: o.notes,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.clientId || !form.productId) return;
    const client = clients.find(c => c.id === form.clientId);
    const product = products.find(p => p.id === form.productId);
    if (!client || !product) return;
    const total = calcTotalAmount();
    const paid = Number(form.paidAmount) || 0;
    const remaining = Math.max(0, total - paid);
    const paymentStatus = calcPaymentStatus();
    const expiryDate = calcExpiryDate();
    const data: Omit<Order, "id" | "createdAt"> = {
      clientId: client.id, clientName: client.name,
      productId: product.id, productName: product.name,
      quantity: Number(form.quantity) || 1,
      deliveryDate: form.deliveryDate, expiryDate,
      totalAmount: total, paidAmount: paid, remainingAmount: remaining,
      paymentStatus, orderStatus: form.orderStatus, notes: form.notes,
    };
    if (editTarget) {
      updateOrder({ ...editTarget, ...data });
      toast({ title: "Order updated" });
    } else {
      addOrder(data, form.paymentMethod);
      toast({ title: "Order created" });
    }
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    deleteOrder(id);
    setDeleteId(null);
    toast({ title: "Order deleted", variant: "destructive" });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Orders</h1>
            <p className="text-xs text-muted-foreground">{orders.length} total orders</p>
          </div>
        </div>
        <Button data-testid="btn-add-order" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Order
        </Button>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <p className="text-sm font-semibold text-muted-foreground">{orders.length} orders</p>
        <Button data-testid="btn-add-order" size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Order
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-search-orders" placeholder="Search by client or product..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-order-status-filter" className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Renewed">Renewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client / Product</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Remaining</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Expiry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">No orders found.</TableCell>
                  </TableRow>
                ) : filtered.map(o => (
                  <TableRow key={o.id} data-testid={`row-order-${o.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-semibold text-sm">{o.clientName}</p>
                      <p className="text-xs text-muted-foreground">{o.productName}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{o.orderStatus}</p>
                    </TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(o.totalAmount)}</TableCell>
                    <TableCell className={`font-semibold whitespace-nowrap hidden sm:table-cell ${o.remainingAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(o.remainingAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${PAYMENT_STATUS_COLORS[o.paymentStatus] || ""}`}>
                        {o.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={`text-xs ${ORDER_STATUS_COLORS[o.orderStatus] || ""}`}>
                        {o.orderStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell whitespace-nowrap">{formatDate(o.expiryDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button data-testid={`btn-edit-order-${o.id}`} variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(o)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`btn-delete-order-${o.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(o.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Order" : "Create New Order"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                  <SelectTrigger data-testid="select-order-client">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Product *</Label>
                <Select value={form.productId} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                  <SelectTrigger data-testid="select-order-product">
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.status === "Active").map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.salePrice)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProduct && (
              <div className="bg-cyan-50 rounded-lg p-3 text-xs text-cyan-700 space-y-0.5">
                <p>Price: {formatCurrency(selectedProduct.salePrice)} | Duration: {selectedProduct.durationDays} days</p>
                <p className="font-semibold">Total: {formatCurrency(calcTotalAmount())} | Expiry: {calcExpiryDate() || "—"}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input data-testid="input-order-quantity" type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date</Label>
                <Input data-testid="input-order-delivery-date" type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Paid Amount (PKR)</Label>
                <Input data-testid="input-order-paid" type="number" min="0" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
                {selectedProduct && <p className="text-xs text-muted-foreground">Remaining: {formatCurrency(calcRemainingAmount())} — {calcPaymentStatus()}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Order Status</Label>
                <Select value={form.orderStatus} onValueChange={v => setForm(f => ({ ...f, orderStatus: v as Order["orderStatus"] }))}>
                  <SelectTrigger data-testid="select-order-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Renewed">Renewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {Number(form.paidAmount) > 0 && !editTarget && (
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v as Payment["method"] }))}>
                  <SelectTrigger data-testid="select-order-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="input-order-notes" placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-order" onClick={handleSave} disabled={!form.clientId || !form.productId} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto">
              {editTarget ? "Save Changes" : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader><DialogTitle>Delete Order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete-order" variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
