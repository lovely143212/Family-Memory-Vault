import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().min(3).max(120),
});

export const extractDocumentFields = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not configured" };
    }

    const prompt = `You are an OCR assistant. Look at this document image and extract:
- title (a short human label, e.g. "Driver License")
- document_number (any ID/policy/license/account number visible)
- issue_date (YYYY-MM-DD or null)
- expiry_date (YYYY-MM-DD or null)
- category: one of identity, property, insurance, medical, education, bills, vehicles, other
Return ONLY valid JSON with these keys. Use null for unknown fields.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error", res.status, text);
        return { ok: false as const, error: `AI request failed (${res.status})` };
      }

      const payload = await res.json();
      const content = payload?.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, string | null> = {};
      try {
        parsed = JSON.parse(content) as Record<string, string | null>;
      } catch {
        parsed = {};
      }
      return { ok: true as const, fields: parsed };
    } catch (e) {
      console.error("OCR failed", e);
      return { ok: false as const, error: "Could not analyze document" };
    }
  });