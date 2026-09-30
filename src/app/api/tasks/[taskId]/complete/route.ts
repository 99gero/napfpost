import { NextResponse } from "next/server";
import { completeTask } from "@/lib/complete";
import { supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: Request, ctx: RouteContext<"/api/tasks/[taskId]/complete">) {
  const { taskId } = await ctx.params;
  if (!UUID.test(taskId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { source?: string };
  const source = body.source === "tag" ? "tag" : "app";

  const result = await completeTask(sb, user.id, taskId, source);
  if (result.status === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
}
