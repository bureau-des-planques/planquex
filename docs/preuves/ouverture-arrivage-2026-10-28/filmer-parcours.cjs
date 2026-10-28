// Filme l'ouverture d'un Arrivage (#283) : BASE_URL=http://localhost:5178/ node <ce fichier> <dossier> [largeur] [hauteur]
const { chromium } = require('playwright');
const OUT = process.argv[2];
const W = +(process.argv[3] || 390), H = +(process.argv[4] || 844);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => localStorage.setItem('bureau-des-planques-v1', JSON.stringify({ state: { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false } })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(process.env.BASE_URL ?? 'http://localhost:5178/');
  await page.getByRole('button', { name: /Ouvrir un Arrivage/ }).click();
  await page.waitForSelector('[data-zone]');
  let n = 0;
  const shot = async (nom) => page.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-${nom}.png` });
  await page.waitForTimeout(300); await shot('arrivee');
  await page.waitForTimeout(1300); await shot('ferme');
  const box = await page.locator('[data-zone]').boundingBox();
  const y = box.y + box.height * 44 / 500;
  await page.mouse.move(box.x + 8, y); await page.mouse.down();
  const course = box.width * 0.7 / 0.9 * 1.0;
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(box.x + 8 + course * i / 20, y + Math.sin(i) * 3);
    await page.waitForTimeout(16);
    if (i === 8 || i === 15) await shot('dechirure' + i);
  }
  await page.mouse.up();
  for (const t of [60, 180, 400, 750]) { await page.waitForTimeout(t === 60 ? 60 : 160); await shot('ouverture' + t); }
  await page.waitForTimeout(700);
  for (let c = 0; c < 5; c++) {
    await page.waitForTimeout(c === 4 ? 1500 : 700);
    await shot('carte' + c);
    const carte = page.locator('.ouverture__carte[data-face="recto"]').last();
    const b = await page.locator('.ouverture__scene').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.waitForTimeout(1400); await shot('recap');
  const cartes = page.locator('.ouverture__carte');
  const bb = await cartes.nth(4).boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(800); await shot('zoom');
  console.log('erreurs:', JSON.stringify(errs));
  await browser.close();
})();
