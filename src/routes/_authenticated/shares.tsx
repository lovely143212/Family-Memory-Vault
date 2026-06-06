import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily, logActivity } from "@/hooks/use-current-family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Link2, Trash2, QrCode } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shares")({
  head: () => ({ meta: [{ title: "Secure shares — Family Vault" }] }),
  component: SharesPage,
});

function makeToken() {
  const arr = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function SharesPage() {
  const { family } = useCurrentFamily();
  const qc = useQueryClient();
  const [docId, setDocId] = useState<string>("");
  const [hours, setHours] = useState<string>("24");
  const [maxViews, setMaxViews] = useState<string>("");
  const [qrFor, setQrFor] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: ["share-docs", family?.family_id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("id,title").eq("family_id", family!.family_id)
        .order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const shares = useQuery({
    queryKey: ["shares", family?.family_id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_shares")
        .select("id,token,expires_at,max_views,view_count,revoked,created_at,document_id,documents(title)")
        .eq("family_id", family!.family_id)
        .order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  async function createShare() {
    if (!family || !docId) { toast.error("Pick a document"); return; }
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return;
    const token = makeToken();
    const expires = new Date(Date.now() + parseInt(hours, 10) * 3600_000).toISOString();
    const { error } = await supabase.from("document_shares").insert({
      document_id: docId,
      family_id: family.family_id,
      created_by: userRes.user.id,
      token,
      expires_at: expires,
      max_views: maxViews ? parseInt(maxViews, 10) : null,
    });
    if (error) return toast.error(error.message);
    await logActivity({ family_id: family.family_id, action: "shared", entity_type: "document", entity_id: docId });
    toast.success("Share link created");
    setQrFor(token);
    qc.invalidateQueries({ queryKey: ["shares"] });
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this link?")) return;
    const { error } = await supabase.from("document_shares").update({ revoked: true }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shares"] });
  }

  function shareUrl(token: string) { return `${window.location.origin}/share/${token}`; }
  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copied"); }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 font-display text-3xl font-bold">Secure shares</h1>
      <p className="mb-6 text-muted-foreground">Generate temporary, revocable links to share documents with anyone — no account required.</p>

      <div className="grid gap-4 rounded-2xl border bg-surface-elevated p-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label>Document</Label>
          <Select value={docId} onValueChange={setDocId}>
            <SelectTrigger><SelectValue placeholder="Pick a document"/></SelectTrigger>
            <SelectContent>
              {(docs.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Expires in (hours)</Label>
          <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)}/>
        </div>
        <div>
          <Label>Max views (optional)</Label>
          <Input type="number" min={1} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="∞"/>
        </div>
        <Button onClick={createShare} className="md:col-span-4"><Link2 className="mr-2 h-4 w-4"/>Create share link</Button>
      </div>

      {qrFor && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border bg-surface-elevated p-6">
          <QRCodeCanvas value={shareUrl(qrFor)} size={192} marginSize={2}/>
          <div className="text-center">
            <div className="text-sm font-medium">Scan to open</div>
            <code className="mt-1 block break-all text-xs text-muted-foreground">{shareUrl(qrFor)}</code>
          </div>
          <Button variant="outline" onClick={() => copy(shareUrl(qrFor))}><Copy className="mr-2 h-4 w-4"/>Copy link</Button>
        </div>
      )}

      <h2 className="mt-10 mb-3 font-display text-lg font-semibold">Active links</h2>
      <div className="grid gap-2">
        {(shares.data ?? []).map((s) => {
          const expired = new Date(s.expires_at).getTime() < Date.now();
          const exhausted = s.max_views != null && s.view_count >= s.max_views;
          const inactive = s.revoked || expired || exhausted;
          return (
            <div key={s.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface-elevated p-3 ${inactive ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <div className="truncate font-medium">{s.documents?.title ?? "Document"}</div>
                <div className="text-xs text-muted-foreground">
                  {s.revoked ? "Revoked" : expired ? "Expired" : exhausted ? "Max views reached" : `Expires ${formatDistanceToNow(new Date(s.expires_at), { addSuffix: true })}`}
                  {" · "}{s.view_count}{s.max_views ? ` / ${s.max_views}` : ""} views
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setQrFor(s.token)}><QrCode className="h-4 w-4"/></Button>
                <Button size="sm" variant="ghost" onClick={() => copy(shareUrl(s.token))}><Copy className="h-4 w-4"/></Button>
                {!s.revoked && <Button size="sm" variant="ghost" onClick={() => revoke(s.id)} className="text-danger"><Trash2 className="h-4 w-4"/></Button>}
              </div>
            </div>
          );
        })}
        {shares.data?.length === 0 && <p className="text-sm text-muted-foreground">No active shares.</p>}
      </div>
    </div>
  );
}