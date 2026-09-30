import { NextResponse } from "next/server";
import { sendToUsers } from "@/lib/push";
import { supabaseServer } from "@/lib/supabase/server";

/** Testnachricht an die eigenen Geräte */
export async function POST() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await sendToUsers([user.id], {
    title: "✅ Benachrichtigungen sind an",
    body: "So erfährst du, wenn jemand aus der Familie etwas erledigt.",
    url: "/hund",
    tag: "test",
  });
  return NextResponse.json(r);
}
