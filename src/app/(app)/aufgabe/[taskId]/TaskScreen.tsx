"use client";
import Link from "next/link";
import { useHousehold } from "@/components/HouseholdProvider";
import { SlotPill } from "@/components/SlotPill";
import { TaskHero } from "@/components/TaskHero";
import { ErrorText } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { useTasks } from "@/hooks/useTasks";
import { slotsForDay } from "@/lib/schedule";

/** Ziel von NFC-Tag und QR-Code: eine einzelne Aufgabe, erst Status, dann ggf. Knopf. */
export function TaskScreen({ taskId, viaTag }: { taskId: string; viaTag: boolean }) {
  const { household, dogs, nameOf } = useHousehold();
  const now = useNow();
  const { tasks, completions, error, reload } = useTasks(household.id, { taskId });
  const task = tasks?.[0];
  const dog = task?.dog_id ? dogs.find((d) => d.id === task.dog_id) : undefined;
  const subject = dog?.name ?? task?.title ?? "";

  if (tasks && !task) return <ErrorText>Diese Aufgabe gibt es nicht mehr oder sie ist ausgeschaltet.</ErrorText>;

  return (
    <main className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link href={dog ? `/hund/${dog.id}` : "/hund"} className="text-sm font-semibold text-muted">← {dog ? dog.name : "Zurück"}</Link>
        {viaTag && <span className="rounded-full border border-line bg-card px-2.5 py-1.5 font-mono text-[0.72rem] font-semibold text-muted">Chip erkannt</span>}
      </header>
      {task && (
        <h1 className="font-display text-2xl leading-none">
          {dog?.emoji ?? task.emoji} {dog ? `${dog.name} – ${task.title}` : task.title}
        </h1>
      )}
      <ErrorText>{error}</ErrorText>
      {!task && !error && <div className="h-96 animate-pulse rounded-[26px] bg-card/70" aria-label="Lädt" />}
      {task && (
        <>
          <TaskHero task={task} subject={subject} slots={slotsForDay(task.task_schedules, completions, now, household.timezone)} source={viaTag ? "tag" : "app"} now={now} onChanged={reload} large />
          {task.task_schedules.length > 1 && (
            <section className="grid gap-2">
              <p className="eyebrow">Heute</p>
              <div className="grid grid-cols-2 gap-2">
                {slotsForDay(task.task_schedules, completions, now, household.timezone).map((s) => (
                  <SlotPill key={s.periodKey} slot={s} tz={household.timezone} nameOf={nameOf} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
