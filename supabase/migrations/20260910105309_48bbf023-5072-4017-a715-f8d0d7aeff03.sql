
REVOKE ALL ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_expense(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_expense(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_expense_creditor(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_expense_creditor(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_kostenstall(TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_kostenstall(TEXT, TEXT, TEXT[]) TO authenticated;
REVOKE ALL ON FUNCTION public.join_kostenstall(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_kostenstall(TEXT, TEXT) TO authenticated;
