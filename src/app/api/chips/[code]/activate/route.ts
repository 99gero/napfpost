import { NextResponse } from "next/server";
import { isValidCode, toChipConfig, type Chip, type ChipInput } from "@/lib/chips";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Body = Partial<ChipInput> & { household_id?: string; move_file_from?: string };

// Aktiviert einen freien Chip für einen Haushalt. Freie Chips sind per RLS nicht lesbar,
// deshalb schreibt nur dieser Server-Weg (Secret-Key) – nach Prüfung von Anmeldung und Mitgliedschaft.
export async function POST(req: Request, ctx: RouteContext<"/api/chips/[code]/activate">) {
  const { code } = await ctx.params;
  const unavailable = NextResponse.json({ error: "Dieser Chip kann nicht aktiviert werden." }, { status: 404 });
  if (!isValidCode(code)) return unavailable;

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const hid = body.household_id ?? "";
  if (!UUID.test(hid)) return NextResponse.json({ error: "Bitte einen Haushalt wählen." }, { status: 400 });

  // Mitgliedschaft mit der Sitzung des Nutzers prüfen (RLS)
  const { data: member } = await sb.from("household_members").select("user_id").eq("household_id", hid).eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Bitte einen Haushalt wählen." }, { status: 403 });

  const parsed = toChipConfig({ ...body, title: body.title ?? "", target_type: body.target_type as ChipInput["target_type"], visibility: body.visibility as ChipInput["visibility"] });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { config } = parsed;

  if (config.target_type === "task") {
    const { data: task } = await sb.from("tasks").select("id").eq("id", config.target_id ?? "").eq("household_id", hid).maybeSingle();
    if (!task) return NextResponse.json({ error: "Diese Aufgabe gibt es nicht." }, { status: 400 });
  }

  // Datei eines gesperrten Chips desselben Haushalts übernehmen
  let moveFrom: string | null = null;
  if (body.move_file_from) {
    if (!UUID.test(body.move_file_from) || config.target_type !== "file") return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    const { data: old } = await sb.from("chips").select("id").eq("id", body.move_file_from).eq("household_id", hid).eq("status", "gesperrt").maybeSingle();
    if (!old) return NextResponse.json({ error: "Der alte Chip wurde nicht gefunden." }, { status: 400 });
    moveFrom = old.id;
  }

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Der Server ist nicht vollständig eingerichtet." }, { status: 503 });

  // Nur ein noch freier Chip wird aktiviert; bei gleichzeitigem Zugriff gewinnt genau einer
  const { data: chip, error } = await admin
    .from("chips")
    .update({ ...config, status: "aktiv", household_id: hid, activated_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "frei")
    .select("id")
    .maybeSingle<Pick<Chip, "id">>();
  if (error) {
    console.error("chip activation failed", error.code);
    return NextResponse.json({ error: "Speichern hat nicht geklappt." }, { status: 400 });
  }
  if (!chip) return unavailable;

  if (moveFrom) {
    const { error: moveError } = await admin.from("chip_files").update({ chip_id: chip.id }).eq("chip_id", moveFrom).eq("household_id", hid);
    if (moveError) console.error("chip file move failed", moveError.code);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
