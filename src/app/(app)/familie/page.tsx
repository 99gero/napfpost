"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { PushSetup } from "@/components/PushSetup";
import { Button, Card } from "@/components/ui";
import { AREAS } from "@/lib/areas";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function FamilyPage() {
  const { household, members, userId } = useHousehold();
  const router = useRouter();
  const [code, setCode] = useState(household.invite_code);
  const [msg, setMsg] = useState("");
  const isOwner = members.find((m) => m.user_id === userId)?.role === "owner";
  const inviteUrl = typeof window === "undefined" ? "" : `${location.origin}/start?code=${code}`;

  async function copyInvite() {
    try { await navigator.clipboard.writeText(`Komm in unseren Haushalt bei Napfpost: ${inviteUrl} (Code ${code})`); setMsg("Einladung kopiert – z. B. in den Familienchat einfügen."); }
    catch { setMsg(inviteUrl); }
  }

  async function rotate() {
    const { data, error } = await supabaseBrowser().rpc("rotate_invite_code", { p_household: household.id });
    if (!error && data) { setCode(data as string); setMsg("Neuer Code erzeugt. Der alte gilt nicht mehr."); }
  }

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="grid gap-5">
      <div className="grid gap-1">
        <p className="eyebrow">Haushalt</p>
        <h1 className="font-display text-3xl leading-none">{household.name}</h1>
      </div>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Familie</h2>
        <ul className="grid gap-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-biscuit font-extrabold">{m.display_name.slice(0, 1).toUpperCase()}</span>
              <span className="font-semibold">{m.display_name}{m.user_id === userId ? " (du)" : ""}</span>
              {m.role === "owner" && <span className="ml-auto font-mono text-xs text-muted">verwaltet</span>}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 rounded-2xl border border-dashed border-line bg-tile p-4">
          <span className="text-sm text-muted">Einladungscode für weitere Familienmitglieder</span>
          <span className="font-mono text-2xl font-semibold tracking-[0.3em]">{code}</span>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyInvite}>Einladung kopieren</Button>
            {isOwner && <Button variant="ghost" onClick={rotate}>Neuer Code</Button>}
          </div>
          {msg && <p className="break-all text-sm text-muted">{msg}</p>}
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Benachrichtigungen</h2>
        <p className="text-sm text-muted">Wenn jemand anderes eine Aufgabe erledigt, bekommst du eine Nachricht. Deine eigenen Erledigungen melden wir dir nicht.</p>
        <PushSetup />
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Weitere Bereiche</h2>
        <p className="text-sm text-muted">Nach dem gleichen Prinzip folgen bald:</p>
        <ul className="grid gap-2">
          {Object.entries(AREAS).filter(([, a]) => !a.ready).map(([k, a]) => (
            <li key={k} className="flex items-baseline gap-2">
              <span aria-hidden>{a.emoji}</span><b>{a.label}</b><span className="truncate text-sm text-muted">{a.examples.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </Card>

      <button type="button" onClick={logout} className="justify-self-start font-semibold text-muted underline underline-offset-4">Abmelden</button>
    </main>
  );
}
