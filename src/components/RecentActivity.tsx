"use client";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { activityLabel, whenLabel, type ActivityRow } from "@/lib/household";
import { supabaseBrowser } from "@/lib/supabase/client";

/** „Zuletzt erledigt“: die letzten 10 Erledigungen des Haushalts (nur Lesen). */
export function RecentActivity() {
  const { household, nameOf } = useHousehold();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabaseBrowser()
      .from("task_completions")
      .select("id, completed_at, completed_by, tasks(title, emoji, dogs(name, emoji))")
      .eq("household_id", household.id)
      .order("completed_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setRows((data ?? []) as unknown as ActivityRow[]);
      });
    return () => { cancelled = true; };
  }, [household.id]);

  if (failed) return <p className="text-sm text-warn">Der Verlauf konnte nicht geladen werden.</p>;
  if (rows === null) return <div className="h-24 animate-pulse rounded-2xl bg-tile" aria-label="Lädt" />;
  if (rows.length === 0) return <p className="text-sm text-muted">Noch nichts erledigt. Sobald jemand eine Aufgabe abhakt, erscheint sie hier.</p>;

  return (
    <ul className="grid gap-2">
      {rows.map((r) => {
        const a = activityLabel(r);
        return (
          <li key={r.id} className="flex items-center gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-biscuit text-lg">{a.emoji}</span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-semibold">{a.text}</span>
              <span className="truncate text-sm text-muted">{nameOf(r.completed_by)}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-muted">{whenLabel(r.completed_at, household.timezone)}</span>
          </li>
        );
      })}
    </ul>
  );
}
