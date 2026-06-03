import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type FamilyMembership = {
  family_id: string;
  role: "owner" | "editor" | "viewer";
  families: { id: string; name: string; owner_id: string };
};

export function useFamilies() {
  return useQuery({
    queryKey: ["families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id, role, families(id, name, owner_id)")
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FamilyMembership[];
    },
  });
}

export function useCurrentFamily() {
  const q = useFamilies();
  const current = q.data?.[0];
  return { ...q, family: current };
}

export async function logActivity(params: {
  family_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Json;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;
  await supabase.from("activity_logs").insert({
    ...params,
    user_id: userRes.user.id,
  });
}