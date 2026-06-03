import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  const [accepting, setAccepting] = useState(false);

  async function accept() {
    setAccepting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { navigate({ to: "/auth" }); return; }
    const { error } = await supabase.rpc("accept_invitation", { _token: token } as never);
    if (error) { toast.error(error.message); setAccepting(false); return; }
    toast.success("Welcome to the family!");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-surface-elevated p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Vault className="h-6 w-6"/></div>
        <h1 className="font-display text-2xl font-bold">Family invitation</h1>
        <p className="mt-3 text-muted-foreground">Sign in with the invited email to join the family.</p>
        <Button onClick={accept} disabled={accepting} className="mt-6 w-full">{accepting ? "Accepting…" : "Accept invitation"}</Button>
      </div>
    </div>
  );
}