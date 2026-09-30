"use client";
import { useState } from "react";
import { requestComplete, type CompleteResponse } from "@/lib/complete-client";
import { currentSlot, formatMinutes, type Slot } from "@/lib/schedule";
import { supabaseBrowser } from "@/lib/supabase/client";
import { actionLabel, alreadySentence, byWhomSentence, formatTime, notYetSentence } from "@/lib/texts";
import type { Task } from "@/lib/types";
import { CoinButton } from "./CoinButton";
import { useHousehold } from "./HouseholdProvider";
import { ErrorText } from "./ui";

const UNDO_MS = 15 * 60_000;

/**
 * Das Herzstück: Zuerst prüfen, ob der aktuelle Zeitraum schon erledigt ist.
 * Ja → „Bruno wurde bereits gefüttert. Jolina · 08:42 Uhr. Du musst nichts mehr tun.“
 * Nein → Knopf „Jetzt als gefüttert markieren“.
 */
export function TaskHero({
  task, subject, slots, source, now, onChanged, large,
}: {
  task: Task; subject: string; slots: Slot[]; source: "app" | "tag"; now: Date; onChanged: () => void; large?: boolean;
}) {
  const { household, userId, myName, nameOf } = useHousehold();
  const tz = household.timezone;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CompleteResponse | null>(null);

  const slot = currentSlot(slots);
  const completion = slot.completion ?? (result && result.completion.period_key === slot.periodKey ? result.completion : null);
  const range = slot.schedule ? `${slot.label} · ${formatMinutes(slot.startMin)}–${formatMinutes(slot.endMin)} Uhr` : "Einmal am Tag";

  async function complete() {
    setBusy(true);
    setError("");
    try {
      const r = await requestComplete(task.id, source);
      setResult(r);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    setBusy(true);
    const { error } = await supabaseBrowser().from("task_completions").delete().eq("id", id);
    setBusy(false);
    if (error) return setError("Rückgängig machen geht nur in den ersten 15 Minuten.");
    setResult(null);
    onChanged();
  }

  const titleCls = large ? "text-[2.1rem]" : "text-[1.7rem]";

  if (completion) {
    const mine = completion.completed_by === userId;
    const justNow = mine && result?.status === "created" && result.completion.id === completion.id;
    const time = formatTime(completion.completed_at, tz);
    const canUndo = mine && now.getTime() - new Date(completion.completed_at).getTime() < UNDO_MS;
    return (
      <section className="pop grid gap-4 rounded-[26px] border border-ok/40 bg-card p-6 shadow-[0_20px_50px_-28px_var(--shadow)]" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ok text-2xl text-on-ink" aria-hidden>✓</span>
          <p className="eyebrow !text-ok">{range}</p>
        </div>
        {justNow ? (
          <>
            <h2 className={`font-display leading-[1.05] ${titleCls}`}>{byWhomSentence(subject, task, myName, time)}</h2>
            <p className="text-muted">
              {result?.notified ? `Die Familie wurde benachrichtigt (${result.notified} ${result.notified === 1 ? "Gerät" : "Geräte"}).` : "Die Familie sieht es in der App."}
            </p>
          </>
        ) : (
          <>
            <h2 className={`font-display leading-[1.05] ${titleCls}`}>{alreadySentence(subject, task)}</h2>
            <p className="flex items-baseline gap-3">
              <span className="text-xl font-extrabold">{mine ? "Von dir" : nameOf(completion.completed_by)}</span>
              <span className="font-mono text-xl tabular-nums">{time} Uhr</span>
            </p>
            <p className="rounded-2xl bg-ok/10 px-4 py-3 font-bold text-ok">Du musst nichts mehr tun.</p>
          </>
        )}
        {canUndo && (
          <button type="button" onClick={() => undo(completion.id)} disabled={busy} className="justify-self-start text-sm font-semibold text-muted underline underline-offset-4">
            Versehentlich? Rückgängig machen
          </button>
        )}
        <ErrorText>{error}</ErrorText>
      </section>
    );
  }

  const otherDoneToday = slots.some((s) => s.completion);
  const overdue = slot.state === "overdue";
  return (
    <section className={`grid justify-items-center gap-5 rounded-[26px] border bg-card p-6 text-center shadow-[0_20px_50px_-28px_var(--shadow)] ${overdue ? "border-warn/50" : "border-line"}`}>
      <p className={`eyebrow ${overdue ? "!text-warn" : ""}`}>{overdue ? `⚠️ Noch nicht erledigt · ${range}` : range}</p>
      <h2 className={`font-display leading-[1.05] ${titleCls}`}>{notYetSentence(subject, task, !otherDoneToday)}</h2>
      <CoinButton label={actionLabel(task)} busy={busy} onPress={complete} />
      <ErrorText>{error}</ErrorText>
    </section>
  );
}
