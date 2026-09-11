import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resizeImage } from "@/lib/billy";

export const Route = createFileRoute("/_authenticated/neu")({
  head: () => ({
    meta: [
      { title: "Kostenstall anlegen | BILLY" },
      { name: "description", content: "Lege einen neuen Kostenstall für deine Gruppe an." },
      { property: "og:title", content: "Kostenstall anlegen | BILLY" },
      { property: "og:description", content: "Lege einen neuen Kostenstall für deine Gruppe an." },
    ],
  }),
  component: NewStall,
});

function NewStall() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [emails, setEmails] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await resizeImage(file, 200));
    } catch {
      toast.error("Das Bild mochte BILLY nicht.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const cleaned = emails.map((e) => e.trim()).filter(Boolean);
      if (cleaned.length > 11) throw new Error("Maximal 12 Personen pro Kostenstall (inkl. dir).");
      const { data, error } = await supabase.rpc("create_kostenstall", {
        _name: name.trim(),
        _photo_url: photo,
        _emails: cleaned,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["stalls"] });
      toast.success("Kostenstall steht!");
      navigate({ to: "/stall/$id", params: { id: data as string } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das hat nicht geklappt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link to="/dashboard" className="text-sm font-bold text-muted-foreground">
        ← Deine Kontoställe
      </Link>
      <h1 className="mt-2 font-display text-2xl text-foreground">Neuen Kostenstall anlegen</h1>

      <form className="card-stall mt-5 space-y-4 p-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
            Name des Kostenstalls
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="z. B. Ballermanntrip"
            required
            className="w-full rounded-xl border-2 border-ink bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
            Foto (optional, wird auf 200×200 px verkleinert)
          </span>
          <div className="flex items-center gap-3">
            {photo ? (
              <img src={photo} alt="Vorschau" className="h-16 w-16 rounded-xl border-2 border-ink object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-ink bg-primary text-2xl">
                🐄
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handlePhoto(event.target.files?.[0])}
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
            Teilnehmer einladen (E-Mail, max. 12 inkl. dir)
          </span>
          <div className="space-y-2">
            {emails.map((value, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="email"
                  value={value}
                  placeholder="freund@beispiel.de"
                  onChange={(event) =>
                    setEmails((prev) => prev.map((e, i) => (i === index ? event.target.value : e)))
                  }
                  className="flex-1 rounded-xl border-2 border-ink bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setEmails((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-xl border-2 border-ink px-3"
                  aria-label="Entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {emails.length < 11 && (
            <button
              type="button"
              onClick={() => setEmails((prev) => [...prev, ""])}
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-foreground"
            >
              <Plus className="h-4 w-4" /> Weitere Person
            </button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Nur Personen, die schon bei BILLY sind, werden direkt hinzugefügt. Alle anderen können
            über „Kostenstall beitreten“ dazukommen.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full border-2 border-ink bg-primary px-4 py-3 font-display text-lg font-bold text-primary-foreground shadow-stall disabled:opacity-60"
        >
          Kostenstall bauen
        </button>
      </form>
    </div>
  );
}
