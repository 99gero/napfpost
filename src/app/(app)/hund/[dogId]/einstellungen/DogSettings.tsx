"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { TagPanel } from "@/components/TagPanel";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { emojiForSpecies, speciesOf, type Species } from "@/lib/species";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Dog, Schedule, Task } from "@/lib/types";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const hhmm = (t: string) => t.slice(0, 5);

export function DogSettings({ dogId }: { dogId: string }) {
  const { household, dogs } = useHousehold();
  const dog = dogs.find((d) => d.id === dogId);
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser()
      .from("tasks")
      .select("*, task_schedules(id, label, start_time, end_time, weekdays)")
      .eq("dog_id", dogId)
      .order("sort")
      .order("created_at");
    if (error) return setError(error.message);
    setTasks(data as Task[]);
  }, [dogId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen laden
  useEffect(() => { load(); }, [load]);

  if (!dog) return <ErrorText>Dieses Haustier gibt es nicht.</ErrorText>;
  const sb = supabaseBrowser();

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    if (error) setError(error.message);
    else { setError(""); load(); }
  }

  async function saveDog(patch: { name: string; species: Species; emoji: string }) {
    const { error } = await sb.from("dogs").update(patch).eq("id", dogId);
    if (error) return setError(error.message);
    setError("");
    router.refresh();
  }

  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await run(sb.from("tasks").insert({
      household_id: household.id, area: "dog", dog_id: dogId, kind: "custom",
      title: String(f.get("title")).trim(), emoji: String(f.get("temoji") || "✅"),
      done_aux: "wurde", done_word: String(f.get("word")).trim() || "versorgt", sort: (tasks?.length ?? 0) + 1,
    }));
    form.reset();
  }

  async function deleteDog() {
    const { error } = await sb.from("dogs").delete().eq("id", dogId);
    if (error) return setError(error.message);
    router.replace("/hund");
    router.refresh();
  }

  return (
    <main className="grid gap-5">
      <Link href={`/hund/${dogId}`} className="text-sm font-semibold text-muted">← {dog.name}</Link>
      <h1 className="font-display text-3xl leading-none">Einstellungen</h1>
      <ErrorText>{error}</ErrorText>

      <Card>
        <PetForm key={`${dog.id}-${dog.species}-${dog.emoji}-${dog.name}`} dog={dog} onSave={saveDog} />
      </Card>

      {tasks?.map((t) => (
        <Card key={t.id} className={`grid gap-4 ${t.active ? "" : "opacity-60"}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl">{t.emoji} {t.title}</h2>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={t.active} onChange={(e) => run(sb.from("tasks").update({ active: e.target.checked }).eq("id", t.id))} className="size-5 accent-[var(--ink)]" />
              aktiv
            </label>
          </div>

          <div className="grid gap-2">
            <p className="eyebrow">Zeitfenster</p>
            {t.task_schedules.length === 0 && <p className="text-sm text-muted">Keine Zeitfenster: gilt einmal pro Tag.</p>}
            {[...t.task_schedules].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((s) => (
              <ScheduleRow key={s.id} s={s} onSave={(patch) => run(sb.from("task_schedules").update(patch).eq("id", s.id))} onDelete={() => run(sb.from("task_schedules").delete().eq("id", s.id))} />
            ))}
            <button
              type="button"
              onClick={() => run(sb.from("task_schedules").insert({ household_id: household.id, task_id: t.id, label: t.task_schedules.length ? "Mittags" : "Morgens", start_time: "12:00", end_time: "14:00" }))}
              className="justify-self-start text-sm font-bold text-kibble"
            >
              + Zeitfenster
            </button>
          </div>

          <div className="grid gap-2 border-t border-line pt-4">
            <p className="eyebrow">NFC-Chip &amp; QR-Code</p>
            <TagPanel taskId={t.id} householdId={household.id} label={`${dog.name} – ${t.title}`} />
          </div>

          {t.kind === "custom" && (
            <button type="button" onClick={() => run(sb.from("tasks").delete().eq("id", t.id))} className="justify-self-start text-sm font-semibold text-warn">Aufgabe löschen</button>
          )}
        </Card>
      ))}

      <Card>
        <form onSubmit={addTask} className="grid gap-3">
          <h2 className="font-display text-xl">Weitere Aufgabe</h2>
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <Field id="temoji" name="temoji" label="Symbol" defaultValue="💊" maxLength={4} />
            <Field id="title" name="title" label="Bezeichnung" placeholder="Wurmkur" required maxLength={40} />
          </div>
          <Field id="word" name="word" label={`Nachricht: „${dog.name} wurde …“`} placeholder="entwurmt" required maxLength={40} />
          <Button variant="ghost">Hinzufügen</Button>
        </form>
      </Card>

      <Card className="grid gap-3">
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="justify-self-start font-semibold text-warn">{dog.name} entfernen</button>
        ) : (
          <>
            <p><b>{dog.name} wirklich entfernen?</b> Alle Aufgaben, Chips und der Verlauf werden gelöscht.</p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={deleteDog}>Ja, entfernen</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

function ScheduleRow({ s, onSave, onDelete }: { s: Schedule; onSave: (p: Partial<Schedule>) => void; onDelete: () => void }) {
  const [label, setLabel] = useState(s.label);
  const [start, setStart] = useState(hhmm(s.start_time));
  const [end, setEnd] = useState(hhmm(s.end_time));
  const [days, setDays] = useState<number[]>(s.weekdays);
  const dirty = label !== s.label || start !== hhmm(s.start_time) || end !== hhmm(s.end_time) || days.join() !== s.weekdays.join();
  const invalid = end <= start || days.length === 0 || !label.trim();

  return (
    <div className="grid gap-2 rounded-2xl border border-line bg-tile p-3">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
        <input aria-label="Bezeichnung" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} className="min-w-0 rounded-xl border border-line bg-card px-3 py-2 font-semibold" />
        <input aria-label="Beginn" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-line bg-card px-2 py-2 font-mono" />
        <input aria-label="Ende" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-line bg-card px-2 py-2 font-mono" />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {DAYS.map((d, i) => {
          const on = days.includes(i + 1);
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i + 1) : [...days, i + 1].sort())}
              className={`size-8 rounded-full text-xs font-bold ${on ? "bg-ink text-on-ink" : "border border-line text-muted"}`}>{d}</button>
          );
        })}
        <span className="flex-1" />
        {dirty && <button type="button" disabled={invalid} onClick={() => onSave({ label: label.trim(), start_time: start, end_time: end, weekdays: days })} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-on-ink disabled:opacity-40">Speichern</button>}
        <button type="button" onClick={onDelete} aria-label="Zeitfenster löschen" className="px-2 text-sm text-muted">✕</button>
      </div>
      {invalid && <p className="text-xs text-warn">Das Ende muss nach dem Beginn liegen, und mindestens ein Tag muss gewählt sein.</p>}
    </div>
  );
}

function PetForm({ dog, onSave }: { dog: Dog; onSave: (p: { name: string; species: Species; emoji: string }) => void }) {
  const [species, setSpecies] = useState<Species>(speciesOf(dog.species));
  const [emoji, setEmoji] = useState(dog.emoji);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: String(new FormData(e.currentTarget).get("dogname")).trim(), species, emoji });
      }}
      className="grid gap-3"
    >
      <SpeciesPicker species={species} emoji={emoji} onSpecies={(s) => { setSpecies(s); setEmoji((cur) => emojiForSpecies(cur, s)); }} onEmoji={setEmoji} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><Field id="dogname" name="dogname" label="Name" defaultValue={dog.name} required maxLength={40} /></div>
        <Button>Speichern</Button>
      </div>
      <p className="text-xs text-muted">Die Art ändert nur Symbol und Anzeige. Bereits angelegte Aufgaben bleiben, wie sie sind.</p>
    </form>
  );
}
