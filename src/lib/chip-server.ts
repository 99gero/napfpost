import "server-only";
import { isValidCode, type Chip, type ChipFile } from "./chips";
import { supabaseAdmin } from "./supabase/server";

/**
 * Löst einen Code serverseitig mit dem Secret-Key auf (freie Chips sind per RLS nie lesbar).
 * Gibt null zurück bei ungültigem Format, unbekanntem Code oder fehlendem Schlüssel.
 */
export async function loadChipByCode(code: string): Promise<Chip | null> {
  if (!isValidCode(code)) return null;
  const admin = supabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.from("chips").select("*").eq("code", code).maybeSingle<Chip>();
  if (error) {
    console.error("chip lookup failed", error.code);
    return null;
  }
  return data;
}

export async function loadChipFile(chipId: string): Promise<ChipFile | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.from("chip_files").select("*").eq("chip_id", chipId).maybeSingle<ChipFile>();
  return data;
}

/** Kurzlebige Adresse zur privaten Datei. */
export async function signedFileUrl(path: string): Promise<string | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.storage.from("chip-files").createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}
