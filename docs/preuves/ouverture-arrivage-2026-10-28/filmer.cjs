// Filme l'ouverture d'un Arrivage (#283) : BASE_URL=… node <ce fichier> <dossier> [largeur] [hauteur] [--secrete]
const { chromium } = require('playwright');
const OUT = process.argv[2];
const W = +(process.argv[3] || 390), H = +(process.argv[4] || 844);
const SECRETE = process.argv.includes('--secrete');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('bureau-des-planques-v1', JSON.stringify({ state: { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false } })); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(process.env.BASE_URL ?? 'http://localhost:5178/');
  for (let essai = 0; ; essai++) {
    await page.getByRole('button', { name: /Ouvrir un Arrivage/ }).click();
    await page.waitForSelector('[data-zone]');
    if (!SECRETE || (await page.locator('.ouverture[data-palier="secrete"]').count())) break;
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    if (essai > 40) throw new Error('pas de secrète');
  }
  let n = 0;
  const shot = async (nom) => page.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-${nom}.png` });
  await page.waitForTimeout(1500); await shot('ferme');
  const box = await page.locator('[data-zone]').boundingBox();
  const y = box.y + box.height * 44 / 500;
  await page.mouse.move(box.x + 8, y); await page.mouse.down();
  const course = box.width * 0.7 / 0.9;
  for (let i = 1; i <= 20; i++) { await page.mouse.move(box.x + 8 + course * i / 20, y); await page.waitForTimeout(16); if (i === 14) await shot('dechirure'); }
  await page.mouse.up();
  for (const t of [250, 450, 600, 700, 900]) { await page.waitForTimeout(t); await shot('envol'); }
  await page.waitForTimeout(600); await shot('etalees');
  const paliers = await page.locator('.ouverture__carte').evaluateAll((els) => els.map((e) => e.dataset.palier));
  const ordre = paliers.map((p, i) => [p, i]).sort((a, b) => ['simple', 'rare', 'brillante', 'secrete'].indexOf(a[0]) - ['simple', 'rare', 'brillante', 'secrete'].indexOf(b[0])).map((x) => x[1]);
  for (const i of ordre) {
    const p = paliers[i];
    await page.locator('.ouverture__carte').nth(i).click();
    if (p === 'simple') { await page.waitForTimeout(700); await shot('simple'); continue; }
    await page.waitForTimeout(500); await shot(p + '-tension');
    await page.waitForTimeout({ rare: 500, brillante: 1000, secrete: 1500 }[p]); await shot(p + '-eclat');
    await page.waitForTimeout(700); await shot(p + '-annonce');
    await page.waitForTimeout(2600);
  }
  await page.waitForTimeout(800); await shot('retournees');
  await page.locator('.ouverture__carte').nth(ordre[ordre.length - 1]).click();
  await page.waitForTimeout(450); await shot('fiche-pirouette');
  await page.waitForTimeout(800); await shot('fiche');
  console.log('erreurs:', JSON.stringify(errs), 'paliers', paliers.join(','));
  await browser.close();
})();
