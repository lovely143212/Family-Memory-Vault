import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily } from "@/hooks/use-current-family";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";
import { FileText, Bell, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Family Vault" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { family } = useCurrentFamily();

  const stats = useQuery({
    queryKey: ["dashboard-stats", family?.family_id],
    enabled: !!family,
    queryFn: async () => {
      const familyId = family!.family_id;
      const { count: total } = await supabase
        .from("documents").select("*", { count: "exact", head: true }).eq("family_id", familyId);
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const { data: expiring } = await supabase
        .from("documents").select("id,title,category,expiry_date")
        .eq("family_id", familyId)
        .not("expiry_date", "is", null)
        .lte("expiry_date", in30.toISOString().slice(0, 10))
        .order("expiry_date", { ascending: true }).limit(5);
      const { data: recent } = await supabase
        .from("documents").select("id,title,category,created_at")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false }).limit(5);
      return { total: total ?? 0, expiring: expiring ?? [], recent: recent ?? [] };
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{family?.families.name ?? "Your vault"} overview</p>
        </div>
        <Button asChild><Link to="/upload"><Upload className="mr-2 h-4 w-4"/>Upload document</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={FileText} label="Total documents" value={stats.data?.total ?? 0} tone="primary"/>
        <StatCard icon={AlertTriangle} label="Expiring (30d)" value={stats.data?.expiring.length ?? 0} tone="warning"/>
        <StatCard icon={Bell} label="Recent uploads" value={stats.data?.recent.length ?? 0} tone="success"/>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-surface-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Expiring soon</h2>
            <Link to="/reminders" className="text-sm text-primary">View all</Link>
          </div>
          <ul className="space-y-3">
            {(stats.data?.expiring ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border bg-surface p-3">
                <div className="flex items-center gap-3">
                  <CategoryBadge value={d.category}/>
                  <span className="font-medium">{d.title}</span>
                </div>
                <ExpiryPill date={d.expiry_date}/>
              </li>
            ))}
            {stats.data?.expiring.length === 0 && <p className="text-sm text-muted-foreground">Nothing expiring in the next 30 days.</p>}
          </ul>
        </section>

        <section className="rounded-2xl border bg-surface-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent uploads</h2>
            <Link to="/documents" className="text-sm text-primary">View all</Link>
          </div>
          <ul className="space-y-3">
            {(stats.data?.recent ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border bg-surface p-3">
                <div className="flex items-center gap-3">
                  <CategoryBadge value={d.category}/>
                  <span className="font-medium">{d.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
              </li>
            ))}
            {stats.data?.recent.length === 0 && <p className="text-sm text-muted-foreground">No documents yet. Upload your first one!</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "primary"|"warning"|"success" }) {
  const toneCls = tone === "primary" ? "bg-primary-soft text-primary" : tone === "warning" ? "bg-warning/15 text-warning" : "bg-success/15 text-success";
  return (
    <div className="rounded-2xl border bg-surface-elevated p-6">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${toneCls}`}>
        <Icon className="h-5 w-5"/>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}