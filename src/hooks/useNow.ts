"use client";
import { useEffect, useState } from "react";

/** Aktuelle Zeit, alle 30 Sekunden und beim Zurückkehren in die App neu. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return now;
}
