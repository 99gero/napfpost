"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Logo } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

const messages: Record<string, string> = {
  "Invalid login credentials": "E-Mail oder Passwort stimmen nicht.",
  "User already registered": "Für diese E-Mail gibt es schon ein Konto. Bitte melde dich an.",
  "Email not confirmed": "Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    setBusy(true);
    setError("");
    const sb = supabaseBrowser();
    const res =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: String(f.get("name")).trim() },
              emailRedirectTo: `${location.origin}${next}`,
            },
          });
    setBusy(false);
    if (res.error) return setError(messages[res.error.message] ?? res.error.message);
    if (!res.data.session) return setInfo("Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link im Postfach.");
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 px-4 py-10">
      <Logo />
      <div className="grid gap-2">
        <h1 className="font-display text-4xl leading-none">
          Schon <span className="text-kibble">gefüttert?</span>
        </h1>
        <p className="text-muted">Einer erledigt es, alle wissen Bescheid.</p>
      </div>
      <Card className="grid gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-tile p-1" role="tablist">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(""); setInfo(""); }}
              className={`rounded-full py-2 text-sm font-bold ${mode === m ? "bg-ink text-on-ink" : "text-muted"}`}
            >
              {m === "in" ? "Anmelden" : "Neues Konto"}
            </button>
          ))}
        </div>
        {info ? (
          <p className="rounded-2xl bg-ok/10 px-4 py-3 text-ok">{info}</p>
        ) : (
          <form onSubmit={submit} className="grid gap-3">
            {mode === "up" && <Field id="name" name="name" label="Dein Name (so sieht ihn die Familie)" required maxLength={40} autoComplete="given-name" />}
            <Field id="email" name="email" label="E-Mail" type="email" required autoComplete="email" />
            <Field id="password" name="password" label="Passwort" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} />
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy} className="mt-1">{busy ? "Einen Moment …" : mode === "in" ? "Anmelden" : "Konto anlegen"}</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
