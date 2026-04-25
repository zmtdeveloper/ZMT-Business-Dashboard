import { useState } from "react";
import { useData, Client } from "@/context/DataContext";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Pencil, Trash2, Users } from "lucide-react";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

export default function Clients() {
  const { clients, addClient, updateClient, deleteClient } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: Client) {
    setEditTarget(c);
    setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editTarget) {
      updateClient({ ...editTarget, ...form });
      toast({ title: "Client updated successfully" });
    } else {
      addClient(form);
      toast({ title: "Client added successfully" });
    }
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    deleteClient(id);
    setDeleteId(null);
    toast({ title: "Client deleted", variant: "destructive" });
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Clients</h1>
            <p className="text-xs text-muted-foreground">{clients.length} total clients</p>
          </div>
        </div>
        <Button data-testid="btn-add-client" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Client
        </Button>
      </header>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <p className="text-sm font-semibold text-muted-foreground">{clients.length} clients</p>
        <Button data-testid="btn-add-client" size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Client
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-clients"
                  placeholder="Search by name, phone or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="outline" className="shrink-0 self-start sm:self-auto">{filtered.length} results</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                  <TableHead className="hidden lg:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {search ? "No clients match your search" : "No clients yet. Add your first client."}
                    </TableCell>
                  </TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id} data-testid={`row-client-${c.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{c.phone || "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{c.phone || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{c.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-36 truncate hidden md:table-cell">{c.address || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">{formatDate(c.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button data-testid={`btn-edit-client-${c.id}`} variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`btn-delete-client-${c.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
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
            <DialogTitle>{editTarget ? "Edit Client" : "Add New Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Name *</Label>
              <Input id="client-name" data-testid="input-client-name" placeholder="Ahmed Ali" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Phone</Label>
                <Input id="client-phone" data-testid="input-client-phone" placeholder="0321-1234567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-email">Email</Label>
                <Input id="client-email" data-testid="input-client-email" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-address">Address</Label>
              <Input id="client-address" data-testid="input-client-address" placeholder="Lahore, Punjab" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-notes">Notes</Label>
              <Textarea id="client-notes" data-testid="input-client-notes" placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-client" onClick={handleSave} disabled={!form.name.trim()} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto">
              {editTarget ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete" variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
