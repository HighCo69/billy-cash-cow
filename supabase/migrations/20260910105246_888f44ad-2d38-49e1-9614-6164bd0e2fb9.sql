
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone_number TEXT UNIQUE,
    paypal_me_handle TEXT,
    wero_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    photo_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE POLICY "groups_select_member" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "groups_insert_own" ON public.groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_update_member" ON public.groups FOR UPDATE TO authenticated
  USING (public.is_group_member(id, auth.uid())) WITH CHECK (public.is_group_member(id, auth.uid()));
CREATE POLICY "groups_delete_creator" ON public.groups FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "members_select" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_insert" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );
CREATE POLICY "members_delete" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()));

CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    paid_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND paid_by = auth.uid());
CREATE POLICY "expenses_update_owner" ON public.expenses FOR UPDATE TO authenticated
  USING (paid_by = auth.uid()) WITH CHECK (paid_by = auth.uid());
CREATE POLICY "expenses_delete_owner" ON public.expenses FOR DELETE TO authenticated USING (paid_by = auth.uid());

CREATE TABLE public.expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'disputed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_splits TO authenticated;
GRANT ALL ON public.expense_splits TO service_role;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_expense(_expense_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.group_members m ON m.group_id = e.group_id
    WHERE e.id = _expense_id AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_expense_creditor(_expense_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = _expense_id AND e.paid_by = _user_id);
$$;

CREATE POLICY "splits_select" ON public.expense_splits FOR SELECT TO authenticated
  USING (public.can_access_expense(expense_id, auth.uid()));
CREATE POLICY "splits_insert" ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (public.is_expense_creditor(expense_id, auth.uid()));
CREATE POLICY "splits_update" ON public.expense_splits FOR UPDATE TO authenticated
  USING (debtor_id = auth.uid() OR public.is_expense_creditor(expense_id, auth.uid()))
  WITH CHECK (debtor_id = auth.uid() OR public.is_expense_creditor(expense_id, auth.uid()));
CREATE POLICY "splits_delete_creditor" ON public.expense_splits FOR DELETE TO authenticated
  USING (public.is_expense_creditor(expense_id, auth.uid()));

CREATE TABLE public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    payer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    payee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT CHECK (payment_method IN ('paypal', 'wero', 'cash', 'bank_transfer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "settlements_insert" ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND payer_id = auth.uid());
CREATE POLICY "settlements_update" ON public.settlements FOR UPDATE TO authenticated
  USING (payer_id = auth.uid() OR payee_id = auth.uid()) WITH CHECK (payer_id = auth.uid() OR payee_id = auth.uid());
CREATE POLICY "settlements_delete_payer" ON public.settlements FOR DELETE TO authenticated USING (payer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_kostenstall(_name TEXT, _photo_url TEXT, _emails TEXT[])
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.groups (name, photo_url, created_by) VALUES (_name, _photo_url, uid) RETURNING id INTO new_id;
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (new_id, uid, 'owner');
  INSERT INTO public.group_members (group_id, user_id)
  SELECT new_id, p.id FROM public.profiles p
  WHERE lower(p.email) = ANY (SELECT lower(unnest(_emails))) AND p.id <> uid
  ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = new_id) > 12 THEN
    RAISE EXCEPTION 'Maximal 12 Teilnehmer pro Kostenstall';
  END IF;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_kostenstall(TEXT, TEXT, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_kostenstall(_inviter_email TEXT, _group_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gid UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT g.id INTO gid
  FROM public.groups g
  JOIN public.group_members m ON m.group_id = g.id
  JOIN public.profiles p ON p.id = m.user_id
  WHERE lower(p.email) = lower(_inviter_email) AND lower(g.name) = lower(_group_name)
  ORDER BY g.created_at DESC LIMIT 1;
  IF gid IS NULL THEN RAISE EXCEPTION 'Kostenstall nicht gefunden'; END IF;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = gid) >= 12 THEN
    RAISE EXCEPTION 'Dieser Kostenstall ist voll (12 Teilnehmer)';
  END IF;
  INSERT INTO public.group_members (group_id, user_id) VALUES (gid, uid) ON CONFLICT DO NOTHING;
  RETURN gid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_kostenstall(TEXT, TEXT) TO authenticated;
