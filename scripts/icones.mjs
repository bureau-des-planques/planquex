#!/usr/bin/env node
/**
 * Génère les PNG du manifeste à partir de `public/icon-512.svg`.
 *
 * Chromium n'utilise pas un SVG comme icône d'application installée (les
 * plateformes veulent un raster) : sans PNG, l'appareil fabrique une vignette
 * générique — constaté le 21/10/2026 sur l'app installée.
 *
 * Rendu par le Chromium de `ms-playwright`, déjà présent pour `npm run capturer` :
 * aucune dépendance n'est ajoutée pour trois images.
 *
 * Usage : `npm run icones` après toute retouche de `public/icon-512.svg`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(join(root, 'public/icon-512.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const executablePath =
  process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

const BACKGROUND = '#0b1220';

/** Une cible : fichier, taille, et part du carré occupée par l'illustration. */
const TARGETS = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  // Maskable : le système découpe un cercle de 80 % de la largeur, donc
  // l'illustration doit tenir dedans, sinon elle est rognée.
  ['icon-maskable-512.png', 512, 0.78]
];

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

try {
  for (const [name, size, scale] of TARGETS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * scale);
    const margin = Math.round((size - inner) / 2);
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:${BACKGROUND};overflow:hidden">` +
        `<img src="${dataUrl}" width="${inner}" height="${inner}" style="display:block;margin:${margin}px" />` +
        '</body></html>'
    );
    const bytes = await page.screenshot({ omitBackground: false });
    writeFileSync(join(root, 'public', name), bytes);
    await page.close();
    console.log(`✔ public/${name} — ${size}×${size}, illustration à ${Math.round(scale * 100)} %`);
  }
} finally {
  await browser.close();
}
