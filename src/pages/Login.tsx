import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export default function Login() {
  const { login, isAuthenticated, isAuthConfigured } = useAuth();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!isAuthConfigured) {
      setError("Authentication is not configured. Contact the system administrator.");
      setLoading(false);
      return;
    }
    setTimeout(() => {
      const ok = login(password);
      if (ok) {
        setLocation("/dashboard");
      } else {
        setError("Incorrect password. Please try again.");
        setPassword("");
      }
      setLoading(false);
    }, 400);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, hsl(199,85%,9%) 0%, hsl(190,80%,16%) 50%, hsl(185,70%,22%) 100%)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-cyan-900/60 border border-cyan-400/30" style={{ background: "linear-gradient(135deg, #0891b2, #06b6d4)" }}>
            <span className="text-white font-bold text-2xl drop-shadow">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ZMT Business</h1>
          <p className="text-cyan-300/70 text-sm">Business Management Dashboard</p>
        </div>

        <Card className="border-cyan-800/40 shadow-2xl" style={{ background: "rgba(0,40,55,0.85)", backdropFilter: "blur(12px)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" /> Sign In
            </CardTitle>
            <CardDescription className="text-cyan-300/60">Enter your password to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-cyan-200 text-sm">Password</Label>
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-cyan-950/60 border-cyan-700/50 text-white placeholder:text-cyan-600 focus:border-cyan-400"
                  autoFocus
                />
              </div>
              {error && (
                <p data-testid="text-error" className="text-red-400 text-sm">{error}</p>
              )}
              <Button
                data-testid="btn-login"
                type="submit"
                className="w-full font-semibold text-white shadow-lg shadow-cyan-900/40"
                style={{ background: "linear-gradient(135deg, #0891b2, #06b6d4)" }}
                disabled={loading || !password || !isAuthConfigured}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
