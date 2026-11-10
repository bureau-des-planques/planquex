// Preuve #497 : Réglages et Collection APRÈS synchro (faux compte, aucun réseau réel).
// Usage : VITE_SUPABASE_URL=https://exemple.test VITE_SUPABASE_ANON_KEY=sb_publishable_test \
//           npx vite build --outDir /tmp/dist-synchro --emptyOutDir
//         node docs/preuves/synchro-2026-11-11/capturer-synchro.mjs /tmp/dist-synchro <dossier-de-sortie>
// (depuis la racine du dépôt ; CHROME_PATH surcharge le binaire de ms-playwright).
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright-core');

const [dist, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};
const serveur = createServer((req, res) => {
  let f = join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => serveur.listen(4191, r));
const base = 'http://localhost:4191';

const ID = '11111111-1111-4111-8111-111111111111';
const user = {
  id: ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'testeur@exemple.test',
  is_anonymous: false,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-11-01T00:00:00Z'
};
const exp = Math.floor(Date.now() / 1000) + 36000;
const session = {
  access_token: 'a.b.c',
  refresh_token: 'r',
  token_type: 'bearer',
  expires_in: 36000,
  expires_at: exp,
  user
};
const compte = {
  id: ID,
  courriel: user.email,
  etat: 'approuve',
  raison: '',
  administrateur: false,
  created_at: '2026-11-01T00:00:00Z'
};

const ids = {
  collection: [
    { id: 'sse-infirmier-site', q: 1 },
    { id: 'sse-infirmiere-travail', q: 2 },
    { id: 'sse-medecin-travail', q: 3 },
    { id: 'sse-preventeur', q: 1 },
    { id: 'sse-ergonome', q: 2 },
    { id: 'sse-responsable-sse', q: 3 },
    { id: 'sse-kine-travail', q: 1 },
    { id: 'sse-sophrologue', q: 2 },
    { id: 'sse-medecin-chef', q: 3 },
    { id: 'sse-secouriste', q: 1 },
    { id: 'sse-chef-secours', q: 2 },
    { id: 'sse-agent-entretien', q: 3 },
    { id: 'sse-responsable-hygiene', q: 1 },
    { id: 'sse-psychologue', q: 2 },
    { id: 'sse-psychiatre', q: 3 },
    { id: 'sse-dieteticien', q: 1 },
    { id: 'sse-nutritionniste', q: 2 },
    { id: 'sse-interne', q: 3 },
    { id: 'sse-infirmier-volant', q: 1 },
    { id: 'sse-pompier-volontaire', q: 2 },
    { id: 'sse-medecin-sport', q: 3 },
    { id: 'sse-assistante-sociale', q: 1 },
    { id: 'sse-controleur-securite', q: 2 },
    { id: 'sse-responsable-securite', q: 3 },
    { id: 'sse-brancardier', q: 1 },
    { id: 'sse-medecin-legiste', q: 2 },
    { id: 'sse-medecin-chef-ex', q: 3 },
    { id: 'sse-responsable-sse-ex', q: 1 },
    { id: 'management-jeune-manager', q: 2 },
    { id: 'management-chef-de-projet', q: 3 },
    { id: 'management-technico-commercial', q: 1 },
    { id: 'management-assistant-manager', q: 2 },
    { id: 'management-superviseur', q: 3 },
    { id: 'management-animateur-equipe', q: 1 },
    { id: 'management-chargee-clientele', q: 2 },
    { id: 'management-planificateur', q: 3 },
    { id: 'management-controleur-gestion', q: 1 },
    { id: 'management-chef-equipe', q: 2 },
    { id: 'management-charge-affaires', q: 3 },
    { id: 'management-manager-proximite', q: 1 }
  ],
  deck: [
    'sse-infirmier-site',
    'sse-preventeur',
    'sse-kine-travail',
    'sse-secouriste',
    'sse-infirmiere-travail',
    'sse-medecin-travail',
    'sse-ergonome',
    'sse-responsable-sse',
    'sse-sophrologue',
    'sse-medecin-chef'
  ]
};
const collection = ids.collection.map((c) => ({ carte_id: c.id, quantite: c.q }));
const deck = ids.deck.map((id, rang) => ({ carte_id: id, quantite: 1, rang }));

const erreurs = [];
const appels = [];
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`
});
for (const [nom, w, h] of [
  ['420x900', 420, 900],
  ['360x640', 360, 640]
]) {
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  await context.addInitScript(
    ([cle, s, k, st]) => {
      localStorage.setItem(cle, JSON.stringify(s));
      localStorage.setItem(k, JSON.stringify(st));
    },
    [
      'sb-exemple-auth-token',
      session,
      'bureau-des-planques-v1',
      {
        state: {
          tutorielVu: true,
          pasAPasCombatVu: true,
          name: 'Camille',
          deckImporte: true,
          owned: { [ids.collection[0].id]: 1 }
        },
        version: 18
      }
    ]
  );
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`${nom} console: ${m.text()}`);
  });
  page.on('pageerror', (e) => erreurs.push(`${nom} pageerror: ${e.message}`));
  await page.route('https://exemple.test/**', (route) => {
    const url = route.request().url();
    appels.push(`${route.request().method()} ${url.replace('https://exemple.test', '')}`);
    const json = (b, s = 200) =>
      route.fulfill({
        status: s,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify(b)
      });
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*'
        }
      });
    if (url.includes('/auth/v1/user')) return json(user);
    if (url.includes('/rest/v1/comptes')) return json([compte]);
    if (url.includes('/rest/v1/collection')) return json(collection);
    if (url.includes('/rest/v1/deck')) return json(deck);
    if (url.includes('/rpc/')) return json(deck.map((d) => ({ carte: d.carte_id, quantite: 1, rang: d.rang })));
    return json([]);
  });
  await page.goto(`${base}/collection`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    (n) =>
      JSON.parse(localStorage.getItem('bureau-des-planques-v1')).state.owned &&
      Object.keys(JSON.parse(localStorage.getItem('bureau-des-planques-v1')).state.owned).length >= n,
    ids.collection.length,
    { timeout: 10000 }
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, `collection-apres-synchro-${nom}.png`) });

  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Créer ma sauvegarde/ }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Créer ma sauvegarde/ }).click();
  await page.getByText(/viennent de ton compte/).waitFor({ timeout: 10000 });
  const hors = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hors) erreurs.push(`${nom} débordement horizontal sur /settings`);
  await page.locator('#reglages-sauvegarde').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -70));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `reglages-sauvegarde-texte-${nom}.png`) });
  await page
    .locator('[aria-labelledby=reglages-sauvegarde] [role=status]')
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `reglages-sauvegarde-geste-${nom}.png`) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `reglages-haut-${nom}.png`) });
  await context.close();
}
await browser.close();
serveur.close();
console.log(JSON.stringify({ erreurs, appels: [...new Set(appels)] }, null, 1));
process.exit(erreurs.length ? 1 : 0);
