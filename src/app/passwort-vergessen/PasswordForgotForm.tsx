"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Logo } from "@/components/ui";
import { isRateLimitError } from "@/lib/password";
import { supabaseBrowser } from "@/lib/supabase/client";

export function PasswordForgotForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    setError("");
    const { error: err } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/passwort-neu`,
    });
    setBusy(false);
    if (err && isRateLimitError(err)) {
      return setError("Es wurden gerade zu viele E-Mails verschickt. Bitte versuche es in einer Stunde noch einmal.");
    }
    if (err && (err.status === undefined || err.status >= 500 || err.name === "AuthRetryableFetchError")) {
      return setError("Das hat gerade nicht geklappt. Bitte versuche es gleich noch einmal.");
    }
    // Immer dieselbe Bestätigung, damit nicht erkennbar ist, ob die Adresse registriert ist
    setDone(true);
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 px-4 py-10">
      <Logo />
      <div className="grid gap-2">
        <h1 className="font-display text-4xl leading-none">
          Passwort <span className="text-kibble">vergessen?</span>
        </h1>
        <p className="text-muted">Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.</p>
      </div>
      <Card className="grid gap-4">
        {done ? (
          <p className="rounded-2xl bg-ok/10 px-4 py-3 text-ok">
            Wenn es ein Konto mit dieser Adresse gibt, haben wir eine E-Mail geschickt.
          </p>
        ) : (
          <form onSubmit={submit} className="grid gap-3">
            <Field id="email" name="email" label="E-Mail" type="email" required autoComplete="email" />
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy} className="mt-1">{busy ? "Einen Moment …" : "Link schicken"}</Button>
          </form>
        )}
        <Link href="/login" className="text-center text-sm font-semibold text-muted underline">Zurück zur Anmeldung</Link>
      </Card>
    </main>
  );
}
