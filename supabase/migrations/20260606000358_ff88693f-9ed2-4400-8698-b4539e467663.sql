
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS documents_family_favorite_idx ON public.documents(family_id) WHERE is_favorite;
CREATE INDEX IF NOT EXISTS documents_family_pinned_idx ON public.documents(family_id) WHERE is_pinned;

CREATE TABLE IF NOT EXISTS public.document_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_views_user_viewed_idx ON public.document_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS document_views_doc_idx ON public.document_views(document_id);

GRANT SELECT, INSERT, DELETE ON public.document_views TO authenticated;
GRANT ALL ON public.document_views TO service_role;
ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "views_select_own" ON public.document_views FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "views_insert_member" ON public.document_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_family_member(auth.uid(), family_id));
CREATE POLICY "views_delete_own" ON public.document_views FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  max_views integer,
  view_count integer NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_shares_family_idx ON public.document_shares(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS document_shares_token_idx ON public.document_shares(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_shares TO authenticated;
GRANT ALL ON public.document_shares TO service_role;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shares_select_member" ON public.document_shares FOR SELECT TO authenticated
  USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "shares_insert_editor" ON public.document_shares FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_family(auth.uid(), family_id) AND created_by = auth.uid());
CREATE POLICY "shares_update_editor" ON public.document_shares FOR UPDATE TO authenticated
  USING (public.can_edit_family(auth.uid(), family_id));
CREATE POLICY "shares_delete_editor" ON public.document_shares FOR DELETE TO authenticated
  USING (public.can_edit_family(auth.uid(), family_id));

-- Public share resolver (used by anonymous viewers via server fn with admin client; also callable by authenticated)
CREATE OR REPLACE FUNCTION public.resolve_share(_token text)
RETURNS TABLE(document_id uuid, file_path text, mime_type text, title text, category doc_category)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s record;
BEGIN
  SELECT * INTO _s FROM public.document_shares
    WHERE token = _token AND NOT revoked AND expires_at > now()
    LIMIT 1;
  IF _s.id IS NULL THEN
    RETURN;
  END IF;
  IF _s.max_views IS NOT NULL AND _s.view_count >= _s.max_views THEN
    RETURN;
  END IF;
  UPDATE public.document_shares SET view_count = view_count + 1 WHERE id = _s.id;
  RETURN QUERY
    SELECT d.id, d.file_path, d.mime_type, d.title, d.category
    FROM public.documents d WHERE d.id = _s.document_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_share(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_share(text) TO authenticated, service_role;
