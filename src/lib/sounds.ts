import billyCoin from "@/assets/billy-coin.mp3.asset.json";

/**
 * Spielt den BILLY-Münz-Sound ab.
 * Wird z. B. beim Eintragen eines gültigen Betrags ausgelöst.
 */
export function playCoinSound() {
  try {
    const audio = new Audio(billyCoin.url);
    audio.volume = 0.6;
    void audio.play();
  } catch {
    // Audio ist optional – falls Browser blockieren, einfach stillschweigend ignorieren.
  }
}
