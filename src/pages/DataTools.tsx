import { useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatabaseBackup, Download, RotateCcw, Upload } from "lucide-react";

export default function DataTools() {
  const {
    clients,
    products,
    orders,
    payments,
    expenses,
    personalExpenses,
    exportData,
    importData,
    lastDeletedLabel,
    undoLastDelete,
  } = useData();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const counts = [
    { label: "Clients", value: clients.length },
    { label: "Products", value: products.length },
    { label: "Orders", value: orders.length },
    { label: "Payments", value: payments.length },
    { label: "Business expenses", value: expenses.length },
    { label: "Personal costs", value: personalExpenses.length },
  ];

  function handleExport() {
    const snapshot = exportData();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zmt-dashboard-backup-${snapshot.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup exported", description: "Your dashboard data was saved as a JSON file." });
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const ok = importData(parsed);
      if (ok) {
        toast({ title: "Backup restored", description: "Dashboard data has been imported." });
      } else {
        toast({ title: "Import failed", description: "This file does not look like a ZMT backup.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Import failed", description: "Could not read this JSON backup.", variant: "destructive" });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleUndo() {
    if (undoLastDelete()) {
      toast({ title: "Delete undone", description: `${lastDeletedLabel} restored.` });
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Data Tools</h1>
            <p className="text-xs text-muted-foreground">Backup, restore, and recovery controls.</p>
          </div>
        </div>
        <Button data-testid="btn-export-backup" onClick={handleExport} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Download className="w-4 h-4 mr-1" /> Export Backup
        </Button>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <p className="text-sm font-semibold text-muted-foreground">Data Tools</p>
        <Button data-testid="btn-export-backup" size="sm" onClick={handleExport} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Download className="w-3.5 h-3.5 mr-1" /> Export
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {counts.map(item => (
            <Card key={item.label} className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Export JSON Backup</CardTitle>
              <CardDescription>Save a full local copy of every dashboard table.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <Badge variant="outline">Latest local data</Badge>
              <p className="text-sm text-muted-foreground">The file includes clients, products, orders, payments, business expenses, and Owner Wallet costs.</p>
              <Button onClick={handleExport} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                <Download className="w-4 h-4 mr-1" /> Export Backup
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Import / Restore</CardTitle>
              <CardDescription>Restore from a previously exported ZMT backup file.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">Import replaces the current local data with the backup contents. Export first if you want a recovery point.</p>
              <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={event => void handleImport(event.target.files?.[0])}
              />
              <Button variant="outline" disabled={importing} onClick={() => inputRef.current?.click()} className="w-full">
                <Upload className="w-4 h-4 mr-1" /> {importing ? "Importing..." : "Choose Backup"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Undo Delete</CardTitle>
              <CardDescription>Restore the most recently deleted record.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {lastDeletedLabel ? `Ready to restore: ${lastDeletedLabel}` : "No deleted record is available right now."}
              </p>
              <Button variant="outline" disabled={!lastDeletedLabel} onClick={handleUndo} className="w-full">
                <RotateCcw className="w-4 h-4 mr-1" /> Undo Last Delete
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Backup Notes</CardTitle>
            <CardDescription>Current export format</CardDescription>
          </CardHeader>
          <CardContent className="p-5 text-sm text-muted-foreground">
            <p>Backup version: 1</p>
            <p>Export date uses your browser clock. Today is {formatDate(new Date().toISOString())}.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
