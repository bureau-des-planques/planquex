#!/usr/bin/env node
/**
 * Captures d'écran — ticket #53.
 *
 * `AGENTS.md` §6 et §8.4 disent qu'un écran ne se déclare **rendu** que par
 * **capture** ou inspection du navigateur : ce script rend ce geste reproductible.
 * Chromium est piloté par `playwright-core`, une image par page, et la commande
 * **échoue** si une page lève une erreur de console ou une `pageerror` — une capture
 * ne vaut donc que pour une page qui n'a rien cassé.
 *
 * Usage :
 *   npm run build && npm run capturer
 *   BASE_URL=http://localhost:5178 npm run capturer
 *   CHROME_PATH=/chemin/vers/chrome npm run capturer
 *
 * Variables d'environnement :
 *   CHROME_PATH  binaire Chromium (défaut : cache de `ms-playwright`)
 *   BASE_URL     serveur déjà lancé ; le script n'en démarre alors aucun
 *   PORT         port du `vite preview` qu'il démarre lui-même (défaut : 4180)
 *
 * Le dossier de sortie `captures/` est ignoré par git : ces images sont une preuve
 * de travail, pas un livrable. Les preuves citées vivent dans `docs/preuves/`, datées.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'captures');
const distIndex = join(root, 'dist/index.html');

/** Le binaire du cache `ms-playwright`, surchargeable pour une autre machine (comme le legacy). */
const executablePath =
  process.env.CHROME_PATH ??
  join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

/** Une page par route de `src/App.tsx`, dans l'ordre de la barre de navigation. */
const PAGES = [
  ['accueil', '/'],
  ['parc', '/collection'],
  ['chariot', '/deck'],
  ['combat', '/battle'],
  ['reglages', '/settings'],
  // Le mur de la Boîte à idées (#129) : une page hors barre de navigation, menée
  // par la bulle — donc capturée en dernier.
  ['idees', '/idees']
];

const VIEWPORT = { width: 360, height: 800 };
const PORT = Number(process.env.PORT ?? 4180);

const problems = [];

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!existsSync(executablePath)) {
  stop(`Chromium introuvable : ${executablePath}\n  Renseigne CHROME_PATH.`);
}

let server = null;
if (!process.env.BASE_URL) {
  if (!existsSync(distIndex)) {
    stop('dist/index.html absent : lance `npm run build` avant `npm run capturer`.');
  }
  server = await preview({
    root,
    preview: { port: PORT, strictPort: true },
    logLevel: 'error'
  });
}

const base = process.env.BASE_URL ?? `http://localhost:${PORT}`;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

try {
  for (const [slug, route] of PAGES) {
    const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${route} · console : ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`${route} · pageerror : ${error.message}`));

    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(outDir, `${slug}.png`), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  await server?.close();
}

if (problems.length) {
  console.error('✖ Pages en erreur :');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`✔ ${PAGES.length} captures dans captures/ (${base})`);
