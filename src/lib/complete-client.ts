import type { Completion } from "./types";

export type CompleteResponse = {
  status: "created" | "already";
  completion: Completion & { by_name: string };
  notified?: number;
};

/** Einziger Weg, eine Aufgabe zu erledigen – egal ob Knopf, NFC oder QR. */
export async function requestComplete(taskId: string, source: "app" | "tag"): Promise<CompleteResponse> {
  const res = await fetch(`/api/tasks/${taskId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source }),
  });
  if (res.status === 401) {
    // Sitzung abgelaufen: bewusst komplett neu laden, damit der Proxy die Anmeldung übernimmt
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error("Bitte melde dich an.");
  }
  if (!res.ok) throw new Error(res.status === 404 ? "Diese Aufgabe gibt es nicht mehr." : "Das hat nicht geklappt. Bitte versuche es noch einmal.");
  return res.json();
}
