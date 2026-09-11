import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, LogIn } from "lucide-react";
import { useMyStalls, useMe } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Deine Kontoställe | BILLY" },
      { name: "description", content: "Alle deine Kostenställe auf einen Blick." },
      { property: "og:title", content: "Deine Kontoställe | BILLY" },
      { property: "og:description", content: "Alle deine Kostenställe auf einen Blick." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data: stalls, isLoading } = useMyStalls();

  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Deine Kontoställe</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Moin {me?.profile?.full_name ?? "Pursche/Magd"} – hier grast dein Geld.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          to="/neu"
          className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-stall"
        >
          <Plus className="h-4 w-4" /> Neuen Kostenstall anlegen
        </Link>
        <Link
          to="/beitreten"
          className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-card px-4 py-3 text-sm font-bold text-foreground"
        >
          <LogIn className="h-4 w-4" /> Neuem Kostenstall beitreten
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">BILLY käut wieder…</p>}
        {!isLoading && (stalls?.length ?? 0) === 0 && (
          <div className="card-stall p-6 text-center">
            <p className="text-4xl">🌾</p>
            <p className="mt-2 font-display text-lg">Noch kein Kostenstall</p>
            <p className="text-sm text-muted-foreground">
              Leg deinen ersten Stall an – z. B. „WG“, „Ballermanntrip“ oder „Wacken“.
            </p>
          </div>
        )}
        {stalls?.map((stall) => (
          <Link
            key={stall.id}
            to="/stall/$id"
            params={{ id: stall.id }}
            className="card-stall flex items-center gap-4 p-4"
          >
            {stall.photo_url ? (
              <img
                src={stall.photo_url}
                alt={stall.name}
                className="h-14 w-14 rounded-xl border-2 border-ink object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-ink bg-primary text-2xl">
                🐄
              </span>
            )}
            <div>
              <p className="font-display text-lg text-foreground">{stall.name}</p>
              <p className="text-sm text-muted-foreground">
                {stall.memberCount} {stall.memberCount === 1 ? "Teilnehmer" : "Teilnehmer"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
