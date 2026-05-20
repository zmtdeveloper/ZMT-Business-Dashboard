import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import Payments from "@/pages/Payments";
import Expenses from "@/pages/Expenses";
import OwnerWallet from "@/pages/OwnerWallet";
import Renewals from "@/pages/Renewals";
import Reports from "@/pages/Reports";
import DataTools from "@/pages/DataTools";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/clients/:id">
        {() => <ProtectedRoute component={ClientDetail} />}
      </Route>
      <Route path="/clients">
        {() => <ProtectedRoute component={Clients} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={Products} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={Orders} />}
      </Route>
      <Route path="/payments">
        {() => <ProtectedRoute component={Payments} />}
      </Route>
      <Route path="/expenses">
        {() => <ProtectedRoute component={Expenses} />}
      </Route>
      <Route path="/owner-wallet">
        {() => <ProtectedRoute component={OwnerWallet} />}
      </Route>
      <Route path="/renewals">
        {() => <ProtectedRoute component={Renewals} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/data-tools">
        {() => <ProtectedRoute component={DataTools} />}
      </Route>
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <DataProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  );
}

export default App;
