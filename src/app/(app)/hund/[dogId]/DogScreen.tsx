"use client";
import Link from "next/link";
import { History } from "@/components/History";
import { useHousehold } from "@/components/HouseholdProvider";
import { PushSetup } from "@/components/PushSetup";
import { SlotPill } from "@/components/SlotPill";
import { TaskHero } from "@/components/TaskHero";
import { ErrorText } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { useTasks } from "@/hooks/useTasks";
import { currentSlot, slotsForDay } from "@/lib/schedule";
import { requestComplete } from "@/lib/complete-client";
import { useState } from "react";

export function DogScreen({ dogId }: { dogId: string }) {
  const { household, dogs, nameOf } = useHousehold();
  const dog = dogs.find((d) => d.id === dogId);
  const now = useNow();
  const { tasks, completions, error, reload } = useTasks(household.id, { dogId });
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const tz = household.timezone;

  if (!dog) return <ErrorText>Dieses Haustier gibt es in eurem Haushalt nicht.</ErrorText>;

  const primary = tasks?.find((t) => t.kind === "feed") ?? tasks?.[0];

  async function quickComplete(taskId: string) {
    setBusyTask(taskId);
    try { await requestComplete(taskId, "app"); await reload(); } finally { setBusyTask(null); }
  }

  return (
    <main className="grid gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Haustier auswählen">
          {dogs.map((d) => (
            <Link
              key={d.id}
              href={`/hund/${d.id}`}
              role="tab"
              aria-selected={d.id === dogId}
              className={`shrink-0 rounded-full border-[1.5px] px-4 py-2.5 font-semibold ${d.id === dogId ? "border-ink bg-ink text-on-ink" : "border-line bg-card"}`}
            >
              {d.emoji} {d.name}
            </Link>
          ))}
          <Link href="/hund/neu" aria-label="Haustier hinzufügen" className="shrink-0 rounded-full border-[1.5px] border-dashed border-line px-4 py-2.5 font-semibold text-muted">+</Link>
        </div>
        <Link href={`/hund/${dogId}/einstellungen`} aria-label="Einstellungen für dieses Haustier" className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-card text-lg">⚙︎</Link>
      </header>

      <ErrorText>{error}</ErrorText>
      {tasks === null && <div className="h-80 animate-pulse rounded-[26px] bg-card/70" aria-label="Lädt" />}

      {primary && (
        <TaskHero task={primary} subject={dog.name} slots={slotsForDay(primary.task_schedules, completions, now, tz)} source="app" now={now} onChanged={reload} />
      )}

      <PushSetup compact />

      {tasks && tasks.length > 0 && (
        <section className="grid gap-3">
          <p className="eyebrow">Heute bei {dog.name}</p>
          {tasks.map((t) => {
            const slots = slotsForDay(t.task_schedules, completions, now, tz);
            const cur = currentSlot(slots);
            const showButton = t.id !== primary?.id && !cur.completion;
            return (
              <div key={t.id} className="grid gap-2.5 rounded-[22px] border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/aufgabe/${t.id}`} className="min-w-0 font-bold">
                    <span aria-hidden>{t.emoji}</span> {t.title}
                  </Link>
                  {showButton && (
                    <button
                      type="button"
                      onClick={() => quickComplete(t.id)}
                      disabled={busyTask === t.id}
                      className="shrink-0 rounded-full border-[1.5px] border-ink px-3.5 py-1.5 text-sm font-bold disabled:opacity-50"
                    >
                      {busyTask === t.id ? "…" : "Erledigt"}
                    </button>
                  )}
                </div>
                <div className={`grid gap-2 ${slots.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {slots.map((s) => <SlotPill key={s.periodKey} slot={s} tz={tz} nameOf={nameOf} />)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tasks && (
        <section className="grid gap-3">
          <p className="eyebrow">Verlauf</p>
          <History completions={completions} tasks={tasks} subject={dog.name} />
        </section>
      )}
    </main>
  );
}
