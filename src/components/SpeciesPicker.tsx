"use client";
import { SPECIES, type Species } from "@/lib/species";

/** Auswahl der Art (Hund/Katze) und des Symbols. Steuerbar von außen, damit Anlegen und Bearbeiten dasselbe nutzen. */
export function SpeciesPicker({ species, emoji, onSpecies, onEmoji }: { species: Species; emoji: string; onSpecies: (s: Species) => void; onEmoji: (e: string) => void }) {
  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold text-muted">Art</legend>
        <div className="flex gap-2">
          {(Object.keys(SPECIES) as Species[]).map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="species" value={s} checked={species === s} onChange={() => onSpecies(s)} className="peer sr-only" />
              <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line bg-card px-4 py-2.5 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-on-ink peer-focus-visible:outline peer-focus-visible:outline-kibble">
                <span aria-hidden>{SPECIES[s].emoji}</span> {SPECIES[s].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold text-muted">Symbol</legend>
        <div className="flex flex-wrap gap-2">
          {SPECIES[species].emojis.map((em) => (
            <label key={em} className="cursor-pointer">
              <input type="radio" name="emoji" value={em} checked={emoji === em} onChange={() => onEmoji(em)} className="peer sr-only" />
              <span className="grid size-12 place-items-center rounded-2xl border-[1.5px] border-line bg-card text-2xl peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-kibble">{em}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
