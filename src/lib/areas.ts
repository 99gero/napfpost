// Bereiche der App. Der Hund ist ausgebaut; die anderen sind im Datenmodell (tasks.area)
// und in der Erledigungslogik bereits vorgesehen und bekommen später eigene Oberflächen.
import type { Area } from "./types";

export const AREAS: Record<Area, { label: string; emoji: string; ready: boolean; examples: string[] }> = {
  dog: { label: "Hund", emoji: "🐶", ready: true, examples: ["Füttern", "Gassi", "Frisches Wasser"] },
  pet: { label: "Haustiere", emoji: "🐱", ready: false, examples: ["Katze gefüttert", "Katzenklo", "Medikamente"] },
  child: { label: "Kind", emoji: "🎒", ready: false, examples: ["Brotdose gepackt", "Schulranzen", "Abgeholt"] },
  household: { label: "Haushalt", emoji: "🏠", ready: false, examples: ["Müll", "Spülmaschine", "Pflanzen gegossen"] },
};
