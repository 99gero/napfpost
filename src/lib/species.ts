// Art des Haustiers. Die Tabelle heißt aus Kompatibilitätsgründen weiter `dogs` (Route /hund, Spalte dog_id).
// Die Standardaufgaben legt die Datenbankfunktion create_dog an; sie müssen mit DEFAULT_TASKS übereinstimmen
// (species.test.ts prüft das gegen die Migration).
export type Species = "dog" | "cat";

export type TaskTemplate = {
  kind: "feed" | "walk" | "water" | "custom";
  title: string;
  emoji: string;
  done_aux: string;
  done_word: string;
  /** Zeitfenster als [Bezeichnung, Beginn, Ende]; leer = einmal pro Tag */
  windows: [string, string, string][];
};

export const SPECIES: Record<Species, { label: string; emoji: string; emojis: string[]; placeholder: string }> = {
  dog: { label: "Hund", emoji: "🐶", emojis: ["🐶", "🐕", "🦮", "🐩", "🐕‍🦺"], placeholder: "Bruno" },
  cat: { label: "Katze", emoji: "🐱", emojis: ["🐱", "🐈", "🐈‍⬛", "😺", "😸"], placeholder: "Minka" },
};

export const DEFAULT_TASKS: Record<Species, TaskTemplate[]> = {
  dog: [
    { kind: "feed", title: "Füttern", emoji: "🍖", done_aux: "wurde", done_word: "gefüttert", windows: [["Morgens", "07:00", "10:00"], ["Abends", "17:00", "21:00"]] },
    { kind: "walk", title: "Gassi", emoji: "🦮", done_aux: "war", done_word: "Gassi", windows: [["Morgens", "06:00", "09:00"], ["Abends", "18:00", "22:00"]] },
    { kind: "water", title: "Frisches Wasser", emoji: "💧", done_aux: "hat", done_word: "frisches Wasser bekommen", windows: [] },
  ],
  cat: [
    { kind: "feed", title: "Füttern", emoji: "🐟", done_aux: "wurde", done_word: "gefüttert", windows: [["Morgens", "07:00", "10:00"], ["Abends", "17:00", "21:00"]] },
    { kind: "water", title: "Frisches Wasser", emoji: "💧", done_aux: "hat", done_word: "frisches Wasser bekommen", windows: [] },
    { kind: "custom", title: "Katzenklo", emoji: "🧹", done_aux: "hat", done_word: "ein sauberes Katzenklo bekommen", windows: [] },
  ],
};

export const isSpecies = (v: unknown): v is Species => v === "dog" || v === "cat";

/** Unbekannte oder fehlende Werte (Altbestand) gelten als Hund. */
export const speciesOf = (v: unknown): Species => (isSpecies(v) ? v : "dog");

export const defaultEmoji = (s: Species) => SPECIES[s].emoji;

/** Emoji passend zur Art; ein Emoji der anderen Art wird beim Umschalten der Art ersetzt. */
export function emojiForSpecies(current: string | undefined, next: Species): string {
  return current && SPECIES[next].emojis.includes(current) ? current : defaultEmoji(next);
}

/** „Bruno wurde gefüttert“ / „Minka hat ein sauberes Katzenklo bekommen“ */
export const previewSentence = (name: string, t: Pick<TaskTemplate, "done_aux" | "done_word">) => `${name} ${t.done_aux} ${t.done_word}`;
