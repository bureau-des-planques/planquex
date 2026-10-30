#!/usr/bin/env node
/**
 * La taille des paquets — **mesurée, pas espérée** (#480).
 *
 * ## Pourquoi
 *
 * Jusqu'ici, la seule chose qui disait qu'un paquet avait grossi était un **avertissement de
 * Vite** dans les journaux de déploiement — et il n'empêchait rien. Une importation ajoutée sans
 * y penser remet un mégaoctet dans le paquet principal, et personne ne le voit avant qu'un
 * testeur se plaigne d'un premier écran lent.
 *
 * Mesure de référence, **29/10/2026**, sur ce dépôt :
 *
 * | état                                            | principal          | plus gros paquet        |
 * |-------------------------------------------------|--------------------|-------------------------|
 * | avant (un seul morceau)                         | **1 032 kB** (313 kB gzip) | le principal   |
 * | après #478 (écrans à la demande, Accueil en dur) | **727 kB** (221 kB gzip)   | le principal   |
 * | après #479 (paquets par famille)                | **290 kB** (78 kB gzip)    | `react`, 219 kB |
 *
 * Le ticket #480 écrit « 1 026 kB avant » : c'est la même mesure sur une autre copie du dépôt
 * (celui-ci donne 1 032 kB sur `d9c5ba3`), et l'écart de 6 kB ne change aucune conclusion.
 *
 * Le ticket #479 annonce 202 kB : c'est la variante « Accueil paresseux », **écartée** par #478
 * (la porte d'entrée n'attend aucun morceau, et son repli ne s'affiche pas). Les 88 kB d'écart
 * sont le code de l'Accueil et de sa scène d'Arrivage, restés dans l'entrée.
 *
 * ## Les deux seuils, et leur raison
 *
 * - **500 000 octets par paquet** : c'est le chiffre de l'avertissement de Vite
 *   (`chunkSizeWarningLimit`, 500 kB). Vite compte en **kB décimaux** — `290 251` octets
 *   s'affichent « 290,25 kB » —, le seuil est donc écrit ici en octets, sans ambiguïté. Un
 *   avertissement qui n'empêche rien devient un échec.
 * - **le cliquet du paquet principal** : la valeur mesurée à la fusion de #480, écrite une fois
 *   ci-dessous avec sa date. Il ne monte pas sans une décision écrite ; il descend avec le code
 *   qui le permet. C'est le même geste que les cliquets de captures et de compteurs.
 *
 * ## Usage
 *
 * ```bash
 * npm run mesure:paquets                # construit si dist/ est périmé, mesure, échoue au-delà
 * npm run mesure:paquets -- --sans-build  # mesure dist/ tel quel (ce que fait la CI après son build)
 * node scripts/ci/taille-paquets.mjs --plan   # les seuils et l'état de dist/, sans rien construire
 * ```
 *
 * La CI l'appelle **juste après `npm run build`** : `dist/` a été produit dans le même job, donc
 * la garde ne refait pas un build pour rien (elle ne reconstruit que si une source est plus
 * récente que `dist/index.html`).
 *
 * Garde du contrôle : `scripts/ci/taille-paquets.test.ts` le confronte à des tailles fabriquées
 * — juste sous le seuil (passe), juste au-dessus (échoue) — et à un dossier de paquets fabriqués.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** La racine du dépôt, quel que soit le dossier de travail. */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(RACINE, 'dist');
const ASSETS = join(DIST, 'assets');

/**
 * **Le seuil de Vite, en octets** : 500 kB décimaux, exactement le chiffre de l'avertissement
 * `Some chunks are larger than 500 kB after minification`.
 */
export const SEUIL_PAQUET = 500_000;

/**
 * **Le cliquet du paquet principal**, mesuré le 29/10/2026 à la fusion de #480 : 290 251 octets,
 * soit « 290,25 kB » au rapport de Vite (`index-*.js`, 78,25 kB gzip). Il ne monte pas sans une
 * décision écrite dans le commit qui le relève ; il descend avec le code qui le permet.
 *
 * **Relevé de 69 octets le 30/10/2026 (#527, D-156)** : le drapeau d'anonymat porté par la
 * session et le refus d'un compte non approuvé. Le code a été resserré avant de relever
 * (prédicat en ligne, lecture du compteur conditionnée) ; il reste 290 320 octets.
 *
 * **Relevé encore de 462 octets le 30/10/2026** (290 782 octets) (décision de Bastien, #525) : le glyphe de faction
 * dans la pastille de café (`CafePips`, qui vit dans le paquet principal) et le choix de son encre.
 * Un café ne se lisait que par sa couleur (le critère WCAG sur la couleur seule) ; la variante en
 * CSS seul (couleur relative OKLCH) a été écartée pour ne pas dépendre d'une syntaxe récente.
 */
export const PLAFOND_PRINCIPAL = 290_782;

/** Les fichiers du dépôt qui entrent dans le build : une source plus récente périme `dist/`. */
const SOURCES = ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json'];

/** Une taille lisible, dans l'unité de Vite (kB décimaux) : « 290,3 kB ». */
export function enKb(octets) {
  return `${(octets / 1000).toFixed(1).replace('.', ',')} kB`;
}

/** Les paquets d'un dossier : leur nom, leur taille minifiée, leur taille gzip. */
export function paquetsDe(dossier = ASSETS) {
  return readdirSync(dossier)
    .filter((nom) => nom.endsWith('.js'))
    .map((nom) => {
      const octets = statSync(join(dossier, nom)).size;
      return { nom, octets, gzip: gzipSync(readFileSync(join(dossier, nom))).length };
    })
    .sort((a, b) => b.octets - a.octets);
}

/**
 * Ce qu'il faut savoir d'une liste de paquets : le **plus gros**, le **principal** (le morceau
 * d'entrée, `index-<hash>.js`) et la liste triée. `principal` vaut `null` quand il n'y en a pas
 * exactement un : la mesure ne sait alors pas lequel est l'entrée, et le dit.
 */
export function mesurer(paquets) {
  const tries = [...paquets].sort((a, b) => b.octets - a.octets);
  const principaux = tries.filter((paquet) => /^index-.+\.js$/.test(paquet.nom));
  return {
    paquets: tries,
    total: tries.length,
    plusGros: tries[0] ?? null,
    principaux,
    principal: principaux.length === 1 ? principaux[0] : null
  };
}

/**
 * Les échecs d'une mesure, vide si tout passe. Fonction **pure** : c'est elle que le test
 * confronte à des tailles fabriquées, sans construire quoi que ce soit.
 */
export function verdict(mesures, { seuil = SEUIL_PAQUET, plafond = PLAFOND_PRINCIPAL } = {}) {
  if (mesures.total === 0) {
    return ['aucun paquet mesuré : `dist/assets/` ne porte aucun `.js` (le build n’a rien produit)'];
  }
  const echecs = [];
  if (mesures.principaux.length !== 1) {
    echecs.push(`${mesures.principaux.length} paquet(s) « index-*.js » : la mesure ne sait pas lequel est l’entrée`);
  }
  for (const paquet of mesures.paquets) {
    if (paquet.octets > seuil) {
      echecs.push(`${paquet.nom} : ${enKb(paquet.octets)} — au-dessus du seuil de ${enKb(seuil)}`);
    }
  }
  if (mesures.principal && mesures.principal.octets > plafond) {
    echecs.push(
      `le paquet principal ${mesures.principal.nom} : ${enKb(mesures.principal.octets)} — ` +
        `au-dessus du cliquet de ${enKb(plafond)} (relevé le 30/10/2026, #527 et #525) : ` +
        'descendre le code, ou relever le cliquet dans un commit qui le dit'
    );
  }
  return echecs;
}

/** Le plus grand `mtime` (en ms) d'une liste de chemins, dossier ou fichier, récursivement. */
export function plusRecent(chemins) {
  let recent = 0;
  for (const chemin of chemins) {
    if (!existsSync(chemin)) continue;
    const stats = statSync(chemin);
    if (stats.isDirectory()) {
      recent = Math.max(
        recent,
        plusRecent(
          readdirSync(chemin)
            .filter((nom) => nom !== 'node_modules')
            .map((nom) => join(chemin, nom))
        )
      );
    } else {
      recent = Math.max(recent, stats.mtimeMs);
    }
  }
  return recent;
}

/** Vrai quand `dist/` n'existe pas, ou qu'une source est plus récente que le build. */
export function estPerime({ dist = DIST, racine = RACINE, sources = SOURCES } = {}) {
  const index = join(dist, 'index.html');
  if (!existsSync(index)) return true;
  return plusRecent(sources.map((source) => join(racine, source))) > statSync(index).mtimeMs;
}

/** Construit la production, en héritant de la sortie : un build muet ne dirait pas pourquoi il casse. */
function construire(racine) {
  console.log('dist/ est périmé (ou absent) : npm run build');
  execFileSync('npm', ['run', 'build'], { cwd: racine, stdio: 'inherit' });
}

/** Les seuils, leur raison et l'état de `dist/` — sans construire ni mesurer. */
export function plan() {
  const etat = existsSync(join(DIST, 'index.html')) ? (estPerime() ? 'périmé' : 'à jour') : 'absent';
  return [
    'seuil par paquet     : ' + `${enKb(SEUIL_PAQUET)} (l’avertissement de Vite, en échec)`,
    'cliquet du principal : ' + `${enKb(PLAFOND_PRINCIPAL)} (relevé le 30/10/2026, #527 et #525)`,
    'référence 29/10/2026 : ' + 'principal 1 032 kB avant, 290,3 kB après #479 ; plus gros paquet 219 kB',
    'dist/                : ' + etat
  ].join('\n');
}

function principal(argv) {
  const sansBuild = argv.includes('--sans-build');
  if (argv.includes('--plan')) {
    console.log(plan());
    return 0;
  }
  if (!existsSync(ASSETS)) {
    if (sansBuild) {
      console.error('dist/assets/ est absent et --sans-build interdit de construire : rien à mesurer.');
      return 2;
    }
    construire(RACINE);
  } else if (!sansBuild && estPerime()) {
    construire(RACINE);
  }

  const mesures = mesurer(paquetsDe());
  const echecs = verdict(mesures);
  const principal = mesures.principal;

  console.log(`\nPaquets mesurés — dist/assets, ${mesures.total} morceaux :`);
  console.log(
    `  principal   ${principal ? principal.nom.padEnd(28) : '(introuvable)'.padEnd(28)} ` +
      `${principal ? enKb(principal.octets) : '—'.padStart(10)}   gzip ${principal ? enKb(principal.gzip) : '—'}   ` +
      `cliquet ${enKb(PLAFOND_PRINCIPAL)}`
  );
  console.log(
    `  plus gros   ${mesures.plusGros.nom.padEnd(28)} ${enKb(mesures.plusGros.octets)}   ` +
      `gzip ${enKb(mesures.plusGros.gzip)}   seuil   ${enKb(SEUIL_PAQUET)}`
  );

  if (echecs.length > 0) {
    console.error('\nCe n’est pas une taille acceptable :');
    for (const echec of echecs) console.error(`  - ${echec}`);
    return 1;
  }

  console.log(`\n✔ Aucun paquet au-dessus de ${enKb(SEUIL_PAQUET)}, et le principal tient son cliquet.`);
  return 0;
}

// Le module est importé par son test : le CLI ne part que lancé directement.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = principal(process.argv.slice(2));
}
