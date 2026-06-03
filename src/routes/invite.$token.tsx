import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Vault } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invite — Family Vault" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<{ id: string; family_id: string; email: string; role: string; expires_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("invitations").select("id,family_id,email,role,expires_at,status").eq("token", token).maybeSingle();
      if (data && data.status === "pending" && new Date(data.expires_at) > new Date()) setInvite(data);
      setLoading(false);
    })();
  }, [token]);

  async function accept() {
    if (!invite) return;
    setAccepting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { navigate({ to: "/auth" }); return; }
    if (u.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      toast.error(`This invite is for ${invite.email}. Sign in with that email.`);
      setAccepting(false); return;
    }
    const { error: mErr } = await supabase.from("family_members").insert({
      family_id: invite.family_id, user_id: u.user.id, role: invite.role as never,
    });
    if (mErr && !mErr.message.includes("duplicate")) { toast.error(mErr.message); setAccepting(false); return; }
    await supabase.from("invitations").update({ status: "accepted" }).eq("id", invite.id);
    toast.success("Welcome to the family!");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-surface-elevated p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Vault className="h-6 w-6"/></div>
        <h1 className="font-display text-2xl font-bold">Family invitation</h1>
        {loading ? <p className="mt-4 text-muted-foreground">Loading…</p>
          : !invite ? <p className="mt-4 text-muted-foreground">This invitation is invalid or has expired.</p>
          : (
            <>
              <p className="mt-3 text-muted-foreground">You've been invited as <strong>{invite.role}</strong>.<br/>Sign in with <strong>{invite.email}</strong> to accept.</p>
              <Button onClick={accept} disabled={accepting} className="mt-6 w-full">{accepting ? "Accepting…" : "Accept invitation"}</Button>
            </>
          )}
      </div>
    </div>
  );
}