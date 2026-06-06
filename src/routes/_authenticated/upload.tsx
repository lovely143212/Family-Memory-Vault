import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily, logActivity } from "@/hooks/use-current-family";
import { useServerFn } from "@tanstack/react-start";
import { extractDocumentFields } from "@/lib/ocr.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, type CategoryValue } from "@/lib/categories";
import { Sparkles, Upload as UploadIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — Family Vault" }] }),
  component: UploadPage,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function UploadPage() {
  const { family } = useCurrentFamily();
  const navigate = useNavigate();
  const extract = useServerFn(extractDocumentFields);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryValue>("other");
  const [docNum, setDocNum] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFile(f: File) {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast.error("File must be under 15 MB"); return; }
    if (!["application/pdf","image/jpeg","image/png","image/jpg","image/webp"].includes(f.type)) {
      toast.error("Only PDF, JPG, PNG, WEBP"); return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    if (f.type.startsWith("image/")) {
      await runOcr(f);
    }
  }

  async function runOcr(f: File) {
    setOcrBusy(true);
    try {
      const b64 = await fileToBase64(f);
      const res = await extract({ data: { imageBase64: b64, mimeType: f.type } });
      if (res.ok) {
        const fields = res.fields as Record<string, string | null>;
        if (fields.title) setTitle(fields.title);
        if (fields.document_number) setDocNum(fields.document_number);
        if (fields.issue_date) setIssueDate(fields.issue_date);
        if (fields.expiry_date) setExpiryDate(fields.expiry_date);
        if (fields.category && CATEGORIES.some((c) => c.value === fields.category)) {
          setCategory(fields.category as CategoryValue);
        }
        toast.success("AI filled in what it could detect");
      } else {
        toast.message("AI couldn't read this document — fill in manually.");
      }
    } finally {
      setOcrBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!family || !file) { toast.error("Pick a file first"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");

      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${family.family_id}/${docId}/${docId}.${ext}`;

      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("documents").insert({
        id: docId,
        family_id: family.family_id,
        uploaded_by: userRes.user.id,
        title, category,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        document_number: docNum || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        notes: notes || null,
      });
      if (insErr) throw insErr;

      if (expiryDate) {
        const remindAt = new Date(expiryDate); remindAt.setDate(remindAt.getDate() - 14);
        await supabase.from("reminders").insert({ document_id: docId, family_id: family.family_id, remind_at: remindAt.toISOString() });
      }

      await logActivity({ family_id: family.family_id, action: "uploaded", entity_type: "document", entity_id: docId, metadata: { title } });
      toast.success("Document saved");
      navigate({ to: "/documents/$id", params: { id: docId } });
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Upload failed";
      toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 font-display text-3xl font-bold">Upload document</h1>
      <p className="mb-8 text-muted-foreground">PDF, JPG, PNG or WEBP. Images are auto-analyzed with AI to fill the form.</p>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-surface-elevated p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary-soft/40 p-8 text-center transition hover:border-primary/60">
          <UploadIcon className="h-6 w-6 text-primary"/>
          <span className="font-medium">{file ? file.name : "Click to choose a file"}</span>
          <span className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP — up to 15 MB</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
        </label>

        {ocrBusy && (
          <div className="flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-sm text-accent-foreground">
            <Sparkles className="h-4 w-4 animate-pulse"/> Analyzing with AI…
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)}/></div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryValue)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Document number</Label><Input value={docNum} onChange={(e) => setDocNum(e.target.value)}/></div>
          <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}/></div>
          <div><Label>Expiry date</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}/></div>
          <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}/></div>
        </div>

        <Button type="submit" className="w-full" disabled={saving || !file}>{saving ? "Saving…" : "Save document"}</Button>
      </form>
    </div>
  );
}