#!/usr/bin/env node
/**
 * Filmer une animation — la **planche de frames** (rétro du 26/10/2026).
 *
 * Une animation dure 800 ms : ni un `snapshot` du navigateur, ni un style calculé ne la
 * voient. Le 25/10/2026, quatre « je ne vois pas les animations » de suite ont suivi des
 * « vérifié » fondés sur des styles calculés ; les vraies causes (`color-mix()` ignoré, règle
 * globale « Mouvement réduit » à 0,001 ms) ne sont apparues qu'en regardant des images.
 *
 * Ce script déclenche l'animation, photographie une zone toutes les `--intervalle` ms, et
 * assemble les images en **une planche** qu'on lit d'un coup d'œil. Il échoue sur une erreur
 * de console, comme `npm run capturer`.
 *
 * Usage :
 *   BASE_URL=http://localhost:5178 node scripts/filmer-animation.mjs \
 *     --chemin /battle --clic 'button.button--primary' --zone .board --images 24 --intervalle 70
 *   node scripts/filmer-animation.mjs --plan ...   (imprime la configuration, sans navigateur)
 *
 * Options :
 *   --chemin      route à ouvrir (défaut : /battle)
 *   --clic        sélecteur à cliquer pour déclencher ; répétable, dans l'ordre
 *   --survol      sélecteur à survoler (après les clics) pour déclencher un effet de survol ;
 *                 répétable. Le pointeur y reste pendant la prise (#294 : la carte de main soulevée)
 *   --zone        sélecteur de la zone photographiée (défaut : body)
 *   --images      nombre de frames (défaut : 24)
 *   --intervalle  millisecondes entre deux frames (défaut : 70)
 *   --colonnes    colonnes de la planche (défaut : 6)
 *   --stockage    JSON fusionné dans l'état amorcé du store (ex. '{"combatDetaille":true}')
 *   --sortie      dossier de sortie (défaut : captures/film)
 *
 * Le store est amorcé avec `tutorielVu: true` et **`reducedMotion: false`** : sous « Mouvement
 * réduit », une règle globale de `src/styles.css` ramène toute animation à 0,001 ms et la
 * planche serait vide. Chromium est lancé avec `reducedMotion: 'no-preference'` pour la même
 * raison.
 *
 * Variables : BASE_URL (serveur déjà lancé, requis), CHROME_PATH (binaire Chromium).
 * Le dossier de sortie est sous `captures/`, ignoré par git.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STORAGE_KEY = 'bureau-des-planques-v1';
const DEFAUTS = {
  chemin: '/battle',
  clics: [],
  survols: [],
  zone: 'body',
  images: 24,
  intervalle: 70,
  colonnes: 6,
  stockage: {},
  sortie: 'captures/film'
};

/** Lit `--option valeur` ; refuse une option inconnue ou une valeur non numérique. */
export function analyserArguments(argv) {
  const config = { ...DEFAUTS, clics: [], survols: [], stockage: {} };
  const entiers = new Set(['images', 'intervalle', 'colonnes']);
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === '--plan') {
      config.plan = true;
      continue;
    }
    const nom = option.startsWith('--') ? option.slice(2) : null;
    if (
      !nom ||
      !['chemin', 'clic', 'survol', 'zone', 'images', 'intervalle', 'colonnes', 'stockage', 'sortie'].includes(nom)
    ) {
      throw new Error(`Option inconnue : ${option}`);
    }
    const valeur = argv[i + 1];
    if (valeur === undefined) throw new Error(`${option} attend une valeur`);
    i += 1;
    if (nom === 'clic') config.clics.push(valeur);
    else if (nom === 'survol') config.survols.push(valeur);
    else if (nom === 'stockage') config.stockage = JSON.parse(valeur);
    else if (entiers.has(nom)) {
      const n = Number(valeur);
      if (!Number.isInteger(n) || n < 1) throw new Error(`${option} attend un entier ≥ 1 (reçu « ${valeur} »)`);
      config[nom] = n;
    } else config[nom] = valeur;
  }
  return config;
}

/** L'état amorcé du store : tutoriel passé, mouvement **non** réduit, plus le supplément demandé. */
export function etatAmorce(supplement = {}) {
  return { state: { tutorielVu: true, reducedMotion: false, ...supplement } };
}

/** Le nom de fichier d'une frame, triable : `f00.png`, `f01.png`… */
export function nomFrame(index) {
  return `f${String(index).padStart(2, '0')}.png`;
}

/** La page HTML de la planche : une grille de frames légendées par leur instant en ms. */
export function htmlPlanche(frames, { colonnes, intervalle }) {
  const cases = frames
    .map(
      (src, i) => `<figure><img src="${src}" alt="frame ${i}"><figcaption>${i * intervalle} ms</figcaption></figure>`
    )
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#ddd;font:12px monospace}
main{display:grid;grid-template-columns:repeat(${colonnes},auto);gap:4px;padding:4px;width:max-content}
figure{margin:0}img{display:block;max-width:360px;height:auto}figcaption{padding:2px 4px}
</style><main>${cases}</main>`;
}

async function filmer(config) {
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

  const navigateur = await chromium.launch({ executablePath });
  const erreurs = [];
  try {
    const page = await navigateur.newPage({ viewport: { width: 420, height: 900 }, reducedMotion: 'no-preference' });
    page.on('pageerror', (e) => erreurs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
    await page.addInitScript(
      ([cle, etat]) => localStorage.setItem(cle, JSON.stringify(etat)),
      [STORAGE_KEY, etatAmorce(config.stockage)]
    );
    await page.goto(new URL(config.chemin, base).href, { waitUntil: 'networkidle' });
    for (const selecteur of config.clics) {
      await page.locator(selecteur).first().click();
    }
    for (const selecteur of config.survols) {
      await page.locator(selecteur).first().hover();
    }
    const zone = page.locator(config.zone).first();
    const frames = [];
    for (let i = 0; i < config.images; i += 1) {
      const nom = nomFrame(i);
      await zone.screenshot({ path: join(sortie, nom), animations: 'allow' });
      frames.push(nom);
      await page.waitForTimeout(config.intervalle);
    }
    writeFileSync(join(sortie, 'planche.html'), htmlPlanche(frames, config));
    await page.goto(pathToFileURL(join(sortie, 'planche.html')).href);
    await page.screenshot({ path: join(sortie, 'planche.png'), fullPage: true });
  } finally {
    await navigateur.close();
  }
  if (erreurs.length > 0) throw new Error(`Erreurs de console pendant la prise :\n${erreurs.join('\n')}`);
  return join(config.sortie, 'planche.png');
}

const estLance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estLance) {
  try {
    const config = analyserArguments(process.argv.slice(2));
    if (config.plan) {
      console.log(JSON.stringify({ ...config, etat: etatAmorce(config.stockage) }, null, 2));
    } else {
      console.log(`Planche : ${await filmer(config)}`);
    }
  } catch (erreur) {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  }
}

export { STORAGE_KEY };
