import { describe, expect, it } from "vitest";
import { currentSlot, localParts, slotsForDay, type Completion, type Schedule } from "./schedule";

const TZ = "Europe/Berlin";
const all = [1, 2, 3, 4, 5, 6, 7];
const morning: Schedule = { id: "11111111-1111-1111-1111-111111111111", label: "Morgens", start_time: "07:00:00", end_time: "10:00:00", weekdays: all };
const evening: Schedule = { id: "22222222-2222-2222-2222-222222222222", label: "Abends", start_time: "17:00:00", end_time: "21:00:00", weekdays: all };

// 30.09.2026 ist ein Mittwoch; Berlin ist in der Sommerzeit UTC+2
const at = (hhmm: string) => new Date(`2026-09-30T${hhmm}:00+02:00`);

const done = (s: Schedule, time: string, by = "jolina"): Completion => ({
  id: "c1",
  task_id: "t",
  schedule_id: s.id,
  period_key: `2026-09-30#${s.id}`,
  completed_by: by,
  completed_at: at(time).toISOString(),
  source: "app",
});

describe("localParts", () => {
  it("rechnet in der Zeitzone des Haushalts", () => {
    expect(localParts(new Date("2026-09-30T22:30:00Z"), TZ)).toEqual({ dateKey: "2026-10-01", minutes: 30, weekday: 4 });
  });
  it("berücksichtigt die Winterzeit", () => {
    expect(localParts(new Date("2026-12-01T06:00:00Z"), TZ).minutes).toBe(7 * 60);
  });
});

describe("slotsForDay", () => {
  it("ordnet 06:40 und 10:30 der Morgenfütterung zu, 14:00 der Abendfütterung", () => {
    for (const t of ["06:40", "08:42", "10:30", "13:29"]) {
      expect(currentSlot(slotsForDay([morning, evening], [], at(t), TZ)).label).toBe("Morgens");
    }
    for (const t of ["13:30", "14:00", "22:00", "23:59"]) {
      expect(currentSlot(slotsForDay([morning, evening], [], at(t), TZ)).label).toBe("Abends");
    }
  });

  it("zeigt den Status je Zeitfenster", () => {
    const s = slotsForDay([evening, morning], [], at("09:15"), TZ);
    expect(s.map((x) => [x.label, x.state])).toEqual([["Morgens", "due"], ["Abends", "upcoming"]]);
    const late = slotsForDay([morning, evening], [], at("11:00"), TZ);
    expect(late[0].state).toBe("overdue");
  });

  it("Testfall: Jolina füttert 08:42, Gero sieht um 09:15 „bereits gefüttert“", () => {
    const slot = currentSlot(slotsForDay([morning, evening], [done(morning, "08:42")], at("09:15"), TZ));
    expect(slot.state).toBe("done");
    expect(slot.completion?.completed_by).toBe("jolina");
    expect(slot.periodKey).toBe(`2026-09-30#${morning.id}`);
  });

  it("Morgens erledigt heißt nicht abends erledigt", () => {
    const slot = currentSlot(slotsForDay([morning, evening], [done(morning, "08:42")], at("18:00"), TZ));
    expect(slot.label).toBe("Abends");
    expect(slot.state).toBe("due");
  });

  it("Aufgaben ohne Zeitfenster gelten einmal pro Tag", () => {
    const slots = slotsForDay([], [], at("12:00"), TZ);
    expect(slots).toHaveLength(1);
    expect(slots[0].periodKey).toBe("2026-09-30");
  });

  it("beachtet Wochentage", () => {
    const weekend: Schedule = { ...morning, weekdays: [6, 7] };
    const slots = slotsForDay([weekend, evening], [], at("08:00"), TZ); // Mittwoch
    expect(slots.map((s) => s.label)).toEqual(["Abends"]);
    expect(currentSlot(slots).label).toBe("Abends");
  });
});
