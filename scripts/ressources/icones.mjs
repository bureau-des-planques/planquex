#!/usr/bin/env node
/**
 * Génère les icônes de l'application à partir des deux maîtres de la marque (D-188) :
 *
 * - `design/logo/app/icone-acier.jpg` — engrenage d'acier et tasse : **l'application
 *   installée** (PNG 192, 512, 512 *maskable*, et l'icône d'écran d'accueil iPhone 180) ;
 * - `design/logo/app/icone-plat.jpg` — la même idée en deux tons, sans relief : **les
 *   petites tailles** (favicon 32 et 16), où l'acier devient flou.
 *
 * Chromium n'utilise pas un SVG comme icône d'application installée (les plateformes
 * veulent un raster) : sans PNG, l'appareil fabrique une vignette générique — constaté le
 * 21/10/2026 sur l'app installée (D-054).
 *
 * Rendu par le Chromium de `ms-playwright`, déjà présent pour `npm run capturer` : aucune
 * dépendance n'est ajoutée pour quelques images.
 *
 * Usage : `npm run icones` après tout changement d'un maître.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../..', import.meta.url));

const executablePath =
  process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

/**
 * Un maître : l'image, sa taille, la couleur de son fond uni, et la boîte du motif
 * (centre et côté, en pixels du maître) — mesurée une fois sur le fond, pour que le
 * cadrage ne dépende pas de la marge que le générateur d'images a laissée.
 */
const MAITRES = {
  acier: { fichier: 'design/logo/app/icone-acier.jpg', cote: 1024, fond: '#141823', cx: 512, cy: 517, motif: 756 },
  plat: { fichier: 'design/logo/app/icone-plat.jpg', cote: 1024, fond: '#1a1e29', cx: 512, cy: 512, motif: 812 }
};

/**
 * Une cible : fichier de `public/`, maître, taille, et part du carré occupée par le motif.
 * Maskable : le système découpe un cercle de 80 % de la largeur, le motif doit tenir dedans.
 */
const CIBLES = [
  ['icon-192.png', 'acier', 192, 0.74],
  ['icon-512.png', 'acier', 512, 0.74],
  ['icon-maskable-512.png', 'acier', 512, 0.64],
  ['apple-touch-icon.png', 'acier', 180, 0.74],
  ['favicon-32.png', 'plat', 32, 0.92],
  ['favicon-16.png', 'plat', 16, 0.92]
];

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

try {
  for (const [nom, cle, taille, part] of CIBLES) {
    const m = MAITRES[cle];
    const dataUrl = `data:image/jpeg;base64,${readFileSync(join(root, m.fichier)).toString('base64')}`;
    // Échelle qui donne au motif `part` du carré, puis décalage qui le centre.
    const k = (taille * part) / m.motif;
    const fond = `${m.cote * k}px`;
    const x = taille / 2 - m.cx * k;
    const y = taille / 2 - m.cy * k;
    const page = await browser.newPage({ viewport: { width: taille, height: taille } });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${taille}px;height:${taille}px;overflow:hidden;` +
        `background:${m.fond} url(${dataUrl}) no-repeat ${x}px ${y}px / ${fond} ${fond}"></body></html>`
    );
    writeFileSync(join(root, 'public', nom), await page.screenshot({ omitBackground: false }));
    await page.close();
    console.log(`✔ public/${nom} — ${taille}×${taille}, ${cle}, motif à ${Math.round(part * 100)} %`);
  }
} finally {
  await browser.close();
}
