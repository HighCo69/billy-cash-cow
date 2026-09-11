import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Dein Profil | BILLY" },
      { name: "description", content: "Name, Mobilnummer, PayPal.Me-Handle und wero-ID pflegen." },
      { property: "og:title", content: "Dein Profil | BILLY" },
      { property: "og:description", content: "Name, Mobilnummer, PayPal.Me und wero-ID pflegen." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [paypal, setPaypal] = useState("");
  const [wero, setWero] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me?.profile) return;
    setFullName(me.profile.full_name ?? "");
    setPhone(me.profile.phone_number ?? "");
    setPaypal(me.profile.paypal_me_handle ?? "");
    setWero(me.profile.wero_id ?? "");
  }, [me?.profile]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!me) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone_number: phone.trim() || null,
        paypal_me_handle: paypal.trim() || null,
        wero_id: wero.trim() || null,
      })
      .eq("id", me.userId);
    setSaving(false);
    if (error) {
      toast.error("Speichern hat nicht geklappt.");
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Gespeichert!");
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">BILLY käut wieder…</p>;

  return (
    <div>
      <Link to="/dashboard" className="text-sm font-bold text-muted-foreground">
        ← Deine Kontoställe
      </Link>
      <h1 className="mt-2 font-display text-2xl text-foreground">Dein Profil</h1>
      <p className="text-sm text-muted-foreground">{me?.email}</p>

      <form className="card-stall mt-5 space-y-4 p-5" onSubmit={handleSubmit}>
        <Field label="Name" value={fullName} onChange={setFullName} />
        <Field label="Mobilnummer" value={phone} onChange={setPhone} placeholder="+49 …" />
        <Field
          label="PayPal.Me-Handle"
          value={paypal}
          onChange={setPaypal}
          placeholder="z. B. alexvomhof"
        />
        <Field label="wero-ID" value={wero} onChange={setWero} placeholder="Handynummer oder E-Mail" />
        <p className="text-xs text-muted-foreground">
          Mit diesen Angaben können dir deine Stallgenossen per Klick Geld schicken.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall disabled:opacity-60"
        >
          Speichern
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
