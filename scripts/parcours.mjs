#!/usr/bin/env node
/**
 * Le parcours — ticket #429, carte #425 (l'ergonomie qui ne se prouve pas se dégrade en silence).
 *
 * Deux contrôles, une commande :
 *
 * 1. **Le seuil.** Chaque écran est atteignable depuis l'accueil en au plus `SEUIL.aller` gestes,
 *    et l'on en revient en au plus `SEUIL.retour`. **Un geste = une adresse suivie** (un lien
 *    rendu). Le graphe vient soit du rendu jsdom (`src/parcours.test.tsx`, sans navigateur), soit
 *    de Chromium (`npm run parcours`, qui relève les liens de chaque écran).
 * 2. **La planche.** Le parcours par défaut — accueil → Arrivage → combat → sortie → accueil —
 *    est joué dans Chromium, une frame par étape, dans `captures/parcours/planche.png`. C'est la
 *    preuve qu'on **peut y aller et en revenir**, pas seulement qu'un écran s'affiche.
 *
 * **Le cliquet.** `SEUIL` est le compte mesuré, pas un objectif. Un geste de plus fait échouer
 * (`evaluerParcours`, avec le nom de l'écran) ; un geste de moins aussi, avec « baisse SEUIL dans ce
 * commit » : le plafond ne monte pas sans une raison écrite, et il descend avec le code qui le permet.
 *
 * Usage :
 *   npm run parcours                            (Chromium + serveur : BASE_URL, CHROME_PATH)
 *   node scripts/parcours.mjs --graphe <f.json> (le seuil seul, sur un graphe fourni, sans navigateur)
 *   node scripts/parcours.mjs --plan            (imprime le seuil et le parcours, sans navigateur)
 *
 * Variables : BASE_URL (serveur déjà lancé, requis pour la planche), CHROME_PATH (binaire Chromium).
 * Le dossier `captures/` est ignoré par git : la planche est une preuve de travail.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STORAGE_KEY, etatAmorce, htmlPlanche, nomFrame } from './filmer-animation.mjs';

/** L'accueil : la racine de tout parcours. */
export const RACINE = '/';

/**
 * Le seuil publié, en gestes (liens suivis). **Mesuré le 28/10/2026** par le rendu de `App`
 * (`src/parcours.test.tsx`) : `aller` = l'écran le plus loin de l'accueil, `retour` = l'écran
 * dont le retour vers l'accueil est le plus long. Ne monte pas sans une raison écrite.
 */
export const SEUIL = Object.freeze({ aller: 2, retour: 1 });

/**
 * Les écrans que rien dans l'application ne relie à l'accueil **en build sans base**, avec leur
 * raison. Chacun est un cul-de-sac **constaté** (#426) ; ils restent hors du seuil d'aller, mais
 * leur retour est mesuré comme celui des autres. Déplacé ici depuis `src/sorties.test.tsx` : la
 * liste ne vit qu'à un endroit.
 */
export const EXCEPTIONS = Object.freeze({
  '/connexion': 'sans base, GardeComptes ne renvoie vers la connexion que si le compte est configuré',
  '/attente': 'lien seulement depuis la bandeau de compte en attente (compte configuré)',
  '/administration': 'lien seulement depuis Réglages, pour un compte administrateur (compte configuré)',
  '/installation': 'aucun lien interne : la note de release la désigne hors de l’application'
});

/** Le parcours filmé : une frame après chaque étape. Un geste est `clic` ou `attendre` (un sélecteur). */
export const PARCOURS_DEFAUT = Object.freeze([
  { libelle: 'Accueil', gestes: [] },
  {
    libelle: 'Arrivage ouvert',
    gestes: [
      { type: 'clic', selecteur: '.hero__ouvrir' },
      { type: 'attendre', selecteur: '.ouverture' },
      { type: 'clic', selecteur: '[data-ouvrir]' },
      { type: 'attendre', selecteur: '.ouverture[data-etape="revelation"]' },
      { type: 'clic', selecteur: '[data-tout-afficher]' }
    ]
  },
  { libelle: 'Arrivage rangé', gestes: [{ type: 'clic', selecteur: '.ouverture button.button--gold' }] },
  {
    libelle: 'Combat',
    gestes: [
      { type: 'clic', selecteur: '.hero__actions a[href="/battle"]' },
      { type: 'attendre', selecteur: '.battle__sortie' }
    ]
  },
  { libelle: 'Sortie du combat', gestes: [{ type: 'clic', selecteur: '.battle__sortie' }] },
  { libelle: 'Accueil revenu', gestes: [{ type: 'attendre', selecteur: '.hero__ouvrir' }] }
]);

/** Les routes déclarées dans `src/App.tsx`, sans `/` (l'index) ni la capture `*`. */
export function routesDeclarees(source) {
  return [...source.matchAll(/<Route path="([^"*]+)"/g)].map((m) => `/${m[1]}`);
}

/** Un chemin sans la requête ni l'ancre, ou `null` si ce n'est pas une adresse interne. */
export function cheminInterne(href) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return null;
  return href.split(/[?#]/)[0] || '/';
}

/** Le nombre minimal de gestes (liens suivis) de `depart` vers chaque chemin atteignable. */
export function distancesDepuis(graphe, depart) {
  const distances = new Map([[depart, 0]]);
  const file = [depart];
  while (file.length > 0) {
    const chemin = file.shift();
    for (const lie of graphe[chemin] ?? []) {
      if (!distances.has(lie)) {
        distances.set(lie, distances.get(chemin) + 1);
        file.push(lie);
      }
    }
  }
  return distances;
}

/**
 * Confronte un graphe au seuil. `graphe` : chemin → chemins liés depuis cette page ; `ecrans` : les
 * routes à mesurer. Rend les échecs (un par ligne, avec le nom de l'écran), et les mesures : le
 * plus grand nombre de gestes à l'aller et au retour, sur les écrans réellement mesurés.
 */
export function evaluerParcours(graphe, { ecrans, exceptions = EXCEPTIONS, seuil = SEUIL, racine = RACINE } = {}) {
  const depuisRacine = distancesDepuis(graphe, racine);
  const echecs = [];
  let aller = 0;
  let retour = 0;
  for (const ecran of ecrans) {
    if (ecran === racine) continue;
    const dAller = depuisRacine.get(ecran);
    if (dAller === undefined) {
      if (!(ecran in exceptions)) echecs.push(`${ecran} : inatteignable depuis ${racine}`);
    } else {
      aller = Math.max(aller, dAller);
      if (ecran in exceptions) echecs.push(`${ecran} : exception périmée, elle est atteignable depuis ${racine}`);
      if (dAller > seuil.aller) {
        echecs.push(`${ecran} : ${dAller} gestes depuis ${racine}, au-delà du seuil de ${seuil.aller}`);
      }
    }
    const dRetour = distancesDepuis(graphe, ecran).get(racine);
    if (dRetour === undefined) {
      echecs.push(`${ecran} : aucun retour vers ${racine}`);
    } else {
      retour = Math.max(retour, dRetour);
      if (dRetour > seuil.retour) {
        echecs.push(`${ecran} : ${dRetour} gestes pour revenir à ${racine}, au-delà du seuil de ${seuil.retour}`);
      }
    }
  }
  // Le cliquet dans l'autre sens : un seuil plus haut que la mesure se baisse dans le même commit.
  if (aller < seuil.aller) {
    echecs.push(`seuil d'aller ${seuil.aller} trop haut : mesuré ${aller} — baisse SEUIL dans ce commit`);
  }
  if (retour < seuil.retour) {
    echecs.push(`seuil de retour ${seuil.retour} trop haut : mesuré ${retour} — baisse SEUIL dans ce commit`);
  }
  return { echecs, aller, retour };
}

/** Lit `--option valeur` ; refuse une option inconnue. */
export function analyserArguments(argv) {
  const config = { plan: false, graphe: null, sortie: 'captures/parcours' };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === '--plan') config.plan = true;
    else if (option === '--graphe' || option === '--sortie') {
      const valeur = argv[i + 1];
      if (valeur === undefined) throw new Error(`${option} attend une valeur`);
      i += 1;
      config[option.slice(2)] = valeur;
    } else throw new Error(`Option inconnue : ${option}`);
  }
  return config;
}

/** Relève les liens de chaque route, dans Chromium, par une navigation directe. */
async function releverGraphe(page, base, chemins) {
  const graphe = {};
  for (const chemin of chemins) {
    await page.goto(new URL(chemin, base).href, { waitUntil: 'networkidle' });
    const hrefs = await page.$$eval('a[href]', (liens) => liens.map((lien) => lien.getAttribute('href')));
    graphe[chemin] = [...new Set(hrefs.map(cheminInterne).filter((lie) => lie !== null))];
  }
  return graphe;
}

/** Joue le parcours par défaut et écrit la planche : une frame par étape. */
async function filmerParcours(page, base, sortie) {
  const frames = [];
  await page.goto(new URL(RACINE, base).href, { waitUntil: 'networkidle' });
  for (const etape of PARCOURS_DEFAUT) {
    for (const geste of etape.gestes) {
      if (geste.type === 'clic') await page.locator(geste.selecteur).first().click();
      else await page.locator(geste.selecteur).first().waitFor({ state: 'visible', timeout: 60000 });
    }
    // Un temps pour que la transition finisse : la frame doit montrer l'écran, pas son entrée.
    await page.waitForTimeout(600);
    const src = nomFrame(frames.length);
    await page.screenshot({ path: join(sortie, src), animations: 'allow' });
    frames.push({ src, libelle: `${frames.length + 1}. ${etape.libelle}`, t: null });
  }
  return frames;
}

async function executer(config) {
  const base = process.env.BASE_URL;
  if (!base)
    throw new Error('BASE_URL est requis : lancer le serveur (npm run dev) puis BASE_URL=http://localhost:5178');
  const { chromium } = await import('playwright-core');
  const racine = fileURLToPath(new URL('..', import.meta.url));
  const executablePath =
    process.env.CHROME_PATH ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
  if (!existsSync(executablePath)) throw new Error(`Chromium introuvable : ${executablePath} (CHROME_PATH)`);
  const sortie = resolve(racine, config.sortie);
  rmSync(sortie, { recursive: true, force: true });
  mkdirSync(sortie, { recursive: true });

  const ecrans = routesDeclarees(readFileSync(join(racine, 'src', 'App.tsx'), 'utf8'));
  const navigateur = await chromium.launch({ executablePath });
  const erreurs = [];
  let verdict;
  let frames;
  try {
    const page = await navigateur.newPage({ viewport: { width: 420, height: 900 }, reducedMotion: 'no-preference' });
    page.on('pageerror', (e) => erreurs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
    await page.addInitScript(
      ([cle, etat]) => localStorage.setItem(cle, JSON.stringify(etat)),
      [STORAGE_KEY, etatAmorce({ pasAPasCombatVu: true })]
    );
    const graphe = await releverGraphe(page, base, [RACINE, ...ecrans]);
    verdict = evaluerParcours(graphe, { ecrans });
    frames = await filmerParcours(page, base, sortie);
    writeFileSync(join(sortie, 'planche.html'), htmlPlanche(frames, { colonnes: 3, intervalle: 0 }));
    await page.goto(pathToFileURL(join(sortie, 'planche.html')).href);
    await page.screenshot({ path: join(sortie, 'planche.png'), fullPage: true });
  } finally {
    await navigateur.close();
  }
  if (erreurs.length > 0) throw new Error(`Erreurs de console pendant le parcours :\n${erreurs.join('\n')}`);
  return { verdict, planche: join(config.sortie, 'planche.png') };
}

function afficherVerdict({ echecs, aller, retour }) {
  console.log(`Seuil publié : ${SEUIL.aller} geste(s) pour aller, ${SEUIL.retour} pour revenir.`);
  console.log(`Mesuré : ${aller} geste(s) pour aller, ${retour} pour revenir.`);
  for (const echec of echecs) console.log(`✖ ${echec}`);
  if (echecs.length === 0) console.log('✔ chaque écran est atteignable et revient dans le seuil.');
  return echecs.length === 0;
}

const estLance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estLance) {
  try {
    const config = analyserArguments(process.argv.slice(2));
    if (config.plan) {
      console.log(JSON.stringify({ seuil: SEUIL, exceptions: EXCEPTIONS, parcours: PARCOURS_DEFAUT }, null, 2));
    } else if (config.graphe) {
      const graphe = JSON.parse(readFileSync(config.graphe, 'utf8'));
      const ecrans = Object.keys(graphe).filter((chemin) => chemin !== RACINE);
      if (!afficherVerdict(evaluerParcours(graphe, { ecrans }))) process.exitCode = 1;
    } else {
      const { verdict, planche } = await executer(config);
      console.log(`Planche : ${planche}`);
      if (!afficherVerdict(verdict)) process.exitCode = 1;
    }
  } catch (erreur) {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  }
}
