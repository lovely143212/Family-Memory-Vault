import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily } from "@/hooks/use-current-family";
import { CATEGORIES } from "@/lib/categories";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — Family Vault" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { family } = useCurrentFamily();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const docs = useQuery({
    queryKey: ["documents", family?.family_id, cat, q],
    enabled: !!family,
    queryFn: async () => {
      let query = supabase
        .from("documents")
        .select("id,title,category,expiry_date,file_path,mime_type,created_at,document_number")
        .eq("family_id", family!.family_id)
        .order("created_at", { ascending: false });
      if (cat !== "all") query = query.eq("category", cat as never);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">Your family's secure archive</p>
        </div>
        <Button asChild><Link to="/upload"><Upload className="mr-2 h-4 w-4"/>Upload</Link></Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="pl-10"/>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={cat === "all"} onClick={() => setCat("all")}>All</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.value} active={cat === c.value} onClick={() => setCat(c.value)}>{c.label}</FilterChip>
        ))}
      </div>

      <div className="grid gap-3">
        {docs.data?.map((d) => (
          <Link key={d.id} to="/documents/$id" params={{ id: d.id }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface-elevated p-4 transition hover:border-primary/40 hover:shadow-sm">
            <div className="flex items-center gap-4">
              <CategoryBadge value={d.category}/>
              <div>
                <div className="font-medium">{d.title}</div>
                {d.document_number && <div className="text-xs text-muted-foreground">#{d.document_number}</div>}
              </div>
            </div>
            <ExpiryPill date={d.expiry_date}/>
          </Link>
        ))}
        {docs.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-surface p-10 text-center text-muted-foreground">
            No documents found. <Link to="/upload" className="text-primary">Upload your first one →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted",
    )}>{children}</button>
  );
}