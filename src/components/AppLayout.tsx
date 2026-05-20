import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import {
  LayoutDashboard, Users, Package, ShoppingCart,
  CreditCard, Receipt, BarChart3, WalletCards, DatabaseBackup, Repeat2, LogOut, RefreshCw,
  CheckCircle, Menu, RotateCcw, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/owner-wallet", label: "Owner Wallet", icon: WalletCards },
  { href: "/renewals", label: "Renewals", icon: Repeat2 },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/data-tools", label: "Data Tools", icon: DatabaseBackup },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { currentUser, logout } = useAuth();
  const { clients, orders, payments, syncNow, isSyncing, lastSynced, lastSyncError, undoLastDelete, lastDeletedLabel, isSheetSyncEnabled } = useData();
  const { toast } = useToast();
  const [location] = useLocation();
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    if (!lastSyncError) return;
    toast({ title: "Google Sheets sync issue", description: lastSyncError, variant: "destructive" });
  }, [lastSyncError, toast]);

  const globalResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return [];

    const getOrderMatchDetail = (order: typeof orders[number]) => {
      const notes = order.notes.trim();
      if (notes.toLowerCase().includes(query)) {
        return `Notes: ${notes}`;
      }
      return `${order.productName} - ${order.paymentStatus}`;
    };

    const clientResults = clients
      .filter(client =>
        client.name.toLowerCase().includes(query) ||
        client.phone.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
      )
      .slice(0, 4)
      .map(client => ({
        href: `/clients/${client.id}`,
        label: client.name,
        detail: client.phone || client.email || "Client profile",
        type: "Client",
      }));

    const orderResults = orders
      .filter(order =>
        order.clientName.toLowerCase().includes(query) ||
        order.productName.toLowerCase().includes(query) ||
        order.notes.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query)
      )
      .slice(0, 6)
      .map(order => ({
        href: `/orders#order-${order.id}`,
        label: `${order.clientName} - ${order.productName}`,
        detail: getOrderMatchDetail(order),
        type: "Order",
      }));

    const paymentResults = payments
      .filter(payment =>
        payment.clientName.toLowerCase().includes(query) ||
        payment.orderDescription.toLowerCase().includes(query)
      )
      .slice(0, 4)
      .map(payment => ({
        href: "/payments",
        label: payment.clientName,
        detail: `${payment.orderDescription} - ${payment.method}`,
        type: "Payment",
      }));

    return [...clientResults, ...orderResults, ...paymentResults].slice(0, 8);
  }, [clients, orders, payments, globalSearch]);

  function handleUndoDelete() {
    if (undoLastDelete()) {
      toast({ title: "Delete undone", description: `${lastDeletedLabel} restored.` });
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border shrink-0">
        <Link href="/dashboard" onClick={onNavClick} data-testid="nav-logo" className="flex items-center gap-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400">
          <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg shadow-lg" style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)" }}>
            Z
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">ZMT Business</p>
            <p className="text-xs text-cyan-400/60 leading-tight">Dashboard</p>
          </div>
        </Link>
      </div>

      <div className="px-3 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400/60" />
          <input
            data-testid="input-global-search"
            value={globalSearch}
            onChange={event => setGlobalSearch(event.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/60 py-2 pl-9 pr-3 text-sm text-cyan-50 placeholder:text-cyan-400/50 outline-none focus:ring-2 focus:ring-cyan-500"
          />
          {globalSearch && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-lg border border-sidebar-border bg-sidebar shadow-xl">
              {globalResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-cyan-300/60">No results found</div>
              ) : globalResults.map((result, index) => (
                <Link
                  key={`${result.type}-${result.label}-${index}`}
                  href={result.href}
                  onClick={() => {
                    setGlobalSearch("");
                    onNavClick?.();
                  }}
                  className="block px-3 py-2 text-left hover:bg-sidebar-accent"
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60">{result.type}</span>
                  <span className="block truncate text-sm font-semibold text-white">{result.label}</span>
                  <span className="block truncate text-xs text-cyan-300/60">{result.detail}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-5 px-3 overflow-y-auto space-y-0.5">
        <p className="px-2 text-xs font-semibold text-cyan-500/50 uppercase tracking-wider mb-3">Menu</p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/dashboard" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase()}`}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                active
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-900/40"
                  : "text-cyan-200/70 hover:bg-sidebar-accent hover:text-cyan-100"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-cyan-400/60")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        {lastDeletedLabel && (
          <Button
            data-testid="btn-undo-delete"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-cyan-300/70 hover:text-cyan-100 hover:bg-sidebar-accent text-xs gap-2"
            onClick={handleUndoDelete}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo {lastDeletedLabel}
          </Button>
        )}
        {isSheetSyncEnabled && (
          <Button
            data-testid="btn-sync"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-cyan-300/60 hover:text-cyan-100 hover:bg-sidebar-accent text-xs gap-2"
            onClick={syncNow}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            {isSyncing ? "Refreshing..." : lastSynced ? `Refreshed ${lastSynced.toLocaleTimeString()}` : "Refresh Sheets"}
          </Button>
        )}
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white border border-cyan-500/30 shrink-0" style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)" }}>
            ZM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentUser?.name ?? "Business Owner"}</p>
            <p className="text-xs text-cyan-400/60">{currentUser?.role === "showcase" ? "Showcase" : "Admin"}</p>
          </div>
          <Button
            data-testid="btn-logout"
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-cyan-400/60 hover:text-white hover:bg-sidebar-accent shrink-0"
            onClick={logout}
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const currentPage = NAV_ITEMS.find(n => n.href === location || (n.href !== "/dashboard" && location.startsWith(n.href)))?.label ?? "Dashboard";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground flex-col shrink-0 border-r border-sidebar-border sticky top-0 h-screen z-20">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col z-40 shadow-2xl transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-3 right-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-cyan-400/60 hover:text-white hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 h-14 bg-sidebar text-white flex items-center gap-3 px-4 border-b border-sidebar-border shrink-0">
          <Button
            data-testid="btn-mobile-menu"
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-cyan-300/70 hover:text-white hover:bg-sidebar-accent shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400">
            <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)" }}>
              Z
            </div>
            <span className="font-semibold text-sm text-white">{currentPage}</span>
          </Link>
        </div>

        <main className="flex-1 flex flex-col overflow-auto">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
