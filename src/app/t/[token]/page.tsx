import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

// Öffentlicher Link auf NFC-Tag und QR-Code. Ohne Anmeldung verrät er nichts:
// weder Haustier noch Haushalt noch Aufgabe. Aufgelöst wird nur für Mitglieder (RLS).
export default async function TokenPage(props: PageProps<"/t/[token]">) {
  const { token } = await props.params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/t/${token}`)}`);

  if (/^[A-Za-z0-9_-]{22}$/.test(token)) {
    const { data } = await sb.from("task_tokens").select("task_id").eq("token", token).is("revoked_at", null).maybeSingle();
    if (data) redirect(`/aufgabe/${data.task_id}?via=tag`);
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-5 px-4">
      <Logo />
      <h1 className="font-display text-3xl leading-none">Dieser Chip passt nicht</h1>
      <p className="text-muted">
        Der Code ist ungültig, wurde ersetzt oder gehört zu einem anderen Haushalt. Wenn es euer Chip ist: In den Einstellungen des Haustiers könnt ihr einen neuen Link erzeugen und auf den Chip schreiben.
      </p>
      <Link href="/" className="justify-self-start rounded-full bg-ink px-5 py-3 font-extrabold text-on-ink">Zur App</Link>
    </main>
  );
}
