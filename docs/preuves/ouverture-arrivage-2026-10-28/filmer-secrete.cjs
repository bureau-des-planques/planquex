// Ouvre des Arrivages jusqu'à une carte étoilée, puis filme sa révélation (#283) : BASE_URL=… node <ce fichier> <dossier>
const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x','1'); localStorage.setItem('bureau-des-planques-v1', JSON.stringify({ state: { tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false } })); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(process.env.BASE_URL ?? 'http://localhost:5178/');
  let essais = 0;
  for (;;) {
    essais++;
    await page.getByRole('button', { name: /Ouvrir un Arrivage/ }).click();
    await page.waitForSelector('[data-zone]');
    if (await page.locator('.ouverture[data-palier="secrete"]').count()) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (essais > 40) throw new Error('pas de secrète');
  }
  let n = 0;
  const shot = async (nom) => page.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-${nom}.png` });
  await page.waitForTimeout(1200); await shot('ferme-lueur');
  // Appui à côté des pointillés : le rappel.
  const box = await page.locator('[data-zone]').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.waitForTimeout(350); await shot('rappel');
  await page.getByRole('button', { name: /^Ouvrir$/ }).click();
  await page.waitForTimeout(350); await shot('ouvrir-auto');
  await page.waitForTimeout(450); await shot('envol');
  await page.waitForTimeout(250); await shot('sortie');
  await page.waitForTimeout(1200);
  for (let c = 0; c < 4; c++) { await page.keyboard.press('Enter'); await page.waitForTimeout(700); }
  for (const t of [150, 300, 300, 300, 250, 250, 300, 400]) { await page.waitForTimeout(t); await shot('secrete'); }
  console.log('essais', essais, 'erreurs', JSON.stringify(errs));
  await browser.close();
})();
