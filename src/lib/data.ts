import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  paypal_me_handle: string | null;
  wero_id: string | null;
};

export type MemberStatus = "pending" | "active" | "leaving";

export type Member = {
  id: string;
  user_id: string;
  role: string;
  status: MemberStatus;
  profile: Profile;
};

export type Expense = {
  id: string;
  group_id: string | null;
  paid_by: string | null;
  amount: string | number;
  title: string;
  category: string;
  expense_date: string;
  created_at: string | null;
};

export type Split = {
  id: string;
  expense_id: string | null;
  debtor_id: string | null;
  amount: string | number;
  status: string;
};

export type Settlement = {
  id: string;
  group_id: string | null;
  payer_id: string | null;
  payee_id: string | null;
  amount: string | number;
  payment_method: string | null;
  status: string;
  created_at: string | null;
};

export const num = (value: string | number | null) => Number(value ?? 0);

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number, paypal_me_handle, wero_id")
        .eq("id", user.id)
        .maybeSingle();
      return { userId: user.id, email: user.email ?? null, profile: (profile ?? null) as Profile | null };
    },
  });
}

export function useMyStalls() {
  return useQuery({
    queryKey: ["stalls"],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name, photo_url, created_at, created_by)")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      const groups = (memberships ?? [])
        .map((m) => m.groups)
        .filter(Boolean) as { id: string; name: string; photo_url: string | null; created_at: string | null; created_by: string | null }[];

      const counts: Record<string, number> = {};
      if (groups.length) {
        const { data: all } = await supabase
          .from("group_members")
          .select("group_id")
          .in("group_id", groups.map((g) => g.id));
        for (const row of all ?? []) {
          if (row.group_id) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
        }
      }
      return groups.map((g) => ({ ...g, memberCount: counts[g.id] ?? 1 }));
    },
  });
}

export function useStall(groupId: string) {
  return useQuery({
    queryKey: ["stall", groupId],
    queryFn: async () => {
      const [groupRes, memberRes, expenseRes, settlementRes] = await Promise.all([
        supabase.from("groups").select("id, name, photo_url, created_by, created_at").eq("id", groupId).maybeSingle(),
        supabase
          .from("group_members")
          .select("id, user_id, role, profiles:user_id(id, full_name, email, phone_number, paypal_me_handle, wero_id)")
          .eq("group_id", groupId),
        supabase
          .from("expenses")
          .select("id, group_id, paid_by, amount, title, category, expense_date, created_at")
          .eq("group_id", groupId)
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("settlements")
          .select("id, group_id, payer_id, payee_id, amount, payment_method, status, created_at")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
      ]);

      if (groupRes.error) throw groupRes.error;
      const expenses = (expenseRes.data ?? []) as Expense[];
      let splits: Split[] = [];
      if (expenses.length) {
        const { data } = await supabase
          .from("expense_splits")
          .select("id, expense_id, debtor_id, amount, status")
          .in("expense_id", expenses.map((e) => e.id));
        splits = (data ?? []) as Split[];
      }

      const members: Member[] = (memberRes.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id as string,
        role: m.role,
        profile: m.profiles as unknown as Profile,
      }));

      return {
        group: groupRes.data,
        members,
        expenses,
        splits,
        settlements: (settlementRes.data ?? []) as Settlement[],
      };
    },
    enabled: Boolean(groupId),
  });
}

/** Nettosaldo je Mitglied: positiv = bekommt Geld, negativ = schuldet Geld. */
export function computeNet(
  members: Member[],
  expenses: Expense[],
  splits: Split[],
  settlements: Settlement[],
) {
  const net: Record<string, number> = {};
  for (const m of members) net[m.user_id] = 0;

  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  for (const split of splits) {
    if (split.status !== "accepted") continue;
    const payer = split.expense_id ? payerOf.get(split.expense_id) : null;
    if (!payer || !split.debtor_id) continue;
    const amount = num(split.amount);
    net[split.debtor_id] = (net[split.debtor_id] ?? 0) - amount;
    net[payer] = (net[payer] ?? 0) + amount;
  }

  for (const settlement of settlements) {
    if (settlement.status !== "confirmed") continue;
    if (!settlement.payer_id || !settlement.payee_id) continue;
    const amount = num(settlement.amount);
    net[settlement.payer_id] = (net[settlement.payer_id] ?? 0) + amount;
    net[settlement.payee_id] = (net[settlement.payee_id] ?? 0) - amount;
  }

  return net;
}
