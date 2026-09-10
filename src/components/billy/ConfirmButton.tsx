import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

/** Rundes Gelb-Schwarzes Bestätigungs-Icon mit "(¥€$) Alles korrekt?" */
export function ConfirmButton({ onClick, disabled, label = "Alles korrekt?", className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary py-1 pl-1 pr-4 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50",
        className,
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[11px] font-black text-primary">
        (¥€$)
      </span>
      {label}
    </button>
  );
}
