import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";
import { Sparkles, Search } from "lucide-react";
import { aiSearchDocuments } from "@/lib/search.functions";
import { useCurrentFamily } from "@/hooks/use-current-family";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — Family Vault" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { family } = useCurrentFamily();
  const aiSearch = useServerFn(aiSearchDocuments);

  const res = useQuery({
    queryKey: ["ai-search", family?.family_id, q],
    enabled: !!family && q.trim().length > 1,
    queryFn: async () => {
      const r = await aiSearch({ data: { query: q.trim(), family_id: family!.family_id } });
      if (!r.ok) return { items: [] as ResultItem[], reasoning: r.error ?? "" };
      const ids = r.results.map((x) => x.id);
      if (ids.length === 0) return { items: [] as ResultItem[], reasoning: "No matches" };
      const { data } = await supabase
        .from("documents")
        .select("id,title,category,expiry_date,document_number,notes")
        .in("id", ids);
      const byId = new Map((data ?? []).map((d) => [d.id, d]));
      const items: ResultItem[] = r.results.flatMap((x) => {
        const d = byId.get(x.id);
        return d ? [{ ...d, reason: x.reason }] : [];
      });
      return { items, reasoning: r.reasoning ?? "" };
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 inline-flex items-center gap-2 font-display text-3xl font-bold">
        <Sparkles className="h-6 w-6 text-primary"/> AI search
      </h1>
      <p className="mb-6 text-muted-foreground">Ask in plain language — try "expiring passport", "car insurance", "Aadhaar".</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, number or notes…" className="pl-10 h-12 text-base"/>
      </div>

      <div className="grid gap-2">
        {res.isFetching && <p className="text-sm text-muted-foreground">Thinking…</p>}
        {res.data?.items.map((d) => (
          <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="flex items-center justify-between gap-3 rounded-xl border bg-surface-elevated p-3 hover:border-primary/40">
            <div className="flex min-w-0 items-center gap-3">
              <CategoryBadge value={d.category}/>
              <div className="min-w-0">
                <div className="truncate font-medium">{d.title}</div>
                {d.reason && <div className="truncate text-xs text-muted-foreground">{d.reason}</div>}
              </div>
            </div>
            <ExpiryPill date={d.expiry_date}/>
          </Link>
        ))}
        {q.trim().length > 1 && !res.isFetching && res.data && res.data.items.length === 0 && (
          <p className="text-muted-foreground">No matches.</p>
        )}
      </div>
    </div>
  );
}

type ResultItem = {
  id: string;
  title: string;
  category: string;
  expiry_date: string | null;
  document_number: string | null;
  notes: string | null;
  reason?: string;
};