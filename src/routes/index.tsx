import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import billyLogo from "@/assets/billy-logo-kreis.webp.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BILLY – The Friendly Cash Cow | Gruppenkasse & WG-Konto" },
      {
        name: "description",
        content:
          "Lieber Geld wie Heu als dumm wie Stroh: BILLY teilt Ausgaben in WG, Urlaub und Gruppe fair auf und rechnet Schulden auf ein Minimum herunter.",
      },
      { property: "og:title", content: "BILLY – The Friendly Cash Cow" },
      {
        property: "og:description",
        content: "Ausgaben unter Freunden. EINFACH. FAIR. VERWALTEN.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [paypal, setPaypal] = useState("");
  const [wero, setWero] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        if (!fullName.trim()) throw new Error("Sag uns deinen Namen, Pursche/Magd!");
        if (password.length < 8) throw new Error("Mindestens 8 Zeichen – sonst wirst du gemolken.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          await supabase
            .from("profiles")
            .update({
              full_name: fullName.trim(),
              phone_number: phone.trim() || null,
              paypal_me_handle: paypal.trim() || null,
              wero_id: wero.trim() || null,
            })
            .eq("id", data.session.user.id);
          navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Fast im Stall! Bestätige bitte die E-Mail in deinem Postfach.");
          setMode("login");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Da hat der Stall geklemmt.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Trag erst deine E-Mail ein, dann schicken wir dir den Link.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Das hat nicht geklappt. Versuch es gleich nochmal.");
      return;
    }
    toast.success("Wenn es ein Konto mit dieser E-Mail gibt, ist der Link unterwegs in dein Postfach.");
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google-Anmeldung hat nicht geklappt.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  if (!checked) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="hay-stripes h-3 w-full" />
      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-8">
        <section className="text-center">
          <img
            src={billyLogo.url}
            alt="BILLY – The Friendly Cash Cow"
            className="mx-auto h-24 w-24 rounded-full border-2 border-ink bg-white object-contain"
          />
          <h1 className="mt-4 font-display text-3xl font-bold text-foreground">
            BILLY
            <span className="mt-1 block text-base font-semibold text-muted-foreground">
              The Friendly Cash Cow
            </span>
          </h1>
          <p className="mt-4 font-display text-xl leading-snug text-foreground">
            „Lieber Geld wie Heu als dumm wie Stroh.“
          </p>
          <p className="mt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Ausgaben unter Freunden. Einfach. Fair. Verwalten.
          </p>
        </section>

        <section className="card-stall mt-8 p-5">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-full border-2 border-ink bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-full px-3 py-2 text-sm font-bold ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Neu hier
            </button>
          </div>

          <h2 className="font-display text-xl text-foreground">
            {mode === "login" ? "Zu deinen Kontoställen?" : "Wie soll dein Name sein, Pursche/Magd?"}
          </h2>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            {mode === "register" && (
              <Field
                label="Dein Name"
                value={fullName}
                onChange={setFullName}
                placeholder="z. B. Alex vom Hof"
                required
              />
            )}
            <Field
              label="E-Mail"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="du@beispiel.de"
              required
            />
            {mode === "register" && (
              <Field
                label="Mobilnummer (optional)"
                value={phone}
                onChange={setPhone}
                placeholder="+49 …"
              />
            )}
            <Field
              label="Passwort"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
            />
            {mode === "register" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Damit nicht du gemolken wirst, wähle ein sicheres Passwort.
                </p>
                <Field
                  label="PayPal.Me-Handle (optional)"
                  value={paypal}
                  onChange={setPaypal}
                  placeholder="z. B. alexvomhof"
                />
                <Field
                  label="wero-ID (optional)"
                  value={wero}
                  onChange={setWero}
                  placeholder="Handynummer oder E-Mail bei wero"
                />
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {mode === "login" ? "Hinein in den Stall" : "Stalltür aufmachen"}
            </button>
            {mode === "login" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full text-center text-sm font-bold text-muted-foreground underline underline-offset-2"
              >
                Passwort vergessen?
              </button>
            )}
          </form>

          <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> oder <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full rounded-full border-2 border-ink bg-card px-4 py-3 text-sm font-bold text-foreground"
          >
            Weiter mit Google
          </button>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-3">
          <Feature emoji="🏚️" title="Kostenställe" text="WG, Ballermanntrip, Wacken – alles getrennt sauber im eigenen Stall." />
          <Feature emoji="🧾" title="Ausgaben erfassen" text="Betrag, Grund, Datum und wer mitzahlt – in wenigen Sekunden." />
          <Feature emoji="🤝" title="Schuldenminimierung" text="BILLY rechnet alles auf die kleinstmögliche Zahl an Überweisungen herunter." />
        </section>
      </main>
    </div>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-ink bg-card p-4">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <div>
        <h3 className="font-display text-base text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
