"use client";
import { useRef } from "react";

/** Der runde Chip-Knopf aus dem Napfpost-Entwurf. */
export function CoinButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className="coin"
      disabled={busy}
      onClick={() => {
        const el = ref.current;
        if (el) { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }
        navigator.vibrate?.(30);
        onPress();
      }}
    >
      <i className="ring" /><i className="ring" /><i className="ring" />
      <span>{busy ? "Wird eingetragen …" : label}</span>
    </button>
  );
}
