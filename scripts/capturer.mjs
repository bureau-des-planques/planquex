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
 * Depuis le ticket #150, un contexte **neuf** est une **première visite** : la
 * Journée d'intégration s'y montre, et recouvrait donc chaque page photographiée.
 * Les pages sont désormais **amorcées** — `tutorielVu: true` écrit dans le store
 * **avant** la navigation —, et la première visite garde **une** capture à part
 * (`premiere-visite.png`), nue. C'est l'exigence (4) de D-060 qui tient à ce prix :
 * une capture doit montrer l'écran qu'elle nomme.
 *
 * Usage :
 *   npm run build && npm run capturer
 *   BASE_URL=http://localhost:5178 npm run capturer
 *   CHROME_PATH=/chemin/vers/chrome npm run capturer
 *   node scripts/capturer.mjs --plan   (imprime l'état amorcé et le plan, sans navigateur)
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

/**
 * La **première visite** (#150) : le seul écran photographié **sans** amorçage.
 * Elle partage la route de l'accueil, mais la barre de navigation n'a pas à la
 * connaître : `PAGES` reste « une page par route », et la visite s'ajoute à part.
 */
const PREMIERE_VISITE = ['premiere-visite', '/'];

/** La clé du store persisté — `STORAGE_KEY`, `src/store/useStore.ts`. */
const STORAGE_KEY = 'bureau-des-planques-v1';

/**
 * L'amorçage du store (#150) : le blob que `persist` relit à l'hydratation, avec
 * `tutorielVu: true`. `version` est omise **à dessein** : `persist` ne migre que sur
 * une version **numérique différente** de la sienne (zustand, `middleware.js`), et ce
 * blob ne porte qu'un booléen — aucune forme à migrer, donc aucune version à recopier.
 */
function amorcageStore(origin) {
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: STORAGE_KEY, value: JSON.stringify({ state: { tutorielVu: true } }) }
        ]
      }
    ]
  };
}

const VIEWPORT = { width: 360, height: 800 };
const PORT = Number(process.env.PORT ?? 4180);
const base = process.env.BASE_URL ?? `http://localhost:${PORT}`;
/** L'origine où `storageState` dépose le store : Playwright range le `localStorage` par origine. */
let origine = '';
try {
  origine = new URL(base).origin;
} catch {
  // `BASE_URL=/` arrive sans qu'on le veuille (Vite l'exporte, vitest aussi) : le dire
  // vaut mieux que laisser remonter `ERR_INVALID_URL`.
  stop(`BASE_URL n'est pas une URL absolue : « ${base} ».`);
}

/** Les pages amorcées, puis la première visite — nue, et capturée à part. */
const shots = [
  ...PAGES.map(([slug, route]) => ({ slug, route, amorce: true })),
  { slug: PREMIERE_VISITE[0], route: PREMIERE_VISITE[1], amorce: false }
];

const problems = [];

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

// Sonde de `scripts/capturer.test.ts` : imprime le **plan** réel des captures —
// l'état amorcé et la liste des couples (slug, route, amorce) — puis sort, sans
// navigateur ni serveur. La garde lit donc le vrai plan, elle ne cherche pas une
// chaîne dans ce fichier.
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ amorcage: amorcageStore(origine), captures: shots }));
  process.exit(0);
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

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

try {
  for (const { slug, route, amorce } of shots) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      isMobile: true,
      // Écrit avant la navigation : le store relit `tutorielVu: true` à l'hydratation,
      // donc les pages sont photographiées telles qu'un invité les voit après la visite.
      storageState: amorce ? amorcageStore(origine) : undefined
    });

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

console.log(`✔ ${shots.length} captures dans captures/ (${base}) — dont la première visite`);
