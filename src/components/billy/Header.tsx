import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Original-Logo bleibt als Backup erhalten (src/assets/billy-logo-kreis.webp.asset.json).
// Vorläufig ersetzt durch temporäres Header-Bild:
import headerLogoTemp from "@/assets/header-logo-temp.jpg";

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-primary">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          <img
            src={headerLogoTemp}
            alt="BILLY"
            className="h-10 w-10 rounded-full border-2 border-ink bg-white object-contain"
          />
          <span className="min-w-0 font-display text-sm font-bold leading-tight text-primary-foreground sm:text-base">
            BILLY - Your friendly cash cow
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/profil"
            className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-card px-3 py-1.5 text-sm font-bold text-foreground"
          >
            <UserRound className="h-4 w-4" /> <span className="hidden sm:inline">Profil</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-ink px-3 py-1.5 text-sm font-bold text-ink-foreground"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Raus</span>
          </button>
        </div>
      </div>
    </header>
  );
}
