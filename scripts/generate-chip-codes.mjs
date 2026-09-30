#!/usr/bin/env node
// Erzeugt Codes für vorprogrammierte NFC-Chips. Braucht keine Schlüssel und keine Datenbankverbindung.
//
//   node scripts/generate-chip-codes.mjs 100 --base-url https://app.meinedomain.de [--batch 2026-10-a]
//
// Ergebnis in chip-codes/ (per .gitignore ausgeschlossen, die Codes sind die Geheimnisse der Chips):
//   <batch>.csv  code,url,batch  – für die NFC-Schreib-Software (URL-Spalte auf den Chip schreiben)
//   <batch>.sql  INSERT (nur Codes, Status 'frei') – im Supabase SQL Editor ausführen
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BATCH_RE, generateCodes, toCsv, toSql } from "./chip-codes.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const count = Number(args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")));
const baseUrl = opt("--base-url") ?? process.env.NEXT_PUBLIC_APP_URL;
const batch = opt("--batch") ?? new Date().toISOString().slice(0, 10);

function fail(msg) {
  console.error(`Fehler: ${msg}\n\nAufruf: node scripts/generate-chip-codes.mjs <Anzahl> --base-url https://app.meinedomain.de [--batch NAME]`);
  process.exit(1);
}

if (!Number.isInteger(count) || count < 1 || count > 10000) fail("Anzahl muss eine ganze Zahl zwischen 1 und 10000 sein.");
if (!baseUrl || !/^https:\/\/[^\s/]+\/?$/.test(baseUrl)) fail("--base-url fehlt oder ist keine https-Adresse ohne Pfad (oder NEXT_PUBLIC_APP_URL setzen).");
if (!BATCH_RE.test(batch)) fail("--batch darf nur A-Z a-z 0-9 _ - enthalten (max. 40 Zeichen).");

const dir = "chip-codes";
mkdirSync(dir, { recursive: true });
const csvPath = join(dir, `${batch}.csv`);
const sqlPath = join(dir, `${batch}.sql`);
if (existsSync(csvPath) || existsSync(sqlPath)) fail(`${csvPath} oder ${sqlPath} gibt es schon. Bitte einen anderen --batch-Namen wählen.`);

const codes = generateCodes(count);
writeFileSync(csvPath, toCsv(codes, baseUrl, batch), { flag: "wx", mode: 0o600 });
writeFileSync(sqlPath, toSql(codes, batch), { flag: "wx", mode: 0o600 });

console.log(`${count} Codes erzeugt (Batch ${batch}).`);
console.log(`  CSV: ${csvPath}`);
console.log(`  SQL: ${sqlPath}  → im Supabase SQL Editor ausführen`);
console.log("Beide Dateien sind per .gitignore ausgeschlossen. Nicht weitergeben, nicht einchecken.");
