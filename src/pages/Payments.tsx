import { useState } from "react";
import { useData, Payment } from "@/context/DataContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { printPaymentReceipt } from "@/lib/businessActions";
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
import { Search, Plus, Trash2, CreditCard, Printer } from "lucide-react";

const METHODS: Payment["method"][] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Other"];
const emptyForm = { orderId: "", amount: "", method: "Cash" as Payment["method"], paymentDate: new Date().toISOString().slice(0, 10), notes: "" };

const METHOD_COLORS: Record<string, string> = {
  Cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Bank Transfer": "bg-blue-50 text-blue-700 border-blue-200",
  JazzCash: "bg-orange-50 text-orange-700 border-orange-200",
  Easypaisa: "bg-purple-50 text-purple-700 border-purple-200",
  Other: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function Payments() {
  const { payments, orders, addPayment, deletePayment } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = payments.filter(p =>
    p.clientName.toLowerCase().includes(search.toLowerCase()) ||
    p.orderDescription.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
  const unpaidOrders = orders.filter(o => o.paymentStatus !== "Paid" && o.orderStatus !== "Cancelled");

  const selectedOrder = orders.find(o => o.id === form.orderId);

  function openAdd() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.orderId || !form.amount) return;
    const order = orders.find(o => o.id === form.orderId);
    if (!order) return;
    const amount = Math.min(Math.max(0, Number(form.amount) || 0), order.remainingAmount);
    if (amount <= 0) return;
    addPayment({
      orderId: form.orderId,
      clientId: order.clientId,
      clientName: order.clientName,
      orderDescription: order.productName,
      amount,
      method: form.method,
      paymentDate: form.paymentDate,
      notes: form.notes,
    });
    toast({ title: `Payment of ${formatCurrency(amount)} recorded` });
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    deletePayment(id);
    setDeleteId(null);
    toast({ title: "Payment deleted", variant: "destructive" });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Payments</h1>
            <p className="text-xs text-muted-foreground">{payments.length} records - Total: {formatCurrency(totalReceived)}</p>
          </div>
        </div>
        <Button data-testid="btn-add-payment" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Record Payment
        </Button>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{payments.length} records</p>
          <p className="text-xs text-muted-foreground">Total: {formatCurrency(totalReceived)}</p>
        </div>
        <Button data-testid="btn-add-payment" size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Record
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-search-payments" placeholder="Search by client or order..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Badge variant="outline" className="shrink-0">{filtered.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client / Order</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      <div className="space-y-3">
                        <p>No payments recorded yet.</p>
                        {unpaidOrders.length > 0 && <Button size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Plus className="w-3.5 h-3.5 mr-1" /> Record First Payment</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : [...filtered].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).map(p => (
                  <TableRow key={p.id} data-testid={`row-payment-${p.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-semibold text-sm">{p.clientName}</p>
                      <p className="text-xs text-muted-foreground">{p.orderDescription}</p>
                      <div className="flex items-center gap-2 sm:hidden mt-0.5">
                        <Badge variant="outline" className={`text-xs ${METHOD_COLORS[p.method] || ""}`}>{p.method}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(p.paymentDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={`text-xs ${METHOD_COLORS[p.method] || ""}`}>{p.method}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">{formatDate(p.paymentDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button data-testid={`btn-print-payment-${p.id}`} variant="ghost" size="icon" className="w-8 h-8" onClick={() => printPaymentReceipt(p)}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`btn-delete-payment-${p.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
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
        <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Order *</Label>
              <Select value={form.orderId} onValueChange={v => setForm(f => ({ ...f, orderId: v, amount: "" }))}>
                <SelectTrigger data-testid="select-payment-order">
                  <SelectValue placeholder="Choose an order..." />
                </SelectTrigger>
                <SelectContent>
                  {unpaidOrders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.clientName} - {o.productName} ({formatCurrency(o.remainingAmount)} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOrder && (
                <div className="text-xs text-muted-foreground bg-muted rounded p-2 space-y-0.5">
                  <p>Total: {formatCurrency(selectedOrder.totalAmount)} | Paid: {formatCurrency(selectedOrder.paidAmount)}</p>
                  <p>Remaining: <span className="font-semibold text-amber-600">{formatCurrency(selectedOrder.remainingAmount)}</span></p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (PKR) *</Label>
                <Input
                  data-testid="input-payment-amount"
                  type="number"
                  min="0"
                  max={selectedOrder?.remainingAmount}
                  placeholder={selectedOrder ? String(selectedOrder.remainingAmount) : "0"}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v as Payment["method"] }))}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input data-testid="input-payment-date" type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="input-payment-notes" placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-payment" onClick={handleSave} disabled={!form.orderId || !form.amount} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto">
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader><DialogTitle>Delete Payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure?</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete-payment" variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
