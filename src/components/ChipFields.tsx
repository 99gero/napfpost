"use client";
import { TARGETS, TARGET_TYPES, VISIBILITY_LABEL, parseContact, type Chip, type ChipInput, type TargetType, type Visibility } from "@/lib/chips";
import { Field } from "./ui";

export type TaskOption = { id: string; household_id: string; label: string };

/** Formularzustand für „was macht der Chip“. Wird beim Aktivieren und beim Bearbeiten genutzt. */
export type ChipForm = {
  title: string;
  target_type: TargetType;
  visibility: Visibility;
  task_id: string;
  note: string;
  url: string;
  name: string;
  phone: string;
  phone2: string;
  contactNote: string;
};

export const emptyForm = (): ChipForm => ({ title: "", target_type: "note", visibility: "members", task_id: "", note: "", url: "", name: "", phone: "", phone2: "", contactNote: "" });

export function chipToForm(c: Pick<Chip, "title" | "target_type" | "visibility" | "target_id" | "target_value">): ChipForm {
  const type = c.target_type ?? "note";
  const contact = type === "contact" ? parseContact(c.target_value) : null;
  return {
    title: c.title ?? "",
    target_type: type,
    visibility: c.visibility,
    task_id: c.target_id ?? "",
    note: type === "note" ? c.target_value ?? "" : "",
    url: type === "link" ? c.target_value ?? "" : "",
    name: contact?.name ?? "",
    phone: contact?.phone ?? "",
    phone2: contact?.phone2 ?? "",
    contactNote: contact?.note ?? "",
  };
}

export function formToInput(f: ChipForm): ChipInput {
  return {
    title: f.title,
    target_type: f.target_type,
    visibility: f.target_type === "task" ? "members" : f.visibility,
    task_id: f.task_id,
    note: f.note,
    url: f.url,
    contact: { name: f.name, phone: f.phone, phone2: f.phone2, note: f.contactNote },
  };
}

const control = "w-full min-w-0 rounded-2xl border-[1.5px] border-line bg-card px-4 py-3 text-base text-ink outline-none focus:border-ink";

export function ChipFields({ id, form, onChange, tasks }: { id: string; form: ChipForm; onChange: (f: ChipForm) => void; tasks: TaskOption[] }) {
  const set = <K extends keyof ChipForm>(k: K, v: ChipForm[K]) => onChange({ ...form, [k]: v });
  const t = form.target_type;
  return (
    <div className="grid gap-3">
      <Field id={`${id}-title`} label="Name des Chips" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={60} required placeholder="z. B. Napf-Chip Küche" />

      <label htmlFor={`${id}-type`} className="grid gap-1.5">
        <span className="text-sm font-semibold text-muted">Was soll der Chip tun?</span>
        <select id={`${id}-type`} className={control} value={t} onChange={(e) => set("target_type", e.target.value as TargetType)}>
          {TARGET_TYPES.map((k) => <option key={k} value={k}>{TARGETS[k].emoji} {TARGETS[k].label}</option>)}
        </select>
        <span className="text-xs text-muted">{TARGETS[t].hint}</span>
      </label>

      {t === "task" && (
        <label htmlFor={`${id}-task`} className="grid gap-1.5">
          <span className="text-sm font-semibold text-muted">Aufgabe</span>
          <select id={`${id}-task`} className={control} value={form.task_id} onChange={(e) => set("task_id", e.target.value)}>
            <option value="">Bitte wählen …</option>
            {tasks.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
      )}
      {t === "note" && (
        <label htmlFor={`${id}-note`} className="grid gap-1.5">
          <span className="text-sm font-semibold text-muted">Text</span>
          <textarea id={`${id}-note`} className={control} rows={4} maxLength={2000} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </label>
      )}
      {t === "link" && <Field id={`${id}-url`} label="Adresse" type="url" inputMode="url" placeholder="https://…" value={form.url} onChange={(e) => set("url", e.target.value)} maxLength={2000} />}
      {t === "contact" && (
        <>
          <Field id={`${id}-name`} label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="off" />
          <Field id={`${id}-phone`} label="Telefon" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} autoComplete="off" />
          <Field id={`${id}-phone2`} label="Zweite Nummer (optional)" type="tel" value={form.phone2} onChange={(e) => set("phone2", e.target.value)} maxLength={40} autoComplete="off" />
          <label htmlFor={`${id}-cnote`} className="grid gap-1.5">
            <span className="text-sm font-semibold text-muted">Hinweis (optional)</span>
            <textarea id={`${id}-cnote`} className={control} rows={2} maxLength={500} value={form.contactNote} onChange={(e) => set("contactNote", e.target.value)} />
          </label>
        </>
      )}

      {t === "task" ? (
        <p className="text-xs text-muted">Aufgaben kann nur erledigen, wer angemeldet ist.</p>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold text-muted">Wer darf es sehen?</legend>
          {(["members", "public"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 font-semibold">
              <input type="radio" name={`${id}-vis`} checked={form.visibility === v} onChange={() => set("visibility", v)} className="size-4 accent-[var(--ink)]" />
              {VISIBILITY_LABEL[v]}
            </label>
          ))}
          {form.visibility === "public" && (
            <p className="text-xs text-warn">Achtung: Wer den Chip antippt, sieht den Inhalt ohne Anmeldung. Nichts Vertrauliches eintragen.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
