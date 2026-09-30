"use client";
import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push-client";
import { Button } from "./ui";

const hints: Record<Exclude<PushState, "on" | "off">, string> = {
  unsupported: "Dieser Browser kann keine Benachrichtigungen empfangen. Auf Android klappt es mit Chrome, auf dem iPhone mit der installierten Web-App.",
  "needs-install": "Auf dem iPhone kommen Benachrichtigungen nur in der installierten App an: Teilen-Symbol antippen → „Zum Home-Bildschirm“ → Napfpost dort öffnen.",
  denied: "Benachrichtigungen sind für Napfpost blockiert. Du kannst sie in den Einstellungen des Browsers bzw. des iPhones wieder erlauben.",
};

/** compact = Hinweis-Banner im Haustier-Bereich (nur wenn Push noch aus ist) */
export function PushSetup({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  async function run(fn: () => Promise<PushState>) {
    setBusy(true);
    setMsg("");
    try { setState(await fn()); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    const r = await fetch("/api/push/test", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    setMsg(r?.sent ? "Testnachricht verschickt." : r?.reason === "push-not-configured" ? "Push ist auf dem Server noch nicht eingerichtet." : "Es ist kein Gerät angemeldet.");
  }

  if (state === null) return null;
  if (compact && (state === "on" || state === "unsupported")) return null;

  if (compact)
    return (
      <div className="grid gap-3 rounded-[22px] border border-kibble/40 bg-kibble/10 p-4">
        <p className="text-[0.95rem]"><b>Nichts verpassen:</b> Erhalte eine Nachricht, sobald jemand aus der Familie das Haustier versorgt.</p>
        {state === "off" ? (
          <Button onClick={() => run(enablePush)} disabled={busy} className="justify-self-start">Benachrichtigungen aktivieren</Button>
        ) : (
          <p className="text-sm text-muted">{hints[state as keyof typeof hints]}</p>
        )}
        {msg && <p className="text-sm text-warn">{msg}</p>}
      </div>
    );

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <span className={`size-3 shrink-0 rounded-full ${state === "on" ? "bg-ok" : "bg-warn"}`} />
        <b>{state === "on" ? "Auf diesem Gerät aktiv" : "Auf diesem Gerät aus"}</b>
      </div>
      {state !== "on" && state !== "off" && <p className="text-sm text-muted">{hints[state]}</p>}
      <div className="flex flex-wrap gap-2">
        {state === "off" && <Button onClick={() => run(enablePush)} disabled={busy}>Aktivieren</Button>}
        {state === "on" && (
          <>
            <Button onClick={test} disabled={busy}>Test senden</Button>
            <Button variant="ghost" onClick={() => run(disablePush)} disabled={busy}>Ausschalten</Button>
          </>
        )}
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
