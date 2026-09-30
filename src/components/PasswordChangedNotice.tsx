"use client";
import { useEffect, useState } from "react";
import { PASSWORD_CHANGED_FLAG } from "@/lib/password";

/** Einmalige Erfolgsmeldung nach „Passwort zurücksetzen“ (Merker kommt von /passwort-neu). */
export function PasswordChangedNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PASSWORD_CHANGED_FLAG)) {
        sessionStorage.removeItem(PASSWORD_CHANGED_FLAG);
        Promise.resolve().then(() => setShow(true));
      }
    } catch { /* ohne Meldung weiter */ }
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="mb-4 rounded-2xl bg-ok/10 px-4 py-3 text-ok">
      Dein Passwort wurde geändert. Du bist angemeldet.
    </p>
  );
}
