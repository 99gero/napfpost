"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorText, Field, Logo } from "@/components/ui";
import { MIN_PASSWORD_LENGTH, PASSWORD_CHANGED_FLAG, hasRecoveryParams, validateNewPassword } from "@/lib/password";
import { supabaseBrowser } from "@/lib/supabase/client";

type Phase = "pruefen" | "bereit" | "ungueltig";

export function PasswordResetForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("pruefen");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Vor dem ersten Zugriff auf den Client lesen: Er räumt Code/Hash beim Einlösen aus der Adresse.
    const fromLink = hasRecoveryParams(location.search, location.hash);
    let cancelled = false;
    if (!fromLink) {
      Promise.resolve().then(() => { if (!cancelled) setPhase("ungueltig"); });
      return () => { cancelled = true; };
    }
    // Der Browser-Client (PKCE) löst ?code= beim Start selbst ein und kann auch Tokens im Hash lesen.
    // getSession() wartet auf diese Initialisierung; ohne Sitzung war der Link ungültig oder abgelaufen.
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (!cancelled) setPhase(data.session ? "bereit" : "ungueltig");
    });
    return () => { cancelled = true; };
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const problem = validateNewPassword(String(f.get("password")), String(f.get("repeat")));
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    const { error: err } = await supabaseBrowser().auth.updateUser({ password: String(f.get("password")) });
    setBusy(false);
    if (err) {
      if (/same password|different from the old/i.test(err.message)) return setError("Bitte wähle ein Passwort, das du bisher noch nicht benutzt hast.");
      if (/session/i.test(err.message)) return setPhase("ungueltig");
      return setError("Das Passwort konnte nicht gespeichert werden. Bitte versuche es noch einmal.");
    }
    try { sessionStorage.setItem(PASSWORD_CHANGED_FLAG, "1"); } catch { /* ohne Meldung weiter */ }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 px-4 py-10">
      <Logo />
      <div className="grid gap-2">
        <h1 className="font-display text-4xl leading-none">
          Neues <span className="text-kibble">Passwort</span>
        </h1>
      </div>
      <Card className="grid gap-4">
        {phase === "pruefen" && <p className="text-muted">Link wird geprüft …</p>}
        {phase === "ungueltig" && (
          <>
            <p role="alert" className="rounded-2xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-warn">
              Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.
            </p>
            <Link href="/passwort-vergessen" className="text-center font-extrabold underline">Neuen Link anfordern</Link>
          </>
        )}
        {phase === "bereit" && (
          <form onSubmit={submit} className="grid gap-3">
            <Field id="password" name="password" label="Neues Passwort" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
            <Field id="repeat" name="repeat" label="Neues Passwort wiederholen" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy} className="mt-1">{busy ? "Einen Moment …" : "Passwort speichern"}</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
