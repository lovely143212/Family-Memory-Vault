import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({ token: z.string().min(8).max(128) });

/**
 * Public share resolver. Uses the SECURITY DEFINER `resolve_share` RPC via
 * the service-role client (so unauthenticated viewers can fetch the file).
 * Returns a short-lived signed URL for the document, or an error.
 */
export const resolveShare = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("resolve_share", { _token: data.token });
    if (error) return { ok: false as const, error: error.message };
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false as const, error: "Link is invalid, expired or used up" };
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(row.file_path, 60 * 10);
    if (sErr || !signed?.signedUrl) return { ok: false as const, error: "Could not load file" };
    return {
      ok: true as const,
      title: row.title as string,
      mime_type: (row.mime_type as string) ?? "application/octet-stream",
      category: row.category as string,
      url: signed.signedUrl,
    };
  });