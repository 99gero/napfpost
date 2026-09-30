"use client";
import { doneSentence, formatDay, formatTime } from "@/lib/texts";
import type { Completion, Task } from "@/lib/types";
import { useHousehold } from "./HouseholdProvider";

/** Verlauf im Stil des Familienchats aus dem Entwurf */
export function History({ completions, tasks, subject }: { completions: Completion[]; tasks: Task[]; subject: string }) {
  const { household, nameOf, userId } = useHousehold();
  const tz = household.timezone;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const labelOf = (c: Completion) => taskById.get(c.task_id)?.task_schedules.find((s) => s.id === c.schedule_id)?.label;
  if (completions.length === 0)
    return <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">Noch keine Einträge. Die erste Erledigung erscheint hier.</p>;

  const shown = completions.filter((c) => taskById.has(c.task_id)).slice(0, 30);
  return (
    <div className="flex flex-col gap-2.5">
      {shown.map((c, i) => {
        const t = taskById.get(c.task_id)!;
        const day = formatDay(c.completed_at, tz);
        const showDay = i === 0 || day !== formatDay(shown[i - 1].completed_at, tz);
        const who = c.completed_by === userId ? "Du" : nameOf(c.completed_by);
        return (
          <div key={c.id} className="contents">
            {showDay && <span className="self-center pt-1 font-mono text-[0.7rem] font-semibold uppercase tracking-widest text-muted">{day}</span>}
            <div className="max-w-[88%] self-start rounded-[16px_16px_16px_4px] border border-kibble/35 bg-kibble/10 px-3 py-2.5 text-[0.95rem]">
              <b>{who}</b>: {doneSentence(subject, t)}.
              <small className="mt-0.5 block font-mono text-[0.7rem] text-muted">
                {formatTime(c.completed_at, tz)} Uhr{labelOf(c) ? ` · ${labelOf(c)}` : ""} · {t.emoji} {t.title}
                {c.source === "tag" ? " · per Chip" : ""}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
