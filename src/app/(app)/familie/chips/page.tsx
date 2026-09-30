"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChipFields, chipToForm, formToInput, type ChipForm, type TaskOption } from "@/components/ChipFields";
import { useHousehold } from "@/components/HouseholdProvider";
import { Button, Card, Chip as Pill, ErrorText } from "@/components/ui";
import { FILE_TYPES, MAX_FILE_BYTES, TARGETS, formatSize, toChipConfig, validateFile, type Chip, type ChipFile } from "@/lib/chips";
import { supabaseBrowser } from "@/lib/supabase/client";

type TaskRow = { id: string; household_id: string; title: string; dogs: { name: string } | { name: string }[] | null };

export default function ChipsPage() {
  const { household } = useHousehold();
  const [chips, setChips] = useState<Chip[] | undefined>(undefined);
  const [files, setFiles] = useState<ChipFile[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [c, f, t] = await Promise.all([
      sb.from("chips").select("*").eq("household_id", household.id).order("activated_at", { ascending: false }),
      sb.from("chip_files").select("*").eq("household_id", household.id),
      sb.from("tasks").select("id, household_id, title, dogs(name)").eq("household_id", household.id).eq("active", true).order("sort"),
    ]);
    if (c.error) setError("Chips konnten nicht geladen werden.");
    setChips((c.data as Chip[]) ?? []);
    setFiles((f.data as ChipFile[]) ?? []);
    setTasks(((t.data as TaskRow[]) ?? []).map((x) => {
      const dog = Array.isArray(x.dogs) ? x.dogs[0] : x.dogs;
      return { id: x.id, household_id: x.household_id, label: dog ? `${dog.name}: ${x.title}` : x.title };
    }));
  }, [household.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen laden
  useEffect(() => { load(); }, [load]);

  const used = files.reduce((n, f) => n + f.size_bytes, 0);
  const active = (chips ?? []).filter((c) => c.status === "aktiv");
  const blocked = (chips ?? []).filter((c) => c.status === "gesperrt");

  return (
    <main className="grid gap-5">
      <div className="grid gap-1">
        <Link href="/familie" className="text-sm font-semibold text-muted underline underline-offset-4">← Familie</Link>
        <p className="eyebrow">{household.name}</p>
        <h1 className="font-display text-3xl leading-none">Meine Chips</h1>
      </div>

      <ErrorText>{error}</ErrorText>
      {chips === undefined && <p className="text-sm text-muted">Lädt …</p>}

      {chips && active.length === 0 && (
        <Card className="grid gap-2">
          <h2 className="font-display text-xl">Noch keine Chips</h2>
          <p className="text-sm text-muted">Halte einen neuen Napfpost-Chip an die Rückseite des Handys. Es öffnet sich eine Seite, auf der du ihn aktivierst und festlegst, was er tun soll.</p>
        </Card>
      )}

      {active.map((c) => (
        <ChipCard key={c.id} chip={c} file={files.find((f) => f.chip_id === c.id)} used={used} tasks={tasks} householdId={household.id} onChanged={load} />
      ))}

      {blocked.length > 0 && (
        <Card className="grid gap-2">
          <h2 className="font-display text-xl">Gesperrte Chips</h2>
          <ul className="grid gap-1.5 text-sm">
            {blocked.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-muted">
                <span aria-hidden>{c.target_type ? TARGETS[c.target_type].emoji : "⛔"}</span>
                <span className="truncate">{c.title}</span>
                <span className="ml-auto font-mono text-xs">gesperrt</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Neuen Chip ans Handy halten und beim Aktivieren „Ersatz für einen gesperrten Chip“ wählen, dann übernimmt er die Einstellungen.</p>
        </Card>
      )}

      <p className="text-xs text-muted">Dateispeicher: {formatSize(used)} von 25 MB belegt.</p>
    </main>
  );
}

function ChipCard({ chip, file, used, tasks, householdId, onChanged }: { chip: Chip; file?: ChipFile; used: number; tasks: TaskOption[]; householdId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ChipForm>(() => chipToForm(chip));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const type = chip.target_type ?? "note";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const parsed = toChipConfig(formToInput(form));
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    const { error } = await supabaseBrowser().from("chips").update(parsed.config).eq("id", chip.id);
    setBusy(false);
    if (error) return setError("Speichern hat nicht geklappt.");
    setMsg("Gespeichert. Der Chip selbst muss nicht neu beschrieben werden.");
    onChanged();
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    setError("");
    setMsg("");
    const problem = validateFile(f, used, file?.size_bytes ?? 0);
    if (problem) return setError(problem);
    setBusy(true);
    const sb = supabaseBrowser();
    const path = `${householdId}/${chip.id}/${crypto.randomUUID()}.${FILE_TYPES[f.type]}`;
    const up = await sb.storage.from("chip-files").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) {
      setBusy(false);
      return setError("Hochladen hat nicht geklappt.");
    }
    const meta = { path, filename: f.name.slice(0, 200), mime_type: f.type, size_bytes: f.size };
    const res = file
      ? await sb.from("chip_files").update(meta).eq("id", file.id)
      : await sb.from("chip_files").insert({ ...meta, chip_id: chip.id, household_id: householdId });
    if (res.error) {
      await sb.storage.from("chip-files").remove([path]);
      setBusy(false);
      return setError(res.error.code === "54000" ? "Der Speicher für Chip-Dateien ist voll." : "Speichern der Datei hat nicht geklappt.");
    }
    if (file) await sb.storage.from("chip-files").remove([file.path]);
    setBusy(false);
    setMsg(file ? "Datei ersetzt." : "Datei hochgeladen.");
    onChanged();
  }

  async function viewFile() {
    if (!file) return;
    const { data } = await supabaseBrowser().storage.from("chip-files").createSignedUrl(file.path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else setError("Die Datei konnte nicht geöffnet werden.");
  }

  async function block() {
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().rpc("block_chip", { p_chip: chip.id });
    setBusy(false);
    if (error) return setError("Sperren hat nicht geklappt.");
    onChanged();
  }

  return (
    <Card className="grid gap-3">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-biscuit text-xl">{TARGETS[type].emoji}</span>
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="truncate font-display text-xl">{chip.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            <Pill>{TARGETS[type].label}</Pill>
            <Pill>{chip.visibility === "public" ? "öffentlich" : "nur Familie"}</Pill>
            <Pill>…{chip.code.slice(-4)}</Pill>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="shrink-0 rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm font-bold">
          {open ? "Schließen" : "Ändern"}
        </button>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-line pt-4">
          <form onSubmit={save} className="grid gap-4">
            <ChipFields id={`c-${chip.id}`} form={form} onChange={setForm} tasks={tasks} />
            <Button disabled={busy}>{busy ? "Einen Moment …" : "Speichern"}</Button>
          </form>

          {form.target_type === "file" && (
            <div className="grid gap-2 rounded-2xl border border-dashed border-line bg-tile p-4">
              <h3 className="font-extrabold">Datei</h3>
              {file ? (
                <p className="break-all text-sm">{file.filename} <span className="text-muted">({formatSize(file.size_bytes)})</span></p>
              ) : (
                <p className="text-sm text-muted">Noch keine Datei hochgeladen.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex cursor-pointer items-center rounded-full border-2 border-ink px-4 py-2 text-sm font-extrabold ${busy ? "opacity-50" : ""}`}>
                  {file ? "Datei ersetzen" : "Datei hochladen"}
                  <input type="file" className="sr-only" accept={Object.keys(FILE_TYPES).join(",")} onChange={upload} disabled={busy} />
                </label>
                {file && <button type="button" onClick={viewFile} className="rounded-full px-3 py-2 text-sm font-bold underline underline-offset-4">Ansehen</button>}
              </div>
              <p className="text-xs text-muted">PDF, Bild oder Text, höchstens {MAX_FILE_BYTES / 1024 / 1024} MB. Speichern (oben) und Hochladen sind getrennte Schritte.</p>
            </div>
          )}

          <div className="grid gap-2">
            {confirmBlock ? (
              <>
                <p className="text-sm">Der Chip funktioniert danach nicht mehr und zeigt nur „Dieser Chip passt nicht“. Zum Ersetzen einen neuen Chip aktivieren und die Einstellungen übernehmen.</p>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={block} disabled={busy}>Ja, sperren</Button>
                  <Button variant="ghost" onClick={() => setConfirmBlock(false)}>Abbrechen</Button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmBlock(true)} className="justify-self-start text-sm font-semibold text-warn underline underline-offset-4">
                Chip sperren oder ersetzen (verloren, überschrieben)
              </button>
            )}
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
