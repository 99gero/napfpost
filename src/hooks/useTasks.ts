"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Completion, Task } from "@/lib/types";

/**
 * Aufgaben (eines Hundes oder eine einzelne) samt Erledigungen der letzten 7 Tage.
 * Aktualisiert sich live über Supabase Realtime und beim Zurückkehren in die App.
 */
export function useTasks(householdId: string, filter: { dogId?: string; taskId?: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [error, setError] = useState("");
  const { dogId, taskId } = filter;

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    let q = sb.from("tasks").select("*, task_schedules(id, label, start_time, end_time, weekdays)").eq("household_id", householdId).eq("active", true).order("sort").order("created_at");
    if (dogId) q = q.eq("dog_id", dogId);
    if (taskId) q = q.eq("id", taskId);
    const { data, error } = await q;
    if (error) return setError(error.message);
    const list = (data ?? []) as Task[];
    const ids = list.map((t) => t.id);
    let comps: Completion[] = [];
    if (ids.length) {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const res = await sb.from("task_completions").select("*").in("task_id", ids).gte("completed_at", since).order("completed_at", { ascending: false }).limit(300);
      if (res.error) return setError(res.error.message);
      comps = res.data as Completion[];
    }
    setError("");
    setTasks(list);
    setCompletions(comps);
  }, [householdId, dogId, taskId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen laden
    load();
    const sb = supabaseBrowser();
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;
    (async () => {
      // Erst die Anmeldung an Realtime geben: Nach einem kompletten Seitenaufruf (NFC-Scan, Push-Klick)
      // würde der Kanal sonst anonym beitreten, und RLS würde alle Ereignisse zurückhalten.
      const { data } = await sb.auth.getSession();
      if (data.session) await sb.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = sb
        // Eigener Kanalname je Gerät und Ansicht
        .channel(`completions-${householdId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_completions", filter: `household_id=eq.${householdId}` }, () => load())
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "task_completions" }, () => load())
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") load(); // Lücke zwischen erstem Laden und Beitritt schließen
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("realtime", status, err?.message);
        });
    })();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, householdId, dogId, taskId]);

  return { tasks, completions, error, reload: load };
}
