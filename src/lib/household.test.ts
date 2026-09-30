import { describe, expect, it } from "vitest";
import {
  activityLabel, deleteConfirmed, familyErrorText, leaveBlocker, memberActions, ownerCount, pushRecipients,
  validateDisplayName, validateHouseholdName, whenLabel, type ActivityRow,
} from "./household";
import type { Member } from "./types";

const m = (user_id: string, role: Member["role"]): Member => ({ user_id, role, display_name: user_id, notify: true });
const solo = [m("a", "owner")];
const two = [m("a", "owner"), m("b", "member")];
const twoOwners = [m("a", "owner"), m("b", "owner"), m("c", "member")];

describe("Namen", () => {
  it("trimmt, faltet Leerraum und lehnt leere Namen ab", () => {
    expect(validateDisplayName("  Gero   D. ")).toEqual({ ok: true, value: "Gero D." });
    expect(validateDisplayName("   ").ok).toBe(false);
  });
  it("Längengrenzen wie in der Datenbank (40 bzw. 60)", () => {
    expect(validateDisplayName("x".repeat(40)).ok).toBe(true);
    expect(validateDisplayName("x".repeat(41)).ok).toBe(false);
    expect(validateHouseholdName("x".repeat(60)).ok).toBe(true);
    expect(validateHouseholdName("x".repeat(61)).ok).toBe(false);
  });
});

describe("Mitglieder verwalten", () => {
  it("Nur Besitzer haben Aktionen", () => {
    expect(memberActions(two, "b", "a")).toEqual([]);
    expect(memberActions(two, "b", "b")).toEqual([]);
  });
  it("Besitzer kann Mitglieder zum Besitzer machen, Besitz übertragen und entfernen", () => {
    expect(memberActions(two, "a", "b")).toEqual(["make_owner", "transfer", "remove"]);
  });
  it("Besitzer kann andere Besitzer herabstufen oder entfernen", () => {
    expect(memberActions(twoOwners, "a", "b")).toEqual(["make_member", "remove"]);
  });
  it("Der letzte Besitzer kann sich weder herabstufen noch entfernen", () => {
    expect(memberActions(two, "a", "a")).toEqual([]);
    expect(memberActions(solo, "a", "a")).toEqual([]);
  });
  it("Bei mehreren Besitzern kann man die eigene Rolle abgeben", () => {
    expect(memberActions(twoOwners, "a", "a")).toEqual(["give_up"]);
  });
  it("Unbekannte Ziele ergeben nichts", () => {
    expect(memberActions(two, "a", "zz")).toEqual([]);
    expect(ownerCount(twoOwners)).toBe(2);
  });
});

describe("Haushalt verlassen", () => {
  it("Mitglieder und Besitzer bei mehreren Besitzern dürfen gehen", () => {
    expect(leaveBlocker(two, "b")).toBeNull();
    expect(leaveBlocker(twoOwners, "a")).toBeNull();
  });
  it("Der letzte Besitzer muss zuerst übertragen …", () => {
    expect(leaveBlocker(two, "a")).toBe("last_owner");
  });
  it("… oder, wenn er allein ist, den Haushalt löschen", () => {
    expect(leaveBlocker(solo, "a")).toBe("sole_member");
  });
});

describe("Haushalt löschen", () => {
  it("verlangt den exakt eingetippten Namen", () => {
    expect(deleteConfirmed("Familie Muster", "Familie Muster")).toBe(true);
    expect(deleteConfirmed("Familie Muster", "  Familie Muster ")).toBe(true);
    expect(deleteConfirmed("Familie Muster", "familie muster")).toBe(false);
    expect(deleteConfirmed("Familie Muster", "")).toBe(false);
    expect(deleteConfirmed("", "")).toBe(false);
  });
});

describe("Fehlertexte", () => {
  it("übersetzt die Meldungen der Datenbankfunktionen", () => {
    expect(familyErrorText("last owner")).toMatch(/letzte Besitzer/);
    expect(familyErrorText("sole member")).toMatch(/allein/);
    expect(familyErrorText("forbidden")).toMatch(/Besitzer/);
    expect(familyErrorText("name mismatch")).toMatch(/Name/);
    expect(familyErrorText("irgendwas")).toMatch(/nicht geklappt/);
    expect(familyErrorText(undefined)).toMatch(/nicht geklappt/);
  });
});

describe("Push-Empfänger", () => {
  it("nicht die erledigende Person und nicht, wer Push ausgeschaltet hat", () => {
    const rows = [
      { user_id: "a", notify: true },
      { user_id: "b", notify: true },
      { user_id: "c", notify: false },
      { user_id: "d", notify: null },
    ];
    expect(pushRecipients(rows, "a")).toEqual(["b", "d"]);
    expect(pushRecipients([], "a")).toEqual([]);
  });
});

describe("Aktivität", () => {
  const base = { id: "1", completed_at: "2026-09-30T07:17:00Z", completed_by: "a" };
  it("Haustier und Aufgabe, mit dem Emoji des Haustiers", () => {
    const row: ActivityRow = { ...base, tasks: { title: "Füttern", emoji: "🍖", dogs: { name: "Minka", emoji: "🐱" } } };
    expect(activityLabel(row)).toEqual({ emoji: "🐱", text: "Minka: Füttern" });
  });
  it("Eingebettete Beziehungen dürfen als Liste ankommen", () => {
    const row: ActivityRow = { ...base, tasks: [{ title: "Füttern", emoji: "🍖", dogs: [{ name: "Bruno", emoji: "🐶" }] }] };
    expect(activityLabel(row).text).toBe("Bruno: Füttern");
  });
  it("Aufgabe ohne Haustier und gelöschte Aufgabe", () => {
    expect(activityLabel({ ...base, tasks: { title: "Müll", emoji: "🗑️", dogs: null } })).toEqual({ emoji: "🗑️", text: "Müll" });
    expect(activityLabel({ ...base, tasks: null }).text).toMatch(/nicht mehr vorhanden/);
  });
  it("Zeitangabe in der Zeitzone des Haushalts", () => {
    const now = new Date("2026-09-30T12:00:00Z"); // 14:00 in Berlin (MESZ)
    expect(whenLabel("2026-09-30T07:17:00Z", "Europe/Berlin", now)).toBe("Heute 09:17");
    expect(whenLabel("2026-09-29T16:02:00Z", "Europe/Berlin", now)).toBe("Gestern 18:02");
    expect(whenLabel("2026-09-27T06:10:00Z", "Europe/Berlin", now)).toMatch(/· 08:10$/);
    // 22:30 UTC ist in Berlin schon der nächste Tag
    expect(whenLabel("2026-09-29T22:30:00Z", "Europe/Berlin", now)).toBe("Heute 00:30");
  });
});
