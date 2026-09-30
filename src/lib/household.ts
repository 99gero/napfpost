// Regeln des Familienbereichs (rein, ohne Datenbank). Die Datenbank erzwingt dieselben Regeln in den Funktionen
// rename_household, set_member_role, transfer_ownership, remove_member, leave_household und delete_household;
// hier stehen sie, damit die Oberfläche nur erlaubte Aktionen anbietet und verständliche Meldungen zeigt.
import { formatDay, formatTime } from "./texts";
import type { Member } from "./types";

export const DISPLAY_NAME_MAX = 40;
export const HOUSEHOLD_NAME_MAX = 60;

export type NameCheck = { ok: true; value: string } | { ok: false; error: string };

export function validateName(raw: string, max: number, what: string): NameCheck {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: `Bitte gib ${what} ein.` };
  if (value.length > max) return { ok: false, error: `${what[0].toUpperCase()}${what.slice(1)} darf höchstens ${max} Zeichen haben.` };
  return { ok: true, value };
}
export const validateDisplayName = (raw: string) => validateName(raw, DISPLAY_NAME_MAX, "deinen Namen");
export const validateHouseholdName = (raw: string) => validateName(raw, HOUSEHOLD_NAME_MAX, "einen Namen für den Haushalt");

export const ownerCount = (members: Pick<Member, "role">[]) => members.filter((m) => m.role === "owner").length;
export const isOwnerOf = (members: Pick<Member, "user_id" | "role">[], userId: string) =>
  members.some((m) => m.user_id === userId && m.role === "owner");

export type MemberAction = "make_owner" | "transfer" | "make_member" | "remove" | "give_up";

/** Was der angemeldete Nutzer bei einem Mitglied tun darf. Nur Besitzer verwalten. */
export function memberActions(members: Pick<Member, "user_id" | "role">[], meId: string, targetId: string): MemberAction[] {
  if (!isOwnerOf(members, meId)) return [];
  const target = members.find((m) => m.user_id === targetId);
  if (!target) return [];
  if (targetId === meId) return ownerCount(members) > 1 ? ["give_up"] : []; // der letzte Besitzer bleibt Besitzer
  return target.role === "owner" ? ["make_member", "remove"] : ["make_owner", "transfer", "remove"];
}

/** Warum der Nutzer den Haushalt (noch) nicht verlassen kann; null = er kann. */
export function leaveBlocker(members: Pick<Member, "user_id" | "role">[], meId: string): "last_owner" | "sole_member" | null {
  if (!isOwnerOf(members, meId) || ownerCount(members) > 1) return null;
  return members.some((m) => m.user_id !== meId) ? "last_owner" : "sole_member";
}

/** Löschen wird erst freigegeben, wenn der Haushaltsname genau eingetippt wurde. */
export const deleteConfirmed = (householdName: string, typed: string) => {
  const name = householdName.trim();
  return name !== "" && typed.trim() === name;
};

/** Datenbankfehler (Meldung der Funktionen) in verständliches Deutsch übersetzen. */
export function familyErrorText(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("last owner")) return "Du bist der letzte Besitzer. Übertrage die Besitzer-Rolle zuerst an jemanden.";
  if (m.includes("sole member")) return "Du bist allein im Haushalt. Lösche ihn stattdessen.";
  if (m.includes("use leave_household")) return "Dich selbst kannst du über „Haushalt verlassen“ entfernen.";
  if (m.includes("name mismatch")) return "Der eingetippte Name stimmt nicht mit dem Haushaltsnamen überein.";
  if (m.includes("forbidden") || m.includes("permission denied")) return "Das dürfen nur Besitzer des Haushalts.";
  if (m.includes("member not found")) return "Dieses Mitglied gibt es nicht mehr.";
  if (m.includes("invalid name")) return "Der Name ist ungültig.";
  if (m.includes("violates check constraint")) return "Der Name ist zu lang oder leer.";
  return "Das hat nicht geklappt. Bitte versuche es noch einmal.";
}

// ---------------------------------------------------------------------------
// Aktivität: „Zuletzt erledigt“
// ---------------------------------------------------------------------------

type One<T> = T | T[] | null;
export type ActivityRow = {
  id: string;
  completed_at: string;
  completed_by: string | null;
  tasks: One<{ title: string; emoji: string; dogs: One<{ name: string; emoji: string }> }>;
};

const first = <T,>(v: One<T> | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** „Bruno: Füttern“ bzw. nur der Aufgabentitel, mit dem passenden Emoji. */
export function activityLabel(row: ActivityRow): { emoji: string; text: string } {
  const task = first(row.tasks);
  if (!task) return { emoji: "✅", text: "Aufgabe (nicht mehr vorhanden)" };
  const pet = first(task.dogs);
  return pet ? { emoji: pet.emoji, text: `${pet.name}: ${task.title}` } : { emoji: task.emoji, text: task.title };
}

const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** „Heute 09:17“, „Gestern 18:02“, sonst „Mo., 28. Sep. · 08:10“ (in der Zeitzone des Haushalts). */
export function whenLabel(iso: string, tz: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = formatTime(d, tz);
  const key = dayKey(d, tz);
  if (key === dayKey(now, tz)) return `Heute ${time}`;
  if (key === dayKey(new Date(now.getTime() - 86_400_000), tz)) return `Gestern ${time}`;
  return `${formatDay(d, tz)} · ${time}`;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/** Wer bei einer Erledigung benachrichtigt wird: alle Mitglieder mit „Push an“, außer der Person selbst. */
export const pushRecipients = (rows: { user_id: string; notify: boolean | null }[], exceptUserId: string) =>
  rows.filter((r) => r.user_id !== exceptUserId && r.notify !== false).map((r) => r.user_id);
