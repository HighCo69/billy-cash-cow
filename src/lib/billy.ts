export const CATEGORIES = [
  { key: "Einkauf", hint: "z. B. Ort", emoji: "🛒" },
  { key: "Taxi / Uber", hint: "z. B. Strecke", emoji: "🚕" },
  { key: "Eintritt", hint: "z. B. Location", emoji: "🎟️" },
  { key: "Essen", hint: "z. B. Location", emoji: "🍽️" },
  { key: "Kneipe", hint: "z. B. Location", emoji: "🍺" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);

export const deDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value),
  );

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Teilt einen Betrag centgenau auf n Personen auf. */
export function splitAmount(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const rest = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

export type Transfer = { from: string; to: string; amount: number };

/**
 * Schuldenminimierung: aus den Nettosalden aller Mitglieder wird die
 * minimale Anzahl an Überweisungen berechnet.
 * Positiver Saldo = bekommt Geld, negativer Saldo = schuldet Geld.
 */
export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net)
    .filter(([, v]) => v < -0.005)
    .map(([id, v]) => ({ id, amount: -v }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0.005)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = round2(Math.min(debtor.amount, creditor.amount));
    if (amount > 0.005) {
      transfers.push({ from: debtor.id, to: creditor.id, amount });
    }
    debtor.amount = round2(debtor.amount - amount);
    creditor.amount = round2(creditor.amount - amount);
    if (debtor.amount <= 0.005) i += 1;
    if (creditor.amount <= 0.005) j += 1;
  }
  return transfers;
}

export function paypalLink(handle: string, amount: number) {
  const clean = handle.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "");
  return `https://www.paypal.me/${encodeURIComponent(clean)}/${amount.toFixed(2)}EUR`;
}

/** Verkleinert ein Bild auf max. 200x200 px und liefert eine Data-URL. */
export async function resizeImage(file: File, max = 200): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}
