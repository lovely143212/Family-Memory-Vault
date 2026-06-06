import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Upload, Bell, Users, Search, Activity, LogOut, Vault, Menu, X, Share2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/search", label: "AI Search", icon: Search },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/shares", label: "Shares", icon: Share2 },
  { to: "/offline", label: "Offline", icon: ShieldCheck },
  { to: "/family", label: "Family", icon: Users },
  { to: "/activity", label: "Activity", icon: Activity },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-surface px-4 py-3 backdrop-blur">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Vault className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold">Family Vault</span>
        </Link>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 hover:bg-muted">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <div className="md:flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-sidebar transition-transform md:relative md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col p-4">
            <Link to="/dashboard" className="mb-8 hidden items-center gap-2 px-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Vault className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-base font-semibold">Family Vault</div>
                <div className="text-xs text-muted-foreground">Memory & documents</div>
              </div>
            </Link>

            <nav className="flex-1 space-y-1">
              {NAV.map((item) => {
                const active = loc.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-primary-soft text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Button variant="ghost" onClick={signOut} className="justify-start gap-3 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>

        {open && (
          <button
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="Close menu"
          />
        )}

        <main className="min-h-screen flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}