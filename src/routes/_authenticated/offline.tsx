import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listCached, removeCached, getCachedBlob } from "@/lib/offline-vault";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "@/components/document-viewer";
import { CategoryBadge } from "@/components/category-badge";
import { ShieldCheck, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/offline")({
  head: () => ({ meta: [{ title: "Offline vault — Family Vault" }] }),
  component: OfflinePage,
});

type Item = Awaited<ReturnType<typeof listCached>>[number];

function OfflinePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState<{ url: string; mime: string; title: string } | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setItems(await listCached(data.user.id));
    })();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function openItem(id: string) {
    if (!userId) return;
    const got = await getCachedBlob(userId, id);
    if (!got) return toast.error("Could not decrypt cached document");
    setOpen({ url: URL.createObjectURL(got.blob), mime: got.meta.mime_type, title: got.meta.title });
  }

  async function remove(id: string) {
    await removeCached(id);
    if (userId) setItems(await listCached(userId));
    toast.success("Removed from offline vault");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary"/>
        <div>
          <h1 className="font-display text-3xl font-bold">Offline vault</h1>
          <p className="text-muted-foreground">AES-256 encrypted documents available without internet.</p>
        </div>
      </div>

      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <WifiOff className="h-4 w-4"/> You're offline — your cached documents still work.
        </div>
      )}

      {open && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{open.title}</h2>
            <Button variant="ghost" onClick={() => { URL.revokeObjectURL(open.url); setOpen(null); }}>Close</Button>
          </div>
          <div className="h-[70vh]"><DocumentViewer url={open.url} mimeType={open.mime} title={open.title}/></div>
        </div>
      )}

      <div className="grid gap-2">
        {items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface-elevated p-3">
            <button onClick={() => openItem(it.id)} className="flex flex-1 items-center gap-3 text-left">
              <CategoryBadge value={it.category}/>
              <div className="min-w-0">
                <div className="truncate font-medium">{it.title}</div>
                <div className="text-xs text-muted-foreground">
                  {(it.size / 1024).toFixed(0)} KB · cached {formatDistanceToNow(new Date(it.cached_at), { addSuffix: true })}
                </div>
              </div>
            </button>
            <Button size="sm" variant="ghost" onClick={() => remove(it.id)} className="text-danger"><Trash2 className="h-4 w-4"/></Button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-surface p-10 text-center text-muted-foreground">
            No documents saved offline yet. Open any document and tap <strong>Save offline</strong>.{" "}
            <Link to="/documents" className="text-primary">Browse documents →</Link>
          </div>
        )}
      </div>
    </div>
  );
}