// Bereiche der App. Das Haustier (Hund oder Katze, intern area „dog“) ist ausgebaut; die anderen sind im Datenmodell (tasks.area)
// und in der Erledigungslogik bereits vorgesehen und bekommen später eigene Oberflächen.
import type { Area } from "./types";

export const AREAS: Record<Area, { label: string; emoji: string; ready: boolean; examples: string[] }> = {
  dog: { label: "Haustier", emoji: "🐾", ready: true, examples: ["Füttern", "Gassi", "Katzenklo", "Frisches Wasser"] },
  pet: { label: "Weitere Tiere", emoji: "🐰", ready: false, examples: ["Kaninchen gefüttert", "Aquarium", "Medikamente"] },
  child: { label: "Kind", emoji: "🎒", ready: false, examples: ["Brotdose gepackt", "Schulranzen", "Abgeholt"] },
  household: { label: "Haushalt", emoji: "🏠", ready: false, examples: ["Müll", "Spülmaschine", "Pflanzen gegossen"] },
};
