"use client";

/** Ein/Aus-Schalter mit Beschriftung */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-tile px-4 py-3 text-left font-semibold disabled:opacity-50"
    >
      <span>{label}</span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${checked ? "bg-ink" : "bg-transparent"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full transition-all ${checked ? "left-[22px] bg-on-ink" : "left-0.5 bg-ink"}`} />
      </span>
    </button>
  );
}
