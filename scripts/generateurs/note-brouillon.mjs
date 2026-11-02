#!/usr/bin/env node
/**
 * **La note d'une version à venir, écrite par le générateur** — ticket #623.
 *
 * `docs/VERSIONS.md` §4 étape 1 demandait d'« écrire la note » dans `src/data/versions.ts`,
 * alors que ce fichier dit en tête « **Fichier généré : ne pas éditer à la main** ». Sur la
 * release 0.1.17, l'édition manuelle a coûté **deux `npm test` rouges** : un premier pour
 * l'ordre et le découpage des lignes, un second pour `src/data/notes-resume.ts`, oublié. Le
 * script rejoue le geste par le générateur — il ne réimplémente **pas** la mise en forme :
 * `rendreFichier` et `rendreResume` (`notes-versions.mjs`) restent la seule source de la
 * forme des deux fichiers, celle que `notes-versions.test.ts` compare au fichier commité.
 *
 * Usage :
 *   npm run note:brouillon -- --version 0.1.18 --points points.txt
 *
 * Le fichier de points porte **une ligne par point** : `groupe | texte`, le groupe étant
 * facultatif (la ligne n'est alors que le texte). La note prend le titre `Version <numéro>`
 * — c'est celui que `titreDe` rend d'une release dont le nom est son tag (D-152) —, la date
 * du jour, et `brouillon: true` : le tag part **avant** la release GitHub, la note écrite
 * d'avance est donc celle que la garde de `src/data/versions.test.ts` attend.
 *
 * **Ce que le script refuse**, et il le dit : une version déjà présente, une liste de points
 * vide, une ligne vide dans le fichier, un point sans texte. Il refuse avant d'écrire —
 * un brouillon à moitié posé serait pire que pas de brouillon.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparer, notesEnPlace, rendreFichier, rendreResume } from './notes-versions.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const CIBLE = join(root, 'src/data/versions.ts');
const CIBLE_RESUME = join(root, 'src/data/notes-resume.ts');

/** Le jour du poste, en `AAAA-MM-JJ` — le format que les deux fichiers et `versions.test.ts` lisent. */
function jour() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * **Le fichier de points, ligne à ligne.** Une ligne est `groupe | texte`, ou seulement
 * `texte`. Les refus sont nommés avec leur numéro de ligne : un fichier de quarante lignes
 * dont une est vide ne se cherche pas à l'œil.
 *
 * Le saut de ligne **final** est toléré (un éditeur en pose un) ; une ligne vide **au
 * milieu** ne l'est pas, elle est presque toujours un point oublié.
 */
export function lirePoints(texte, nom = 'le fichier de points') {
  // Un seul saut de ligne final : c'est la fin du fichier, pas une ligne vide.
  const corps = String(texte ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '');
  if (!corps.trim()) {
    throw new Error(`${nom} est vide : il faut au moins un point, une ligne par point.`);
  }

  const points = [];
  corps.split('\n').forEach((brute, index) => {
    const numero = index + 1;
    const ligne = brute.trim();
    if (!ligne) {
      throw new Error(`${nom} : la ligne ${numero} est vide (un point par ligne, sans blanc).`);
    }
    const barre = ligne.indexOf('|');
    const groupe = barre === -1 ? '' : ligne.slice(0, barre).trim();
    const contenu = (barre === -1 ? ligne : ligne.slice(barre + 1)).trim();
    if (!contenu) {
      throw new Error(`${nom} : la ligne ${numero} n'a pas de texte — écrire \`groupe | texte\` ou \`texte\`.`);
    }
    points.push(groupe ? { groupe, texte: contenu } : { texte: contenu });
  });
  return points;
}

/** Une version au format de `package.json` et de `versions.test.ts` : `majeur.mineur.correctif`. */
function versionValide(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * L'entrée de brouillon : le titre neutre de D-152 (`Version 0.1.18`), la date du jour, les
 * points, et `brouillon: true`. Aucune mise en forme ici — c'est `rendreFichier` qui écrit.
 */
export function noteBrouillon({ version, points, date = jour() }) {
  if (!versionValide(version)) {
    throw new Error(`version invalide : ${JSON.stringify(version)} — attendu \`majeur.mineur.correctif\` (0.1.18).`);
  }
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('aucun point : une note sans point ne dit rien (voir lirePoints).');
  }
  return { version, date, titre: `Version ${version}`, points, brouillon: true };
}

/**
 * **L'historique avec le brouillon en tête.** Le fichier est rangé de la plus récente à la
 * plus ancienne (`versions.test.ts` le garde) : on trie comme `notes-versions.mjs` le fait
 * déjà plutôt que de poser l'entrée au hasard — pour la version à venir, le tri la met en
 * tête, et une version oubliée plus ancienne retrouve sa place au lieu de casser l'ordre.
 *
 * Une version qui a déjà sa note est **refusée** : c'est le cas d'une release déjà publiée
 * (ou d'un brouillon déjà écrit), et l'écraser effacerait ce que la release dit.
 */
export function ajouterBrouillon(notes, note) {
  if (notes.some((existante) => existante.version === note.version)) {
    throw new Error(
      `la version ${note.version} a déjà sa note (publiée ou brouillon) — ` +
        'choisis la version suivante, ou retire l’entrée à la main si elle est fausse.'
    );
  }
  return [...notes, note].sort((a, b) => comparer(b.version, a.version));
}

/**
 * **Le geste, en entier** : relire l'historique, refuser ce qui doit l'être, puis réécrire
 * **les deux** fichiers par le générateur — `rendreFichier` et `rendreResume`. Les chemins
 * sont injectables pour que le test écrive dans un bac, jamais dans le dépôt.
 */
export async function ecrireBrouillon({ version, points, date, cible = CIBLE, resume = CIBLE_RESUME }) {
  const note = noteBrouillon({ version, points, date });
  const notes = await notesEnPlace(cible);
  // `notesEnPlace` rend `[]` quand le fichier manque, mais aussi quand il n'exporte plus
  // `NOTES_VERSIONS` : dans le second cas, écrire effacerait tout l'historique en silence.
  if (existsSync(cible) && notes.length === 0) {
    throw new Error(`${cible} existe mais ne rend aucun NOTES_VERSIONS — le fichier est cassé, on n’écrit pas dessus.`);
  }
  const suivantes = ajouterBrouillon(notes, note);
  mkdirSync(dirname(cible), { recursive: true });
  mkdirSync(dirname(resume), { recursive: true });
  writeFileSync(cible, rendreFichier(suivantes));
  writeFileSync(resume, rendreResume(suivantes));
  return { note, notes: suivantes };
}

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/**
 * Les deux options, dans l'ordre de la ligne de commande. Chaque valeur absente est un refus
 * nommé : une commande qui écrit deux fichiers du dépôt ne devine pas son numéro de version.
 */
export function lireArguments(argv) {
  const valeurs = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [nom, colle] = arg.split('=');
    if (!['--version', '--points'].includes(nom)) {
      throw new Error(`option inconnue : ${arg} (attendu : --version <numéro>, --points <fichier>)`);
    }
    const valeur = colle ?? argv[++i];
    if (!valeur || valeur.startsWith('--')) {
      throw new Error(`${nom} demande une valeur.`);
    }
    valeurs.set(nom, valeur);
  }
  if (!valeurs.has('--version')) {
    throw new Error('aucune version : `npm run note:brouillon -- --version 0.1.18 --points <fichier>`.');
  }
  if (!valeurs.has('--points')) {
    throw new Error('aucun fichier de points : ajoute `--points <fichier>`, une ligne par point.');
  }
  return { version: valeurs.get('--version'), points: valeurs.get('--points') };
}

// Tout le CLI est sous cette garde : un test qui importe le module ne lit pas `process.argv`
// (vitest y met ses propres options) et n'écrit rien.
const estEntree = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (estEntree) {
  try {
    const { version, points: fichier } = lireArguments(process.argv.slice(2));
    let texte;
    try {
      texte = readFileSync(resolve(fichier), 'utf8');
    } catch {
      throw new Error(`le fichier de points est introuvable : ${fichier}`);
    }
    const points = lirePoints(texte, fichier);
    const { notes } = await ecrireBrouillon({ version, points });
    console.log(
      `✔ note ${version} écrite en brouillon (${points.length} point(s)) dans ` +
        `src/data/versions.ts et src/data/notes-resume.ts — ${notes.length} note(s) au total`
    );
  } catch (erreur) {
    stop(String(erreur.message ?? erreur));
  }
}
