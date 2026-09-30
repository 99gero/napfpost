"use client";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { TaskToken } from "@/lib/types";
import { Button, ErrorText } from "./ui";

type NDEFWriter = { write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void> };
declare global { interface Window { NDEFReader?: new () => NDEFWriter } }

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || location.origin).replace(/\/$/, "");

/** NFC-Tag und QR-Code für eine Aufgabe: beide enthalten denselben Link /t/<token>. */
export function TagPanel({ taskId, householdId, label }: { taskId: string; householdId: string; label: string }) {
  const [token, setToken] = useState<TaskToken | null | undefined>(undefined);
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = token ? `${appUrl()}/t/${token.token}` : "";

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser().from("task_tokens").select("*").eq("task_id", taskId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) setError(error.message);
    setToken((data as TaskToken) ?? null);
  }, [taskId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen laden
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c2833", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  async function create(replace: boolean) {
    setBusy(true);
    setError("");
    const sb = supabaseBrowser();
    if (replace && token) await sb.from("task_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", token.id);
    const { error } = await sb.from("task_tokens").insert({ task_id: taskId, household_id: householdId });
    setBusy(false);
    if (error) return setError(error.message);
    setMsg(replace ? "Neuer Link erzeugt. Der alte Chip funktioniert nicht mehr – bitte neu beschreiben." : "");
    load();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setMsg("Link kopiert."); } catch { setMsg(url); }
  }

  async function writeNfc() {
    if (!window.NDEFReader) return;
    setMsg("Halte jetzt den Chip an die Rückseite des Handys …");
    try {
      await new window.NDEFReader().write({ records: [{ recordType: "url", data: url }] });
      setMsg("Chip beschrieben. Tippe ihn zum Testen einmal an.");
    } catch (e) {
      setMsg(`Schreiben hat nicht geklappt: ${(e as Error).message}`);
    }
  }

  if (token === undefined) return <p className="text-sm text-muted">Lädt …</p>;

  if (!token)
    return (
      <div className="grid gap-2">
        <p className="text-sm text-muted">Optional: Ein NFC-Chip oder QR-Code am Ort der Aufgabe öffnet direkt „{label}“.</p>
        <Button variant="ghost" onClick={() => create(false)} disabled={busy} className="justify-self-start">NFC/QR-Link erzeugen</Button>
        <ErrorText>{error}</ErrorText>
      </div>
    );

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[112px_1fr] items-start gap-4">
        {qr ? (
          <div className="aspect-square w-[112px] overflow-hidden rounded-xl border border-line bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR-Code für ${label}`} role="img" />
        ) : (
          <div className="aspect-square w-[112px] rounded-xl bg-tile" />
        )}
        <div className="grid min-w-0 gap-2">
          <p className="break-all rounded-xl border border-dashed border-line bg-tile px-3 py-2 font-mono text-[0.72rem]">{url}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm font-bold">Link kopieren</button>
            {typeof window !== "undefined" && window.NDEFReader && (
              <button type="button" onClick={writeNfc} className="rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-on-ink">Auf Chip schreiben</button>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">
        QR-Code ausdrucken oder den Link mit einer NFC-App (z. B. „NFC Tools“) als URL auf einen NTAG213-Chip schreiben. Auf Android-Chrome geht es direkt mit „Auf Chip schreiben“.
      </p>
      <button type="button" onClick={() => create(true)} disabled={busy} className="justify-self-start text-sm font-semibold text-warn underline underline-offset-4">
        Chip verloren? Neuen Link erzeugen
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
