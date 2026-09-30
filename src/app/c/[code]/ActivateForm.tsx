"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChipFields, chipToForm, emptyForm, formToInput, type ChipForm, type TaskOption } from "@/components/ChipFields";
import { Button, Card, ErrorText, Logo } from "@/components/ui";
import { TARGETS, type Chip } from "@/lib/chips";

export type BlockedChip = Pick<Chip, "id" | "household_id" | "title" | "target_type" | "target_id" | "target_value" | "visibility">;

/** „Chip aktivieren“: ein freier Chip bekommt Haushalt und Zweck. Danach ist er sofort einsatzbereit. */
export function ActivateForm({ code, households, tasks, blocked }: { code: string; households: { id: string; name: string }[]; tasks: TaskOption[]; blocked: BlockedChip[] }) {
  const router = useRouter();
  const [hid, setHid] = useState(households[0]?.id ?? "");
  const [form, setForm] = useState<ChipForm>(emptyForm());
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (households.length === 0)
    return (
      <Shell>
        <h1 className="font-display text-3xl leading-none">Chip aktivieren</h1>
        <p className="text-muted">Du bist noch in keinem Haushalt. Lege zuerst einen an oder tritt mit einem Einladungscode bei.</p>
        <Link href="/start" className="justify-self-start rounded-full bg-ink px-5 py-3 font-extrabold text-on-ink">Haushalt einrichten</Link>
      </Shell>
    );

  const myBlocked = blocked.filter((b) => b.household_id === hid);
  const myTasks = tasks.filter((t) => t.household_id === hid);

  function takeOver(id: string) {
    setFrom(id);
    const old = blocked.find((b) => b.id === id);
    if (old) setForm(chipToForm(old));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const old = blocked.find((b) => b.id === from);
    const res = await fetch(`/api/chips/${code}/activate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...formToInput(form), household_id: hid, move_file_from: old?.target_type === "file" && form.target_type === "file" ? old.id : undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Speichern hat nicht geklappt.");
    // Bei Dateien geht es weiter zum Hochladen; sonst ist der Chip fertig.
    router.replace(form.target_type === "file" && !old ? "/familie/chips" : `/c/${code}`);
    router.refresh();
  }

  return (
    <Shell>
      <div className="grid gap-2">
        <p className="eyebrow">Neuer Chip</p>
        <h1 className="font-display text-3xl leading-none">Chip aktivieren</h1>
        <p className="text-muted">Dieser Chip ist noch frei. Lege fest, was er tun soll. Du kannst das später jederzeit ändern – der Chip selbst bleibt, wie er ist.</p>
      </div>
      <Card>
        <form onSubmit={submit} className="grid gap-4">
          {households.length > 1 && (
            <label htmlFor="hh" className="grid gap-1.5">
              <span className="text-sm font-semibold text-muted">Haushalt</span>
              <select id="hh" value={hid} onChange={(e) => { setHid(e.target.value); setFrom(""); }} className="w-full rounded-2xl border-[1.5px] border-line bg-card px-4 py-3 text-base outline-none focus:border-ink">
                {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
          )}
          {myBlocked.length > 0 && (
            <label htmlFor="from" className="grid gap-1.5">
              <span className="text-sm font-semibold text-muted">Ersatz für einen gesperrten Chip?</span>
              <select id="from" value={from} onChange={(e) => takeOver(e.target.value)} className="w-full rounded-2xl border-[1.5px] border-line bg-card px-4 py-3 text-base outline-none focus:border-ink">
                <option value="">Nein, neu einrichten</option>
                {myBlocked.map((b) => <option key={b.id} value={b.id}>{b.target_type ? TARGETS[b.target_type].emoji : ""} {b.title}</option>)}
              </select>
              <span className="text-xs text-muted">Übernimmt Name, Zweck und Datei des alten Chips.</span>
            </label>
          )}
          <ChipFields id="act" form={form} onChange={setForm} tasks={myTasks} />
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy || !hid}>{busy ? "Einen Moment …" : "Chip aktivieren"}</Button>
        </form>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-5 px-4 py-10">
      <Logo />
      {children}
    </main>
  );
}
