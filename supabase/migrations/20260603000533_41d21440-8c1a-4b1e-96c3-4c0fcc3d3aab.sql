
-- Enums
CREATE TYPE public.family_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.doc_category AS ENUM ('identity','property','insurance','medical','education','bills','vehicles','other');
CREATE TYPE public.invite_status AS ENUM ('pending','accepted','revoked','expired');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Families
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Family members
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.family_members(user_id);
CREATE INDEX ON public.family_members(family_id);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_family_member(_user uuid, _family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE user_id = _user AND family_id = _family);
$$;

CREATE OR REPLACE FUNCTION public.family_role_of(_user uuid, _family uuid)
RETURNS public.family_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.family_members WHERE user_id = _user AND family_id = _family;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_family(_user uuid, _family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user AND family_id = _family AND role IN ('owner','editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_owner(_user uuid, _family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user AND family_id = _family AND role = 'owner'
  );
$$;

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  category public.doc_category NOT NULL DEFAULT 'other',
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  document_number text,
  issue_date date,
  expiry_date date,
  notes text,
  ocr_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.documents(family_id);
CREATE INDEX ON public.documents(expiry_date);
CREATE INDEX ON public.documents(category);

-- Reminders
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Activity logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.activity_logs(family_id, created_at DESC);

-- Invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.family_role NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.invite_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.invitations(email);
CREATE INDEX ON public.invitations(family_id);

-- RLS POLICIES

-- profiles
CREATE POLICY "profiles_select_self_or_family" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = auth.uid() AND fm2.user_id = profiles.id
  )
);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- families
CREATE POLICY "families_select_member" ON public.families FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), id));
CREATE POLICY "families_insert_self" ON public.families FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "families_update_owner" ON public.families FOR UPDATE TO authenticated
USING (public.is_family_owner(auth.uid(), id));
CREATE POLICY "families_delete_owner" ON public.families FOR DELETE TO authenticated
USING (public.is_family_owner(auth.uid(), id));

-- family_members
CREATE POLICY "fm_select_member" ON public.family_members FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "fm_insert_owner_or_self" ON public.family_members FOR INSERT TO authenticated
WITH CHECK (
  -- owner adds anyone, OR a user adds themselves as owner of a new family they just created
  public.is_family_owner(auth.uid(), family_id)
  OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.families f WHERE f.id = family_id AND f.owner_id = auth.uid()))
);
CREATE POLICY "fm_update_owner" ON public.family_members FOR UPDATE TO authenticated
USING (public.is_family_owner(auth.uid(), family_id));
CREATE POLICY "fm_delete_owner_or_self" ON public.family_members FOR DELETE TO authenticated
USING (public.is_family_owner(auth.uid(), family_id) OR user_id = auth.uid());

-- documents
CREATE POLICY "docs_select_member" ON public.documents FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "docs_insert_editor" ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.can_edit_family(auth.uid(), family_id) AND uploaded_by = auth.uid());
CREATE POLICY "docs_update_editor" ON public.documents FOR UPDATE TO authenticated
USING (public.can_edit_family(auth.uid(), family_id));
CREATE POLICY "docs_delete_editor" ON public.documents FOR DELETE TO authenticated
USING (public.can_edit_family(auth.uid(), family_id));

-- reminders
CREATE POLICY "rem_select_member" ON public.reminders FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "rem_insert_editor" ON public.reminders FOR INSERT TO authenticated
WITH CHECK (public.can_edit_family(auth.uid(), family_id));
CREATE POLICY "rem_update_editor" ON public.reminders FOR UPDATE TO authenticated
USING (public.can_edit_family(auth.uid(), family_id));
CREATE POLICY "rem_delete_editor" ON public.reminders FOR DELETE TO authenticated
USING (public.can_edit_family(auth.uid(), family_id));

-- activity_logs
CREATE POLICY "act_select_member" ON public.activity_logs FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "act_insert_member" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (public.is_family_member(auth.uid(), family_id) AND user_id = auth.uid());

-- invitations
CREATE POLICY "inv_select_owner" ON public.invitations FOR SELECT TO authenticated
USING (public.is_family_owner(auth.uid(), family_id));
CREATE POLICY "inv_insert_owner" ON public.invitations FOR INSERT TO authenticated
WITH CHECK (public.is_family_owner(auth.uid(), family_id) AND invited_by = auth.uid());
CREATE POLICY "inv_update_owner" ON public.invitations FOR UPDATE TO authenticated
USING (public.is_family_owner(auth.uid(), family_id));
CREATE POLICY "inv_delete_owner" ON public.invitations FOR DELETE TO authenticated
USING (public.is_family_owner(auth.uid(), family_id));

-- Trigger: on new auth user, create profile + default family + owner membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_family_id uuid;
  display_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, display_name, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.families (name, owner_id)
  VALUES (COALESCE(display_name,'My') || '''s Family', NEW.id)
  RETURNING id INTO new_family_id;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (new_family_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
