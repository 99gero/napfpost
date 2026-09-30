"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { PushSetup } from "@/components/PushSetup";
import { RecentActivity } from "@/components/RecentActivity";
import { Switch } from "@/components/Switch";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { AREAS } from "@/lib/areas";
import { familyErrorText, isOwnerOf, validateDisplayName } from "@/lib/household";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function FamilyPage() {
  const { household, members, userId, myName, myEmail } = useHousehold();
  const router = useRouter();
  const [code, setCode] = useState(household.invite_code);
  const [msg, setMsg] = useState("");
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [nameError, setNameError] = useState("");
  const [notifyError, setNotifyError] = useState("");
  const isOwner = isOwnerOf(members, userId);
  const notify = members.find((m) => m.user_id === userId)?.notify ?? true;
  const inviteUrl = typeof window === "undefined" ? "" : `${location.origin}/start?code=${code}`;

  async function copyInvite() {
    try { await navigator.clipboard.writeText(`Komm in unseren Haushalt bei Napfpost: ${inviteUrl} (Code ${code})`); setMsg("Einladung kopiert – z. B. in den Familienchat einfügen."); }
    catch { setMsg(inviteUrl); }
  }

  async function rotate() {
    setConfirmRotate(false);
    const { data, error } = await supabaseBrowser().rpc("rotate_invite_code", { p_household: household.id });
    if (!error && data) { setCode(data as string); setMsg("Neuer Code erzeugt. Der alte gilt nicht mehr."); }
    else setMsg(familyErrorText(error?.message));
  }

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameMsg("");
    const check = validateDisplayName(String(new FormData(e.currentTarget).get("displayname")));
    if (!check.ok) return setNameError(check.error);
    const { error } = await supabaseBrowser().from("users").update({ display_name: check.value }).eq("id", userId);
    if (error) return setNameError("Speichern hat nicht geklappt.");
    setNameError("");
    setNameMsg("Gespeichert. So erscheinst du in den Nachrichten.");
    router.refresh();
  }

  async function setNotify(on: boolean) {
    const { error } = await supabaseBrowser().rpc("set_notify", { p_household: household.id, p_notify: on });
    setNotifyError(error ? familyErrorText(error.message) : "");
    if (!error) router.refresh();
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
        <h2 className="font-display text-xl">Ich</h2>
        <form onSubmit={saveName} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field id="displayname" name="displayname" label="Mein Anzeigename" defaultValue={myName} required maxLength={40} autoComplete="nickname" />
          </div>
          <Button>Speichern</Button>
        </form>
        <ErrorText>{nameError}</ErrorText>
        {nameMsg && <p className="text-sm text-ok">{nameMsg}</p>}
        <p className="text-sm text-muted">Konto: <span className="break-all font-mono">{myEmail || "unbekannt"}</span></p>
      </Card>

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
        <Link href="/familie/mitglieder" className="justify-self-start text-sm font-bold text-kibble underline underline-offset-4">
          {isOwner ? "Mitglieder verwalten" : "Mitglieder ansehen"}
        </Link>
        <div className="grid gap-2 rounded-2xl border border-dashed border-line bg-tile p-4">
          <span className="text-sm text-muted">Einladungscode für weitere Familienmitglieder</span>
          <span className="font-mono text-2xl font-semibold tracking-[0.3em]">{code}</span>
          <p className="text-xs text-muted">Der Code gilt bis zum Erneuern. Wer ihn hat, kann dem Haushalt beitreten.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyInvite}>Einladung kopieren</Button>
            {isOwner && !confirmRotate && <Button variant="ghost" onClick={() => setConfirmRotate(true)}>Neuer Code</Button>}
          </div>
          {confirmRotate && (
            <div className="grid gap-2">
              <p className="text-sm">Der alte Code und alle damit verschickten Einladungen gelten danach nicht mehr. Erneuern?</p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={rotate}>Ja, erneuern</Button>
                <Button variant="ghost" onClick={() => setConfirmRotate(false)}>Abbrechen</Button>
              </div>
            </div>
          )}
          {msg && <p className="break-all text-sm text-muted">{msg}</p>}
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Benachrichtigungen</h2>
        <p className="text-sm text-muted">Wenn jemand anderes eine Aufgabe erledigt, bekommst du eine Nachricht. Deine eigenen Erledigungen melden wir dir nicht.</p>
        <Switch checked={notify} onChange={setNotify} label="Push für diesen Haushalt" />
        <ErrorText>{notifyError}</ErrorText>
        {!notify && <p className="text-sm text-muted">Aus: Du bekommst für {household.name} keine Nachrichten, auch wenn dein Gerät angemeldet ist.</p>}
        <div className="border-t border-line pt-3">
          <p className="eyebrow mb-2">Dieses Gerät</p>
          <PushSetup />
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Zuletzt erledigt</h2>
        <RecentActivity />
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">NFC-Chips</h2>
        <p className="text-sm text-muted">Was ein Chip beim Antippen tut, änderst du hier – der Chip selbst bleibt unverändert.</p>
        <Link href="/familie/chips" className="justify-self-start rounded-full border-2 border-ink px-5 py-3 font-extrabold">Meine Chips</Link>
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Haushalt</h2>
        <p className="text-sm text-muted">
          {isOwner ? "Namen ändern, Haushalt verlassen oder löschen." : "Haushalt verlassen."}
        </p>
        <Link href="/familie/haushalt" className="justify-self-start rounded-full border-2 border-ink px-5 py-3 font-extrabold">Haushalt verwalten</Link>
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
