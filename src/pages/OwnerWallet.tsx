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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  CalendarDays, Pencil, PiggyBank, Plus, Search, Trash2, TrendingDown, WalletCards,
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

const METHOD_COLORS: Record<PersonalExpense["method"], string> = {
  Cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Bank Transfer": "bg-blue-50 text-blue-700 border-blue-200",
  JazzCash: "bg-orange-50 text-orange-700 border-orange-200",
  Easypaisa: "bg-purple-50 text-purple-700 border-purple-200",
  Other: "bg-slate-50 text-slate-600 border-slate-200",
};

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
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: getMonthLabel(key) });
  }
  return options;
}

function getPeriodLabel(monthKey: string) {
  return monthKey === "all" ? "All time" : getMonthLabel(monthKey);
}

function getMonthDayCount(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  return isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate();
}

function getPeriodDayCount(monthKey: string, periodExpenses: PersonalExpense[]) {
  if (monthKey !== "all") return getMonthDayCount(monthKey);

  const dates = periodExpenses
    .map(expense => new Date(expense.expenseDate).getTime())
    .filter(Number.isFinite);
  if (dates.length === 0) return 1;

  const start = new Date(Math.min(...dates));
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
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
  } = useData();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonalExpense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const monthOptions = getMonthOptions();
  const isAllTime = selectedMonth === "all";
  const periodLabel = getPeriodLabel(selectedMonth);
  const totalBusinessExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0) + getOrderCostsTotal(orders, products);
  const dashboardNetProfit = getReceivedTotal(orders, payments) - totalBusinessExpenses;

  const periodBusinessExpenses = useMemo(() => {
    if (isAllTime) return totalBusinessExpenses;
    return expenses.filter(expense => getMonthKey(expense.expenseDate) === selectedMonth)
      .reduce((sum, expense) => sum + expense.amount, 0) + getOrderCostsForMonth(orders, products, selectedMonth);
  }, [expenses, orders, products, selectedMonth, isAllTime, totalBusinessExpenses]);

  const periodBusinessProfit = useMemo(() => {
    if (isAllTime) return dashboardNetProfit;
    return getReceivedForMonth(orders, payments, selectedMonth) - periodBusinessExpenses;
  }, [orders, payments, selectedMonth, isAllTime, dashboardNetProfit, periodBusinessExpenses]);

  const periodPersonalExpenses = useMemo(() => {
    const rows = isAllTime
      ? personalExpenses
      : personalExpenses.filter(expense => getMonthKey(expense.expenseDate) === selectedMonth);
    return [...rows].sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [personalExpenses, selectedMonth, isAllTime]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodPersonalExpenses.filter(expense => {
      const matchesSearch = !query ||
        expense.title.toLowerCase().includes(query) ||
        expense.notes.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "All" || expense.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [periodPersonalExpenses, search, categoryFilter]);

  const periodPersonalTotal = periodPersonalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const personalAllTimeTotal = personalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remainingForPeriod = periodBusinessProfit - periodPersonalTotal;
  const remainingAllTime = dashboardNetProfit - personalAllTimeTotal;
  const dailyAverage = periodPersonalTotal / getPeriodDayCount(selectedMonth, periodPersonalExpenses);

  const categoryData = useMemo(() => {
    const byCategory: Record<string, number> = {};
    periodPersonalExpenses.forEach(expense => {
      byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
    });
    return Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodPersonalExpenses]);

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
    const amount = Math.max(0, Number(form.amount) || 0);
    if (!form.title.trim() || amount <= 0) return;

    const data = {
      title: form.title.trim(),
      category: form.category,
      amount,
      expenseDate: form.expenseDate,
      method: form.method,
      notes: form.notes.trim(),
    };

    if (editTarget) {
      updatePersonalExpense({ ...editTarget, ...data });
      toast({ title: "Personal expense updated" });
    } else {
      addPersonalExpense(data);
      toast({ title: "Personal expense added" });
    }

    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    deletePersonalExpense(id);
    setDeleteId(null);
    toast({ title: "Personal expense deleted", variant: "destructive" });
  }

  const stats = [
    { label: "Business Profit", value: periodBusinessProfit, icon: WalletCards, bg: "bg-cyan-50", color: "text-cyan-600", sub: isAllTime ? "All months total" : periodLabel },
    { label: "Personal Costs", value: periodPersonalTotal, icon: TrendingDown, bg: "bg-rose-50", color: "text-rose-600", sub: periodLabel },
    { label: isAllTime ? "Remaining All Time" : "Remaining This Month", value: remainingForPeriod, icon: PiggyBank, bg: remainingForPeriod >= 0 ? "bg-emerald-50" : "bg-rose-50", color: remainingForPeriod >= 0 ? "text-emerald-600" : "text-rose-600", sub: "Business profit minus personal costs" },
    { label: "Daily Average", value: dailyAverage, icon: CalendarDays, bg: "bg-amber-50", color: "text-amber-600", sub: isAllTime ? "Across all personal costs" : "Personal spend pace" },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <header className="hidden lg:flex h-16 bg-card border-b border-border items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <WalletCards className="w-5 h-5 text-cyan-600" />
          <div>
            <h1 className="text-xl font-bold">Owner Wallet</h1>
            <p className="text-xs text-muted-foreground">Personal costs tracked separately from business expenses.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            data-testid="select-owner-wallet-month"
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value)}
          >
            {monthOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <Button data-testid="btn-add-personal-expense" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Personal Cost
          </Button>
        </div>
      </header>

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border gap-3">
        <select
          data-testid="select-owner-wallet-month"
          className="flex-1 text-sm border border-border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          value={selectedMonth}
          onChange={event => setSelectedMonth(event.target.value)}
        >
          {monthOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        <Button data-testid="btn-add-personal-expense" size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map(({ label, value, icon: Icon, bg, color, sub }) => (
            <Card key={label} className="shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${value < 0 ? "text-rose-600" : "text-foreground"}`}>
                      {formatCurrency(value)}
                    </p>
                  </div>
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Personal Spend Breakdown</CardTitle>
              <CardDescription>{periodLabel} category totals</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {categoryData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                  No personal costs recorded for this period
                </div>
              ) : (
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={8} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickFormatter={value => `Rs ${Number(value) / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                        formatter={(value: number) => [formatCurrency(value), "Personal cost"]}
                      />
                      <Bar dataKey="amount" name="Amount" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold">Wallet Summary</CardTitle>
              <CardDescription>Business profit after owner costs</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                <p className="text-xs text-cyan-700/70">All-time remaining</p>
                <p className={`text-xl font-bold ${remainingAllTime >= 0 ? "text-cyan-900" : "text-rose-700"}`}>{formatCurrency(remainingAllTime)}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Dashboard net profit</span>
                  <span className="font-semibold">{formatCurrency(dashboardNetProfit)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Personal costs total</span>
                  <span className="font-semibold text-rose-600">{formatCurrency(personalAllTimeTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isAllTime ? "Selected period profit" : "This month profit"}</span>
                  <span className="font-semibold">{formatCurrency(periodBusinessProfit)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isAllTime ? "Selected period costs" : "This month costs"}</span>
                  <span className="font-semibold text-rose-600">{formatCurrency(periodPersonalTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isAllTime ? "Selected period remaining" : "This month remaining"}</span>
                  <span className={`font-semibold ${remainingForPeriod >= 0 ? "" : "text-rose-600"}`}>{formatCurrency(remainingForPeriod)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-personal-expenses"
                  placeholder="Search personal costs..."
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-personal-category-filter" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  {CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="shrink-0 self-start sm:self-auto">
                {filteredExpenses.length} - {formatCurrency(filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0))}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Title / Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <div className="space-y-3">
                        <p>No personal costs found.</p>
                        {!search && categoryFilter === "All" && <Button size="sm" onClick={openAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Plus className="w-3.5 h-3.5 mr-1" /> Add First Cost</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.map(expense => (
                  <TableRow key={expense.id} data-testid={`row-personal-expense-${expense.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-semibold text-sm">{expense.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{expense.category}</Badge>
                        <span className="text-xs text-muted-foreground sm:hidden">{formatDate(expense.expenseDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-rose-600 whitespace-nowrap">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={`text-xs ${METHOD_COLORS[expense.method]}`}>{expense.method}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">{formatDate(expense.expenseDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-44 truncate hidden md:table-cell">{expense.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button data-testid={`btn-edit-personal-expense-${expense.id}`} variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(expense)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`btn-delete-personal-expense-${expense.id}`} variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(expense.id)}>
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
            <DialogTitle>{editTarget ? "Edit Personal Cost" : "Add Personal Cost"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input data-testid="input-personal-expense-title" placeholder="Lunch, fuel, home bill..." value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} />
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
                <Label>Amount (PKR) *</Label>
                <Input data-testid="input-personal-expense-amount" type="number" min="0" placeholder="1000" value={form.amount} onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))} />
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
              <Textarea data-testid="input-personal-expense-notes" placeholder="Notes..." value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-save-personal-expense" onClick={handleSave} disabled={!form.title.trim() || !form.amount} className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto">
              {editTarget ? "Save Changes" : "Add Cost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader><DialogTitle>Delete Personal Cost</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure?</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button data-testid="btn-confirm-delete-personal-expense" variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
