"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Button, Card, Chip as Pill, ErrorText } from "@/components/ui";
import { familyErrorText, isOwnerOf, memberActions, type MemberAction } from "@/lib/household";
import { supabaseBrowser } from "@/lib/supabase/client";

const LABEL: Record<MemberAction, string> = {
  make_owner: "Zum Besitzer machen",
  transfer: "Besitz übertragen",
  make_member: "Zum Mitglied machen",
  remove: "Entfernen",
  give_up: "Meine Besitzer-Rolle abgeben",
};

const CONFIRM: Record<MemberAction, (name: string) => string> = {
  make_owner: (n) => `${n} wird zusätzlich Besitzer und kann dann Mitglieder verwalten und den Haushalt löschen.`,
  transfer: (n) => `${n} wird Besitzer, du wirst normales Mitglied und kannst danach keine Mitglieder mehr verwalten.`,
  make_member: (n) => `${n} ist danach kein Besitzer mehr.`,
  remove: (n) => `${n} wird aus dem Haushalt entfernt und bekommt keine Nachrichten mehr. Bisherige Erledigungen bleiben im Verlauf.`,
  give_up: () => "Du bist danach normales Mitglied und kannst keine Mitglieder mehr verwalten. Es bleibt mindestens ein Besitzer.",
};

export default function MembersPage() {
  const { household, members, userId } = useHousehold();
  const router = useRouter();
  const [pending, setPending] = useState<{ user: string; action: MemberAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const isOwner = isOwnerOf(members, userId);

  async function run(user: string, action: MemberAction) {
    setBusy(true);
    setError("");
    setDone("");
    const sb = supabaseBrowser();
    const p_household = household.id;
    const res =
      action === "remove" ? await sb.rpc("remove_member", { p_household, p_user: user })
      : action === "transfer" ? await sb.rpc("transfer_ownership", { p_household, p_user: user })
      : await sb.rpc("set_member_role", { p_household, p_user: user, p_role: action === "make_owner" ? "owner" : "member" });
    setBusy(false);
    setPending(null);
    if (res.error) return setError(familyErrorText(res.error.message));
    setDone("Gespeichert.");
    router.refresh();
  }

  return (
    <main className="grid gap-5">
      <div className="grid gap-1">
        <Link href="/familie" className="text-sm font-semibold text-muted underline underline-offset-4">← Familie</Link>
        <p className="eyebrow">{household.name}</p>
        <h1 className="font-display text-3xl leading-none">Mitglieder</h1>
      </div>

      {!isOwner && <p className="text-sm text-muted">Nur Besitzer können Mitglieder verwalten.</p>}
      <ErrorText>{error}</ErrorText>
      {done && <p className="text-sm text-ok">{done}</p>}

      {members.map((m) => {
        const actions = memberActions(members, userId, m.user_id);
        const active = pending?.user === m.user_id ? pending.action : null;
        return (
          <Card key={m.user_id} className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-biscuit font-extrabold">{m.display_name.slice(0, 1).toUpperCase()}</span>
              <div className="grid min-w-0 flex-1 gap-1">
                <h2 className="truncate font-display text-lg">{m.display_name}{m.user_id === userId ? " (du)" : ""}</h2>
                <div className="flex flex-wrap gap-1.5">
                  <Pill>{m.role === "owner" ? "Besitzer" : "Mitglied"}</Pill>
                  {!m.notify && <Pill>Push aus</Pill>}
                </div>
              </div>
            </div>

            {actions.length > 0 && !active && (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {actions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setPending({ user: m.user_id, action: a })}
                    className={`text-sm font-bold underline underline-offset-4 ${a === "remove" ? "text-warn" : "text-kibble"}`}
                  >
                    {LABEL[a]}
                  </button>
                ))}
              </div>
            )}

            {active && (
              <div className="grid gap-2 rounded-2xl border border-dashed border-line bg-tile p-4">
                <p className="text-sm"><b>{LABEL[active]}?</b> {CONFIRM[active](m.display_name)}</p>
                <div className="flex gap-2">
                  <Button variant={active === "remove" ? "danger" : "solid"} disabled={busy} onClick={() => run(m.user_id, active)}>Ja, {LABEL[active].toLowerCase()}</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>Abbrechen</Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {isOwner && (
        <p className="text-xs text-muted">
          Der letzte Besitzer bleibt immer Besitzer. Wer den Haushalt verlassen will, macht das unter <Link href="/familie/haushalt" className="underline underline-offset-4">Haushalt verwalten</Link>.
        </p>
      )}
    </main>
  );
}
