// Satzbausteine für Status und Push. „Bruno wurde gefüttert“, „Bruno war Gassi“.
import type { Task } from "./types";

type T = Pick<Task, "done_aux" | "done_word" | "kind" | "emoji">;

export const doneSentence = (subject: string, t: T) => `${subject} ${t.done_aux} ${t.done_word}`;
export const alreadySentence = (subject: string, t: T) => `${subject} ${t.done_aux} bereits ${t.done_word}.`;
export const notYetSentence = (subject: string, t: T, today: boolean) =>
  `${subject} ${t.done_aux} ${today ? "heute " : ""}noch nicht ${t.done_word}.`;
export const byWhomSentence = (subject: string, t: T, who: string, time: string) =>
  `${subject} ${t.done_aux} von ${who} um ${time} Uhr ${t.done_word}.`;

/** Knopfbeschriftung: „Jetzt als gefüttert markieren“ – bei anderen Formulierungen neutral. */
export const actionLabel = (t: T) =>
  t.done_aux === "wurde" ? `Jetzt als ${t.done_word} markieren` : "Jetzt als erledigt markieren";

export function formatTime(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

export function formatDay(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(iso));
}

/** Emoji für die Push-Überschrift: das Emoji des Haustiers (🐶, 🐱 …), sonst das der Aufgabe. */
export const pushTitle = (subjectEmoji: string, subject: string, t: T) => `${subjectEmoji} ${doneSentence(subject, t)}`;
