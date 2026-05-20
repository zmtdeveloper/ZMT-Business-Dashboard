import { useState } from "react";
import { useData, Product } from "@/context/DataContext";
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
import { Search, Plus, Pencil, Trash2, Package } from "lucide-react";

const emptyForm = { name: "", salePrice: "", costPrice: "", durationDays: "30", status: "Active" as Product["status"], notes: "" };

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setForm({ name: p.name, salePrice: String(p.salePrice), costPrice: String(p.costPrice), durationDays: String(p.durationDays), status: p.status, notes: p.notes });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      salePrice: Number(form.salePrice) || 0,
      costPrice: Number(form.costPrice) || 0,
      durationDays: Number(form.durationDays) || 30,
      status: form.status,
      notes: form.notes,
    };
    if (editTarget) {
      updateProduct({ ...editTarget, ...data });
      toast({ title: "Product updated" });
    } else {
      addProduct(data);
      toast({ title: "Product added" });
    }
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    const deleted = deleteProduct(id);
    setDeleteId(null);
    if (!deleted) {
      toast({ title: "Product has linked orders", description: "Delete or renew those orders before removing the product.", variant: "destructive" });
      return;
    }
    toast({ title: "Product deleted", variant: "destructive" });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Products</h1>
            <p className="text-xs text-muted-foreground">{products.length} products</p>
          </div>
        </div>
        <Button data-testid="btn-add-product" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <p className="text-sm font-semibold text-muted-foreground">{products.length} products</p>
        <Button data-testid="btn-add-product" size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-search-products" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Badge variant="outline" className="shrink-0">{filtered.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead className="hidden sm:table-cell">Cost</TableHead>
                  <TableHead className="hidden sm:table-cell">Profit</TableHead>
                  <TableHead className="hidden md:table-cell">Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <div className="space-y-3">
                        <p>{search ? "No products match your search" : "No products yet."}</p>
                        {!search && <Button size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Plus className="w-3.5 h-3.5 mr-1" /> Add First Product</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} data-testid={`row-product-${p.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{p.durationDays}d</p>
                    </TableCell>
                    <TableCell className="font-semibold text-emerald-600 whitespace-nowrap">{formatCurrency(p.salePrice)}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell whitespace-nowrap">{formatCurrency(p.costPrice)}</TableCell>
                    <TableCell className="font-medium text-cyan-600 hidden sm:table-cell whitespace-nowrap">{formatCurrency(p.salePrice - p.costPrice)}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{p.durationDays} days</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button data-testid={`btn-edit-product-${p.id}`} variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`btn-delete-product-${p.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
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
            <DialogTitle>{editTarget ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input data-testid="input-product-name" placeholder="Social Media Package" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sale Price (PKR)</Label>
                <Input data-testid="input-product-sale-price" type="number" placeholder="15000" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Price (optional)</Label>
                <Input data-testid="input-product-cost-price" type="number" placeholder="3000" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Only used for profit and expense reports.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (days)</Label>
                <Input data-testid="input-product-duration" type="number" placeholder="30" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Product["status"] }))}>
                  <SelectTrigger data-testid="select-product-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="input-product-notes" placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-product" onClick={handleSave} disabled={!form.name.trim()} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto">
              {editTarget ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader><DialogTitle>Delete Product</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete-product" variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
