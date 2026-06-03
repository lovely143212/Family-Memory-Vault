
-- 1. Tighten family_members INSERT: only owners can insert directly (self-insert moves to accept_invitation function)
DROP POLICY IF EXISTS fm_insert_owner_or_self ON public.family_members;
CREATE POLICY fm_insert_owner ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_family_owner(auth.uid(), family_id));

-- 2. SECURITY DEFINER function for invitee to accept their invitation atomically
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _inv record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  SELECT * INTO _inv FROM public.invitations
    WHERE token = _token
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;

  IF _inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or expired';
  END IF;

  IF lower(_inv.email) <> lower(_email) THEN
    RAISE EXCEPTION 'Invitation email does not match signed-in user';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (_inv.family_id, _uid, _inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.invitations SET status = 'accepted' WHERE id = _inv.id;

  RETURN _inv.family_id;
END;
$$;

-- 3. Lock down EXECUTE on SECURITY DEFINER helpers: revoke from public/anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.is_family_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.family_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_family(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_family_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_family(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_owner(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- handle_new_user / set_updated_at are trigger-only, lock them down too
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
