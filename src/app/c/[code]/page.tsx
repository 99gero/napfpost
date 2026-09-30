import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { TaskOption } from "@/components/ChipFields";
import { ChipContact, ChipMissing, ChipNoMatch, ChipNote } from "@/components/ChipViews";
import { decideAccess, isValidCode, parseContact, parseHttpUrl, type Chip } from "@/lib/chips";
import { loadChipByCode, loadChipFile, signedFileUrl } from "@/lib/chip-server";
import { supabaseServer } from "@/lib/supabase/server";
import { ActivateForm, type BlockedChip } from "./ActivateForm";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

// Fester Link auf dem NFC-Chip: /c/<code>. Der Chip bleibt unverändert; was er tut, steht in der Datenbank.
// Ohne Berechtigung verrät die Seite nichts über Haushalt, Hund oder Inhalt.
export default async function ChipPage(props: PageProps<"/c/[code]">) {
  const { code } = await props.params;
  if (!isValidCode(code)) return <ChipNoMatch />;

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const chip = await loadChipByCode(code);

  let households: { id: string; name: string }[] = [];
  if (user) {
    const { data } = await sb.from("household_members").select("households(id, name)").eq("user_id", user.id);
    households = (data ?? []).flatMap((m: { households: { id: string; name: string } | { id: string; name: string }[] | null }) =>
      (Array.isArray(m.households) ? m.households : m.households ? [m.households] : []),
    );
  }

  const access = decideAccess(chip, {
    signedIn: Boolean(user),
    memberOfChipHousehold: Boolean(chip?.household_id && households.some((h) => h.id === chip.household_id)),
  });

  if (access === "invalid" || !chip) return <ChipNoMatch />;
  if (access === "login") redirect(`/login?next=${encodeURIComponent(`/c/${code}`)}`);
  if (access === "activate") return <Activate code={code} households={households} />;
  return <Target chip={chip} signedIn={Boolean(user)} />;
}

async function Activate({ code, households }: { code: string; households: { id: string; name: string }[] }) {
  const sb = await supabaseServer();
  const [{ data: tasks }, { data: blocked }] = await Promise.all([
    sb.from("tasks").select("id, household_id, title, dogs(name)").eq("active", true).order("sort"),
    sb.from("chips").select("id, household_id, title, target_type, target_id, target_value, visibility").eq("status", "gesperrt").order("revoked_at", { ascending: false }),
  ]);
  const taskOptions: TaskOption[] = (tasks ?? []).map((t: { id: string; household_id: string; title: string; dogs: { name: string } | { name: string }[] | null }) => {
    const dog = Array.isArray(t.dogs) ? t.dogs[0] : t.dogs;
    return { id: t.id, household_id: t.household_id, label: dog ? `${dog.name}: ${t.title}` : t.title };
  });
  return <ActivateForm code={code} households={households} tasks={taskOptions} blocked={(blocked ?? []) as BlockedChip[]} />;
}

async function Target({ chip, signedIn }: { chip: Chip; signedIn: boolean }) {
  const title = chip.title ?? "Chip";
  switch (chip.target_type) {
    case "task": {
      if (!signedIn || !chip.target_id) return <ChipMissing text="Die Aufgabe für diesen Chip gibt es nicht mehr. Wähle in „Meine Chips“ eine neue." />;
      const sb = await supabaseServer();
      const { data } = await sb.from("tasks").select("id").eq("id", chip.target_id).eq("active", true).maybeSingle();
      if (!data) return <ChipMissing text="Die Aufgabe für diesen Chip gibt es nicht mehr. Wähle in „Meine Chips“ eine neue." />;
      redirect(`/aufgabe/${data.id}?via=tag`);
    }
    case "note":
      return chip.target_value ? <ChipNote title={title} text={chip.target_value} /> : <ChipNoMatch />;
    case "link": {
      const url = parseHttpUrl(chip.target_value ?? "");
      return url ? redirect(url) : <ChipNoMatch />;
    }
    case "file": {
      const file = await loadChipFile(chip.id);
      if (!file) return <ChipMissing text="Für diesen Chip ist noch keine Datei hinterlegt." />;
      const url = await signedFileUrl(file.path);
      return url ? redirect(url) : <ChipMissing text="Die Datei ist gerade nicht erreichbar. Bitte später noch einmal versuchen." />;
    }
    case "contact": {
      const contact = parseContact(chip.target_value);
      return contact ? <ChipContact title={title} contact={contact} /> : <ChipNoMatch />;
    }
    default:
      return <ChipNoMatch />;
  }
}
