"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Logo } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export function StartForms({ name, code }: { name: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("create_household", { p_name: String(new FormData(e.currentTarget).get("household")) });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/hund/neu");
    router.refresh();
  }

  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("join_household", { p_code: String(new FormData(e.currentTarget).get("code")) });
    setBusy(false);
    if (error) return setError(error.message.includes("invalid invite") ? "Diesen Einladungscode gibt es nicht. Bitte prüfe ihn noch einmal." : error.message);
    router.replace("/hund");
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 px-4 py-10">
      <Logo />
      <div className="grid gap-2">
        <h1 className="font-display text-4xl leading-none">Hallo{name ? ` ${name}` : ""}!</h1>
        <p className="text-muted">Lege euren Haushalt an. Oder tritt mit dem Einladungscode bei, wenn schon jemand aus der Familie dabei ist.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Beitreten</h2>
        <form onSubmit={join} className="grid gap-3">
          <Field id="code" name="code" label="Einladungscode" defaultValue={code} required minLength={8} maxLength={8} autoCapitalize="characters" autoComplete="off" className="font-mono tracking-[0.3em] uppercase" />
          <Button disabled={busy}>Haushalt beitreten</Button>
        </form>
      </Card>
      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Neu anlegen</h2>
        <form onSubmit={create} className="grid gap-3">
          <Field id="household" name="household" label="Name des Haushalts" placeholder="Familie Muster" required maxLength={60} />
          <Button variant="ghost" disabled={busy}>Haushalt anlegen</Button>
        </form>
      </Card>
    </main>
  );
}
