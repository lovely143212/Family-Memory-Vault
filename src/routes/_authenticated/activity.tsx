import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily } from "@/hooks/use-current-family";
import { formatDistanceToNow } from "date-fns";
import { Activity as ActIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — Family Vault" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { family } = useCurrentFamily();
  const q = useQuery({
    queryKey: ["activity", family?.family_id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id,action,entity_type,metadata,created_at,profiles:user_id(full_name)")
        .eq("family_id", family!.family_id)
        .order("created_at",{ ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 font-display text-3xl font-bold">Activity</h1>
      <p className="mb-8 text-muted-foreground">Audit log of everything that happens in your vault.</p>

      <ol className="space-y-2">
        {q.data?.map((a) => {
          const meta = (a.metadata as { title?: string; email?: string; role?: string } | null);
          const who = (a.profiles as { full_name?: string|null } | null)?.full_name ?? "Someone";
          return (
            <li key={a.id} className="flex items-start gap-3 rounded-xl border bg-surface-elevated p-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary"><ActIcon className="h-4 w-4"/></div>
              <div className="flex-1">
                <div className="text-sm"><span className="font-medium">{who}</span> {a.action} {a.entity_type ?? ""} {meta?.title ? `"${meta.title}"` : meta?.email ? meta.email : ""}</div>
                <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
              </div>
            </li>
          );
        })}
        {q.data?.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
      </ol>
    </div>
  );
}