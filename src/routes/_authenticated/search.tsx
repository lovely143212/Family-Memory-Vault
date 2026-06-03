import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — Family Vault" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const res = useQuery({
    queryKey: ["search", q],
    enabled: q.trim().length > 1,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      const { data, error } = await supabase
        .from("documents")
        .select("id,title,category,expiry_date,document_number,notes")
        .or(`title.ilike.${term},document_number.ilike.${term},notes.ilike.${term}`)
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 font-display text-3xl font-bold">Search</h1>
      <p className="mb-6 text-muted-foreground">Find documents across all your families.</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, number or notes…" className="pl-10 h-12 text-base"/>
      </div>

      <div className="grid gap-2">
        {res.data?.map((d) => (
          <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="flex items-center justify-between rounded-xl border bg-surface-elevated p-3 hover:border-primary/40">
            <div className="flex items-center gap-3">
              <CategoryBadge value={d.category}/>
              <div>
                <div className="font-medium">{d.title}</div>
                {d.document_number && <div className="text-xs text-muted-foreground">#{d.document_number}</div>}
              </div>
            </div>
            <ExpiryPill date={d.expiry_date}/>
          </Link>
        ))}
        {q.trim().length > 1 && res.data?.length === 0 && <p className="text-muted-foreground">No matches.</p>}
      </div>
    </div>
  );
}