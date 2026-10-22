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
 * Depuis le ticket #153, la capture tient enfin dans une image qu'on **regarde** : elle
 * est prise à la taille que D-060 nomme (**420 × 900**) et sur la **fenêtre**, jamais
 * sur la page entière — la Collection sortait en 141 460 px de haut, le Deck en 80 064.
 * Ce qu'on perd, et pourquoi c'est le bon compromis, est écrit sur `PLEINE_PAGE`.
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
  ['collection', '/collection'],
  ['deck', '/deck'],
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

/** La route du combat : la seule photographiée à son arrivée, pas remise à zéro (#170). */
const ROUTE_COMBAT = '/battle';

/**
 * Les instants figés qui fixent la graine d'une partie (`createBattle`, seed = `Date.now()`) :
 * plusieurs donnes, pour que la garde de rendu ne se fie pas à une seule main (#170).
 * Le premier sert à la capture `combat.png`.
 */
const INSTANTS_COMBAT = [
  Date.UTC(2026, 9, 22, 9, 0),
  Date.UTC(2026, 9, 22, 14, 30),
  Date.UTC(2026, 9, 22, 20, 5),
  Date.UTC(2026, 9, 23, 7, 45)
];

/** Attend le tour du joueur (« à toi ») — l'IA joue seule — puis le défilement d'arrivée (smooth). */
async function arriveeAuTourDuJoueur(page) {
  await page.waitForFunction(() => document.querySelector('.battle__head')?.textContent.includes('à toi'), null, {
    timeout: 60000
  });
  await page.waitForTimeout(1200);
}

/**
 * La **main est-elle visible sans défiler** ? (#170) Elle l'est si son bord bas tient
 * au-dessus de la barre de navigation fixe (qui masque le bas de l'écran), et si son
 * bord haut est dans l'écran. Lu dans le navigateur, à l'arrivée sur le combat.
 */
function mesureMain() {
  const main = document.querySelector('.hand')?.getBoundingClientRect();
  const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  const bas = Math.round(nav ? nav.top : window.innerHeight);
  return {
    mainHaut: main ? Math.round(main.top) : null,
    mainBas: main ? Math.round(main.bottom) : null,
    bas,
    visible: !!main && main.top >= 0 && main.bottom <= bas
  };
}

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

/**
 * La **fenêtre d'un téléphone**, telle que le critère (4) de **D-060** la nomme :
 * « on regarde les captures à la taille d'un téléphone (420×900) ». C'est un acte
 * daté, et `AGENTS.md` §2 met les actes au-dessus du code : l'écart
 * `360 × 800` du script était un bug, donc on suit la décision (#153).
 */
const VIEWPORT = { width: 420, height: 900 };

/**
 * Capture de la **fenêtre**, jamais de la page entière (#153).
 *
 * `fullPage: true` photographiait tout le document : la Collection mesurait ainsi
 * **141 460 px de haut** et le Deck **80 064** (mesuré le 22/10/2026, à 360 de
 * large). Une capture de 141 000 px ne se regarde pas, et D-060 dit justement qu'on
 * **regarde** les captures : une capture sert à juger **l'écran qu'un invité voit**,
 * et cet écran est la fenêtre, pas un rouleau.
 *
 * Ce qu'on **gagne** : une image par page, toujours à 420 × 900, qu'on ouvre et qu'on
 * juge ; c'est la taille que nomme D-060, donc l'écart doc/code ferme des deux côtés.
 * Ce qu'on **perd** : ce qui vit sous la ligne de flottaison — le bas de la Collection, les
 * rangées du Deck, le pied de page. Ce contenu se regarde en faisant défiler dans
 * le navigateur ; il ne se jugeait pas dans un rouleau de 141 000 px. Si une planche
 * de contrôle des grilles devient nécessaire, ce sera **un autre artefact**, avec sa
 * commande : la capture d'écran reste « ce que voit un invité ».
 */
const PLEINE_PAGE = false;
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
  // La **taille** et le **cadrage** sont dans le plan (#153) : la garde les lit ici,
  // au lieu de chercher des nombres dans le source, et une régression les fait tomber.
  console.log(
    JSON.stringify({
      amorcage: amorcageStore(origine),
      capture: { viewport: VIEWPORT, pleinePage: PLEINE_PAGE },
      captures: shots
    })
  );
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

    if (route === ROUTE_COMBAT) {
      // Le combat se photographie **à l'arrivée**, au tour du joueur (#170) : la graine de
      // la partie vient de l'horloge, donc on la fige (`page.clock`) pour une capture
      // reproductible. On ne remet pas la page à zéro : ce qu'on juge, c'est ce que voit
      // l'invité sans toucher.
      await page.clock.setFixedTime(INSTANTS_COMBAT[0]);
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await arriveeAuTourDuJoueur(page);
      const main = await page.evaluate(mesureMain);
      console.log(`combat · ${slug} · ${JSON.stringify(main)}`);
      if (!main.visible) {
        problems.push(
          `${route} · la main n'est pas visible sans défiler (${VIEWPORT.width} × ${VIEWPORT.height}) : ` +
            `bas de la main à ${main.mainBas} px, barre de navigation à ${main.bas} px`
        );
      }
    } else {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(450);
    }
    await page.screenshot({ path: join(outDir, `${slug}.png`), fullPage: PLEINE_PAGE });
    await context.close();
  }

  // La garde de rendu (#170) ne se fie pas à **une** donne : la graine change avec
  // l'heure, donc la main change de hauteur. On mesure sur chaque instant figé.
  for (const instant of INSTANTS_COMBAT.slice(1)) {
    const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, storageState: amorcageStore(origine) });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`${ROUTE_COMBAT} · pageerror : ${error.message}`));
    await page.clock.setFixedTime(instant);
    await page.goto(`${base}${ROUTE_COMBAT}`, { waitUntil: 'networkidle' });
    await arriveeAuTourDuJoueur(page);
    const main = await page.evaluate(mesureMain);
    console.log(`combat · ${new Date(instant).toISOString()} · ${JSON.stringify(main)}`);
    if (!main.visible) {
      problems.push(
        `${ROUTE_COMBAT} · la main n'est pas visible sans défiler (${VIEWPORT.width} × ${VIEWPORT.height}, ` +
          `${new Date(instant).toISOString()}) : bas de la main à ${main.mainBas} px, barre de navigation à ${main.bas} px`
      );
    }
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
