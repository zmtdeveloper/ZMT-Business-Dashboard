import { useState } from "react";
import { useData, Expense } from "@/context/DataContext";
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
import { Search, Plus, Pencil, Trash2, Receipt } from "lucide-react";

const CATEGORIES: Expense["category"][] = ["Product Cost", "Delivery", "Marketing / Ads", "Salary", "Office", "Software / Tools", "Other"];
const emptyForm = { title: "", category: "Other" as Expense["category"], amount: "", expenseDate: new Date().toISOString().slice(0, 10), notes: "" };

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = expenses.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || e.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(e: Expense) {
    setEditTarget(e);
    setForm({ title: e.title, category: e.category, amount: String(e.amount), expenseDate: e.expenseDate, notes: e.notes });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.amount) return;
    const data = { title: form.title, category: form.category, amount: Number(form.amount), expenseDate: form.expenseDate, notes: form.notes };
    if (editTarget) {
      updateExpense({ ...editTarget, ...data });
      toast({ title: "Expense updated" });
    } else {
      addExpense(data);
      toast({ title: "Expense added" });
    }
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    deleteExpense(id);
    setDeleteId(null);
    toast({ title: "Expense deleted", variant: "destructive" });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Expenses</h1>
            <p className="text-xs text-muted-foreground">{expenses.length} records - Total: {formatCurrency(grandTotal)}</p>
          </div>
        </div>
        <Button data-testid="btn-add-expense" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{expenses.length} records</p>
          <p className="text-xs text-muted-foreground">Total: {formatCurrency(grandTotal)}</p>
        </div>
        <Button data-testid="btn-add-expense" size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-search-expenses" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="shrink-0 self-start sm:self-auto">{filtered.length} - {formatCurrency(total)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Title / Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      <div className="space-y-3">
                        <p>No expenses found.</p>
                        {!search && categoryFilter === "All" && <Button size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Plus className="w-3.5 h-3.5 mr-1" /> Add First Expense</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : [...filtered].sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(e => (
                  <TableRow key={e.id} data-testid={`row-expense-${e.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-semibold text-sm">{e.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{e.category}</Badge>
                        <span className="text-xs text-muted-foreground sm:hidden">{formatDate(e.expenseDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-rose-600 whitespace-nowrap">{formatCurrency(e.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">{formatDate(e.expenseDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-40 truncate hidden md:table-cell">{e.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button data-testid={`btn-edit-expense-${e.id}`} variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(e)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`btn-delete-expense-${e.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}>
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
            <DialogTitle>{editTarget ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input data-testid="input-expense-title" placeholder="Facebook Ads - Month" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as Expense["category"] }))}>
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (PKR) *</Label>
                <Input data-testid="input-expense-amount" type="number" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input data-testid="input-expense-date" type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="input-expense-notes" placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-expense" onClick={handleSave} disabled={!form.title.trim() || !form.amount} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto">
              {editTarget ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader><DialogTitle>Delete Expense</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure?</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete-expense" variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
