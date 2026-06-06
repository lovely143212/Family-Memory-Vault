import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  query: z.string().min(2).max(200),
  family_id: z.string().uuid(),
});

type DocRow = {
  id: string;
  title: string;
  category: string;
  document_number: string | null;
  notes: string | null;
  expiry_date: string | null;
};

/**
 * AI-ranked document search. Pulls family documents the user can see,
 * then asks the AI to pick and rank the most relevant ones for the query
 * (handles synonyms, intent like "expiring soon", typos, etc.).
 */
export const aiSearchDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: docs, error } = await supabase
      .from("documents")
      .select("id,title,category,document_number,notes,expiry_date")
      .eq("family_id", data.family_id)
      .limit(200);
    if (error) return { ok: false as const, error: error.message, results: [] };
    const rows = (docs ?? []) as DocRow[];
    if (rows.length === 0) return { ok: true as const, results: [], reasoning: "No documents." };

    const apiKey = process.env.LOVABLE_API_KEY;
    // Fallback: simple substring rank when no AI key.
    if (!apiKey) {
      const q = data.query.toLowerCase();
      const ranked = rows
        .map((d) => ({ id: d.id, score: scoreRow(d, q), reason: "Text match" }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);
      return { ok: true as const, results: ranked, reasoning: "Local match" };
    }

    const compact = rows.map((d) => ({
      id: d.id,
      t: d.title,
      c: d.category,
      n: d.document_number,
      e: d.expiry_date,
      o: d.notes?.slice(0, 200) ?? null,
    }));
    const prompt = `You are a search ranker for a family document vault. The user asked: "${data.query}".
Pick up to 10 documents from this JSON array that best answer the query, ordered most relevant first. Consider synonyms (e.g. "DL" = driving license, "Aadhar" = identity), expiry intent ("expiring", "valid until"), and category. Return ONLY JSON of the shape {"results":[{"id":"...","reason":"why"}]}.
Documents: ${JSON.stringify(compact)}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        return { ok: false as const, error: `AI search failed (${res.status})`, results: [] };
      }
      const payload = await res.json();
      const content = payload?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as { results?: { id: string; reason?: string }[] };
      const known = new Set(rows.map((r) => r.id));
      const results = (parsed.results ?? [])
        .filter((r) => known.has(r.id))
        .map((r, i) => ({ id: r.id, score: 100 - i, reason: r.reason ?? "" }));
      return { ok: true as const, results, reasoning: "AI" };
    } catch (e) {
      console.error("AI search failed", e);
      return { ok: false as const, error: "AI search failed", results: [] };
    }
  });

function scoreRow(d: DocRow, q: string): number {
  let score = 0;
  if (d.title?.toLowerCase().includes(q)) score += 5;
  if (d.document_number?.toLowerCase().includes(q)) score += 4;
  if (d.notes?.toLowerCase().includes(q)) score += 2;
  if (d.category?.toLowerCase().includes(q)) score += 1;
  return score;
}