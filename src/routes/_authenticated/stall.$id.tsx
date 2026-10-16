import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeNet, num, useMe, useStall, type Member, type Split } from "@/lib/data";
import { deDate, eur, paypalLink, simplifyDebts } from "@/lib/billy";
import { ExpenseForm } from "@/components/billy/ExpenseForm";
import { ConfirmButton } from "@/components/billy/ConfirmButton";

export const Route = createFileRoute("/_authenticated/stall/$id")({
  head: () => ({
    meta: [
      { title: "Kostenstall | BILLY" },
      { name: "description", content: "Ausgaben, unklare Forderungen und Salden dieses Kostenstalls." },
      { property: "og:title", content: "Kostenstall | BILLY" },
      { property: "og:description", content: "Ausgaben, unklare Forderungen und Salden." },
    ],
  }),
  component: StallPage,
});

type Tab = "konto" | "unklar" | "salden" | "team";

function StallPage() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const { data, isLoading } = useStall(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("konto");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);


  const meId = me?.userId ?? "";
  const allMembers = data?.members ?? [];
  const members = allMembers.filter((m) => m.status !== "pending");
  const pendingMembers = allMembers.filter((m) => m.status === "pending");
  const leavingMembers = allMembers.filter((m) => m.status === "leaving");
  const isOwner = data?.group?.created_by === meId;
  const myMembership = allMembers.find((m) => m.user_id === meId);
  const nameOf = (userId: string | null) =>
    allMembers.find((m) => m.user_id === userId)?.profile?.full_name ?? "Unbekannt";
  const profileOf = (userId: string | null) =>
    allMembers.find((m) => m.user_id === userId)?.profile ?? null;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stall", id] }),
      queryClient.invalidateQueries({ queryKey: ["stalls"] }),
    ]);

  async function approveMember(memberId: string) {
    const { error } = await supabase
      .from("group_members")
      .update({ status: "active" })
      .eq("id", memberId);
    if (error) {
      toast.error("Freigeben ging nicht.");
      return;
    }
    toast.success("Willkommen in der Herde!");
    refresh();
  }

  async function removeMember(memberId: string, label: string) {
    if (!window.confirm(`${label} wirklich aus dem Stall lassen?`)) return;
    const { error } = await supabase.from("group_members").delete().eq("id", memberId);
    if (error) {
      toast.error("Das ging nicht.");
      return;
    }
    toast.success("Tor auf, Tor zu.");
    refresh();
  }

  async function markLeaving() {
    if (!myMembership) return;
    const { error } = await supabase
      .from("group_members")
      .update({ status: "leaving" })
      .eq("id", myMembership.id);
    if (error) {
      toast.error("Das ging nicht.");
      return;
    }
    toast.success("Der Stallmeister ist informiert. Er holt nur noch kurz den Schlüssel.");
    refresh();
  }

  function requestLeave() {
    const balance = net[meId] ?? 0;
    if (balance < -0.005) {
      window.alert(
        `Damit die anderen dich nicht schlachten, solltest du erst dein Konto ausgleichen.\n\nDu schuldest noch ${eur(-balance)}.`,
      );
      return;
    }
    if (balance > 0.005) {
      const ok = window.confirm(
        `Warte. Du bekommst noch Futter.\n\nDie Herde muss dir noch ${eur(balance)} zahlen.\n\nWillst du darauf verzichten?`,
      );
      if (!ok) return;
    }
    markLeaving();
  }

  async function deleteStall() {
    const open = Object.values(net).some((value) => Math.abs(value) > 0.005);
    if (open && !window.confirm("Es sind noch Salden offen. Trotzdem alles löschen?")) return;
    if (!window.confirm("Kostenstall mit allen Ausgaben endgültig löschen?")) return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) {
      toast.error("Löschen ging nicht.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["stalls"] });
    toast.success("Stall abgerissen.");
    navigate({ to: "/dashboard" });
  }

  async function renameStall(event: React.FormEvent) {
    event.preventDefault();
    const value = (newName ?? "").trim();
    if (!value) return;
    setSavingName(true);
    const { data: updated, error } = await supabase
      .from("groups")
      .update({ name: value })
      .eq("id", id)
      .select("id");
    setSavingName(false);
    if (error || !updated?.length) {
      toast.error(error ? `Umbenennen hat nicht geklappt: ${error.message}` : "Keine Berechtigung zum Umbenennen.");
      return;
    }
    await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["stalls"] })]);
    setNewName(null);
    toast.success("Neuer Name hängt am Stall!");
  }


  const net = useMemo(
    () => computeNet(members, data?.expenses ?? [], data?.splits ?? [], data?.settlements ?? []),
    [members, data?.expenses, data?.splits, data?.settlements],
  );
  const transfers = useMemo(() => simplifyDebts(net), [net]);

  const splitsByExpense = useMemo(() => {
    const map = new Map<string, Split[]>();
    for (const split of data?.splits ?? []) {
      if (!split.expense_id) continue;
      const list = map.get(split.expense_id) ?? [];
      list.push(split);
      map.set(split.expense_id, list);
    }
    return map;
  }, [data?.splits]);

  const disputed = (data?.splits ?? []).filter((s) => s.status === "disputed");
  const openForMe = (data?.splits ?? []).filter((s) => s.status === "pending" && s.debtor_id === meId);

  async function setSplitStatus(splitId: string, status: "accepted" | "disputed") {
    const { error } = await supabase.from("expense_splits").update({ status }).eq("id", splitId);
    if (error) { toast.error("Das ging nicht."); return; }
    toast.success(status === "accepted" ? "Übernommen ins Konto." : "Ab in den Ordner „Unklar“.");
    refresh();
  }

  async function withdrawSplit(splitId: string) {
    const { error } = await supabase.from("expense_splits").delete().eq("id", splitId);
    if (error) { toast.error("Zurücknehmen ging nicht."); return; }
    toast.success("Forderung zurückgenommen.");
    refresh();
  }

  async function createSettlement(
    payeeId: string,
    amount: number,
    method: "paypal" | "wero" | "cash" | "bank_transfer",
  ) {
    const { error } = await supabase.from("settlements").insert({
      group_id: id,
      payer_id: meId,
      payee_id: payeeId,
      amount,
      payment_method: method,
      status: "pending",
    });
    if (error) { toast.error("Tilgung konnte nicht gespeichert werden."); return; }
    toast.success("Tilgung eingetragen – warte auf Bestätigung.");
    refresh();
  }

  async function setSettlementStatus(settlementId: string, status: "confirmed" | "disputed") {
    const { error } = await supabase.from("settlements").update({ status }).eq("id", settlementId);
    if (error) { toast.error("Das ging nicht."); return; }
    toast.success(status === "confirmed" ? "Tilgung bestätigt." : "Tilgung bestritten.");
    refresh();
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">BILLY käut wieder…</p>;
  if (!data?.group) return <p className="text-sm text-muted-foreground">Kostenstall nicht gefunden.</p>;

  const myBalance = net[meId] ?? 0;

  return (
    <div>
      <Link to="/dashboard" className="text-sm font-bold text-muted-foreground">
        ← Deine Kontoställe
      </Link>

      <header className="mt-2 flex items-center gap-3">
        {data.group.photo_url ? (
          <img
            src={data.group.photo_url}
            alt={data.group.name}
            className="h-14 w-14 rounded-xl border-2 border-ink object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-ink bg-primary text-2xl">
            🐄
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl text-foreground">{data.group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} Teilnehmer ·{" "}
            {myBalance >= 0 ? `du bekommst ${eur(myBalance)}` : `du schuldest ${eur(-myBalance)}`}
          </p>
        </div>
      </header>

      {openForMe.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-accent p-4">
          <p className="font-display text-base">
            {openForMe.length} Forderung{openForMe.length > 1 ? "en" : ""} warten auf dich – unten im
            Konto bestätigen.
          </p>
        </div>
      )}

      <nav className="mt-5 grid grid-cols-4 gap-1 rounded-full border-2 border-ink bg-muted p-1 text-sm font-bold">
        {(
          [
            ["konto", "Konto"],
            ["unklar", `Unklar${disputed.length ? ` (${disputed.length})` : ""}`],
            ["salden", "Salden"],
            ["team", "Stall"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-2 py-2 ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "konto" && (
        <section className="mt-4 space-y-3">
          {showForm ? (
            <ExpenseForm
              groupId={id}
              members={members}
              meId={meId}
              onDone={() => setShowForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall"
            >
              <Plus className="h-5 w-5" /> Ausgabe erfassen
            </button>
          )}

          {data.expenses.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch nichts ausgegeben. Wie sparsam.</p>
          )}

          {data.expenses.map((expense) => {
            const splits = (splitsByExpense.get(expense.id) ?? []).filter(
              (s) => s.status !== "disputed",
            );
            const mySplit = splits.find((s) => s.debtor_id === meId);
            return (
              <article key={expense.id} className="card-stall p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg">{expense.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {nameOf(expense.paid_by)} hat gezahlt · {deDate(expense.expense_date)}
                    </p>
                  </div>
                  <p className="font-display text-lg">{eur(num(expense.amount))}</p>
                </div>

                <ul className="mt-3 space-y-1 text-sm">
                  {splits.map((split) => (
                    <li key={split.id} className="flex items-center justify-between gap-2">
                      <span>
                        {nameOf(split.debtor_id)}
                        {split.debtor_id === meId ? " (du)" : ""}: {eur(num(split.amount))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          split.status === "accepted"
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {split.status === "accepted" ? "akzeptiert" : "offen"}
                      </span>
                    </li>
                  ))}
                </ul>

                {mySplit && mySplit.status === "pending" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ConfirmButton onClick={() => setSplitStatus(mySplit.id, "accepted")} />
                    <button
                      type="button"
                      onClick={() => setSplitStatus(mySplit.id, "disputed")}
                      className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
                    >
                      Widerspruch
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {tab === "unklar" && (
        <section className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Bestrittene Forderungen werden nicht verrechnet, bis ihr euch einig seid.
          </p>
          {disputed.length === 0 && (
            <div className="card-stall p-6 text-center">
              <p className="text-3xl">✨</p>
              <p className="mt-2 font-display text-lg">Alles klar im Stall</p>
            </div>
          )}
          {disputed.map((split) => {
            const expense = data.expenses.find((e) => e.id === split.expense_id);
            const isCreditor = expense?.paid_by === meId;
            const isDebtor = split.debtor_id === meId;
            return (
              <article key={split.id} className="card-stall p-4">
                <p className="font-display text-lg">{expense?.title ?? "Ausgabe"}</p>
                <p className="text-sm text-muted-foreground">
                  {nameOf(expense?.paid_by ?? null)} fordert {eur(num(split.amount))} von{" "}
                  {nameOf(split.debtor_id)}
                  {expense ? ` · ${deDate(expense.expense_date)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isDebtor && (
                    <ConfirmButton
                      onClick={() => setSplitStatus(split.id, "accepted")}
                      label="Doch akzeptieren"
                    />
                  )}
                  {isCreditor && (
                    <button
                      type="button"
                      onClick={() => withdrawSplit(split.id)}
                      className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
                    >
                      Forderung zurücknehmen
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === "salden" && (
        <section className="mt-4 space-y-3">
          <div className="card-stall p-4">
            <h2 className="font-display text-lg">Wer muss wem wie viel überweisen?</h2>
            {transfers.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Niemand schuldet jemandem etwas. BILLY ist zufrieden.
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {transfers.map((transfer, index) => {
                const payee = profileOf(transfer.to);
                const isMine = transfer.from === meId;
                return (
                  <li key={index} className="rounded-2xl border-2 border-border p-3">
                    <p className="font-bold">
                      {nameOf(transfer.from)}
                      {isMine ? " (du)" : ""} → {nameOf(transfer.to)}:{" "}
                      <span className="font-display">{eur(transfer.amount)}</span>
                    </p>
                    {isMine && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {payee?.paypal_me_handle && (
                          <a
                            href={paypalLink(payee.paypal_me_handle, transfer.amount)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => createSettlement(transfer.to, transfer.amount, "paypal")}
                            className="rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                          >
                            Jetzt begleichen (PayPal)
                          </a>
                        )}
                        {payee?.wero_id && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(payee.wero_id ?? "");
                              createSettlement(transfer.to, transfer.amount, "wero");
                              toast.success(`wero-ID kopiert: ${payee.wero_id}`);
                            }}
                            className="rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                          >
                            Jetzt begleichen (wero)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => createSettlement(transfer.to, transfer.amount, "cash")}
                          className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
                        >
                          Manuell gezahlt (bar)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            createSettlement(transfer.to, transfer.amount, "bank_transfer")
                          }
                          className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
                        >
                          Manuell gezahlt (Überweisung)
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card-stall p-4">
            <h2 className="font-display text-lg">Tilgungen</h2>
            {data.settlements.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">Noch keine Zahlung eingetragen.</p>
            )}
            <ul className="mt-3 space-y-3">
              {data.settlements.map((settlement) => (
                <li key={settlement.id} className="rounded-2xl border-2 border-border p-3">
                  <p className="font-bold">
                    {nameOf(settlement.payer_id)} → {nameOf(settlement.payee_id)}:{" "}
                    {eur(num(settlement.amount))}
                  </p>
                  <p className="text-xs uppercase text-muted-foreground">
                    {settlement.payment_method} ·{" "}
                    {settlement.status === "confirmed"
                      ? "bestätigt"
                      : settlement.status === "disputed"
                        ? "bestritten"
                        : "wartet auf Bestätigung"}
                  </p>
                  {settlement.status === "pending" && settlement.payee_id === meId && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ConfirmButton
                        onClick={() => setSettlementStatus(settlement.id, "confirmed")}
                      />
                      <button
                        type="button"
                        onClick={() => setSettlementStatus(settlement.id, "disputed")}
                        className="rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold"
                      >
                        Nicht erhalten
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tab === "team" && (
        <section className="mt-4 space-y-3">
          <form className="card-stall p-4" onSubmit={renameStall}>
            <h2 className="font-display text-lg">Stall umbenennen</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={newName ?? data.group.name}
                onChange={(event) => setNewName(event.target.value)}
                className="flex-1 rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={savingName}
                className="rounded-full border-2 border-ink bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60"
              >
                Speichern
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Achtung: Neue Leute brauchen zum Beitreten genau diesen Namen.
            </p>
          </form>

          {isOwner && pendingMembers.length > 0 && (
            <div className="card-stall p-4">
              <h2 className="font-display text-lg">Vor dem Stall ({pendingMembers.length})</h2>
              <ul className="mt-3 space-y-3">
                {pendingMembers.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <strong>{member.profile?.full_name ?? "Unbekannt"}</strong>
                      <br />
                      <span className="text-muted-foreground">{member.profile?.email}</span>
                    </span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => approveMember(member.id)}
                        className="rounded-full border-2 border-ink bg-primary px-3 py-1 font-bold text-primary-foreground"
                      >
                        Zur Herde
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id, member.profile?.full_name ?? "Diese Person")}
                        className="rounded-full border-2 border-ink bg-card px-3 py-1 font-bold"
                      >
                        Ablehnen
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && leavingMembers.length > 0 && (
            <div className="card-stall p-4">
              <h2 className="font-display text-lg">Will raus.</h2>
              <ul className="mt-3 space-y-3">
                {leavingMembers.map((member) => {
                  const balance = net[member.user_id] ?? 0;
                  return (
                    <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <strong>{member.profile?.full_name ?? "Unbekannt"}</strong> · {eur(balance)}
                        {balance > 0.005 && (
                          <span className="block text-xs text-muted-foreground">verzichtet auf das Guthaben</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id, member.profile?.full_name ?? "Diese Person")}
                        className="rounded-full border-2 border-ink bg-primary px-3 py-1 font-bold text-primary-foreground"
                      >
                        Rauslassen
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="card-stall p-4">
            <h2 className="font-display text-lg">Die Herde ({members.length}/12)</h2>

            <ul className="mt-3 space-y-2">
              {members.map((member: Member) => {
                const balance = net[member.user_id] ?? 0;
                const settled = Math.abs(balance) < 0.005;
                return (
                  <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {member.profile?.full_name ?? "Unbekannt"}
                      {member.user_id === meId ? " (du)" : ""}
                      {member.role === "owner" ? " · Stallmeister" : ""}
                      {member.status === "leaving" ? " · will raus" : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={balance >= 0 ? "text-foreground" : "text-destructive"}>
                        {eur(balance)}
                      </span>
                      {isOwner && member.user_id !== meId && settled && (
                        <button
                          type="button"
                          onClick={() => removeMember(member.id, member.profile?.full_name ?? "Diese Person")}
                          className="rounded-full border-2 border-ink bg-card px-2 py-0.5 text-xs font-bold"
                        >
                          Entfernen
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Zum Einladen: deine Freunde tragen unter „Kostenstall betreten“ die E-Mail{" "}
              <strong>{me?.email}</strong> und den Namen <strong>{data.group.name}</strong> ein. Der
              Stallmeister lässt sie dann rein.
            </p>
            {!isOwner && myMembership?.status === "active" && (
              <button
                type="button"
                onClick={requestLeave}
                className="mt-4 w-full rounded-full border-2 border-ink bg-card px-4 py-2 font-bold"
              >
                Herde verlassen
              </button>
            )}
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={deleteStall}
              className="w-full rounded-full border-2 border-destructive bg-card px-4 py-2 font-bold text-destructive"
            >
              Kostenstall löschen
            </button>
          )}
        </section>
      )}
    </div>
  );
}
