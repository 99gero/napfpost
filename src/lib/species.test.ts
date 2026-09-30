import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_TASKS, SPECIES, defaultEmoji, emojiForSpecies, isSpecies, previewSentence, speciesOf } from "./species";
import { doneSentence, pushTitle } from "./texts";

const migration = readFileSync(new URL("../../supabase/migrations/20260930000200_haustier.sql", import.meta.url), "utf8");

describe("Art des Haustiers", () => {
  it("erkennt nur Hund und Katze, alles andere gilt als Hund", () => {
    expect(isSpecies("dog")).toBe(true);
    expect(isSpecies("cat")).toBe(true);
    expect(isSpecies("bird")).toBe(false);
    expect(speciesOf(undefined)).toBe("dog");
    expect(speciesOf("cat")).toBe("cat");
    expect(speciesOf("x")).toBe("dog");
  });
  it("Standard-Emoji: 🐶 und 🐱, jeweils Teil der eigenen Auswahl", () => {
    expect(defaultEmoji("dog")).toBe("🐶");
    expect(defaultEmoji("cat")).toBe("🐱");
    for (const s of ["dog", "cat"] as const) expect(SPECIES[s].emojis[0]).toBe(SPECIES[s].emoji);
  });
  it("Emoji bleibt beim Umschalten nur, wenn es zur neuen Art gehört", () => {
    expect(emojiForSpecies("🐈", "cat")).toBe("🐈");
    expect(emojiForSpecies("🦮", "cat")).toBe("🐱");
    expect(emojiForSpecies("🐈", "dog")).toBe("🐶");
    expect(emojiForSpecies(undefined, "cat")).toBe("🐱");
  });
});

describe("Standardaufgaben", () => {
  it("Hund: Füttern, Gassi, Wasser wie bisher", () => {
    expect(DEFAULT_TASKS.dog.map((t) => t.kind)).toEqual(["feed", "walk", "water"]);
  });
  it("Katze: Füttern, Wasser, Katzenklo – niemals Gassi", () => {
    expect(DEFAULT_TASKS.cat.map((t) => t.title)).toEqual(["Füttern", "Frisches Wasser", "Katzenklo"]);
    expect(DEFAULT_TASKS.cat.some((t) => t.kind === "walk" || /gassi/i.test(t.title))).toBe(false);
  });
  it("Zeitfenster sind gültig (Ende nach Beginn)", () => {
    for (const list of Object.values(DEFAULT_TASKS)) for (const t of list) for (const [, a, b] of t.windows) expect(b > a).toBe(true);
  });
  it("Nachrichten lesen sich natürlich", () => {
    expect(previewSentence("Minka", DEFAULT_TASKS.cat[0])).toBe("Minka wurde gefüttert");
    expect(previewSentence("Minka", DEFAULT_TASKS.cat[2])).toBe("Minka hat ein sauberes Katzenklo bekommen");
    expect(previewSentence("Bruno", DEFAULT_TASKS.dog[1])).toBe("Bruno war Gassi");
  });
  it("Push-Titel nimmt das Emoji des Haustiers", () => {
    const feed = DEFAULT_TASKS.cat[0];
    expect(pushTitle("🐱", "Minka", feed)).toBe("🐱 Minka wurde gefüttert");
    expect(doneSentence("Minka", feed)).toBe("Minka wurde gefüttert");
  });
});

describe("Migration create_dog", () => {
  const start = migration.indexOf("create or replace function public.create_dog");
  const fn = migration.slice(start, migration.indexOf("\n$$;", start));
  const afterIf = fn.split("if sp = 'dog' then")[1] ?? "";
  const [dogBlock = "", catBlock = ""] = afterIf.split("\n  else\n");

  it("enthält je einen Zweig für Hund und Katze", () => {
    expect(dogBlock.length).toBeGreaterThan(100);
    expect(catBlock.length).toBeGreaterThan(100);
  });
  it("legt genau die Standardaufgaben aus DEFAULT_TASKS an", () => {
    for (const [species, block] of [["dog", dogBlock], ["cat", catBlock]] as const) {
      const list = DEFAULT_TASKS[species];
      expect(block.match(/insert into public\.tasks/g)?.length, species).toBe(list.length);
      for (const t of list) {
        expect(block, `${species}: ${t.title}`).toContain(`'${t.kind}', '${t.title}', '${t.emoji}', '${t.done_aux}', '${t.done_word}'`);
        for (const [label, a, b] of t.windows) expect(block).toContain(`'${label}', '${a}', '${b}'`);
      }
    }
  });
  it("Katzen bekommen keine Gassi-Aufgabe", () => {
    expect(catBlock).not.toMatch(/'walk'|Gassi/);
  });
});
