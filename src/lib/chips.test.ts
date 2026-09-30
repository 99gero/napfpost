import { describe, expect, it } from "vitest";
import { BATCH_RE, CODE_ALPHABET, CODE_LENGTH, generateCode, generateCodes, toCsv, toSql } from "../../scripts/chip-codes.mjs";
import {
  CODE_RE, HOUSEHOLD_QUOTA_BYTES, MAX_FILE_BYTES, chipUrl, decideAccess, isValidCode, parseContact, parseHttpUrl, telHref, toChipConfig, validateFile,
  type Chip, type Viewer,
} from "./chips";

describe("Code-Erzeugung", () => {
  it("hat 10 Zeichen aus dem URL-sicheren Zeichensatz", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateCode();
      expect(c).toHaveLength(CODE_LENGTH);
      expect(c).toMatch(/^[A-Za-z0-9_-]{10}$/);
      expect(isValidCode(c)).toBe(true);
      expect(encodeURIComponent(c)).toBe(c);
    }
  });
  it("Zeichensatz: 64 verschiedene Zeichen, passt zur Prüfung in der App", () => {
    expect(new Set(CODE_ALPHABET).size).toBe(64);
    expect(CODE_RE.source).toBe(`^[${"A-Za-z0-9_-"}]{${CODE_LENGTH}}$`);
  });
  it("nutzt alle 6 Bit jedes Zufallsbytes (byte & 63, ohne Verzerrung)", () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    const seen = new Set<string>();
    for (let off = 0; off < 256; off += CODE_LENGTH) {
      seen.add(generateCode((n) => Uint8Array.from({ length: n }, (_, i) => all[(off + i) % 256])));
    }
    expect(generateCode(() => new Uint8Array(10).fill(0))).toBe("A".repeat(10));
    expect(generateCode(() => new Uint8Array(10).fill(255))).toBe("-".repeat(10));
    expect(seen.size).toBeGreaterThan(20);
  });
  it("erzeugt eindeutige Codes", () => {
    const codes = generateCodes(5000);
    expect(codes).toHaveLength(5000);
    expect(new Set(codes).size).toBe(5000);
  });
  it("überspringt vorhandene Codes und wiederholt bei Kollision", () => {
    const seq = [new Uint8Array(10).fill(0), new Uint8Array(10).fill(0), new Uint8Array(10).fill(1)];
    let i = 0;
    const codes = generateCodes(2, () => seq[i++]);
    expect(codes).toEqual(["A".repeat(10), "B".repeat(10)]);
    expect(generateCodes(1, () => new Uint8Array(10).fill(0), new Set()).length).toBe(1);
  });
  it("lehnt ungültige Anzahl ab", () => {
    for (const n of [0, -1, 1.5, NaN]) expect(() => generateCodes(n)).toThrow();
  });
  it("CSV und SQL enthalten nur die Codes, Status 'frei'", () => {
    const codes = ["AAAAAAAAAA", "BBBBBBBBBB"];
    expect(toCsv(codes, "https://app.example.de/", "b1")).toBe(
      "code,url,batch\nAAAAAAAAAA,https://app.example.de/c/AAAAAAAAAA,b1\nBBBBBBBBBB,https://app.example.de/c/BBBBBBBBBB,b1\n",
    );
    const sql = toSql(codes, "b1");
    expect(sql).toContain("('AAAAAAAAAA', 'b1', 'frei')");
    expect(sql).toContain("on conflict (code) do nothing");
    expect(() => toSql(codes, "x'; drop table chips; --")).toThrow();
    expect(BATCH_RE.test("2026-10-a")).toBe(true);
  });
});

describe("Codeprüfung", () => {
  it("weist falsche Codes ab", () => {
    for (const bad of ["", "abc", "AAAAAAAAA", "AAAAAAAAAAA", "AAAAA AAAAA", "AAAAA/AAAA", "ÄÄÄÄÄÄÄÄÄÄ", "AAAAAAAAA%", "../../etc"]) expect(isValidCode(bad)).toBe(false);
  });
  it("baut den Link", () => {
    expect(chipUrl("https://a.de/", "AAAAAAAAAA")).toBe("https://a.de/c/AAAAAAAAAA");
  });
});

describe("Zugriff auf /c/<code>", () => {
  const chip = (status: Chip["status"], visibility: Chip["visibility"]) => ({ status, visibility });
  const anon: Viewer = { signedIn: false, memberOfChipHousehold: false };
  const stranger: Viewer = { signedIn: true, memberOfChipHousehold: false };
  const member: Viewer = { signedIn: true, memberOfChipHousehold: true };

  it("unbekannter Code → neutral, egal wer", () => {
    for (const v of [anon, stranger, member]) expect(decideAccess(null, v)).toBe("invalid");
  });

  it("frei: angemeldet → aktivieren, sonst Anmeldung", () => {
    for (const vis of ["members", "public"] as const) {
      expect(decideAccess(chip("frei", vis), anon)).toBe("login");
      expect(decideAccess(chip("frei", vis), stranger)).toBe("activate");
      expect(decideAccess(chip("frei", vis), member)).toBe("activate");
    }
  });

  it("aktiv + members: nur Mitglieder; nicht angemeldet → Anmeldung; Fremde → neutral", () => {
    expect(decideAccess(chip("aktiv", "members"), anon)).toBe("login");
    expect(decideAccess(chip("aktiv", "members"), stranger)).toBe("invalid");
    expect(decideAccess(chip("aktiv", "members"), member)).toBe("show");
  });

  it("aktiv + public: jeder", () => {
    for (const v of [anon, stranger, member]) expect(decideAccess(chip("aktiv", "public"), v)).toBe("show");
  });

  it("gesperrt → neutral, egal wer und egal welche Sichtbarkeit", () => {
    for (const vis of ["members", "public"] as const) for (const v of [anon, stranger, member]) expect(decideAccess(chip("gesperrt", vis), v)).toBe("invalid");
  });
});

describe("Eingaben", () => {
  const uuid = "11111111-1111-1111-1111-111111111111";
  it("Aufgabe braucht eine Aufgaben-ID und Sichtbarkeit 'members'", () => {
    expect(toChipConfig({ title: "Napf", target_type: "task", visibility: "members" }).ok).toBe(false);
    expect(toChipConfig({ title: "Napf", target_type: "task", visibility: "public", task_id: uuid }).ok).toBe(false);
    expect(toChipConfig({ title: "Napf", target_type: "task", visibility: "members", task_id: uuid })).toMatchObject({ ok: true, config: { target_id: uuid, target_value: null } });
  });
  it("Link nur http(s)", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://a.de", "a b", "", "example.de"]) expect(parseHttpUrl(bad)).toBeNull();
    expect(parseHttpUrl("https://example.de/x?y=1")).toBe("https://example.de/x?y=1");
    expect(toChipConfig({ title: "L", target_type: "link", visibility: "public", url: "javascript:alert(1)" }).ok).toBe(false);
  });
  it("Notiz und Titel werden begrenzt", () => {
    expect(toChipConfig({ title: "", target_type: "note", visibility: "members", note: "x" }).ok).toBe(false);
    expect(toChipConfig({ title: "x".repeat(61), target_type: "note", visibility: "members", note: "x" }).ok).toBe(false);
    expect(toChipConfig({ title: "N", target_type: "note", visibility: "members", note: "" }).ok).toBe(false);
    expect(toChipConfig({ title: "N", target_type: "note", visibility: "members", note: "x".repeat(2001) }).ok).toBe(false);
    expect(toChipConfig({ title: " N ", target_type: "note", visibility: "members", note: " hallo " })).toMatchObject({ ok: true, config: { title: "N", target_value: "hallo" } });
  });
  it("Kontakt wird als JSON gespeichert und wieder gelesen", () => {
    const r = toChipConfig({ title: "Bruno", target_type: "contact", visibility: "public", contact: { name: "Familie D", phone: "+49 170 1234567" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(parseContact(r.config.target_value)).toEqual({ name: "Familie D", phone: "+49 170 1234567", phone2: "", note: "" });
    expect(toChipConfig({ title: "B", target_type: "contact", visibility: "public", contact: {} }).ok).toBe(false);
    expect(parseContact("kein json")).toBeNull();
    expect(parseContact(null)).toBeNull();
  });
  it("tel:-Link nur bei plausibler Nummer", () => {
    expect(telHref("+49 (170) 123-4567")).toBe("tel:+491701234567");
    expect(telHref("abc")).toBeNull();
    expect(telHref("12")).toBeNull();
  });
  it("Datei hat keine weiteren Felder", () => {
    expect(toChipConfig({ title: "Impfpass", target_type: "file", visibility: "members" })).toMatchObject({ ok: true, config: { target_id: null, target_value: null } });
  });
});

describe("Datei-Upload", () => {
  it("erlaubt PDF, Bilder, Text", () => {
    for (const type of ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]) expect(validateFile({ size: 1000, type })).toBeNull();
  });
  it("lehnt andere Typen, leere und zu große Dateien ab", () => {
    expect(validateFile({ size: 1000, type: "text/html" })).not.toBeNull();
    expect(validateFile({ size: 1000, type: "image/svg+xml" })).not.toBeNull();
    expect(validateFile({ size: 0, type: "image/png" })).not.toBeNull();
    expect(validateFile({ size: MAX_FILE_BYTES, type: "image/png" })).toBeNull();
    expect(validateFile({ size: MAX_FILE_BYTES + 1, type: "image/png" })).not.toBeNull();
  });
  it("beachtet das Kontingent; beim Ersetzen zählt die alte Datei nicht", () => {
    const used = HOUSEHOLD_QUOTA_BYTES - 1000;
    expect(validateFile({ size: 1001, type: "image/png" }, used)).not.toBeNull();
    expect(validateFile({ size: 1000, type: "image/png" }, used)).toBeNull();
    expect(validateFile({ size: 3000, type: "image/png" }, used, 2000)).toBeNull();
  });
});
