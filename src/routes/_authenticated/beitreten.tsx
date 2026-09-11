import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/beitreten")({
  head: () => ({
    meta: [
      { title: "Kostenstall beitreten | BILLY" },
      { name: "description", content: "Tritt dem Kostenstall deiner Freunde bei." },
      { property: "og:title", content: "Kostenstall beitreten | BILLY" },
      { property: "og:description", content: "Tritt dem Kostenstall deiner Freunde bei." },
    ],
  }),
  component: JoinStall,
});

function JoinStall() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("join_kostenstall", {
        _inviter_email: email.trim(),
        _group_name: name.trim(),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      toast.success("Willkommen im Stall!");
      navigate({ to: "/stall/$id", params: { id: data as string } });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes("nicht gefunden")
          ? "Kostenstall nicht gefunden – stimmen E-Mail und Name?"
          : "Beitreten hat nicht geklappt.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link to="/dashboard" className="text-sm font-bold text-muted-foreground">
        ← Deine Kontoställe
      </Link>
      <h1 className="mt-2 font-display text-2xl text-foreground">Neuem Kostenstall beitreten</h1>

      <form className="card-stall mt-5 space-y-4 p-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
            E-Mail der einladenden Person
          </span>
          <input
            type="email"
            value={email}
            required
            onChange={(event) => setEmail(event.target.value)}
            placeholder="freund@beispiel.de"
            className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
            Name des Kostenstalls
          </span>
          <input
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
            placeholder="z. B. Wacken"
            className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall disabled:opacity-60"
        >
          Rein in den Stall
        </button>
      </form>
    </div>
  );
}
