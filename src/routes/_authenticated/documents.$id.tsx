import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryBadge } from "@/components/category-badge";
import { ExpiryPill } from "@/components/expiry-pill";
import { DocumentViewer } from "@/components/document-viewer";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowLeft, Star, Pin, CloudDownload, CloudOff, Share2 } from "lucide-react";
import { logActivity } from "@/hooks/use-current-family";
import { cacheDocument, removeCached, isCached } from "@/lib/offline-vault";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({ meta: [{ title: "Document — Family Vault" }] }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);

  const q = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(data.file_path, 3600);
      return { doc: data, url: signed?.signedUrl ?? null };
    },
  });

  // Record a view + check offline cache
  useEffect(() => {
    if (!q.data) return;
    (async () => {
      setOffline(await isCached(id));
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("document_views").insert({
          document_id: id,
          family_id: q.data.doc.family_id,
          user_id: u.user.id,
        });
      }
    })();
  }, [q.data, id]);

  async function toggleFavorite() {
    if (!q.data) return;
    const next = !q.data.doc.is_favorite;
    const { error } = await supabase.from("documents").update({ is_favorite: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Added to favorites" : "Removed from favorites");
    qc.invalidateQueries({ queryKey: ["document", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  async function togglePin() {
    if (!q.data) return;
    const next = !q.data.doc.is_pinned;
    const { error } = await supabase.from("documents").update({ is_pinned: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Pinned to dashboard" : "Unpinned");
    qc.invalidateQueries({ queryKey: ["document", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  async function toggleOffline() {
    if (!q.data?.url || !q.data.doc) return;
    if (offline) {
      await removeCached(id);
      setOffline(false);
      toast.success("Removed from offline vault");
      return;
    }
    setSavingOffline(true);
    try {
      const res = await fetch(q.data.url);
      const bytes = await res.arrayBuffer();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      await cacheDocument({
        id, user_id: u.user.id,
        title: q.data.doc.title,
        category: q.data.doc.category,
        mime_type: q.data.doc.mime_type ?? "application/octet-stream",
        document_number: q.data.doc.document_number,
        expiry_date: q.data.doc.expiry_date,
        bytes,
      });
      setOffline(true);
      toast.success("Encrypted & saved offline");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save offline");
    } finally {
      setSavingOffline(false);
    }
  }

  async function remove() {
    if (!q.data) return;
    if (!confirm("Delete this document permanently?")) return;
    await supabase.storage.from("documents").remove([q.data.doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await removeCached(id).catch(() => {});
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={toggleFavorite} variant="outline" className={d.is_favorite ? "border-warning text-warning" : ""}>
            <Star className={`mr-2 h-4 w-4 ${d.is_favorite ? "fill-current" : ""}`}/>{d.is_favorite ? "Favorited" : "Favorite"}
          </Button>
          <Button onClick={togglePin} variant="outline" className={d.is_pinned ? "border-primary text-primary" : ""}>
            <Pin className={`mr-2 h-4 w-4 ${d.is_pinned ? "fill-current" : ""}`}/>{d.is_pinned ? "Pinned" : "Pin"}
          </Button>
          <Button onClick={toggleOffline} variant="outline" disabled={savingOffline}>
            {offline ? <CloudOff className="mr-2 h-4 w-4"/> : <CloudDownload className="mr-2 h-4 w-4"/>}
            {savingOffline ? "Saving…" : offline ? "Offline ✓" : "Save offline"}
          </Button>
          <Button asChild variant="outline"><Link to="/shares"><Share2 className="mr-2 h-4 w-4"/>Share</Link></Button>
          <Button onClick={remove} variant="outline" className="text-danger hover:text-danger"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 h-[75vh]">
          {q.data.url && <DocumentViewer url={q.data.url} mimeType={d.mime_type} title={d.title}/>}
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