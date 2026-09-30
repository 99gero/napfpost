// Chip-System: reine Logik ohne Datenbank- und Netzwerkzugriff (testbar).
// Erzeugung der Codes: scripts/chip-codes.mjs. Hier: Prüfung, Zugriffsentscheidung, Eingaben.

export type ChipStatus = "frei" | "aktiv" | "gesperrt";
export type TargetType = "task" | "note" | "file" | "link" | "contact";
export type Visibility = "members" | "public";

export type Chip = {
  id: string;
  code: string;
  batch: string | null;
  status: ChipStatus;
  household_id: string | null;
  target_type: TargetType | null;
  target_id: string | null;
  target_value: string | null;
  title: string | null;
  visibility: Visibility;
  created_at: string;
  activated_at: string | null;
  revoked_at: string | null;
};

export type ChipFile = { id: string; chip_id: string; household_id: string; path: string; filename: string; mime_type: string; size_bytes: number };

export const CODE_RE = /^[A-Za-z0-9_-]{10}$/;

export const TARGETS: Record<TargetType, { label: string; emoji: string; hint: string }> = {
  task: { label: "Aufgabe erledigen", emoji: "✅", hint: "Antippen öffnet die Aufgabe, z. B. „Füttern“." },
  note: { label: "Notiz anzeigen", emoji: "📝", hint: "Ein kurzer Text, z. B. WLAN-Passwort oder Futtermenge." },
  file: { label: "Datei anzeigen", emoji: "📄", hint: "PDF, Bild oder Text, z. B. Impfpass. Die Datei liegt in der App." },
  link: { label: "Link öffnen", emoji: "🔗", hint: "Öffnet eine Internetadresse." },
  contact: { label: "Notfallkarte", emoji: "🆘", hint: "Name und Telefonnummer, z. B. am Halsband. Für Finder gedacht." },
};
export const TARGET_TYPES = Object.keys(TARGETS) as TargetType[];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  members: "Nur Familie (Anmeldung nötig)",
  public: "Jeder mit dem Chip",
};

// Dateien: Größe und Typen. Muss zu Bucket und Tabelle chip_files in der Migration passen.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const HOUSEHOLD_QUOTA_BYTES = 25 * 1024 * 1024;
export const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "text/plain": "txt",
};

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function chipUrl(base: string, code: string): string {
  return `${base.replace(/\/+$/, "")}/c/${code}`;
}

// --- Zugriff -------------------------------------------------------------------------------------------

export type Viewer = { signedIn: boolean; memberOfChipHousehold: boolean };

/**
 * Was passiert bei /c/<code>?
 *  invalid  – neutrale Seite „Chip passt nicht“ (unbekannt, gesperrt, oder fremder Haushalt: verrät nichts)
 *  login    – zur Anmeldung, danach zurück zu /c/<code>
 *  activate – Seite „Chip aktivieren“ (freier Chip, angemeldet)
 *  show     – Ziel des aktiven Chips ausführen
 */
export type Access = "invalid" | "login" | "activate" | "show";

export function decideAccess(chip: Pick<Chip, "status" | "visibility"> | null, viewer: Viewer): Access {
  if (!chip) return "invalid";
  switch (chip.status) {
    case "frei":
      return viewer.signedIn ? "activate" : "login";
    case "aktiv":
      if (chip.visibility === "public") return "show";
      if (!viewer.signedIn) return "login";
      return viewer.memberOfChipHousehold ? "show" : "invalid";
    default:
      return "invalid";
  }
}

// --- Eingaben ------------------------------------------------------------------------------------------

export type Contact = { name: string; phone: string; phone2: string; note: string };

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Nur http(s)-Adressen. Gibt die normalisierte Adresse zurück oder null. */
export function parseHttpUrl(input: string): string | null {
  const s = input.trim();
  if (!s || s.length > 2000 || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function serializeContact(c: Partial<Contact>): string {
  return JSON.stringify({ name: clip(c.name, 80), phone: clip(c.phone, 40), phone2: clip(c.phone2, 40), note: clip(c.note, 500) });
}

export function parseContact(value: string | null): Contact | null {
  if (!value) return null;
  try {
    const o = JSON.parse(value) as Record<string, unknown>;
    const c = { name: clip(o.name, 80), phone: clip(o.phone, 40), phone2: clip(o.phone2, 40), note: clip(o.note, 500) };
    return c.name || c.phone || c.phone2 || c.note ? c : null;
  } catch {
    return null;
  }
}

/** Telefonnummer für tel:-Links: nur Ziffern, + und Trennzeichen. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{3,20}$/.test(digits) ? `tel:${digits}` : null;
}

export type ChipInput = {
  title: string;
  target_type: TargetType;
  visibility: Visibility;
  task_id?: string;
  note?: string;
  url?: string;
  contact?: Partial<Contact>;
};
export type ChipConfig = Pick<Chip, "title" | "target_type" | "visibility" | "target_id" | "target_value">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Prüft die Eingabe für Aktivieren und Ändern und macht daraus die Spalten der Tabelle chips. */
export function toChipConfig(input: ChipInput): { ok: true; config: ChipConfig } | { ok: false; error: string } {
  const title = (input.title ?? "").trim();
  if (title.length < 1 || title.length > 60) return { ok: false, error: "Bitte einen Namen mit 1 bis 60 Zeichen eingeben." };
  if (!TARGET_TYPES.includes(input.target_type)) return { ok: false, error: "Unbekannter Zweck." };
  if (input.visibility !== "members" && input.visibility !== "public") return { ok: false, error: "Unbekannte Sichtbarkeit." };
  const base = { title, target_type: input.target_type, visibility: input.visibility, target_id: null, target_value: null } as ChipConfig;

  switch (input.target_type) {
    case "task":
      if (!input.task_id || !UUID.test(input.task_id)) return { ok: false, error: "Bitte eine Aufgabe wählen." };
      if (input.visibility !== "members") return { ok: false, error: "Aufgaben kann nur erledigen, wer angemeldet ist." };
      return { ok: true, config: { ...base, target_id: input.task_id } };
    case "note": {
      const note = (input.note ?? "").trim();
      if (!note || note.length > 2000) return { ok: false, error: "Die Notiz braucht 1 bis 2000 Zeichen." };
      return { ok: true, config: { ...base, target_value: note } };
    }
    case "link": {
      const url = parseHttpUrl(input.url ?? "");
      if (!url) return { ok: false, error: "Bitte eine Adresse mit http:// oder https:// eingeben." };
      return { ok: true, config: { ...base, target_value: url } };
    }
    case "contact": {
      const value = serializeContact(input.contact ?? {});
      if (!parseContact(value)) return { ok: false, error: "Bitte mindestens einen Namen oder eine Telefonnummer eingeben." };
      return { ok: true, config: { ...base, target_value: value } };
    }
    case "file":
      return { ok: true, config: base };
  }
}

// --- Dateien -------------------------------------------------------------------------------------------

export function validateFile(file: { size: number; type: string }, usedBytes = 0, replacingBytes = 0): string | null {
  if (!(file.type in FILE_TYPES)) return "Erlaubt sind PDF, Bilder (JPG, PNG, WebP, GIF) und Textdateien.";
  if (file.size <= 0) return "Die Datei ist leer.";
  if (file.size > MAX_FILE_BYTES) return `Die Datei ist zu groß (höchstens ${MAX_FILE_BYTES / 1024 / 1024} MB).`;
  if (usedBytes - replacingBytes + file.size > HOUSEHOLD_QUOTA_BYTES) return `Der Speicher für Chip-Dateien ist voll (${HOUSEHOLD_QUOTA_BYTES / 1024 / 1024} MB pro Haushalt).`;
  return null;
}

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
