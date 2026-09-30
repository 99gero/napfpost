/** Mindestlänge wie bei der Registrierung (LoginForm, minLength am Passwortfeld). */
export const MIN_PASSWORD_LENGTH = 8;

/** Prüft neues Passwort und Wiederholung. Gibt eine deutsche Fehlermeldung zurück oder null, wenn alles passt. */
export function validateNewPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  if (password !== repeat) return "Die beiden Passwörter stimmen nicht überein.";
  return null;
}

/** Erkennt die Ratenbegrenzung beim Mailversand (Supabase: HTTP 429 / over_email_send_rate_limit). */
export function isRateLimitError(error: { status?: number; code?: string; message?: string }): boolean {
  return error.status === 429 || error.code === "over_email_send_rate_limit" || /rate limit/i.test(error.message ?? "");
}

/** Wurde die Seite über einen Link aus der Passwort-zurücksetzen-Mail geöffnet? (?code= bei PKCE, sonst Tokens im Hash) */
export function hasRecoveryParams(search: string, hash: string): boolean {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  if (h.get("error") || h.get("error_code") || q.get("error") || q.get("error_code")) return false;
  return !!q.get("code") || (!!h.get("access_token") && h.get("type") === "recovery");
}

/** Merker für die Erfolgsmeldung nach dem Seitenwechsel zur Startseite. */
export const PASSWORD_CHANGED_FLAG = "napfpost:passwort-geaendert";
