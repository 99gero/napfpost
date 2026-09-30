// Zwei-Handy-Test: Jolina und Gero, echtes Supabase (lokal), echte App, Push an einen lokalen Fake-Push-Dienst.
// Voraussetzungen: `npx supabase start`, `.env.local` mit den lokalen Schlüsseln und VAPID-Schlüsseln,
// App mit `npm run build && NODE_TLS_REJECT_UNAUTHORIZED=0 npm start` (nur lokal: der Fake-Push-Dienst
// nutzt ein selbst signiertes Zertifikat), openssl installiert. Start: `npm run e2e`.
const { chromium } = require('playwright');
const https = require('https'); const fs = require('fs'); const crypto = require('crypto');
const { execSync } = require('child_process');
const ece = require('http_ece');
const BASE = 'http://127.0.0.1:3000';
const OUT = __dirname + '/../.e2e-shots/'; fs.mkdirSync(OUT, { recursive: true });
const sql = (q) => execSync(`docker exec supabase_db_napfpost psql -U postgres -At -c "${q}"`).toString().trim();
function selfSigned() {
  const dir = fs.mkdtempSync(require('os').tmpdir() + '/np-');
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 1 -subj /CN=127.0.0.1`, { stdio: 'ignore' });
  return { key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) };
}
const ok = (cond, msg) => { if (!cond) { console.log('FAIL:', msg); process.exitCode = 1; } else console.log('ok  :', msg); };
const stamp = Date.now();

// Fake-Push-Dienst: entschlüsselt, was die App an die Geräte schickt
const keys = {}; const inbox = { jolina: [], gero: [] };
function makeKeys(name) { const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const auth = crypto.randomBytes(16); keys[name] = { ecdh, auth };
  return { endpoint: `https://127.0.0.1:8443/${name}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } }; }
const server = https.createServer({ ...selfSigned() }, (req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const name = req.url.slice(1); const k = keys[name];
    const plain = ece.decrypt(Buffer.concat(chunks), { version: 'aes128gcm', privateKey: k.ecdh, authSecret: k.auth });
    inbox[name].push({ ...JSON.parse(plain.toString()), urgency: req.headers.urgency, vapid: String(req.headers.authorization || '').startsWith('vapid t=') });
    res.writeHead(201); res.end(); });
}).listen(8443);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' };
  const J = await (await b.newContext(phone)).newPage();
  const G = await (await b.newContext(phone)).newPage();
  for (const [p, n] of [[J, 'J'], [G, 'G']]) { p.on('pageerror', e => console.log(n, 'pageerror', e.message)); p.on('console', m => m.type() === 'error' && !m.text().includes('favicon') && console.log(n, 'console', m.text())); }

  async function signup(p, name) {
    await p.goto(BASE + '/hund'); await p.waitForURL(/login/);
    await p.getByRole('tab', { name: 'Neues Konto' }).click();
    await p.fill('#name', name); await p.fill('#email', `${name.toLowerCase()}-${stamp}@example.de`); await p.fill('#password', 'geheim-123');
    await p.getByRole('button', { name: 'Konto anlegen' }).click(); await p.waitForURL(/\/start/);
  }

  // Jolina legt Haushalt und Bruno an
  await signup(J, 'Jolina');
  await J.screenshot({ path: OUT + '01-start.png' });
  await J.fill('#household', 'Familie Didszun'); await J.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await J.waitForURL(/hund\/neu/); await J.fill('#name', 'Bruno'); await J.getByRole('button', { name: 'Hund anlegen' }).click();
  await J.waitForURL(/hund\/[0-9a-f-]{36}$/); const dogUrl = J.url(); const HID = sql(`select household_id from dogs where id='${dogUrl.split('/').pop()}'`);
  await J.goto(BASE + '/familie'); const code = (await J.locator('span.tracking-\\[0\\.3em\\]').innerText()).trim();
  ok(/^[A-Z2-9]{8}$/.test(code), `Einladungscode ${code}`);

  // Gero tritt bei
  await signup(G, 'Gero'); await G.fill('#code', code); await G.getByRole('button', { name: 'Haushalt beitreten' }).click();
  await G.waitForURL(/hund\/[0-9a-f-]{36}$/); ok(G.url() === dogUrl, 'Gero landet bei Bruno');

  // Beide Geräte melden sich für Push an (Fake-Push-Dienst)
  for (const [p, n] of [[J, 'jolina'], [G, 'gero']]) {
    const st = await p.evaluate(async (s) => (await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) })).status, makeKeys(n));
    ok(st === 200, `Push-Gerät ${n} gespeichert`);
  }

  // NFC/QR-Link für „Bruno – Füttern“
  await J.goto(dogUrl + '/einstellungen'); await J.getByRole('button', { name: 'NFC/QR-Link erzeugen' }).first().click();
  const tagUrl = (await J.locator('p.break-all').first().innerText()).trim();
  ok(/\/t\/[A-Za-z0-9_-]{22}$/.test(tagUrl), `Token-URL ${tagUrl}`);
  await J.waitForSelector('[role=img] svg'); await J.screenshot({ path: OUT + '02-einstellungen.png', fullPage: true });

  // ---- Testfall 1: Jolina füttert, Gero (App offen) sieht es sofort, danach scannt er den Chip
  await G.goto(dogUrl); await G.getByText('noch nicht gefüttert').waitFor();
  await J.goto(dogUrl); await J.getByText('noch nicht gefüttert').waitFor();
  await J.screenshot({ path: OUT + '03-hund-offen.png', fullPage: true });
  await J.getByRole('button', { name: 'Jetzt als gefüttert markieren' }).click();
  await J.getByText(/Bruno wurde von Jolina um \d\d:\d\d Uhr gefüttert\./).waitFor();
  const jTime = (await J.getByText(/Bruno wurde von Jolina um/).innerText()).match(/\d\d:\d\d/)[0];
  ok(true, `Jolina sieht: Bruno wurde von Jolina um ${jTime} Uhr gefüttert.`);
  await J.screenshot({ path: OUT + '04-jolina-gefuettert.png', fullPage: true });
  const t0 = Date.now(); await G.getByText('Bruno wurde bereits gefüttert.').waitFor({ timeout: 8000 });
  ok(true, `Geros offene App aktualisiert sich live nach ${Date.now() - t0} ms`);
  await wait(800);
  ok(inbox.gero.length === 1 && inbox.jolina.length === 0, `Push: Gero ${inbox.gero.length}, Jolina (selbst) ${inbox.jolina.length}`);
  ok(inbox.gero[0]?.title === '🐶 Bruno wurde gefüttert' && inbox.gero[0]?.body === `Jolina · ${jTime} Uhr`, `Push an Gero: „${inbox.gero[0]?.title}“ / „${inbox.gero[0]?.body}“`);

  await G.goto(tagUrl); await G.waitForURL(/aufgabe\/.*via=tag/);
  await G.getByText('Bruno wurde bereits gefüttert.').waitFor();
  const body = await G.locator('main').innerText();
  ok(body.includes('Jolina') && body.includes(`${jTime} Uhr`) && body.includes('Du musst nichts mehr tun.'), 'Gero scannt Chip: bereits gefüttert · Jolina · Uhrzeit · nichts mehr tun');
  ok(await G.getByRole('button', { name: 'Jetzt als gefüttert markieren' }).count() === 0, 'Kein Füttern-Knopf nach dem Scan');
  await G.screenshot({ path: OUT + '05-gero-scan-bereits.png', fullPage: true });
  ok(sql(`select count(*) from task_completions where household_id='${HID}'`) === '1', 'Genau ein Eintrag in task_completions');

  // ---- Testfall 2: umgekehrt – Gero füttert zuerst, Jolina bekommt Push
  await J.goto(dogUrl); await J.getByRole('button', { name: /Rückgängig/ }).click();
  await G.getByRole('button', { name: 'Jetzt als gefüttert markieren' }).waitFor({ timeout: 8000 });
  ok(sql(`select count(*) from task_completions where household_id='${HID}'`) === '0', 'Jolina hat zurückgenommen, Gero sieht wieder den Knopf (live)');
  await G.getByRole('button', { name: 'Jetzt als gefüttert markieren' }).click();
  await G.getByText(/Bruno wurde von Gero um \d\d:\d\d Uhr gefüttert\./).waitFor();
  const gTime = (await G.getByText(/Bruno wurde von Gero um/).innerText()).match(/\d\d:\d\d/)[0];
  await G.screenshot({ path: OUT + '06-gero-gefuettert.png', fullPage: true });
  await wait(800);
  const last = inbox.jolina.at(-1);
  ok(last?.title === '🐶 Bruno wurde gefüttert' && last?.body === `Gero · ${gTime} Uhr` && last?.vapid && last?.urgency === 'high', `Push an Jolina: „${last?.title}“ / „${last?.body}“`);
  ok(inbox.gero.length === 1, 'Gero bekommt für seine eigene Fütterung keinen Push');
  ok(sql(`select source from task_completions where household_id='${HID}'`) === 'tag', 'Quelle der Fütterung: Chip');
  await J.getByText('Bruno wurde bereits gefüttert.').waitFor({ timeout: 8000 });
  await J.screenshot({ path: OUT + '07-jolina-sieht-gero.png', fullPage: true });

  // ---- Gleichzeitig antippen: nur ein Eintrag
  await G.getByRole('button', { name: /Rückgängig/ }).click(); await J.getByRole('button', { name: 'Jetzt als gefüttert markieren' }).waitFor({ timeout: 8000 });
  const taskId = sql(`select id from tasks where kind='feed' and household_id='${HID}'`);
  const hit = (p) => p.evaluate((id) => fetch(`/api/tasks/${id}/complete`, { method: 'POST', body: '{"source":"app"}' }).then(async r => [r.status, (await r.json()).status]), taskId);
  const [a, c] = await Promise.all([hit(J), hit(G)]);
  ok([a[1], c[1]].sort().join() === 'already,created' && sql(`select count(*) from task_completions where household_id='${HID}'`) === '1', `Gleichzeitig: ${a} / ${c} → 1 Eintrag`);

  // ---- Fremde Person mit dem Chip-Link
  const M = await (await b.newContext(phone)).newPage();
  await M.goto(tagUrl); await M.waitForURL(/login/);
  ok(!(await M.locator('body').innerText()).includes('Bruno'), 'Ohne Anmeldung verrät der Link nichts');
  await signup(M, 'Mallory'); await M.fill('#household', 'Fremd'); await M.getByRole('button', { name: 'Haushalt anlegen' }).click(); await M.waitForURL(/hund\/neu/);
  await M.goto(tagUrl); await M.getByText('Dieser Chip passt nicht').waitFor();
  ok(!(await M.locator('body').innerText()).includes('Bruno'), 'Fremder Haushalt: Chip passt nicht, keine Daten');
  const st = await M.evaluate((id) => fetch(`/api/tasks/${id}/complete`, { method: 'POST', body: '{}' }).then(r => r.status), taskId);
  ok(st === 404, `Fremder Haushalt kann nicht erledigen (HTTP ${st})`);

  await G.goto(dogUrl); await G.getByText('Verlauf').waitFor(); await G.screenshot({ path: OUT + '08-hund-verlauf.png', fullPage: true });
  await G.goto(BASE + '/familie'); await G.screenshot({ path: OUT + '09-familie.png', fullPage: true });
  await b.close(); server.close();
})().catch(e => { console.log('FEHLER', e.message); process.exit(1); });
