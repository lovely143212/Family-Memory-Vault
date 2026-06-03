import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";
import { Button } from "@/components/ui/button";
import { Trash2, Download, ArrowLeft } from "lucide-react";
import { logActivity } from "@/hooks/use-current-family";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({ meta: [{ title: "Document — Family Vault" }] }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(data.file_path, 3600);
      return { doc: data, url: signed?.signedUrl ?? null };
    },
  });

  async function remove() {
    if (!q.data) return;
    if (!confirm("Delete this document permanently?")) return;
    await supabase.storage.from("documents").remove([q.data.doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity({ family_id: q.data.doc.family_id, action: "deleted", entity_type: "document", entity_id: id, metadata: { title: q.data.doc.title } });
    toast.success("Deleted");
    navigate({ to: "/documents" });
  }

  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!q.data) return <p>Not found</p>;
  const d = q.data.doc;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/documents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Back to documents</Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3"><CategoryBadge value={d.category}/><ExpiryPill date={d.expiry_date}/></div>
          <h1 className="font-display text-3xl font-bold">{d.title}</h1>
          {d.document_number && <p className="mt-1 text-muted-foreground">#{d.document_number}</p>}
        </div>
        <div className="flex gap-2">
          {q.data.url && <Button asChild variant="outline"><a href={q.data.url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4"/>Download</a></Button>}
          <Button onClick={remove} variant="outline" className="text-danger hover:text-danger"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border bg-surface-elevated p-2">
          {q.data.url && d.mime_type?.startsWith("image/") && <img src={q.data.url} alt={d.title} className="w-full rounded-xl"/>}
          {q.data.url && d.mime_type === "application/pdf" && (
            <iframe src={q.data.url} title={d.title} className="h-[70vh] w-full rounded-xl"/>
          )}
        </section>
        <aside className="space-y-4 rounded-2xl border bg-surface-elevated p-6">
          <Field label="Issue date" value={d.issue_date ? format(new Date(d.issue_date), "PP") : "—"}/>
          <Field label="Expiry date" value={d.expiry_date ? format(new Date(d.expiry_date), "PP") : "—"}/>
          <Field label="Document number" value={d.document_number ?? "—"}/>
          <Field label="Uploaded" value={format(new Date(d.created_at), "PPp")}/>
          {d.notes && <div><div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Notes</div><p className="text-sm">{d.notes}</p></div>}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}