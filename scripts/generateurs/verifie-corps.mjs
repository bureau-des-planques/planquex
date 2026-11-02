#!/usr/bin/env node
/**
 * **Le corps d'une release, vérifié avant de publier** — ticket #624.
 *
 * Le 02/11/2026, la release `v0.1.17-alpha` a été publiée avec le corps de
 * `docs/ALPHA-TESTEURS.md`. Ce document est le **message aux testeurs**, pas le corps de la
 * release : il est plein de gras et de code, et `src/data/versions.test.ts` refuse le markdown
 * resté dans une note — **après** la publication, au moment de `npm run notes:versions`. Il a
 * fallu réécrire le corps, `gh release edit`, puis régénérer. Le contrôle arrivait **après**
 * l'acte irréversible ; celui-ci arrive **avant** `gh release create`.
 *
 * Il ne réimplémente pas le parseur : il appelle `analyserCorps`
 * (`scripts/generateurs/notes-versions.mjs`), et n'ajoute que la **localisation** des lignes
 * (le générateur, lui, rend des textes sans numéro de ligne) et les trois refus de
 * `docs/VERSIONS.md` §4.2 :
 *
 * 1. du **markdown en ligne** dans le texte que le générateur garde — `**`, un backtick, un
 *    lien `[texte](url)` : la note du jeu est en texte brut, et le markdown s'y lirait tel quel ;
 * 2. une **section vide** — un titre `##` sans aucun point : le générateur la jetterait en
 *    silence, et la release perdrait ce qu'elle prétend dire ;
 * 3. un **point sans phrase** — une puce vide, de moins de trois mots, ou qui ne finit pas par
 *    une ponctuation de fin de phrase (`.`, `!`, `?`, `…`, avec l'espace française et le
 *    guillemet fermant).
 *
 * **Ce qui n'est pas contrôlé, et pourquoi.** Le contrôle porte sur le texte que le générateur
 * **garde** : titres de section et puces, repli compris. Un paragraphe d'introduction est jeté
 * par `analyserCorps`, il ne va pas dans la note — le corps réel de 0.1.16 y porte un code span
 * (« `v0.1.16-alpha` ») et passe pourtant. Les sections de `SECTIONS_ECARTEES`
 * (`## Pour un testeur`, `## Ta sauvegarde`…) sont jetées aussi, et gardent leur markdown :
 * c'est là que se colle le bloc de `npm run problemes`, qui en porte.
 *
 * Usage :
 *   npm run release:verifie --corps <fichier>
 *   npm run release:verifie -- --corps <fichier>
 *   npm run release:verifie <fichier>
 *
 * npm 10 avale `--corps` quand il n'est pas suivi de `--` (il le prend pour une option npm) :
 * la commande reçoit alors le fichier seul. Le script accepte donc les trois écritures.
 *
 * Sortie : **0** quand le corps est conforme, **1** sinon, avec une ligne par défaut nommant
 * le numéro de ligne et l'extrait fautif. Il ne publie rien, n'écrit rien, ne parle pas au
 * réseau : il lit un fichier.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTIONS_ECARTEES, analyserCorps, nettoyer, titreDeLigne } from './notes-versions.mjs';

/** La puce d'une liste, telle que le générateur la lit (`- ` ou `* `). */
const PUCE = /^[-*]\s+(.+)$/;

/** Une puce **vide** — `-` seul, ou suivi d'espaces : le générateur la jette, le contrôle la nomme. */
const PUCE_VIDE = /^[-*]\s*$/;

/** Le markdown en ligne, avec son nom lisible : le texte de la note doit rester brut. */
const MARKDOWN = [
  { quoi: 'du gras (`**`)', motif: /\*\*/ },
  { quoi: 'du code (un backtick)', motif: /`/ },
  { quoi: 'un lien markdown (`[texte](url)`)', motif: /!?\[[^\]]*\]\([^)]*\)/ }
];

/** La fin d'une phrase : ponctuation finale, espace française et guillemet fermant tolérés. */
const FIN_DE_PHRASE = /[.!?…](?:\s?[»"”’)\]]?)$/;

/** En dessous de trois mots, ce n'est pas une phrase lue par un testeur : c'est un fragment. */
const MOTS_MINIMAUX = 3;

/** Une ligne réduite à ce qui se lit dans le rapport : espaces repliés, 140 caractères. */
function extrait(texte) {
  return String(texte ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

/** Le titre sans son marqueur de section (`##`, `###`, `####`) : ce marqueur n'est pas du markdown en ligne. */
function sansDiese(ligne) {
  return ligne.replace(/^#{2,4}\s+/, '');
}

/**
 * **Le corps, section par section, avec les lignes.** Le générateur rend des groupes sans
 * numéro de ligne ; ce localisateur-ci garde le même découpage (titres par `titreDeLigne`,
 * puces par `PUCE`, repli par indentation, sections de `SECTIONS_ECARTEES` jetées) pour pouvoir
 * nommer la ligne fautive. `analyserCorps` reste l'autorité sur **ce que la note contient** :
 * `verifierCorps` confronte les deux et refuse de publier s'ils divergent.
 *
 * Une section `ecartee` est jetée : ses titres et ses puces ne sont ni contrôlés ni comptés.
 */
function lireSections(corps) {
  const sections = [];
  let courante = { titre: null, ligne: 0, brute: '', ecartee: false, points: [] };
  for (const [index, brute] of String(corps ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .entries()) {
    const ligne = brute.trim();
    const numero = index + 1;
    const titre = titreDeLigne(ligne);
    if (titre) {
      if (courante.titre !== null || courante.points.length) sections.push(courante);
      const plat = titre.replace(/’/g, "'");
      courante = {
        titre,
        ligne: numero,
        brute: ligne,
        ecartee: SECTIONS_ECARTEES.some((motif) => motif.test(plat)),
        points: []
      };
      continue;
    }
    const puce = ligne.match(PUCE);
    if (puce && !courante.ecartee) {
      courante.points.push({ ligne: numero, texte: nettoyer(puce[1]), brute: puce[1] });
      continue;
    }
    if (PUCE_VIDE.test(ligne) && !courante.ecartee) {
      courante.points.push({ ligne: numero, texte: '', brute: ligne });
      continue;
    }
    // Une ligne **indentée** qui suit une puce est la suite de sa phrase : les corps sont
    // repliés à 80 colonnes, et le générateur la recolle (même règle, même `nettoyer`).
    if (/^\s{2,}\S/.test(brute) && !courante.ecartee && courante.points.length) {
      const dernier = courante.points[courante.points.length - 1];
      const suite = nettoyer(ligne);
      if (suite) {
        dernier.texte = `${dernier.texte} ${suite}`.trim();
        dernier.brute = `${dernier.brute}\n${ligne}`;
      }
    }
  }
  if (courante.titre !== null || courante.points.length) sections.push(courante);
  return sections;
}

/**
 * **Le corps d'une release est-il publiable ?** Rend les défauts trouvés, chacun avec sa ligne,
 * et le regard du générateur (les groupes d'`analyserCorps`). Fonction pure : aucun accès au
 * disque, aucun `process.exit` — le test l'éprouve directement.
 */
export function verifierCorps(corps, { nom = 'le corps de la release' } = {}) {
  const defauts = [];
  const ajouter = (ligne, quoi, brute) => defauts.push({ ligne, quoi, extrait: extrait(brute) });

  if (!String(corps ?? '').trim()) {
    ajouter(1, 'le corps est vide — une release sans corps ne dit rien');
    return { ok: false, nom, defauts, groupes: [], sections: [], points: 0, ecartees: [] };
  }

  const sections = lireSections(corps);
  const gardees = sections.filter((section) => section.titre !== null && !section.ecartee);
  const ecartees = sections.filter((section) => section.ecartee);

  if (gardees.length === 0) {
    ajouter(1, 'aucune section : le corps n’a pas de titre `##` qui nourrisse la note');
  }

  // Le markdown en ligne, sur le texte **brut** que le générateur garde : `nettoyer` le retire
  // en silence, et c'est justement ce silence qui a laissé passer le corps de 0.1.17.
  const textes = [];
  for (const section of sections) {
    if (section.ecartee) continue;
    if (section.titre !== null) textes.push({ ligne: section.ligne, quoi: 'le titre', brut: sansDiese(section.brute) });
    for (const point of section.points) textes.push({ ligne: point.ligne, quoi: 'le point', brut: point.brute });
  }
  for (const { ligne, quoi, brut } of textes) {
    for (const { quoi: marque, motif } of MARKDOWN) {
      if (motif.test(brut)) ajouter(ligne, `${quoi} porte ${marque}`, brut);
    }
  }

  // La section vide, puis le point sans phrase — sur les seules sections qui nourrissent la note.
  // Le générateur **jette** une puce vide (`nettoyer` rend `''`, et il ne la pousse pas) : elle
  // n'entre pas dans `pointsUtiles`, sinon le contrôle de divergence ci-dessous crierait à tort.
  for (const section of gardees) {
    if (section.points.length === 0) {
      ajouter(section.ligne, 'une section vide (le titre ne porte aucun point)', section.brute);
      continue;
    }
    for (const point of section.points) {
      const mots = point.texte.split(/\s+/).filter(Boolean);
      if (!point.texte) {
        ajouter(point.ligne, 'un point sans phrase (la puce est vide)', point.brute);
      } else if (mots.length < MOTS_MINIMAUX) {
        ajouter(point.ligne, `un point sans phrase (${mots.length} mot(s), il en faut ${MOTS_MINIMAUX})`, point.brute);
      } else if (!FIN_DE_PHRASE.test(point.texte)) {
        ajouter(
          point.ligne,
          'un point sans phrase (il ne finit pas par une ponctuation de fin de phrase)',
          point.brute
        );
      }
    }
  }

  // Le générateur reste l'autorité sur ce que la note contient : si le localisateur et lui ne
  // lisent pas les mêmes puces, le contrôle est faux — et un contrôle faux ne publie pas.
  const groupes = analyserCorps(corps);
  const attendus = groupes.flatMap((groupe) => groupe.points);
  const pointsUtiles = sections
    .filter((section) => !section.ecartee)
    .flatMap((section) => section.points.map((point) => point.texte))
    .filter(Boolean);
  if (attendus.length !== pointsUtiles.length || attendus.some((texte, index) => texte !== pointsUtiles[index])) {
    ajouter(1, 'le localisateur a divergé du générateur (`analyserCorps`) — corriger le contrôle avant de publier', '');
  }

  defauts.sort((a, b) => a.ligne - b.ligne);
  const comptePoints = (section) => section.points.filter((point) => point.texte).length;
  return {
    ok: defauts.length === 0,
    nom,
    defauts,
    groupes,
    sections: gardees.map((section) => ({ titre: section.titre, ligne: section.ligne, points: comptePoints(section) })),
    points: gardees.reduce((total, section) => total + comptePoints(section), 0),
    ecartees: ecartees.map((section) => ({ titre: section.titre, ligne: section.ligne }))
  };
}

/**
 * Les arguments de la ligne de commande. npm 10 avale `--corps` quand il n'est pas suivi de
 * `--` : le fichier arrive alors **seul**, en positionnel. Les trois écritures sont reçues, et
 * tout le reste est refusé — un contrôle qui ne sait pas ce qu'il lit ne lit rien.
 */
export function lireArguments(argv) {
  const fichiers = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--corps') {
      const valeur = argv[++i];
      if (!valeur || valeur.startsWith('--')) throw new Error('`--corps` demande un fichier.');
      fichiers.push(valeur);
    } else if (arg.startsWith('--corps=')) {
      const valeur = arg.slice('--corps='.length);
      if (!valeur) throw new Error('`--corps=` demande un fichier.');
      fichiers.push(valeur);
    } else if (arg.startsWith('--')) {
      throw new Error(`option inconnue : ${arg} (attendu : --corps <fichier>).`);
    } else {
      fichiers.push(arg);
    }
  }
  if (fichiers.length === 0) {
    throw new Error('aucun fichier : `npm run release:verifie --corps <fichier>`.');
  }
  if (fichiers.length > 1) {
    throw new Error(`un seul fichier à la fois : ${fichiers.join(', ')}.`);
  }
  return { fichier: fichiers[0] };
}

/** Le rapport lisible d'un verdict : la ligne d'ouverture, puis un défaut par ligne. */
export function formaterVerdict(verdict) {
  if (!verdict.ok) {
    const lignes = verdict.defauts.map((defaut) => `  ligne ${defaut.ligne} : ${defaut.quoi} — « ${defaut.extrait} »`);
    return [
      `✖ ${verdict.nom} : corps de release refusé — ${verdict.defauts.length} défaut(s)`,
      ...lignes,
      '  La convention est dans `docs/VERSIONS.md` §4.2 : sections thématiques `##`, chaque point',
      '  une phrase complète, aucun markdown en ligne. Vérifier avant `gh release create`.'
    ].join('\n');
  }
  const titres = verdict.groupes.map((groupe) => groupe.titre ?? '(sans titre)');
  const resume = verdict.groupes.map(
    (groupe) => `  · ${groupe.titre ?? '(sans titre)'} (${groupe.points.length} point(s))`
  );
  return [
    `✔ ${verdict.nom} : corps conforme — ${verdict.groupes.length} section(s), ${verdict.points} point(s)`,
    ...resume,
    titres.length
      ? `  le générateur en ferait la note : ${titres.join(', ')}`
      : '  le générateur n’en ferait aucune note'
  ].join('\n');
}

// Tout le CLI est sous cette garde : un test qui importe le module n'ouvre aucun fichier et ne
// lit pas `process.argv` (vitest y met ses propres options).
const estEntree = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (estEntree) {
  try {
    const { fichier } = lireArguments(process.argv.slice(2));
    let corps;
    try {
      corps = readFileSync(resolve(fichier), 'utf8');
    } catch {
      throw new Error(`le fichier est illisible : ${fichier}`);
    }
    const verdict = verifierCorps(corps, { nom: fichier });
    if (verdict.ok) {
      console.log(formaterVerdict(verdict));
    } else {
      console.error(formaterVerdict(verdict));
      process.exitCode = 1;
    }
  } catch (erreur) {
    console.error(`✖ ${String(erreur.message ?? erreur)}`);
    process.exitCode = 1;
  }
}
