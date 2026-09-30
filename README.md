# Napfpost

Familien-App für wiederkehrende Alltagsaufgaben. Der Grundsatz:

> Eine Person macht eine einfache physische oder digitale Aktion → die App erkennt sie → der Status wird aktualisiert → die Familie wird automatisch informiert.

Der **Hunde-Bereich** ist der Kern und vollständig ausgebaut. Kind, Haushalt und weitere Haustiere sind im Datenmodell und in der Erledigungslogik vorbereitet.

**Live:** https://napfpost.netlify.app (Netlify-Projekt `napfpost`, baut bei jedem Push auf `main` automatisch neu)

**Technik:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Realtime, RLS) · Web Push (VAPID) · PWA · Hosting auf Netlify. Alles läuft in kostenlosen Tarifen.

---

## Ausgangslage (Phase 1)

Referenz war der Napfpost-Entwurf (Konzeptseite mit Live-Demo „Wer füttert heute?“).

| | Im Entwurf | Jetzt |
| --- | --- | --- |
| Gestaltung | Fliesenraster, Emaille-Blau, Trockenfutter-Braun, Futtermatte; Schriften Bowlby One, Chivo, JetBrains Mono | übernommen (Tokens in `src/app/globals.css`) |
| Chip-Knopf | runde Harzmünze mit Kupferspule und Wellen beim Antippen | `CoinButton` |
| Personen-Auswahl | Chips (Anja, Tom, Lena, Ben) | echte Anmeldung; wer tippt, ist angemeldet |
| Status | Ampelpunkt „Bruno ist versorgt“ | pro Zeitfenster: ✅ erledigt / ⚠️ noch nicht erledigt / „ab 17:00“ |
| Doppelt füttern | Rückfrage „Trotzdem eintragen?“ (3-Stunden-Regel) | gemäß Vorgabe verschärft: im Zeitfenster schon erledigt → „Du musst nichts mehr tun.“, kein zweiter Eintrag möglich (Unique-Index) |
| Familienchat | Nachrichtenverlauf | `History` (letzte 7 Tage) |
| Daten | nur im Browser, Beispielwerte | Supabase mit RLS |
| Fehlte ganz | – | Haushalte, Einladung, mehrere Hunde, Zeitfenster, Push, NFC/QR-Tokens, PWA |

## Wie es funktioniert

- **Eine Erledigungslogik für alle Wege.** App-Knopf, NFC-Chip und QR-Code landen alle bei `POST /api/tasks/:id/complete` → `src/lib/complete.ts`.
- **„Bereits erledigt“** zuerst: Jede Aufgabenansicht zeigt zuerst den Status des aktuellen Zeitraums. Erst wenn noch niemand erledigt hat, gibt es den Knopf.
- **Zeitfenster** (`src/lib/schedule.ts`, mit Tests): Die Fenster teilen den Tag lückenlos auf, die Grenze liegt in der Mitte der Lücke. Bei Morgens 07–10 und Abends 17–21 zählt 00:00–13:30 zu „Morgens“, 13:30–24:00 zu „Abends“. Wer um 06:40 füttert, hat die Morgenfütterung erledigt. Nach dem Fensterende ohne Eintrag erscheint „⚠️ Noch nicht erledigt“. Aufgaben ohne Fenster gelten einmal pro Tag. Gerechnet wird in der Zeitzone des Haushalts (Standard Europe/Berlin).
- **Kein doppelter Eintrag:** `task_completions` hat `unique (task_id, period_key)`. Tippen zwei Personen gleichzeitig, bekommt die zweite „bereits erledigt“ mit dem Namen der ersten.
- **Push:** Nach einer neuen Erledigung bekommen alle *anderen* Mitglieder des Haushalts „🐶 Bruno wurde gefüttert – Gero · 09:17 Uhr“. Die Person selbst bekommt nichts.
- **Live:** Offene Apps aktualisieren sich über Supabase Realtime sofort, außerdem beim Zurückkehren in die App.
- **Rückgängig:** Die eigene Erledigung lässt sich 15 Minuten lang zurücknehmen (versehentlich getippt).

## Datenmodell

`supabase/migrations/20260930000000_init.sql`

| Tabelle | Inhalt |
| --- | --- |
| `users` | Profil zu `auth.users` (Anzeigename) |
| `households`, `household_members` | Haushalt, Einladungscode, Rollen owner/member |
| `dogs` | Hunde eines Haushalts |
| `tasks` | Aufgabe mit `area` (`dog`, `child`, `household`, `pet`), bei Hunden `dog_id`; Satzbausteine für Nachrichten („wurde“ + „gefüttert“) |
| `task_schedules` | Zeitfenster mit Wochentagen |
| `task_completions` | wer, wann, welcher Zeitraum, Quelle (`app`/`tag`) |
| `task_tokens` | zufälliger Link für NFC/QR, widerrufbar |
| `push_subscriptions` | Web-Push-Geräte je Nutzer |
| `chips`, `chip_files` | NFC-Chips mit Code, Status, Ziel; Dateimetadaten (Migration `20260930000100_chips.sql`, siehe Abschnitt Chips) |

Ein neuer Bereich (z. B. Kind) bekommt eine eigene Tabelle (`children`) und eine Spalte `tasks.child_id` nach dem Muster von `dog_id`. Erledigung, Zeitfenster, Push und NFC/QR funktionieren dann ohne Änderung.

**Sicherheit:** RLS auf allen Tabellen; Nutzer sehen nur Daten ihrer Haushalte. Zusammengesetzte Fremdschlüssel (`(task_id, household_id)`) verhindern, dass Daten verschiedener Haushalte verknüpft werden. Erledigungen nur im eigenen Namen, nicht änderbar. Tokens: 128 Bit Zufall. `/t/:token` verrät ohne Anmeldung nichts und löst nur für Mitglieder auf. Der geheime Supabase-Schlüssel wird nur serverseitig für den Push-Versand genutzt.

## Chips (vorprogrammierte NFC-Chips)

Ein Chip trägt nur einen festen Link `https://<App-Domain>/c/<code>` (Code: 10 Zeichen, URL-sicher, 60 Bit kryptografischer Zufall). **Was der Chip tut, steht in der Datenbank** (`chips`) und ist in der App unter *Familie → Meine Chips* jederzeit änderbar. Der Chip wird nie neu beschrieben. Funktioniert auf Android und iPhone (iPhone nur Lesen), ohne Zusatz-App.

**Ablauf**
1. Betreiber: `node scripts/generate-chip-codes.mjs 100 --base-url https://app.meinedomain.de --batch 2026-10-a` erzeugt in `chip-codes/` eine CSV (`code,url,batch`, für die Chip-Schreib-Software) und ein SQL-INSERT (nur Codes, Status `frei`). Das Skript braucht keine Schlüssel. Das SQL im Supabase SQL Editor ausführen. `chip-codes/` steht in der `.gitignore`: Die Codes sind die Geheimnisse der Chips, nicht einchecken oder weitergeben.
2. Die `url`-Spalte als URL-Datensatz auf die Chips schreiben, danach **sperren (Schreibschutz)**, damit niemand den Chip überschreiben kann.
3. Kunde hält den Chip ans Handy → *Chip aktivieren* (Anmeldung, Haushalt, Zweck). Danach zeigt derselbe Chip immer, was in der App eingestellt ist.

**Zwecke:** Aufgabe erledigen (wie der bisherige `/t/`-Link, über `complete.ts`), Notiz, Datei, Link, Notfallkarte (Kontaktseite). Sichtbarkeit: *nur Familie* (Anmeldung nötig) oder *öffentlich* (jeder mit dem Chip; Aufgaben immer nur für Angemeldete).

**Ungültig, gesperrt oder fremd:** Es erscheint immer dieselbe neutrale Seite „Dieser Chip passt nicht“. Nicht angemeldet und *nur Familie* → Anmeldung, ohne etwas zu verraten. **Sperren/Ersetzen:** Chip verloren? In *Meine Chips* sperren, den neuen Chip aktivieren und dabei „Ersatz für einen gesperrten Chip“ wählen (übernimmt Name, Zweck, Datei).

**Dateien:** Die Datei liegt in der App (privater Storage-Bucket `chip-files`), der Chip zeigt nur darauf. Web-Upload bis 5 MB (PDF, JPG, PNG, WebP, GIF, Text), höchstens 25 MB pro Haushalt, damit der Free-Tarif (1 GB Storage) reicht. Ausgeliefert wird über kurzlebige signierte Links.

**Chip-Kapazitäten** (die URL braucht nur ca. 40 Byte):

| Typ | Nutzbarer Speicher |
| --- | --- |
| NTAG213 | ca. 144 Byte |
| NTAG215 | ca. 504 Byte |
| NTAG216 | ca. 888 Byte |

Deshalb steht auf dem Chip nur der kurze Link; Inhalte (auch Dateien) liegen in der App. NTAG213 reicht. **Sperren gegen Überschreiben empfohlen**, sonst kann jeder mit einer NFC-App den Link ersetzen.

**Abwärtskompatibel:** `/t/<token>` und die bisherigen NFC/QR-Links der Aufgaben laufen unverändert weiter.

---

## Passwort zurücksetzen

Auf der Anmeldeseite führt „Passwort vergessen?“ zu `/passwort-vergessen`. Dort gibt man die E-Mail-Adresse ein; die App zeigt immer dieselbe Bestätigung („Wenn es ein Konto mit dieser Adresse gibt, haben wir eine E-Mail geschickt.“), damit nicht erkennbar ist, ob eine Adresse registriert ist. Der Link in der E-Mail öffnet `/passwort-neu`. Der Browser-Client (`@supabase/ssr`, PKCE) löst den `?code=` selbst ein; danach vergibt man ein neues Passwort (mindestens 8 Zeichen, Wiederholung muss passen) und landet angemeldet auf der Startseite. Ungültige oder abgelaufene Links führen zurück zu „Passwort vergessen“. Die Prüflogik steht in `src/lib/password.ts` (mit Tests).

**Nötige Supabase-Einstellungen**
1. **Authentication → URL Configuration → Redirect URLs**: `https://napfpost.netlify.app/passwort-neu` eintragen (oder allgemeiner `https://napfpost.netlify.app/**`). Bei einer eigenen Domain zusätzlich `https://app.meinedomain.de/passwort-neu`. Für lokale Tests `http://localhost:3000/passwort-neu`. Ohne diesen Eintrag ignoriert Supabase den Rücksprung und schickt auf die Site URL.
2. **Authentication → Email Templates → Reset Password**: Die Vorlage muss den Link `{{ .ConfirmationURL }}` enthalten (Standard). Nicht auf `{{ .SiteURL }}` oder eigene Adressen umbauen.
3. Der Link muss im selben Browser geöffnet werden, in dem er angefordert wurde (PKCE); auf einem anderen Gerät zeigt die App „Link ungültig“, dann einfach neu anfordern.

**Wichtig: E-Mail-Versand.** Der eingebaute kostenlose Mailversand von Supabase ist stark begrenzt (nur wenige Mails pro Stunde) und darf laut Supabase-Standard nur an Adressen von Mitgliedern der Supabase-Organisation senden. Für echte Kunden braucht es einen eigenen SMTP-Anbieter (**Authentication → Emails → SMTP Settings**); kostenlose Tarife existieren, meist mit eigener Domain. Bis dahin funktioniert das Zurücksetzen nur für Team-Adressen und mit Ratenlimit (die App zeigt dann eine freundliche Meldung).

---

## Einrichtung (alles kostenlos)

### 1. Supabase (Free)
1. Auf supabase.com ein Projekt anlegen, Region z. B. Frankfurt.
2. **SQL Editor** → Inhalt von `supabase/migrations/20260930000000_init.sql` einfügen und ausführen, danach `20260930000100_chips.sql` (Chip-System).
   (Alternativ mit der CLI: `npx supabase link` und `npx supabase db push`.)
3. **Authentication → Sign In / Providers → Email**: „Confirm email“ **ausschalten**. Der kostenlose Supabase-Mailversand schafft nur wenige Mails pro Stunde. Für eine Familie reicht die Anmeldung mit E-Mail und Passwort.
4. **Authentication → URL Configuration**: Site URL = eure Netlify-Adresse (später die eigene Domain).
5. **Project Settings → API Keys**: Publishable Key und Secret Key kopieren.

Hinweis Free-Tarif: Supabase pausiert Projekte nach 7 Tagen ohne Nutzung. Bei täglicher Nutzung passiert das nicht.

### 2. Push-Schlüssel
```bash
npx web-push generate-vapid-keys
```

### 3. Netlify (Free)
1. *Add new project → Import from GitHub* → dieses Repository. Build-Einstellungen kommen aus `netlify.toml`.
2. *Project configuration → Environment variables*: alle Werte aus `.env.example` eintragen.
3. Deployen. Die Netlify-Adresse (`…netlify.app`) funktioniert sofort.

### 4. Eigene Domain (später)
1. Netlify → *Domain management* → `app.meinedomain.de` hinzufügen, beim Domain-Anbieter einen CNAME auf die Netlify-Adresse setzen. HTTPS kommt automatisch.
2. `NEXT_PUBLIC_APP_URL=https://app.meinedomain.de` setzen und neu deployen.
3. In Supabase die Site URL auf die Domain ändern.

**Wichtig für NFC-Chips:** Die Chips speichern die Adresse, die beim Erzeugen galt. Am besten die Domain verbinden, bevor ihr Chips beschreibt. Chips mit der `netlify.app`-Adresse funktionieren weiter, auf dieser Adresse muss man sich aber einmal gesondert anmelden.

### 5. Auf den Handys
- **Android (Chrome):** Seite öffnen → „Zum Startbildschirm hinzufügen“ → in der App unter *Familie* Benachrichtigungen aktivieren.
- **iPhone (ab iOS 16.4):** In Safari öffnen → Teilen → „Zum Home-Bildschirm“ → **die App vom Home-Bildschirm öffnen**, anmelden, Benachrichtigungen aktivieren. Push gibt es auf dem iPhone nur in der installierten App.
- **NFC auf dem iPhone:** Ein NFC-Scan öffnet den Link in Safari, nicht in der installierten App. Deshalb einmal zusätzlich in Safari anmelden, danach bleibt die Anmeldung erhalten.
- **Chip beschreiben:** Unter *Hund → ⚙︎ → NFC-Chip & QR-Code* den Link erzeugen. Auf Android-Chrome direkt „Auf Chip schreiben“; auf dem iPhone mit einer NFC-App (z. B. „NFC Tools“) als URL-Datensatz schreiben. Geeignet sind NTAG213-Chips. Derselbe Link steht als QR-Code zum Ausdrucken bereit.

---

## Entwicklung

```bash
npm install
npm run db:start        # lokales Supabase in Docker (Auth, DB, Realtime, API)
cp .env.example .env.local   # Werte aus der Ausgabe von db:start + VAPID-Schlüssel
npm run dev
```

| Befehl | Prüft |
| --- | --- |
| `npm test` | Zeitfenster-Logik, Chip-Codes, Chip-Zugriff und Passwort-Prüfung (Vitest) |
| `npm run typecheck`, `npm run lint` | TypeScript, ESLint |
| `supabase/tests/rls_test.sql` | RLS-Szenario Jolina/Gero/Fremder gegen PostgreSQL (mit `supabase/tests/stub.sql` auch ohne Supabase) |
| `npm run e2e` | **Zwei-Handy-Test** gegen die laufende App und lokales Supabase: Jolina füttert → Geros offene App aktualisiert sich live, Gero bekommt Push, Gero scannt den Chip und sieht „bereits gefüttert · Jolina · Uhrzeit“, kein zweiter Eintrag; umgekehrt bekommt Jolina „🐶 Bruno wurde gefüttert / Gero · 09:17 Uhr“; gleichzeitiges Antippen ergibt genau einen Eintrag; ein fremder Haushalt sieht nichts. Die Push-Nachrichten werden dabei von einem lokalen Push-Dienst empfangen und entschlüsselt. |

## Bewusst nicht im MVP
Keine KI, kein WhatsApp, kein GPS, keine native App, keine Zahlungen. Keine Erinnerungs-Pushes („Bruno wartet noch“); das wäre der nächste kleine Schritt über eine geplante Netlify-Funktion (ebenfalls kostenlos).
