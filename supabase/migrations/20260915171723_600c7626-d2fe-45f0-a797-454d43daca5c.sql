ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_status_check CHECK (status IN ('pending','active','leaving'));

-- nur freigegebene Mitglieder zaehlen als Mitglied
CREATE OR REPLACE FUNCTION private.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_pending(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND created_by = _user_id);
$$;

CREATE OR REPLACE FUNCTION private.can_access_expense(_expense_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.group_members m ON m.group_id = e.group_id
    WHERE e.id = _expense_id AND m.user_id = _user_id AND m.status = 'active'
  );
$$;

-- Gruppe sichtbar auch fuer Wartende (nur Name/Foto)
DROP POLICY IF EXISTS groups_select_member ON public.groups;
CREATE POLICY groups_select_member ON public.groups FOR SELECT TO authenticated
USING (private.is_group_pending(id, auth.uid()) OR created_by = auth.uid());

-- Umbenennen nur durch freigegebene Mitglieder
DROP POLICY IF EXISTS groups_update_member ON public.groups;
CREATE POLICY groups_update_member ON public.groups FOR UPDATE TO authenticated
USING (private.is_group_member(id, auth.uid()))
WITH CHECK (private.is_group_member(id, auth.uid()));

-- Mitgliederzeilen: Stallmeister darf freigeben, Mitglied darf eigenen Status setzen
DROP POLICY IF EXISTS members_update ON public.group_members;
CREATE POLICY members_update ON public.group_members FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR private.is_group_owner(group_id, auth.uid()))
WITH CHECK (user_id = auth.uid() OR private.is_group_owner(group_id, auth.uid()));

GRANT UPDATE ON public.group_members TO authenticated;

-- Beitritt erzeugt nur eine Anfrage
CREATE OR REPLACE FUNCTION public.join_kostenstall(_inviter_email text, _group_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  gid UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT g.id INTO gid
  FROM public.groups g
  JOIN public.group_members m ON m.group_id = g.id AND m.status = 'active'
  JOIN public.profiles p ON p.id = m.user_id
  WHERE lower(p.email) = lower(_inviter_email) AND lower(g.name) = lower(_group_name)
  ORDER BY g.created_at DESC LIMIT 1;
  IF gid IS NULL THEN RAISE EXCEPTION 'Kostenstall nicht gefunden'; END IF;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = gid AND status <> 'pending') >= 12 THEN
    RAISE EXCEPTION 'Dieser Kostenstall ist voll (12 Teilnehmer)';
  END IF;
  INSERT INTO public.group_members (group_id, user_id, status)
  VALUES (gid, uid, 'pending')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN gid;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_kostenstall(_name text, _photo_url text, _emails text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  new_id UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.groups (name, photo_url, created_by) VALUES (_name, _photo_url, uid) RETURNING id INTO new_id;
  INSERT INTO public.group_members (group_id, user_id, role, status) VALUES (new_id, uid, 'owner', 'active');
  INSERT INTO public.group_members (group_id, user_id, status)
  SELECT new_id, p.id, 'active' FROM public.profiles p
  WHERE lower(p.email) = ANY (SELECT lower(unnest(_emails))) AND p.id <> uid
  ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = new_id) > 12 THEN
    RAISE EXCEPTION 'Maximal 12 Teilnehmer pro Kostenstall';
  END IF;
  RETURN new_id;
END;
$$;