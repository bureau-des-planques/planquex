// Preuve D-205 (2) (#805) : l'onglet Deck est atteignable sous le panneau, et le clic mène au combat.
// Usage : npm run build && node docs/preuves/journee-2026-11-11/mesure-onglet.mjs "$PWD" <dossier de sortie>
import { homedir } from 'node:os';
import { join } from 'node:path';
const ROOT = process.argv[2];
const OUT = process.argv[3];
const { chromium } = await import(`${ROOT}/node_modules/playwright-core/index.mjs`);
const { preview } = await import(`${ROOT}/node_modules/vite/dist/node/index.js`);
const srv = await preview({ root: ROOT, preview: { port: 4198, strictPort: true } });
const origine = 'http://localhost:4198';
const nav = await chromium.launch({
  executablePath: join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'),
  args: ['--no-sandbox']
});
for (const [w, h] of [
  [420, 900],
  [1280, 800]
]) {
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: origine,
        localStorage: [
          {
            name: 'bureau-des-planques-v1',
            value: JSON.stringify({ state: { tutorielVu: false, packsOpened: 1 }, version: 19 })
          }
        ]
      }
    ]
  };
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, storageState });
  const page = await ctx.newPage();
  await page.goto(origine + '/collection');
  await page.waitForSelector('[data-journee-cible="onglet-deck"]', { timeout: 15000 });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => {
    const tab = document.querySelector('[data-journee-cible="onglet-deck"]');
    const r = tab.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const panneau = document.querySelector('[data-journee-panneau]').getBoundingClientRect();
    const cartes = document.querySelector('.journee__cartes');
    const cr = cartes?.getBoundingClientRect();
    const voile = document.querySelector('.journee__voile');
    return {
      chemin: location.pathname,
      onglet: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      elementAuCentre: top?.tagName + '.' + (top?.className || '').toString().slice(0, 40),
      auCentreEstLOnglet: tab.contains(top),
      panneau: { top: Math.round(panneau.top), bottom: Math.round(panneau.bottom) },
      cartesCount: cartes ? cartes.children.length : 0,
      cartesRect: cr
        ? {
            top: Math.round(cr.top),
            bottom: Math.round(cr.bottom),
            left: Math.round(cr.left),
            right: Math.round(cr.right)
          }
        : null,
      cartesInert: cartes ? !!cartes.closest('[inert]') : null,
      voileCible: voile?.dataset.cible,
      scrollY: Math.round(scrollY)
    };
  });
  console.log(`${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/collection-${w}x${h}.png` });
  await page.click('[data-journee-cible="onglet-deck"]', { timeout: 5000 });
  await page.waitForURL('**/battle**', { timeout: 10000 }).catch(() => {});
  console.log(`${w}x${h} apres clic ->`, new URL(page.url()).pathname);
  await ctx.close();
}
await nav.close();
await srv.close();
