import Link from "next/link";
import type { ReactNode } from "react";
import { telHref, type Contact } from "@/lib/chips";
import { Card, Logo } from "./ui";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-5 px-4 py-10">
      <Logo />
      {children}
    </main>
  );
}

/** Verrät nichts: gleiche Seite für ungültige, gesperrte und fremde Chips. */
export function ChipNoMatch() {
  return (
    <Shell>
      <h1 className="font-display text-3xl leading-none">Dieser Chip passt nicht</h1>
      <p className="text-muted">Der Code ist ungültig oder der Chip wird nicht mehr verwendet.</p>
      <Link href="/" className="justify-self-start rounded-full bg-ink px-5 py-3 font-extrabold text-on-ink">Zur App</Link>
    </Shell>
  );
}

export function ChipMissing({ text }: { text: string }) {
  return (
    <Shell>
      <h1 className="font-display text-3xl leading-none">Hier ist noch nichts</h1>
      <p className="text-muted">{text}</p>
      <Link href="/familie/chips" className="justify-self-start rounded-full bg-ink px-5 py-3 font-extrabold text-on-ink">Meine Chips</Link>
    </Shell>
  );
}

export function ChipNote({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <p className="eyebrow">Notiz</p>
      <h1 className="font-display text-3xl leading-none">{title}</h1>
      <Card><p className="whitespace-pre-wrap break-words text-lg">{text}</p></Card>
    </Shell>
  );
}

/** Öffentliche Kontaktseite (Notfallkarte), z. B. für den Finder eines Tieres. */
export function ChipContact({ title, contact }: { title: string; contact: Contact }) {
  const phones = [contact.phone, contact.phone2].filter(Boolean);
  return (
    <Shell>
      <p className="eyebrow">Notfallkarte</p>
      <h1 className="font-display text-3xl leading-none">{title}</h1>
      <Card className="grid gap-4">
        {contact.name && <p className="text-xl font-extrabold">{contact.name}</p>}
        {phones.map((p) => {
          const href = telHref(p);
          return href ? (
            <a key={p} href={href} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 text-lg font-extrabold text-on-ink">
              <span aria-hidden>📞</span> {p}
            </a>
          ) : (
            <p key={p} className="font-mono text-lg">{p}</p>
          );
        })}
        {contact.note && <p className="whitespace-pre-wrap break-words text-muted">{contact.note}</p>}
      </Card>
    </Shell>
  );
}
