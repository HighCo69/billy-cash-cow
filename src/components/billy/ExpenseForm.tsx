import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, splitAmount } from "@/lib/billy";
import type { Member } from "@/lib/data";

type Item = { amount: string; category: string; details: string };

const emptyItem: Item = { amount: "", category: CATEGORIES[0].key, details: "" };

export function ExpenseForm({
  groupId,
  members,
  meId,
  onDone,
}: {
  groupId: string;
  members: Member[];
  meId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [forAll, setForAll] = useState(true);
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.user_id));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const toggle = (userId: string) =>
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const participants = forAll ? members.map((m) => m.user_id) : selected;
    if (participants.length === 0) {
      toast.error("Für wen war das denn? Wähle mindestens eine Person.");
      return;
    }
    const parsed = items.map((item) => ({
      ...item,
      value: Number(item.amount.replace(",", ".")),
    }));
    if (parsed.some((item) => !Number.isFinite(item.value) || item.value <= 0)) {
      toast.error("Bitte bei jedem Kostenpunkt einen Betrag eintragen.");
      return;
    }

    setSaving(true);
    try {
      for (const item of parsed) {
        const title = item.details.trim() ? `${item.category} – ${item.details.trim()}` : item.category;
        const { data: expense, error } = await supabase
          .from("expenses")
          .insert({
            group_id: groupId,
            paid_by: meId,
            amount: item.value,
            title,
            category: item.category,
            expense_date: date,
          })
          .select("id")
          .single();
        if (error) throw error;

        const shares = splitAmount(item.value, participants.length);
        const rows = participants
          .map((userId, index) => ({
            expense_id: expense.id,
            debtor_id: userId,
            amount: shares[index]!,
            status: userId === meId ? "accepted" : "pending",
          }))
          .filter((row) => row.debtor_id !== meId);
        if (rows.length) {
          const { error: splitError } = await supabase.from("expense_splits").insert(rows);
          if (splitError) throw splitError;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["stall", groupId] });
      toast.success("Ausgabe im Stall!");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card-stall space-y-5 p-5" onSubmit={handleSubmit}>
      <h2 className="font-display text-xl">Ausgabe erfassen</h2>

      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-2xl border-2 border-border bg-muted/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">
              Kostenpunkt {index + 1}
            </span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                aria-label="Kostenpunkt entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
              Betrag (€)
            </span>
            <input
              inputMode="decimal"
              value={item.amount}
              onChange={(event) => update(index, { amount: event.target.value })}
              placeholder="0,00"
              className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 text-lg font-bold outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
              Grund
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => update(index, { category: category.key })}
                  className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm font-bold ${
                    item.category === category.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground"
                  }`}
                >
                  {category.emoji} {category.key}
                </button>
              ))}
            </div>
            <input
              value={item.details}
              onChange={(event) => update(index, { details: event.target.value })}
              placeholder={`Details: ${CATEGORIES.find((c) => c.key === item.category)?.hint ?? ""}`}
              className="mt-2 w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}
        className="inline-flex items-center gap-1 text-sm font-bold text-foreground"
      >
        <Plus className="h-4 w-4" /> Weiteren Kostenpunkt ergänzen
      </button>

      <div>
        <span className="mb-2 block text-xs font-bold uppercase text-muted-foreground">
          Bezahlt für
        </span>
        <div className="flex gap-4 text-sm font-bold">
          <label className="flex items-center gap-2">
            <input type="radio" checked={forAll} onChange={() => setForAll(true)} /> alle
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!forAll} onChange={() => setForAll(false)} /> einzelne
          </label>
        </div>
        {!forAll && (
          <div className="mt-2 space-y-1">
            {members.map((member) => (
              <label key={member.user_id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(member.user_id)}
                  onChange={() => toggle(member.user_id)}
                />
                {member.profile?.full_name ?? "Unbekannt"}
                {member.user_id === meId ? " (du)" : ""}
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Datum</span>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall disabled:opacity-60"
        >
          Eintragen
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border-2 border-ink bg-card px-4 py-3 text-sm font-bold"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
