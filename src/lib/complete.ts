import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSlot, slotsForDay, type Completion, type Schedule } from "./schedule";
import { formatTime, pushTitle } from "./texts";
import { notifyHousehold } from "./push";
import type { Task } from "./types";

type TaskRow = Omit<Task, "task_schedules"> & {
  task_schedules: Schedule[];
  households: { timezone: string } | null;
  dogs: { name: string; emoji: string } | null;
};

export type CompleteResult =
  | { status: "created" | "already"; completion: Completion & { by_name: string }; notified?: number }
  | { status: "not_found" };

/**
 * Die eine Erledigungslogik für App-Knopf, NFC und QR.
 * 1. Aufgabe laden (RLS: nur eigener Haushalt)  2. aktuellen Zeitraum bestimmen
 * 3. eintragen – ist der Zeitraum schon erledigt, greift der Unique-Index und die bestehende
 *    Erledigung wird zurückgegeben  4. nur bei neuer Erledigung: Push an die anderen.
 */
export async function completeTask(
  sb: SupabaseClient,
  userId: string,
  taskId: string,
  source: "app" | "tag",
  now = new Date(),
): Promise<CompleteResult> {
  const { data: task, error } = await sb
    .from("tasks")
    .select("*, task_schedules(id, label, start_time, end_time, weekdays), households(timezone), dogs(name, emoji)")
    .eq("id", taskId)
    .eq("active", true)
    .maybeSingle<TaskRow>();
  if (error) throw error;
  if (!task) return { status: "not_found" };

  const tz = task.households?.timezone ?? "Europe/Berlin";
  const slot = currentSlot(slotsForDay(task.task_schedules, [], now, tz));

  const inserted = await sb
    .from("task_completions")
    .insert({
      household_id: task.household_id,
      task_id: task.id,
      schedule_id: slot.schedule?.id ?? null,
      period_key: slot.periodKey,
      completed_by: userId,
      source,
    })
    .select()
    .single<Completion>();

  let completion: Completion;
  let created = true;
  if (inserted.error) {
    if (inserted.error.code !== "23505") throw inserted.error;
    created = false;
    const existing = await sb
      .from("task_completions")
      .select()
      .eq("task_id", task.id)
      .eq("period_key", slot.periodKey)
      .single<Completion>();
    if (existing.error) throw existing.error;
    completion = existing.data;
  } else {
    completion = inserted.data;
  }

  const { data: who } = await sb.from("users").select("display_name").eq("id", completion.completed_by ?? "").maybeSingle();
  const byName = who?.display_name ?? "Jemand";

  if (!created) return { status: "already", completion: { ...completion, by_name: byName } };

  const subject = task.dogs?.name ?? task.title;
  const emoji = task.dogs?.emoji ?? task.emoji;
  let notified = 0;
  try {
    const r = await notifyHousehold(task.household_id, userId, {
      title: pushTitle(emoji, subject, task),
      body: `${byName} · ${formatTime(completion.completed_at, tz)} Uhr`,
      url: task.dog_id ? `/hund/${task.dog_id}` : `/aufgabe/${task.id}`,
      tag: `c-${task.id.slice(0, 8)}-${slot.periodKey.slice(0, 10)}`,
    });
    notified = r.sent;
  } catch (err) {
    // Die Erledigung ist gespeichert; ein Push-Fehler darf sie nicht rückgängig machen
    console.error("notify failed", err);
  }
  return { status: "created", completion: { ...completion, by_name: byName }, notified };
}
