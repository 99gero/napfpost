"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function NewDogPage() {
  const { household, dogs } = useHousehold();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("create_dog", {
      p_household: household.id,
      p_name: String(f.get("name")),
      p_emoji: String(f.get("emoji") || "🐶"),
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace(`/hund/${data}`);
    router.refresh();
  }

  return (
    <main className="grid gap-5">
      <div className="grid gap-2">
        <p className="eyebrow">{dogs.length ? "Weiterer Hund" : "Los geht’s"}</p>
        <h1 className="font-display text-4xl leading-none">Wer wohnt bei euch?</h1>
        <p className="text-muted">Wir legen Füttern (morgens 7–10 Uhr, abends 17–21 Uhr), Gassi und frisches Wasser an. Die Zeiten kannst du danach anpassen.</p>
      </div>
      <Card>
        <form onSubmit={submit} className="grid gap-3">
          <Field id="name" name="name" label="Name des Hundes" placeholder="Bruno" required maxLength={40} />
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-semibold text-muted">Symbol</legend>
            <div className="flex flex-wrap gap-2">
              {["🐶", "🐕", "🦮", "🐩", "🐕‍🦺"].map((em, i) => (
                <label key={em} className="cursor-pointer">
                  <input type="radio" name="emoji" value={em} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="grid size-12 place-items-center rounded-2xl border-[1.5px] border-line bg-card text-2xl peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-kibble">{em}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy}>Hund anlegen</Button>
        </form>
      </Card>
    </main>
  );
}
