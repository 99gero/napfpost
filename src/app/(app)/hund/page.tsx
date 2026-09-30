import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function DogIndex() {
  const sb = await supabaseServer();
  const { data } = await sb.from("dogs").select("id").order("sort").order("created_at").limit(1).maybeSingle();
  redirect(data ? `/hund/${data.id}` : "/hund/neu");
}
