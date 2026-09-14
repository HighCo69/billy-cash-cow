import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Neues Passwort | BILLY" },
      { name: "description", content: "Lege ein neues Passwort für deinen BILLY-Stall fest." },
      { property: "og:title", content: "Neues Passwort | BILLY" },
      { property: "og:description", content: "Neues Passwort für BILLY festlegen." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Recovery-Link liefert die Session im URL-Hash; Supabase verarbeitet sie automatisch.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      const hash = window.location.hash;
      if (data.session && (hash.includes("type=recovery") || hash.includes("access_token"))) {
        setReady(true);
      } else if (!hash.includes("type=recovery")) {
        setInvalid(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Mindestens 8 Zeichen – sonst wirst du gemolken.");
      return;
    }
    if (password !== password2) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Das hat nicht geklappt. Fordere den Link bitte erneut an.");
      return;
    }
    toast.success("Neues Passwort hängt am Stall!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="hay-stripes h-3 w-full" />
      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
        <h1 className="font-display text-2xl text-foreground">Neues Passwort</h1>
        {invalid && (
          <div className="card-stall mt-4 p-5">
            <p className="text-sm text-muted-foreground">
              Dieser Link ist ungültig oder abgelaufen. Fordere auf der Startseite über
              „Passwort vergessen?“ einen neuen an.
            </p>
          </div>
        )}
        {!ready && !invalid && (
          <p className="mt-4 text-sm text-muted-foreground">BILLY prüft deinen Link…</p>
        )}
        {ready && (
          <form className="card-stall mt-4 space-y-3 p-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Neues Passwort
              </span>
              <input
                type="password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Wiederholen
              </span>
              <input
                type="password"
                value={password2}
                required
                onChange={(event) => setPassword2(event.target.value)}
                className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall disabled:opacity-60"
            >
              Passwort festlegen
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
