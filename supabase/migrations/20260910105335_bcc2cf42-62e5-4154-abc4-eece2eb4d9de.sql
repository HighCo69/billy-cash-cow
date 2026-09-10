
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION private.can_access_expense(_expense_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.group_members m ON m.group_id = e.group_id
    WHERE e.id = _expense_id AND m.user_id = _user_id
  );
$$;
CREATE OR REPLACE FUNCTION private.is_expense_creditor(_expense_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = _expense_id AND e.paid_by = _user_id);
$$;
GRANT EXECUTE ON FUNCTION private.is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_expense(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_expense_creditor(UUID, UUID) TO authenticated;

DROP POLICY "groups_select_member" ON public.groups;
DROP POLICY "groups_update_member" ON public.groups;
DROP POLICY "members_select" ON public.group_members;
DROP POLICY "members_insert" ON public.group_members;
DROP POLICY "expenses_select" ON public.expenses;
DROP POLICY "expenses_insert" ON public.expenses;
DROP POLICY "splits_select" ON public.expense_splits;
DROP POLICY "splits_insert" ON public.expense_splits;
DROP POLICY "splits_update" ON public.expense_splits;
DROP POLICY "splits_delete_creditor" ON public.expense_splits;
DROP POLICY "settlements_select" ON public.settlements;
DROP POLICY "settlements_insert" ON public.settlements;

CREATE POLICY "groups_select_member" ON public.groups FOR SELECT TO authenticated
  USING (private.is_group_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "groups_update_member" ON public.groups FOR UPDATE TO authenticated
  USING (private.is_group_member(id, auth.uid())) WITH CHECK (private.is_group_member(id, auth.uid()));
CREATE POLICY "members_select" ON public.group_members FOR SELECT TO authenticated
  USING (private.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_insert" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR private.is_group_member(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated
  USING (private.is_group_member(group_id, auth.uid()));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (private.is_group_member(group_id, auth.uid()) AND paid_by = auth.uid());
CREATE POLICY "splits_select" ON public.expense_splits FOR SELECT TO authenticated
  USING (private.can_access_expense(expense_id, auth.uid()));
CREATE POLICY "splits_insert" ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (private.is_expense_creditor(expense_id, auth.uid()));
CREATE POLICY "splits_update" ON public.expense_splits FOR UPDATE TO authenticated
  USING (debtor_id = auth.uid() OR private.is_expense_creditor(expense_id, auth.uid()))
  WITH CHECK (debtor_id = auth.uid() OR private.is_expense_creditor(expense_id, auth.uid()));
CREATE POLICY "splits_delete_creditor" ON public.expense_splits FOR DELETE TO authenticated
  USING (private.is_expense_creditor(expense_id, auth.uid()));
CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated
  USING (private.is_group_member(group_id, auth.uid()));
CREATE POLICY "settlements_insert" ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (private.is_group_member(group_id, auth.uid()) AND payer_id = auth.uid());

DROP FUNCTION IF EXISTS public.is_group_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.can_access_expense(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_expense_creditor(UUID, UUID);
