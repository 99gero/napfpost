// Erzeugung der Chip-Codes. Reine Funktionen ohne Schlüssel; wird vom Skript und von den Tests genutzt.
import { randomBytes } from "node:crypto";

export const CODE_LENGTH = 10;
// 64 URL-sichere Zeichen. 256 ist durch 64 teilbar, daher ist `byte & 63` ohne Verzerrung (kein Modulo-Bias).
export const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/** Ein Code: 10 Zeichen = 60 Bit aus dem kryptografischen Zufallsgenerator des Betriebssystems. */
export function generateCode(bytes = randomBytes) {
  const b = bytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[b[i] & 63];
  return code;
}

/** `count` verschiedene Codes. `exclude` sind schon vergebene Codes (optional). */
export function generateCodes(count, bytes = randomBytes, exclude = new Set()) {
  if (!Number.isInteger(count) || count < 1) throw new Error("Anzahl muss eine ganze Zahl ab 1 sein");
  const codes = new Set();
  while (codes.size < count) {
    const code = generateCode(bytes);
    if (!exclude.has(code)) codes.add(code);
  }
  return [...codes];
}

export const BATCH_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** CSV mit Kopfzeile code,url,batch. Codes enthalten nur URL-sichere Zeichen, Anführungszeichen sind unnötig. */
export function toCsv(codes, baseUrl, batch) {
  const base = baseUrl.replace(/\/+$/, "");
  return ["code,url,batch", ...codes.map((c) => `${c},${base}/c/${c},${batch}`)].join("\n") + "\n";
}

/** INSERT nur mit Codes, Status 'frei'. Zum manuellen Ausführen im Supabase SQL Editor. */
export function toSql(codes, batch) {
  if (!BATCH_RE.test(batch)) throw new Error("Ungültiger Batch-Name");
  const rows = codes.map((c) => `  ('${c}', '${batch}', 'frei')`).join(",\n");
  return `insert into public.chips (code, batch, status) values\n${rows}\non conflict (code) do nothing;\n`;
}
