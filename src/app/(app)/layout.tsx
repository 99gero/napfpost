import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { HouseholdProvider } from "@/components/HouseholdProvider";
import { supabaseServer } from "@/lib/supabase/server";
import type { Dog, Household, Member } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await sb
    .from("household_members")
    .select("households(id, name, timezone, invite_code)")
    .eq("user_id", user.id)
    .order("joined_at")
    .limit(1)
    .maybeSingle<{ households: Household }>();
  if (!membership?.households) redirect("/start");
  const household = membership.households;

  const [{ data: memberRows }, { data: dogs }] = await Promise.all([
    sb.from("household_members").select("user_id, role, notify, users(display_name)").eq("household_id", household.id).order("joined_at"),
    sb.from("dogs").select("*").eq("household_id", household.id).order("sort").order("created_at"),
  ]);
  const members: Member[] = (memberRows ?? []).map((m: { user_id: string; role: "owner" | "member"; notify: boolean; users: { display_name: string } | { display_name: string }[] | null }) => ({
    user_id: m.user_id,
    role: m.role,
    notify: m.notify,
    display_name: (Array.isArray(m.users) ? m.users[0] : m.users)?.display_name ?? "Jemand",
  }));
  const myName = members.find((m) => m.user_id === user.id)?.display_name ?? "Ich";

  return (
    <HouseholdProvider value={{ userId: user.id, myEmail: user.email ?? "", myName, household, members, dogs: (dogs ?? []) as Dog[] }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        {children}
      </div>
      <BottomNav />
    </HouseholdProvider>
  );
}
