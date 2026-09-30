// Zeitfenster-Logik: Welcher Zeitraum gilt gerade, und ist er schon erledigt?
//
// Regel: Die Fenster eines Tages teilen den ganzen Tag lückenlos auf. Die Grenze zwischen zwei
// Fenstern liegt in der Mitte der Lücke. Beispiel Morgens 07–10 und Abends 17–21:
// 00:00–13:30 zählt zu „Morgens“, 13:30–24:00 zu „Abends“. Wer um 06:40 oder 10:30 füttert,
// hat also die Morgenfütterung erledigt. Aufgaben ohne Zeitfenster gelten einmal pro Tag.
//
// Diese Datei ist die einzige Stelle, an der Zeiträume berechnet werden (Server und Anzeige).

export type Schedule = {
  id: string;
  label: string;
  start_time: string; // "07:00" oder "07:00:00"
  end_time: string;
  weekdays: number[]; // ISO, 1 = Montag
};

export type Completion = {
  id: string;
  task_id: string;
  schedule_id: string | null;
  period_key: string;
  completed_by: string | null;
  completed_at: string;
  source: "app" | "tag";
};

export type LocalParts = { dateKey: string; minutes: number; weekday: number };

export type SlotState = "done" | "due" | "overdue" | "upcoming";

export type Slot = {
  schedule: Schedule | null; // null = einmal täglich
  label: string;
  periodKey: string;
  startMin: number; // Fensterbeginn (bzw. 0 bei täglich)
  endMin: number; // Fensterende (bzw. 1440)
  segStart: number; // Beginn des zugeordneten Tagesabschnitts
  segEnd: number;
  isCurrent: boolean;
  state: SlotState;
  completion: Completion | null;
};

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localParts(date: Date, timeZone: string): LocalParts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(date)) p[type] = value;
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: WEEKDAYS[p.weekday],
  };
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Fenster, die am gegebenen Wochentag gelten, nach Beginn sortiert. */
export function schedulesForDay(schedules: Schedule[], weekday: number): Schedule[] {
  return schedules
    .filter((s) => s.weekdays.includes(weekday))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
}

/** Alle Zeiträume eines Tages mit ihrem Status. */
export function slotsForDay(
  schedules: Schedule[],
  completions: Completion[],
  now: Date,
  timeZone: string,
): Slot[] {
  const { dateKey, minutes, weekday } = localParts(now, timeZone);
  const day = schedulesForDay(schedules, weekday);
  const byKey = new Map(completions.map((c) => [c.period_key, c]));

  if (day.length === 0) {
    const completion = byKey.get(dateKey) ?? null;
    return [
      {
        schedule: null,
        label: "Heute",
        periodKey: dateKey,
        startMin: 0,
        endMin: 1440,
        segStart: 0,
        segEnd: 1440,
        isCurrent: true,
        state: completion ? "done" : "due",
        completion,
      },
    ];
  }

  return day.map((s, i) => {
    const startMin = toMinutes(s.start_time);
    const endMin = toMinutes(s.end_time);
    const segStart = i === 0 ? 0 : Math.floor((toMinutes(day[i - 1].end_time) + startMin) / 2);
    const segEnd = i === day.length - 1 ? 1440 : Math.floor((endMin + toMinutes(day[i + 1].start_time)) / 2);
    const periodKey = `${dateKey}#${s.id}`;
    const completion = byKey.get(periodKey) ?? null;
    const state: SlotState = completion
      ? "done"
      : minutes < startMin
        ? "upcoming"
        : minutes <= endMin
          ? "due"
          : "overdue";
    return {
      schedule: s,
      label: s.label,
      periodKey,
      startMin,
      endMin,
      segStart,
      segEnd,
      isCurrent: minutes >= segStart && minutes < segEnd,
      state,
      completion,
    };
  });
}

/** Der Zeitraum, dem eine Erledigung „jetzt“ zugeordnet wird. */
export function currentSlot(slots: Slot[]): Slot {
  return slots.find((s) => s.isCurrent) ?? slots[slots.length - 1];
}

/** Präfix, mit dem sich alle Erledigungen eines Tages abfragen lassen. */
export function dayKey(now: Date, timeZone: string): string {
  return localParts(now, timeZone).dateKey;
}
