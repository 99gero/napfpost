import { formatMinutes, type Slot } from "@/lib/schedule";
import { formatTime } from "@/lib/texts";

export function SlotPill({ slot, tz, nameOf }: { slot: Slot; tz: string; nameOf: (id: string | null) => string }) {
  const range = slot.schedule ? `${formatMinutes(slot.startMin)}–${formatMinutes(slot.endMin)}` : "";
  const base = "flex min-w-0 flex-col gap-0.5 rounded-2xl border px-3 py-2";
  if (slot.completion)
    return (
      <div className={`${base} border-ok/40 bg-ok/10`}>
        <span className="text-xs font-bold text-ok">✅ {slot.label}</span>
        <span className="truncate font-mono text-[0.72rem] text-ink">
          {nameOf(slot.completion.completed_by)} · {formatTime(slot.completion.completed_at, tz)}
        </span>
      </div>
    );
  if (slot.state === "overdue")
    return (
      <div className={`${base} border-warn/50 bg-warn/10`}>
        <span className="text-xs font-bold text-warn">⚠️ {slot.label}</span>
        <span className="font-mono text-[0.72rem] text-warn">Noch nicht erledigt</span>
      </div>
    );
  if (slot.state === "due")
    return (
      <div className={`${base} border-kibble/60 bg-kibble/10`}>
        <span className="text-xs font-bold text-kibble">{slot.label} · jetzt</span>
        <span className="font-mono text-[0.72rem] text-muted">{range || "offen"}</span>
      </div>
    );
  return (
    <div className={`${base} border-line bg-card`}>
      <span className="text-xs font-bold text-muted">{slot.label}</span>
      <span className="font-mono text-[0.72rem] text-muted">ab {formatMinutes(slot.startMin)}</span>
    </div>
  );
}
