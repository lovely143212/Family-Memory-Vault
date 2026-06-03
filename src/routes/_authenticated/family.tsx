import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentFamily, logActivity } from "@/hooks/use-current-family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Crown, Pencil, Eye, Trash2, Mail, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family — Family Vault" }] }),
  component: FamilyPage,
});

function FamilyPage() {
  const { family } = useCurrentFamily();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer"|"editor"|"owner">("viewer");

  const isOwner = family?.role === "owner";

  const members = useQuery({
    queryKey: ["family-members", family?.family_id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id,user_id,role,joined_at,profiles(full_name,avatar_url)")
        .eq("family_id", family!.family_id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invites = useQuery({
    queryKey: ["invites", family?.family_id],
    enabled: !!family && isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("invitations").select("*").eq("family_id", family!.family_id).eq("status","pending").order("created_at",{ ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!family) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("invitations").insert({
      family_id: family.family_id, email: email.trim().toLowerCase(), role, invited_by: u.user.id,
    });
    if (error) return toast.error(error.message);
    await logActivity({ family_id: family.family_id, action: "invited", entity_type: "invitation", metadata: { email, role } });
    toast.success("Invitation created");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["invites"] });
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("family_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["family-members"] });
  }

  async function changeRole(memberId: string, newRole: string) {
    const { error } = await supabase.from("family_members").update({ role: newRole as never }).eq("id", memberId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["family-members"] });
  }

  async function revoke(id: string) {
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["invites"] });
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 font-display text-3xl font-bold">Family</h1>
      <p className="mb-8 text-muted-foreground">Manage who can access {family?.families.name}</p>

      <section className="mb-8 rounded-2xl border bg-surface-elevated p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Members</h2>
        <ul className="space-y-2">
          {members.data?.map((m) => {
            const p = (m.profiles as { full_name?: string|null } | null);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
                    {(p?.full_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{p?.full_name ?? "Member"}</div>
                    <RoleBadge role={m.role}/>
                  </div>
                </div>
                {isOwner && m.role !== "owner" && (
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)}>
                      <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => removeMember(m.id)} variant="ghost" size="icon" className="text-danger"><Trash2 className="h-4 w-4"/></Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && (
        <>
          <section className="mb-8 rounded-2xl border bg-surface-elevated p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Invite a family member</h2>
            <form onSubmit={invite} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <div><Label className="sr-only">Email</Label><Input type="email" required placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)}/></div>
              <div>
                <Label className="sr-only">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "viewer"|"editor")}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit"><Mail className="mr-2 h-4 w-4"/>Send invite</Button>
            </form>
          </section>

          {invites.data && invites.data.length > 0 && (
            <section className="rounded-2xl border bg-surface-elevated p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Pending invites</h2>
              <ul className="space-y-2">
                {invites.data.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-3">
                    <div>
                      <div className="font-medium">{i.email}</div>
                      <RoleBadge role={i.role}/>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(i.token)}><Copy className="mr-2 h-3.5 w-3.5"/>Copy link</Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => revoke(i.id)}>Revoke</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { icon: React.ComponentType<{className?: string}>; label: string; cls: string }> = {
    owner: { icon: Crown, label: "Owner", cls: "bg-warning/15 text-warning" },
    editor: { icon: Pencil, label: "Editor", cls: "bg-primary-soft text-primary" },
    viewer: { icon: Eye, label: "Viewer", cls: "bg-muted text-muted-foreground" },
  };
  const r = map[role] ?? map.viewer;
  const Icon = r.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.cls}`}><Icon className="h-3 w-3"/>{r.label}</span>;
}