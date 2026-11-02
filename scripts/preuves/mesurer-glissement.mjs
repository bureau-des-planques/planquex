#!/usr/bin/env node
/**
 * Mesure le coût d'un glissement le long des pointillés de l'ouverture d'un Arrivage (#577).
 *
 * Usage : `npm run build && npm run mesurer:glissement`.
 * Chromium tourne en headless. Le script sert `dist/` lui-même ; `BASE_URL` permet d'utiliser
 * un serveur déjà lancé. `CHROME_PATH` surcharge le navigateur de `playwright-core`/ms-playwright.
 *
 * Le geste est fixe : fenêtre 390 × 664, CPU ×6, 60 `pointermove` (un par frame), sur la ligne
 * de déchirure, de 10 % à 60 % de la largeur de la zone. Les métriques CDP sont les deltas du
 * geste, pas les compteurs cumulés depuis le chargement.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { amorcageStore } from './capturer-socle.mjs';

export const CONFIGURATION = Object.freeze({
  viewport: Object.freeze({ width: 390, height: 664 }),
  cpuThrottlingRate: 6,
  mouvements: 60,
  depart: 0.1,
  arrivee: 0.6
});

const METRIQUES = ['TaskDuration', 'RecalcStyleDuration', 'ScriptDuration', 'LayoutDuration'];
const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const DIST_INDEX = join(RACINE, 'dist/index.html');

/** Les positions du doigt, de 10 % à 60 % de la zone, sur son ordonnée de pointillés. */
export function creerMouvements(rectangle, nombre = CONFIGURATION.mouvements) {
  return Array.from({ length: nombre }, (_, index) => ({
    clientX:
      rectangle.left +
      rectangle.width *
        (CONFIGURATION.depart + ((CONFIGURATION.arrivee - CONFIGURATION.depart) * (index + 1)) / nombre),
    clientY: rectangle.lineY
  }));
}

/** Appelle un pointermove après chacune des frames demandées, jamais en rafale synchrone. */
export async function emettreMouvements({ selecteur, mouvements }) {
  const zone = document.querySelector(selecteur);
  if (!zone) throw new Error(`Zone introuvable : ${selecteur}`);

  for (const { clientX, clientY } of mouvements) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    zone.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        buttons: 1,
        clientX,
        clientY
      })
    );
  }
  return mouvements.length;
}

function metricsParNom(reponse) {
  return Object.fromEntries(reponse.metrics.map(({ name, value }) => [name, value]));
}

export function deltasMesures(avant, apres) {
  const valeursAvant = metricsParNom(avant);
  const valeursApres = metricsParNom(apres);
  return Object.fromEntries(
    METRIQUES.map((nom) => {
      if (typeof valeursAvant[nom] !== 'number' || typeof valeursApres[nom] !== 'number') {
        throw new Error(`Métrique CDP absente : ${nom}`);
      }
      return [nom, valeursApres[nom] - valeursAvant[nom]];
    })
  );
}

async function executer() {
  const executablePath = process.env.CHROME_PATH || chromium.executablePath();
  if (!existsSync(executablePath)) {
    throw new Error(`Chromium introuvable : ${executablePath}\n  Renseigne CHROME_PATH.`);
  }

  const port = Number(process.env.PORT ?? 4182);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT invalide : ${process.env.PORT}`);

  let serveur = null;
  let navigateur = null;
  let contexte = null;
  const erreurs = [];

  try {
    if (!process.env.BASE_URL) {
      if (!existsSync(DIST_INDEX)) {
        throw new Error('dist/index.html absent : lance `npm run build` avant `npm run mesurer:glissement`.');
      }
      serveur = await preview({ root: RACINE, preview: { port, strictPort: true }, logLevel: 'error' });
    }

    const base = new URL(process.env.BASE_URL ?? `http://localhost:${port}/`);
    const origine = new URL('/', base).origin;
    navigateur = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    contexte = await navigateur.newContext({
      viewport: CONFIGURATION.viewport,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'no-preference',
      storageState: amorcageStore(origine, { reducedMotion: false })
    });

    const page = await contexte.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(`console : ${message.text()}`);
    });
    page.on('pageerror', (error) => erreurs.push(`pageerror : ${error.message}`));

    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    await page.locator('.hero__ouvrir').click();
    const zone = page.locator('[data-zone]');
    await zone.waitFor({ state: 'visible' });
    await page.waitForTimeout(250);

    const rectangle = await zone.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const guide = element.querySelector('.ouverture__guide');
      const parent = guide?.offsetParent;
      if (!guide || !parent || parent.clientHeight === 0) {
        throw new Error('La ligne de pointillés du sachet est introuvable.');
      }
      const ligne = guide.offsetTop / parent.clientHeight;
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, ligne };
    });
    const mouvements = creerMouvements({
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.width,
      lineY: rectangle.top + rectangle.height * rectangle.ligne
    });

    const session = await contexte.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: CONFIGURATION.cpuThrottlingRate });
    await session.send('Performance.enable');
    const avant = await session.send('Performance.getMetrics');

    const debut = performance.now();
    await page.mouse.move(mouvements[0].clientX, mouvements[0].clientY);
    await page.mouse.down();
    const nombre = await page.evaluate(emettreMouvements, { selecteur: '[data-zone]', mouvements });
    await page.mouse.up();
    const dureeMurale = performance.now() - debut;
    const apres = await session.send('Performance.getMetrics');
    const deltas = deltasMesures(avant, apres);

    if (nombre !== CONFIGURATION.mouvements) {
      throw new Error(`Le geste a émis ${nombre} pointermove au lieu de ${CONFIGURATION.mouvements}.`);
    }
    if (erreurs.length > 0)
      throw new Error(`Erreurs navigateur :\n${erreurs.map((erreur) => `  - ${erreur}`).join('\n')}`);

    console.log(
      `✔ Ouverture d'un Arrivage · ${CONFIGURATION.viewport.width} × ${CONFIGURATION.viewport.height} · CPU ×${CONFIGURATION.cpuThrottlingRate}`
    );
    console.log(
      `Geste : ${nombre} pointermove, un par requestAnimationFrame · ligne des pointillés · ${CONFIGURATION.depart * 100} → ${CONFIGURATION.arrivee * 100} % de la largeur`
    );
    for (const nom of METRIQUES) console.log(`${nom} : ${deltas[nom].toFixed(3)} s`);
    console.log(`Durée murale : ${(dureeMurale / 1000).toFixed(3)} s`);
  } finally {
    await contexte?.close();
    await navigateur?.close();
    await serveur?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await executer();
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
