"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { SPECIES, defaultEmoji, emojiForSpecies, type Species } from "@/lib/species";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function NewDogPage() {
  const { household, dogs } = useHousehold();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [emoji, setEmoji] = useState(defaultEmoji("dog"));

  function pickSpecies(next: Species) {
    setSpecies(next);
    setEmoji((cur) => emojiForSpecies(cur, next));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("create_dog", {
      p_household: household.id,
      p_name: String(f.get("name")),
      p_emoji: emoji,
      p_species: species,
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace(`/hund/${data}`);
    router.refresh();
  }

  return (
    <main className="grid gap-5">
      <div className="grid gap-2">
        <p className="eyebrow">{dogs.length ? "Weiteres Haustier" : "Los geht’s"}</p>
        <h1 className="font-display text-4xl leading-none">Wer wohnt bei euch?</h1>
        <p className="text-muted">
          {species === "dog"
            ? "Wir legen Füttern (morgens 7–10 Uhr, abends 17–21 Uhr), Gassi und frisches Wasser an."
            : "Wir legen Füttern (morgens 7–10 Uhr, abends 17–21 Uhr), frisches Wasser und Katzenklo an."}{" "}
          Die Zeiten kannst du danach anpassen.
        </p>
      </div>
      <Card>
        <form onSubmit={submit} className="grid gap-3">
          <SpeciesPicker species={species} emoji={emoji} onSpecies={pickSpecies} onEmoji={setEmoji} />
          <Field id="name" name="name" label="Name des Haustiers" placeholder={SPECIES[species].placeholder} required maxLength={40} />
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy}>Haustier anlegen</Button>
        </form>
      </Card>
    </main>
  );
}
