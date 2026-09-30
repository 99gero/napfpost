"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { deleteConfirmed, familyErrorText, isOwnerOf, leaveBlocker, validateHouseholdName } from "@/lib/household";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function HouseholdPage() {
  const { household, members, userId } = useHousehold();
  const router = useRouter();
  const isOwner = isOwnerOf(members, userId);
  const blocker = leaveBlocker(members, userId);

  const [renameError, setRenameError] = useState("");
  const [renameMsg, setRenameMsg] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function rename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRenameMsg("");
    const check = validateHouseholdName(String(new FormData(e.currentTarget).get("hname")));
    if (!check.ok) return setRenameError(check.error);
    const { error } = await supabaseBrowser().rpc("rename_household", { p_household: household.id, p_name: check.value });
    if (error) return setRenameError(familyErrorText(error.message));
    setRenameError("");
    setRenameMsg("Gespeichert.");
    router.refresh();
  }

  async function leave() {
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().rpc("leave_household", { p_household: household.id });
    setBusy(false);
    if (error) return setError(familyErrorText(error.message));
    router.replace("/");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/household/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ household_id: household.id, confirm_name: typed }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res || !res.ok) return setError(body?.error ?? "Das hat nicht geklappt. Bitte versuche es noch einmal.");
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid gap-5">
      <div className="grid gap-1">
        <Link href="/familie" className="text-sm font-semibold text-muted underline underline-offset-4">← Familie</Link>
        <p className="eyebrow">Haushalt</p>
        <h1 className="font-display text-3xl leading-none">{household.name}</h1>
      </div>

      <ErrorText>{error}</ErrorText>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Name</h2>
        {isOwner ? (
          <form onSubmit={rename} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field id="hname" name="hname" label="Name des Haushalts" defaultValue={household.name} required maxLength={60} />
            </div>
            <Button>Speichern</Button>
          </form>
        ) : (
          <p className="text-sm text-muted">Nur Besitzer können den Namen ändern.</p>
        )}
        <ErrorText>{renameError}</ErrorText>
        {renameMsg && <p className="text-sm text-ok">{renameMsg}</p>}
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-xl">Haushalt verlassen</h2>
        {blocker === "last_owner" && (
          <p className="text-sm text-muted">
            Du bist der einzige Besitzer. Übertrage die Besitzer-Rolle zuerst an jemanden unter <Link href="/familie/mitglieder" className="underline underline-offset-4">Mitglieder</Link>, dann kannst du gehen.
          </p>
        )}
        {blocker === "sole_member" && (
          <p className="text-sm text-muted">Du bist allein im Haushalt. Statt zu gehen, kannst du ihn unten löschen.</p>
        )}
        {!blocker && !confirmLeave && (
          <>
            <p className="text-sm text-muted">Du siehst danach nichts mehr aus diesem Haushalt und bekommst keine Nachrichten. Die Familie bleibt bestehen.</p>
            <button type="button" onClick={() => setConfirmLeave(true)} className="justify-self-start font-semibold text-warn underline underline-offset-4">Haushalt verlassen</button>
          </>
        )}
        {!blocker && confirmLeave && (
          <>
            <p><b>{household.name} wirklich verlassen?</b> Du kannst nur mit einem neuen Einladungscode wieder beitreten.</p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={leave} disabled={busy}>Ja, verlassen</Button>
              <Button variant="ghost" onClick={() => setConfirmLeave(false)} disabled={busy}>Abbrechen</Button>
            </div>
          </>
        )}
      </Card>

      {isOwner && (
        <Card className="grid gap-3 border-warn/40">
          <h2 className="font-display text-xl">Haushalt löschen</h2>
          <p className="text-sm text-muted">
            Löscht {household.name} für alle: Haustiere, Aufgaben, den ganzen Verlauf, alle NFC-Chips samt hochgeladener Dateien und die Mitgliedschaften. Das lässt sich nicht rückgängig machen.
          </p>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="justify-self-start font-semibold text-warn underline underline-offset-4">Haushalt löschen …</button>
          ) : (
            <div className="grid gap-3">
              <Field
                id="confirm-name"
                label={`Tippe zur Bestätigung den Namen ein: ${household.name}`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="flex gap-2">
                <Button variant="danger" onClick={remove} disabled={busy || !deleteConfirmed(household.name, typed)}>Endgültig löschen</Button>
                <Button variant="ghost" onClick={() => { setConfirmDelete(false); setTyped(""); }} disabled={busy}>Abbrechen</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
