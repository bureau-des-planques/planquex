// Preuve D-205 (4) (#788) : la ligne d'aide du geste, mesurée à 420 × 900 (nombre de lignes, hauteur).
// Usage : npm run build && node docs/preuves/journee-2026-11-11/mesure-aide.mjs "$PWD" <capture.png>
import { homedir } from 'node:os';
import { join } from 'node:path';
const ROOT = process.argv[2];
const { chromium } = await import(`${ROOT}/node_modules/playwright-core/index.mjs`);
const { preview } = await import(`${ROOT}/node_modules/vite/dist/node/index.js`);
const { etatInitialJournee } = await import(`${ROOT}/scripts/preuves/parcours-journee.mjs`);
const srv = await preview({ root: ROOT, preview: { port: 4197, strictPort: true } });
const origine = 'http://localhost:4197';
const nav = await chromium.launch({
  executablePath: join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'),
  args: ['--no-sandbox']
});
const ctx = await nav.newContext({
  viewport: { width: 420, height: 900 },
  storageState: etatInitialJournee({ origine, version: 19 })
});
const page = await ctx.newPage();
await page.goto(origine + '/');
await page.waitForSelector('.journee__aide');
await page.evaluate(() => document.fonts.ready);
const mesure = () =>
  page.evaluate(() => {
    const p = document.querySelector('.journee__aide');
    const r = document.createRange();
    r.selectNodeContents(p);
    const lignes = new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
    const box = p.getBoundingClientRect();
    const cs = getComputedStyle(p);
    return {
      texte: p.textContent,
      lignes,
      hauteur: box.height,
      largeurBoite: box.width,
      lineHeightPx: cs.lineHeight,
      fontSize: cs.fontSize,
      viewport: innerWidth + 'x' + innerHeight
    };
  });
console.log('NOUVEAU', JSON.stringify(await mesure()));
await page.waitForTimeout(3500);
await page.screenshot({ path: process.argv[3] });
for (const t of ['Joue le combat, la suite s’ouvrira']) {
  await page.evaluate((x) => {
    document.querySelector('.journee__aide').textContent = x;
  }, t);
  const m = await mesure();
  console.log(m.lignes, m.hauteur, t.length, t);
}
await nav.close();
await srv.close();
