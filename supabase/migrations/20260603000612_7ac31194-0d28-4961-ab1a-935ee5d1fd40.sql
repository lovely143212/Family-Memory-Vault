
ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.family_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_family(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_owner(uuid, uuid) FROM PUBLIC, anon;

-- Storage RLS: object name format = `${family_id}/${doc_id}/${filename}`
CREATE POLICY "docs_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_family_member(auth.uid(), (split_part(name,'/',1))::uuid)
);
CREATE POLICY "docs_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.can_edit_family(auth.uid(), (split_part(name,'/',1))::uuid)
);
CREATE POLICY "docs_storage_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.can_edit_family(auth.uid(), (split_part(name,'/',1))::uuid)
);
CREATE POLICY "docs_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.can_edit_family(auth.uid(), (split_part(name,'/',1))::uuid)
);
