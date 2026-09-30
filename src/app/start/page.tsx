import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { StartForms } from "./StartForms";

export default async function StartPage(props: PageProps<"/start">) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/start");
  const { code } = await props.searchParams;
  const { data: me } = await sb.from("users").select("display_name").eq("id", user.id).maybeSingle();
  return <StartForms name={me?.display_name ?? ""} code={typeof code === "string" ? code : ""} />;
}
