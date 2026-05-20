import { useState, useMemo } from "react";
import { useData, Client, Order, Payment } from "@/context/DataContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { openWhatsAppReminder, printOrderInvoice } from "@/lib/businessActions";
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
import { Search, Plus, Pencil, Trash2, ShoppingCart, UserPlus, X, MessageCircle, Printer, Repeat2 } from "lucide-react";

const emptyForm = {
  clientId: "", productId: "", quantity: "1", deliveryDate: new Date().toISOString().slice(0, 10),
  totalAmount: "", paidAmount: "0", paymentMethod: "Cash" as Payment["method"], orderStatus: "Pending" as Order["orderStatus"], notes: "",
};

const emptyClientForm = { name: "", phone: "", email: "", address: "", notes: "" };

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
  const { orders, payments, clients, products, addClient, addOrder, updateOrder, deleteOrder, renewOrder } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [clientQuery, setClientQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm);
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

  const selectedClient = clients.find(c => c.id === form.clientId);
  const selectedProduct = products.find(p => p.id === form.productId);
  const clientMatches = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    return clients
      .filter(c => !query ||
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query))
      .slice(0, 8);
  }, [clients, clientQuery]);
  const productMatches = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return products
      .filter(p => p.status === "Active")
      .filter(p => !query ||
        p.name.toLowerCase().includes(query) ||
        String(p.salePrice).includes(query))
      .slice(0, 8);
  }, [products, productQuery]);
  const getQuantityValue = (quantity = form.quantity) => Math.max(1, Number(quantity) || 1);
  const getAutoTotalAmount = (product = selectedProduct, quantity = form.quantity) =>
    (product?.salePrice || 0) * getQuantityValue(quantity);
  const calcTotalAmount = () => {
    const typedTotal = Number(form.totalAmount);
    if (form.totalAmount.trim() !== "" && Number.isFinite(typedTotal)) {
      return Math.max(0, typedTotal);
    }
    return getAutoTotalAmount();
  };
  const getEnteredPaidAmount = () => Math.max(0, Number(form.paidAmount) || 0);
  const calcPaidAmount = () => Math.min(getEnteredPaidAmount(), calcTotalAmount());
  const calcRemainingAmount = () => Math.max(0, calcTotalAmount() - calcPaidAmount());
  const calcPaymentStatus = (): Order["paymentStatus"] => {
    const total = calcTotalAmount();
    const paid = calcPaidAmount();
    if (total <= 0) return paid > 0 ? "Paid" : "Unpaid";
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
    setClientQuery("");
    setProductQuery("");
    setClientPickerOpen(false);
    setProductPickerOpen(false);
    setQuickClientOpen(false);
    setClientForm(emptyClientForm);
    setDialogOpen(true);
  }

  function openEdit(o: Order) {
    setEditTarget(o);
    setForm({
      clientId: o.clientId, productId: o.productId, quantity: String(o.quantity),
      deliveryDate: o.deliveryDate, totalAmount: String(o.totalAmount), paidAmount: String(o.paidAmount), paymentMethod: "Cash", orderStatus: o.orderStatus, notes: o.notes,
    });
    setClientQuery(o.clientName);
    setProductQuery(o.productName);
    setClientPickerOpen(false);
    setProductPickerOpen(false);
    setQuickClientOpen(false);
    setClientForm(emptyClientForm);
    setDialogOpen(true);
  }

  function selectClient(client: Client) {
    setForm(f => ({ ...f, clientId: client.id }));
    setClientQuery(client.name);
    setClientPickerOpen(false);
  }

  function openQuickClient() {
    setClientForm(f => ({ ...f, name: f.name || clientQuery.trim() }));
    setQuickClientOpen(true);
  }

  function handleProductChange(productId: string) {
    const product = products.find(p => p.id === productId);
    const totalAmount = product ? getAutoTotalAmount(product) : 0;
    setForm(f => ({
      ...f,
      productId,
      totalAmount: totalAmount > 0 ? String(totalAmount) : f.totalAmount,
    }));
    if (product) setProductQuery(product.name);
    setProductPickerOpen(false);
  }

  function handleQuantityChange(quantity: string) {
    setForm(f => {
      const product = products.find(p => p.id === f.productId);
      const previousAutoTotal = getAutoTotalAmount(product, f.quantity);
      const nextAutoTotal = getAutoTotalAmount(product, quantity);
      const shouldFollowProductPrice = !f.totalAmount || Number(f.totalAmount) === previousAutoTotal;

      return {
        ...f,
        quantity,
        totalAmount: shouldFollowProductPrice && nextAutoTotal > 0 ? String(nextAutoTotal) : f.totalAmount,
      };
    });
  }

  function handleSave() {
    if (!form.clientId || !form.productId) return;
    const client = clients.find(c => c.id === form.clientId);
    const product = products.find(p => p.id === form.productId);
    if (!client || !product) return;
    const total = calcTotalAmount();
    const paid = calcPaidAmount();
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

  function handleQuickClientSave() {
    if (!clientForm.name.trim()) return;
    const client = addClient({
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      email: clientForm.email.trim(),
      address: clientForm.address.trim(),
      notes: clientForm.notes.trim(),
    });
    selectClient(client);
    setClientForm(emptyClientForm);
    setQuickClientOpen(false);
    toast({ title: "Client added and selected" });
  }

  function handleDelete(id: string) {
    deleteOrder(id);
    setDeleteId(null);
    toast({ title: "Order deleted", variant: "destructive" });
  }

  function handleRenew(id: string) {
    const order = renewOrder(id);
    if (order) {
      toast({ title: "Order renewed", description: `${order.clientName} - ${order.productName}` });
    }
  }

  const previewTotal = calcTotalAmount();
  const previewPaid = calcPaidAmount();
  const previewRemaining = calcRemainingAmount();
  const paidExceedsTotal = getEnteredPaidAmount() > previewTotal;

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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <div className="space-y-3">
                        <p>No orders found.</p>
                        {!search && statusFilter === "All" && <Button size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Plus className="w-3.5 h-3.5 mr-1" /> Create First Order</Button>}
                      </div>
                    </TableCell>
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
                        {o.remainingAmount > 0 && (
                          <Button data-testid={`btn-remind-order-${o.id}`} variant="ghost" size="icon" className="w-8 h-8 text-emerald-700" title="WhatsApp payment reminder" onClick={() => openWhatsAppReminder(o, clients.find(c => c.id === o.clientId))}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button data-testid={`btn-print-order-${o.id}`} variant="ghost" size="icon" className="w-8 h-8" title="Print invoice" onClick={() => printOrderInvoice(o, payments.filter(payment => payment.orderId === o.id))}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        {o.orderStatus !== "Renewed" && o.orderStatus !== "Cancelled" && (
                          <Button data-testid={`btn-renew-order-${o.id}`} variant="ghost" size="icon" className="w-8 h-8 text-cyan-700" title="Renew order" onClick={() => handleRenew(o.id)}>
                            <Repeat2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
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
        <DialogContent className="sm:max-w-3xl w-[calc(100vw-1rem)] h-[min(92vh,760px)] grid-rows-[auto,1fr,auto] overflow-hidden p-0 gap-0 border-cyan-100 shadow-2xl">
          <DialogHeader className="px-5 py-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-emerald-50">
            <DialogTitle>{editTarget ? "Edit Order" : "Create New Order"}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Total comes from product price x quantity. Paid amount is capped to the order total, so remaining stays sane.
            </p>
          </DialogHeader>
          <div className="space-y-4 min-h-0 overflow-y-auto overflow-x-visible p-4 sm:p-5 bg-gradient-to-b from-cyan-50/30 to-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Client *</Label>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={openQuickClient}>
                    <UserPlus className="w-3.5 h-3.5" /> New
                  </Button>
                </div>
                <div className="relative z-30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      data-testid="input-order-client-search"
                      placeholder="Search client by name, phone or email..."
                      value={clientQuery}
                      onFocus={() => {
                        setClientPickerOpen(true);
                        setProductPickerOpen(false);
                      }}
                      onChange={e => {
                        const value = e.target.value;
                        setClientQuery(value);
                        setClientPickerOpen(true);
                        if (!value || (form.clientId && value !== selectedClient?.name)) setForm(f => ({ ...f, clientId: "" }));
                      }}
                      className="pl-9 pr-9"
                    />
                    {form.clientId && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setForm(f => ({ ...f, clientId: "" }));
                          setClientQuery("");
                          setClientPickerOpen(true);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {clientPickerOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-md border border-cyan-100 bg-card shadow-xl">
                      {clientMatches.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground">
                          No client found.
                          <button type="button" className="ml-1 font-semibold text-cyan-700 hover:underline" onMouseDown={e => e.preventDefault()} onClick={openQuickClient}>Create new</button>
                        </div>
                      ) : clientMatches.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          data-testid={`option-order-client-${client.id}`}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/60 ${form.clientId === client.id ? "bg-cyan-50 text-cyan-800" : ""}`}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => selectClient(client)}
                        >
                          <span className="block font-medium truncate">{client.name}</span>
                          <span className="block text-xs text-muted-foreground truncate">{client.phone || client.email || "No contact saved"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedClient && (
                  <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                    <span className="font-semibold">{selectedClient.name}</span>
                    {selectedClient.phone ? <span className="text-cyan-700/80"> - {selectedClient.phone}</span> : null}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Product *</Label>
                <div className="relative z-20">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      data-testid="input-order-product-search"
                      placeholder="Search product..."
                      value={productQuery}
                      onFocus={() => {
                        setProductPickerOpen(true);
                        setClientPickerOpen(false);
                      }}
                      onChange={e => {
                        const value = e.target.value;
                        setProductQuery(value);
                        setProductPickerOpen(true);
                        if (!value || (form.productId && value !== selectedProduct?.name)) setForm(f => ({ ...f, productId: "" }));
                      }}
                      className="pl-9 pr-9"
                    />
                    {form.productId && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setForm(f => ({ ...f, productId: "" }));
                          setProductQuery("");
                          setProductPickerOpen(true);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {productPickerOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-md border border-cyan-100 bg-card shadow-xl">
                      {productMatches.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground">No active product found.</div>
                      ) : productMatches.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          data-testid={`option-order-product-${product.id}`}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/60 ${form.productId === product.id ? "bg-emerald-50 text-emerald-800" : ""}`}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleProductChange(product.id)}
                        >
                          <span className="block font-medium truncate">{product.name}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            Sale {formatCurrency(product.salePrice)} - {product.durationDays} days
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedProduct && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <span className="font-semibold">{selectedProduct.name}</span>
                    <span className="text-emerald-700/80"> - {formatCurrency(selectedProduct.salePrice)}</span>
                  </div>
                )}
              </div>
            </div>

            {quickClientOpen && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-cyan-900">Quick Add Client</p>
                  <Button type="button" variant="ghost" size="icon" className="w-7 h-7" onClick={() => setQuickClientOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input data-testid="input-quick-client-name" placeholder="Client name" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input data-testid="input-quick-client-phone" placeholder="0321-1234567" value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input data-testid="input-quick-client-email" type="email" placeholder="email@example.com" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" data-testid="btn-save-quick-client" disabled={!clientForm.name.trim()} onClick={handleQuickClientSave} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    Add & Select
                  </Button>
                </div>
              </div>
            )}

            {selectedProduct && (
              <div className="rounded-xl border border-cyan-100 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-cyan-50 p-2">
                    <p className="text-cyan-700/70">Unit price</p>
                    <p className="font-bold text-cyan-900">{formatCurrency(selectedProduct.salePrice)}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2">
                    <p className="text-blue-700/70">Order total</p>
                    <p className="font-bold text-blue-900">{formatCurrency(previewTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <p className="text-emerald-700/70">Paid</p>
                    <p className="font-bold text-emerald-900">{formatCurrency(previewPaid)}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <p className="text-amber-700/70">Remaining</p>
                    <p className="font-bold text-amber-900">{formatCurrency(previewRemaining)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Duration {selectedProduct.durationDays} days - Expiry {calcExpiryDate() || "-"} - Status {calcPaymentStatus()}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input data-testid="input-order-quantity" type="number" min="1" value={form.quantity} onChange={e => handleQuantityChange(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Order Total (PKR)</Label>
                <Input data-testid="input-order-total" type="number" min="0" placeholder="Auto from product x qty" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date</Label>
                <Input data-testid="input-order-delivery-date" type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Paid / Received (PKR)</Label>
                <Input data-testid="input-order-paid" type="number" min="0" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Remaining: {formatCurrency(previewRemaining)} - {calcPaymentStatus()}</p>
                {paidExceedsTotal && (
                  <p className="text-xs font-medium text-amber-700">
                    Paid is higher than total, so it will save as {formatCurrency(previewPaid)}.
                  </p>
                )}
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
          <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-cyan-100 bg-white px-5 py-4">
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
