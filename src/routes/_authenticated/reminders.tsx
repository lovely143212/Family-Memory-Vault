import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily } from "@/hooks/use-current-family";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders — Family Vault" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const { family } = useCurrentFamily();
  const q = useQuery({
    queryKey: ["reminders", family?.family_id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,title,category,expiry_date")
        .eq("family_id", family!.family_id)
        .not("expiry_date","is", null)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 font-display text-3xl font-bold">Reminders</h1>
      <p className="mb-8 text-muted-foreground">All documents with an expiry date, soonest first.</p>

      <div className="grid gap-3">
        {q.data?.map((d) => (
          <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="flex items-center justify-between rounded-2xl border bg-surface-elevated p-4 hover:border-primary/40">
            <div className="flex items-center gap-3">
              <CategoryBadge value={d.category}/>
              <span className="font-medium">{d.title}</span>
            </div>
            <ExpiryPill date={d.expiry_date}/>
          </Link>
        ))}
        {q.data?.length === 0 && <p className="text-muted-foreground">No documents with expiry dates yet.</p>}
      </div>
    </div>
  );
}