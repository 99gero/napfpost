import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { count } = await sb.from("household_members").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  redirect(count ? "/hund" : "/start");
}
