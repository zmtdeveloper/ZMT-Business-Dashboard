import { useMemo, useState } from "react";
import { useData, PersonalExpense } from "@/context/DataContext";
import { formatCurrency, formatDate, getMonthKey, getMonthLabel } from "@/lib/format";
import {
  getOrderCostsForMonth,
  getOrderCostsTotal,
  getReceivedForMonth,
  getReceivedTotal,
} from "@/lib/finance";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CalendarDays,
  CheckCircle2,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  WalletCards,
} from "lucide-react";

const CATEGORIES: PersonalExpense["category"][] = [
  "Food",
  "Fuel",
  "Home",
  "Family",
  "Rent",
  "Utilities",
  "Travel",
  "Personal",
  "Health",
  "Other",
];

const METHODS: PersonalExpense["method"][] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Other"];

const emptyForm = {
  title: "",
  category: "Food" as PersonalExpense["category"],
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  method: "Cash" as PersonalExpense["method"],
  notes: "",
};

function getMonthOptions() {
  const options = [{ key: "all", label: "All Time" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: getMonthLabel(key) });
  }
  return options;
}

function getPeriodLabel(monthKey: string) {
  return monthKey === "all" ? "All time" : getMonthLabel(monthKey);
}

function getDayCount(monthKey: string, rows: PersonalExpense[]) {
  if (monthKey !== "all") {
    const [year, month] = monthKey.split("-").map(Number);
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    return isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate();
  }

  const times = rows.map(row => new Date(row.expenseDate).getTime()).filter(Number.isFinite);
  if (times.length === 0) return 1;

  const first = new Date(Math.min(...times));
  const today = new Date();
  first.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((today.getTime() - first.getTime()) / 86400000) + 1);
}

function toAmount(value: string) {
  return Math.max(0, Number(value.replace(/,/g, "")) || 0);
}

export default function OwnerWallet() {
  const {
    orders,
    payments,
    expenses,
    products,
    personalExpenses,
    addPersonalExpense,
    updatePersonalExpense,
    deletePersonalExpense,
    isSheetSyncEnabled,
    isSyncing,
    lastSynced,
    lastSyncError,
  } = useData();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonalExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonalExpense | null>(null);
  const [form, setForm] = useState(emptyForm);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const isAllTime = selectedMonth === "all";
  const periodLabel = getPeriodLabel(selectedMonth);

  const allBusinessCosts = expenses.reduce((sum, expense) => sum + expense.amount, 0) + getOrderCostsTotal(orders, products);
  const allBusinessProfit = getReceivedTotal(orders, payments) - allBusinessCosts;

  const periodBusinessCosts = useMemo(() => {
    if (isAllTime) return allBusinessCosts;
    const manualCosts = expenses
      .filter(expense => getMonthKey(expense.expenseDate) === selectedMonth)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return manualCosts + getOrderCostsForMonth(orders, products, selectedMonth);
  }, [allBusinessCosts, expenses, isAllTime, orders, products, selectedMonth]);

  const periodBusinessProfit = useMemo(() => {
    if (isAllTime) return allBusinessProfit;
    return getReceivedForMonth(orders, payments, selectedMonth) - periodBusinessCosts;
  }, [allBusinessProfit, isAllTime, orders, payments, periodBusinessCosts, selectedMonth]);

  const periodRows = useMemo(() => {
    const rows = isAllTime
      ? personalExpenses
      : personalExpenses.filter(expense => getMonthKey(expense.expenseDate) === selectedMonth);

    return [...rows].sort((a, b) => {
      const dateDiff = new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
      return dateDiff || b.createdAt.localeCompare(a.createdAt);
    });
  }, [isAllTime, personalExpenses, selectedMonth]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodRows.filter(expense => {
      const matchesSearch = !query ||
        expense.title.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query) ||
        expense.method.toLowerCase().includes(query) ||
        expense.notes.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "All" || expense.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, periodRows, search]);

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    periodRows.forEach(expense => {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    });
    return Array.from(totals, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodRows]);

  const periodPersonalTotal = periodRows.reduce((sum, expense) => sum + expense.amount, 0);
  const allPersonalTotal = personalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const periodRemaining = periodBusinessProfit - periodPersonalTotal;
  const allRemaining = allBusinessProfit - allPersonalTotal;
  const dailyAverage = periodPersonalTotal / getDayCount(selectedMonth, periodRows);
  const filteredTotal = filteredRows.reduce((sum, expense) => sum + expense.amount, 0);

  const stats = [
    {
      label: "Business Profit",
      value: periodBusinessProfit,
      sub: isAllTime ? "All months" : periodLabel,
      icon: WalletCards,
      tone: "text-cyan-600 bg-cyan-50",
    },
    {
      label: "Owner Spend",
      value: periodPersonalTotal,
      sub: `${periodRows.length} entries`,
      icon: TrendingDown,
      tone: "text-rose-600 bg-rose-50",
    },
    {
      label: "Remaining",
      value: periodRemaining,
      sub: "After personal costs",
      icon: PiggyBank,
      tone: periodRemaining >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
    },
    {
      label: "Daily Average",
      value: dailyAverage,
      sub: isAllTime ? "Since first entry" : "This period pace",
      icon: CalendarDays,
      tone: "text-amber-600 bg-amber-50",
    },
  ];

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(expense: PersonalExpense) {
    setEditTarget(expense);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate,
      method: expense.method,
      notes: expense.notes,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const amount = toAmount(form.amount);
    const title = form.title.trim();

    if (!title || amount <= 0) {
      toast({ title: "Title and amount are required", variant: "destructive" });
      return;
    }

    const payload = {
      title,
      category: form.category,
      amount,
      expenseDate: form.expenseDate,
      method: form.method,
      notes: form.notes.trim(),
    };

    if (editTarget) {
      updatePersonalExpense({ ...editTarget, ...payload });
      toast({ title: "Owner cost updated" });
    } else {
      addPersonalExpense(payload);
      toast({ title: "Owner cost added" });
    }

    setDialogOpen(false);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deletePersonalExpense(deleteTarget.id);
    toast({ title: "Owner cost deleted", variant: "destructive" });
    setDeleteTarget(null);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <WalletCards className="h-5 w-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Owner Wallet</h1>
            <p className="text-xs text-muted-foreground">Personal spending kept separate from business expenses.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            data-testid="select-owner-wallet-month"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value)}
          >
            {monthOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <Button data-testid="btn-add-personal-expense" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Plus className="mr-1 h-4 w-4" />
            Add Owner Cost
          </Button>
        </div>
      </header>

      <div className="lg:hidden flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <select
          data-testid="select-owner-wallet-month-mobile"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500"
          value={selectedMonth}
          onChange={event => setSelectedMonth(event.target.value)}
        >
          {monthOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        <Button size="sm" data-testid="btn-add-personal-expense-mobile" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <main className="flex-1 space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
        {lastSyncError && lastSyncError.includes("Owner Wallet") && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {lastSyncError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, sub, icon: Icon, tone }) => (
            <Card key={label} className="shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className={`mt-1 truncate text-lg font-bold sm:text-2xl ${value < 0 ? "text-rose-600" : "text-foreground"}`}>
                      {formatCurrency(value)}
                    </p>
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">Owner Cost Ledger</CardTitle>
                  <CardDescription>{periodLabel} records</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      data-testid="input-search-personal-expenses"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="Search costs..."
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger data-testid="select-personal-category-filter" className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Categories</SelectItem>
                      {CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground">{filteredRows.length} shown</span>
                <span className="font-semibold text-rose-600">{formatCurrency(filteredTotal)}</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Cost</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden sm:table-cell">Method</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          <div className="space-y-3">
                            <p>No owner costs found.</p>
                            {!search && categoryFilter === "All" && (
                              <Button size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add First Cost
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredRows.map(expense => (
                      <TableRow key={expense.id} data-testid={`row-personal-expense-${expense.id}`} className="hover:bg-muted/30">
                        <TableCell>
                          <p className="text-sm font-semibold">{expense.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs">{expense.category}</Badge>
                            <span className="text-xs text-muted-foreground sm:hidden">{formatDate(expense.expenseDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-rose-600">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{expense.method}</Badge>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground sm:table-cell">{formatDate(expense.expenseDate)}</TableCell>
                        <TableCell className="hidden max-w-52 truncate text-sm text-muted-foreground md:table-cell">{expense.notes || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button data-testid={`btn-edit-personal-expense-${expense.id}`} variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button data-testid={`btn-delete-personal-expense-${expense.id}`} variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(expense)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base">Wallet Summary</CardTitle>
                <CardDescription>{periodLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
                  <p className="text-xs text-cyan-700">All-time remaining</p>
                  <p className={`text-xl font-bold ${allRemaining >= 0 ? "text-cyan-950" : "text-rose-700"}`}>{formatCurrency(allRemaining)}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Business profit</span>
                    <span className="font-semibold">{formatCurrency(periodBusinessProfit)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Owner costs</span>
                    <span className="font-semibold text-rose-600">{formatCurrency(periodPersonalTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className={`font-semibold ${periodRemaining < 0 ? "text-rose-600" : ""}`}>{formatCurrency(periodRemaining)}</span>
                  </div>
                </div>
                {isSheetSyncEnabled && (
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                    {isSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    <span>{isSyncing ? "Syncing PersonalExpenses..." : lastSynced ? `Synced ${lastSynced.toLocaleTimeString()}` : "Google Sheets ready"}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base">Category Breakdown</CardTitle>
                <CardDescription>{periodRows.length} entries</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {categoryData.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No category data</div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={value => `Rs ${Number(value) / 1000}k`} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                          formatter={(value: number) => [formatCurrency(value), "Amount"]}
                        />
                        <Bar dataKey="amount" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Owner Cost" : "Add Owner Cost"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input data-testid="input-personal-expense-title" value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Fuel, lunch, home bill..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={value => setForm(prev => ({ ...prev, category: value as PersonalExpense["category"] }))}>
                  <SelectTrigger data-testid="select-personal-expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input data-testid="input-personal-expense-amount" value={form.amount} onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))} inputMode="decimal" placeholder="1000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input data-testid="input-personal-expense-date" type="date" value={form.expenseDate} onChange={event => setForm(prev => ({ ...prev, expenseDate: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={value => setForm(prev => ({ ...prev, method: value as PersonalExpense["method"] }))}>
                  <SelectTrigger data-testid="select-personal-expense-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="input-personal-expense-notes" value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} rows={2} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-personal-expense" onClick={handleSave} className="w-full bg-cyan-600 text-white hover:bg-cyan-700 sm:w-auto">
              {editTarget ? "Save Changes" : "Add Cost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Owner Cost</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget ? `Delete "${deleteTarget.title}" from Owner Wallet?` : "Delete this owner cost?"}
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete-personal-expense" variant="destructive" onClick={confirmDelete} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
