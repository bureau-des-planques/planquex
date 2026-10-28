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
 *   --attendre    sélecteur à attendre (visible) avant l'étape suivante ; répétable, **mêlé aux
 *                 `--clic` dans l'ordre de la ligne de commande** (atteindre un état de partie)
 *   --pause       millisecondes à attendre entre deux étapes (laisser finir un défilement)
 *   --horloge     instant ISO où l'horloge est **figée** (`page.clock.setFixedTime`) : la graine
 *                 d'une partie vient de `Date.now()`, donc la planche se refait à l'identique
 *   --marge       pixels ajoutés **autour** de la zone photographiée (défaut : 0). Un chiffre qui
 *                 s'élève sort de la boîte de sa carte : sans marge, la planche le rogne et ne dit
 *                 plus s'il reste près d'elle
 *   --compter     sélecteur dont on **compte les éléments dans le DOM** à chaque frame, et dont le
 *                 compte est écrit dans la légende : c'est ce qui prouve un retrait du DOM
 *   --survol      sélecteur à survoler (après les clics) pour déclencher un effet de survol ;
 *                 répétable. Le pointeur y reste pendant la prise (#294 : la carte de main soulevée)
 *   --zone        sélecteur de la zone photographiée (défaut : body)
 *   --images      nombre de frames (défaut : 24)
 *   --intervalle  millisecondes d'attente **après** chaque frame (défaut : 70) ; une capture prend
 *                 elle-même quelques dizaines de ms, donc la légende porte l'instant **mesuré**
 *                 (`performance.now()` depuis la dernière étape), pas le nominal
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
  glissers: [],
  etapes: [],
  survols: [],
  horloge: null,
  compter: null,
  marge: 0,
  zone: 'body',
  images: 24,
  intervalle: 70,
  colonnes: 6,
  pendant: 0,
  stockage: {},
  sortie: 'captures/film'
};

/** Lit `--option valeur` ; refuse une option inconnue ou une valeur non numérique. */
export function analyserArguments(argv) {
  const config = { ...DEFAUTS, clics: [], glissers: [], etapes: [], survols: [], stockage: {} };
  const entiers = new Set(['images', 'intervalle', 'colonnes']);
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === '--plan') {
      config.plan = true;
      continue;
    }
    const nom = option.startsWith('--') ? option.slice(2) : null;
    const connues = [
      'chemin',
      'clic',
      'glisser',
      'pendant',
      'survol',
      'attendre',
      'pause',
      'horloge',
      'compter',
      'marge',
      'zone',
      'images',
      'intervalle',
      'colonnes',
      'stockage',
      'sortie'
    ];
    if (!nom || !connues.includes(nom)) {
      throw new Error(`Option inconnue : ${option}`);
    }
    const valeur = argv[i + 1];
    if (valeur === undefined) throw new Error(`${option} attend une valeur`);
    i += 1;
    if (nom === 'clic') {
      config.clics.push(valeur);
      config.etapes.push({ type: 'clic', selecteur: valeur });
    } else if (nom === 'glisser') {
      // « sélecteur:x0,y0>x1,y1 », en fractions de la boîte de l'élément : un glissement se décrit
      // par où le doigt se pose et où il arrive, jamais par des pixels absolus (la zone bouge).
      const m = /^(.*?):(-?[\d.]+),(-?[\d.]+)>(-?[\d.]+),(-?[\d.]+)$/.exec(valeur);
      if (!m) throw new Error(`--glisser attend « sélecteur:x0,y0>x1,y1 » (reçu « ${valeur} »)`);
      const [, selecteur, ...nombres] = m;
      const [x0, y0, x1, y1] = nombres.map(Number);
      if ([x0, y0, x1, y1].some((n) => Number.isNaN(n))) {
        throw new Error(`--glisser attend des fractions numériques (reçu « ${valeur} »)`);
      }
      config.glissers.push(valeur);
      config.etapes.push({ type: 'glisser', selecteur, x0, y0, x1, y1 });
    } else if (nom === 'pendant') {
      const n = Number(valeur);
      if (!Number.isInteger(n) || n < 1) throw new Error(`--pendant attend un entier ≥ 1 (reçu « ${valeur} »)`);
      config.pendant = n;
    } else if (nom === 'survol') {
      config.survols.push(valeur);
    } else if (nom === 'attendre') config.etapes.push({ type: 'attendre', selecteur: valeur });
    else if (nom === 'pause') {
      const ms = Number(valeur);
      if (!Number.isInteger(ms) || ms < 1) throw new Error(`${option} attend un entier ≥ 1 (reçu « ${valeur} »)`);
      config.etapes.push({ type: 'pause', ms });
    } else if (nom === 'marge') {
      const px = Number(valeur);
      if (!Number.isInteger(px) || px < 0) throw new Error(`${option} attend un entier ≥ 0 (reçu « ${valeur} »)`);
      config.marge = px;
    } else if (nom === 'horloge') {
      if (Number.isNaN(Date.parse(valeur))) throw new Error(`${option} attend une date ISO (reçu « ${valeur} »)`);
      config.horloge = valeur;
    } else if (nom === 'stockage') config.stockage = JSON.parse(valeur);
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

/**
 * La page HTML de la planche : une grille de frames légendées par leur instant en ms.
 * Une frame est un nom de fichier (instant nominal `i × intervalle`) ou `{ src, t, compte }` :
 * l'instant **mesuré** et, si `--compter` est donné, le nombre d'éléments alors dans le DOM.
 */
export function htmlPlanche(frames, { colonnes, intervalle }) {
  const cases = frames
    .map((frame, i) => {
      const { src, t, compte } = typeof frame === 'string' ? { src: frame } : frame;
      // Une prise **pendant un geste** n'a pas d'instant : sa légende dit le geste, pas le temps
      // (le doigt peut s'arrêter, et c'est justement ce que la planche doit montrer).
      const legende = t === null ? `geste ${i + 1}` : `${Math.round(t ?? i * intervalle)} ms`;
      const suite = compte === undefined ? '' : ` · DOM : ${compte}`;
      return `<figure><img src="${src}" alt="frame ${i}"><figcaption>${legende}${suite}</figcaption></figure>`;
    })
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
    if (config.horloge) await page.clock.setFixedTime(new Date(config.horloge));
    await page.goto(new URL(config.chemin, base).href, { waitUntil: 'networkidle' });
    /** Les prises faites **pendant** les gestes : elles passent avant les prises minutées. */
    const pendant = [];
    let geste = 0;
    for (const etape of config.etapes) {
      if (etape.type === 'clic') await page.locator(etape.selecteur).first().click();
      else if (etape.type === 'glisser') {
        // Un vrai geste : poser, glisser en douze pas (un seul `move` ne produit pas de
        // `pointermove` intermédiaire), puis lever. C'est ce que le doigt fait.
        const boite = await page.locator(etape.selecteur).first().boundingBox();
        if (!boite) throw new Error(`La zone « ${etape.selecteur} » du glissement n'a pas de boîte`);
        const x0 = boite.x + boite.width * etape.x0;
        const y0 = boite.y + boite.height * etape.y0;
        const x1 = boite.x + boite.width * etape.x1;
        const y1 = boite.y + boite.height * etape.y1;
        await page.mouse.move(x0, y0);
        await page.mouse.down();
        for (let pas = 1; pas <= 12; pas += 1) {
          await page.mouse.move(x0 + ((x1 - x0) * pas) / 12, y0 + ((y1 - y0) * pas) / 12);
          if (config.pendant > 0 && pas % Math.max(1, Math.floor(12 / config.pendant)) === 0) {
            const nom = `g${geste}_${pas}.png`;
            await page
              .locator(config.zone)
              .first()
              .screenshot({ path: join(sortie, nom), animations: 'allow' });
            pendant.push({ src: nom, t: null, compte: undefined });
          }
        }
        await page.mouse.up();
        geste += 1;
      } else if (etape.type === 'attendre') {
        await page.locator(etape.selecteur).first().waitFor({ state: 'visible', timeout: 60000 });
      } else await page.waitForTimeout(etape.ms);
    }
    for (const selecteur of config.survols) {
      await page.locator(selecteur).first().hover();
    }
    const zone = page.locator(config.zone).first();
    const frames = pendant;
    // `performance.now()` n'est pas figé par `setFixedTime` : c'est l'horloge réelle de la page.
    const t0 = await page.evaluate(() => performance.now());
    for (let i = 0; i < config.images; i += 1) {
      const nom = nomFrame(i);
      const t = (await page.evaluate(() => performance.now())) - t0;
      const compte = config.compter ? await page.locator(config.compter).count() : undefined;
      if (config.marge > 0) {
        // La boîte est relue à chaque frame : la zone peut bouger. Bornée à la fenêtre.
        const boite = await zone.boundingBox();
        if (!boite) throw new Error(`La zone « ${config.zone} » n'a plus de boîte (retirée du DOM ?)`);
        const x = Math.max(0, boite.x - config.marge);
        const y = Math.max(0, boite.y - config.marge);
        await page.screenshot({
          path: join(sortie, nom),
          animations: 'allow',
          clip: {
            x,
            y,
            width: Math.min(420 - x, boite.width + 2 * config.marge),
            height: Math.min(900 - y, boite.height + 2 * config.marge)
          }
        });
      } else await zone.screenshot({ path: join(sortie, nom), animations: 'allow' });
      frames.push({ src: nom, t, compte });
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
