import { NextResponse } from "next/server";
import { familyErrorText } from "@/lib/household";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Haushalt endgültig löschen. Die Rechteprüfung (nur Besitzer, Name stimmt) und das Löschen der Datenbankzeilen
 * macht die Funktion delete_household mit der Sitzung des Nutzers. Danach entfernt dieser Server-Weg die
 * Chip-Dateien (Bucket chip-files) mit dem Secret-Key, weil Storage-Objekte nicht per SQL löschbar sind und
 * der Nutzer nach dem Löschen kein Mitglied mehr ist.
 */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { household_id?: string; confirm_name?: string };
  const hid = body.household_id ?? "";
  if (!UUID.test(hid) || typeof body.confirm_name !== "string") return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const { data, error } = await sb.rpc("delete_household", { p_household: hid, p_confirm_name: body.confirm_name });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0001" ? 409 : error.code === "P0002" ? 404 : 400;
    return NextResponse.json({ error: familyErrorText(error.message) }, { status });
  }

  // Nur Pfade dieses Haushalts anfassen
  const paths = ((data as string[] | null) ?? []).filter((p) => p.startsWith(`${hid}/`));
  let removed = 0;
  const admin = supabaseAdmin();
  if (admin) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const res = await admin.storage.from("chip-files").remove(chunk);
      if (res.error) console.error("chip file cleanup failed", res.error.message);
      else removed += res.data?.length ?? chunk.length;
    }
  }
  return NextResponse.json({ deleted: true, files: paths.length, filesRemoved: removed, filesOrphaned: paths.length - removed });
}
