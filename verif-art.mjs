// Inspection du navigateur : preuve que le repli sur l'aplat fonctionne (AGENTS.md §6).
// Non commité : fichier temporaire de vérification.
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';

const exe =
  process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const base = process.env.BASE_URL ?? 'http://localhost:4181';

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

for (const route of ['/collection', '/deck']) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  const report = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.card__art')];
    const classify = (el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg.includes('/design/illustrations/')) return 'illustration';
      if (bg.includes('gradient')) return 'aplat';
      if (bg === 'none') return 'PERDU';
      return 'autre:' + bg.slice(0, 40);
    };
    const counts = {};
    for (const el of els) counts[classify(el)] = (counts[classify(el)] ?? 0) + 1;
    return { total: els.length, counts };
  });
  console.log(route, JSON.stringify(report));
}

console.log('erreurs console :', errors.length ? errors : 'aucune');
await browser.close();