#!/usr/bin/env node
/**
 * **Le journal des versions, pris à GitHub** — ticket #182.
 *
 * `src/data/versions.ts` alimente l'écran `/feuille-de-route` : c'est là qu'un invité lit ce
 * que la version qu'il a sous les yeux contient. Ce fichier-là est **généré** par ce
 * script, à partir des **releases GitHub** — les notes réellement publiées, écrites une
 * fois par version. Personne ne recopie plus à la main ce qu'une release dit.
 *
 * **Pourquoi pas un appel depuis l'application ?** Le dépôt est **privé** : l'API GitHub
 * répond `404` sans jeton (mesuré le 24/10/2026), et un jeton dans le bundle se lit dans
 * les DevTools de n'importe qui. L'application lit donc un fichier **embarqué au build**
 * (elle marche hors ligne, et il n'y a rien à configurer), et ce script est le seul pont
 * avec GitHub. Il tourne **avant de taguer**, pas pendant `npm run build` : la CI n'a ni
 * `gh` ni réseau vers GitHub, et un build qui dépend du réseau ne se rejoue pas.
 *
 * Usage :
 *   npm run notes:versions              écrit src/data/versions.ts
 *   npm run notes:versions -- --verifie n'écrit rien, et sort 1 si le fichier diverge
 *   npm run notes:versions -- --json    imprime les notes, sans écrire
 *
 * **Ce que le script ne fait pas** : il ne touche jamais au corps de la release. Il le
 * lit, il le met en forme, il jette le message aux testeurs (voir `SECTIONS_ECARTEES`),
 * et il garde les notes **brouillon** écrites à la main (`brouillon: true`) tant que leur
 * version n'est pas publiée sur GitHub. Le jour du tag, la release prend la place du
 * brouillon — c'est le seul geste que la publication demande.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CIBLE = join(root, 'src/data/versions.ts');
const SOURCE = pathToFileURL(CIBLE).href;

/**
 * Les titres de section qu'on **jette**, avec leur raison : ce sont les mots adressés
 * aux testeurs (« ta sauvegarde », « comment remonter un retour ») ou l'état de l'alpha
 * (« ce qui n'existe pas encore »), pas ce que la version contient. La liste est courte
 * et choisie : un titre qui n'y est pas entre dans la note.
 */
const SECTIONS_ECARTEES = [
  /^ta sauvegarde$/i,
  /^comment remonter un retour$/i,
  /^pour un testeur$/i,
  /^adresse$/i,
  /^ce qui n'existe pas encore$/i
];

/** Le bruit markdown d'un corps de release : on garde la phrase, pas la mise en forme. */
export function nettoyer(texte) {
  return (
    texte
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // une image ne dit rien dans une liste
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // un lien garde son texte
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, '$1$2')
      .replace(/\s+/g, ' ')
      // Les corps de release écrivent l'apostrophe droite ; le reste du projet écrit la
      // typographique. On ne touche qu'à celle qui est **entre deux lettres** : une citation
      // entre guillemets, un code, un nom de fichier ne bougent pas.
      .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
      .trim()
  );
}

/** Deux titres se comparent sans se soucier de l'apostrophe : GitHub n'écrit pas la même. */
function memeTitre(a, b) {
  const plat = (texte) => texte.replace(/[’']/g, "'").toLowerCase();
  return plat(a) === plat(b);
}

/**
 * Les titres que GitHub **ne porte pas** : quand le nom de la release est nu
 * (« Alpha · 0.1.6 »), il n'y a rien à lire. C'est un **libellé**, pas du contenu — le
 * corps de la release, lui, n'est jamais touché. Un nom qui porte déjà son titre après un
 * tiret (0.1.2) se lit tout seul et n'a pas besoin d'entrer ici.
 */
const TITRES = {
  '0.1.1': 'L’alpha ouvre ses portes',
  '0.1.3': 'La partie à deux, et le mur des retours',
  '0.1.4': 'Le combat se lit d’un coup',
  '0.1.5': 'Le mur des retours fonctionne de bout en bout',
  '0.1.6': 'L’Atelier a ses illustrations',
  '0.1.13': 'Le comité se suit, et le combat tient dans l’écran'
};

/** Un titre de groupe : `## …`, `### …`, ou une ligne en gras toute seule. */
function titreDeLigne(ligne) {
  const titre = ligne.match(/^#{2,4}\s+(.+)$/);
  if (titre) return nettoyer(titre[1].replace(/[⚠️✅🚧🔧]+\s*/gu, ''));
  const gras = ligne.match(/^\*\*(.+?)\*\*[.:]?\s*$/);
  // Un point final sur une ligne en gras est une phrase d'ouverture, pas un titre de
  // section : on le retire pour que le titre se lise comme un titre.
  if (gras) return nettoyer(gras[1]).replace(/\.$/, '');
  return null;
}

/**
 * **Le corps d'une release, mis en groupes de points.**
 *
 * Les listes à puces (`- `) sont des points ; les titres deviennent des groupes ; tout
 * le reste — paragraphes d'introduction, listes numérotées, tableaux, citations — est
 * ignoré : c'est du commentaire, pas un changement. Les sections de `SECTIONS_ECARTEES`
 * et leur contenu sont jetées.
 *
 * Fonction pure, et exportée : `scripts/notes-versions.test.ts` l'éprouve sur des corps
 * réels, sans réseau.
 */
export function analyserCorps(corps) {
  const groupes = [];
  let courant = { titre: null, points: [] };
  let ecarte = false;

  for (const brute of (corps ?? '').split('\n')) {
    const ligne = brute.trim();
    const titre = titreDeLigne(ligne);
    if (titre) {
      if (courant.points.length) groupes.push(courant);
      // La comparaison se fait sans apostrophe typographique : `nettoyer` vient d'en
      // poser une dans « n'existe », et une liste de titres ne doit pas s'en soucier.
      const plat = titre.replace(/’/g, "'");
      ecarte = SECTIONS_ECARTEES.some((motif) => motif.test(plat));
      courant = { titre, points: [] };
      continue;
    }
    const puce = ligne.match(/^[-*]\s+(.+)$/);
    if (puce && !ecarte) {
      const texte = nettoyer(puce[1]);
      if (texte) courant.points.push(texte);
      continue;
    }
    // Une ligne **indentée** qui suit une puce est la suite de sa phrase : les corps de
    // release sont repliés à 80 colonnes, et couper « … et la fiche » sans « de chaque
    // carte » serait un mensonge. Une ligne non indentée est un paragraphe : ignoré.
    if (/^\s{2,}\S/.test(brute) && !ecarte && courant.points.length) {
      const suite = nettoyer(ligne);
      if (suite) courant.points[courant.points.length - 1] += ` ${suite}`;
    }
  }
  if (courant.points.length) groupes.push(courant);
  return groupes;
}

/** Une minuscule de début de titre devient une majuscule : « illustrations servies » → « Illustrations servies ». */
function capitaliser(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Le titre de la note. GitHub le porte dans le **nom** de la release, après un tiret
 * (« Alpha · 0.1.2 — illustrations servies par Vite ») ; sinon il est dans `TITRES`.
 * Il ne s'invente jamais ailleurs.
 */
export function titreDe(release) {
  const nom = (release.name ?? '').trim();
  const apres = nom
    .split(/\s[—–]\s/)
    .slice(1)
    .join(' — ')
    .trim();
  if (apres) return capitaliser(apres);
  const version = release.tagName.replace(/^v/, '');
  return TITRES[version] ?? `Version ${version}`;
}

/** Le jour de publication, en `AAAA-MM-JJ` — le format que la page sait lire. */
function jourDe(release) {
  return new Date(release.publishedAt ?? release.createdAt).toISOString().slice(0, 10);
}

/** Une release GitHub → une entrée de `versions.ts`. */
export function entreeDe(release) {
  const version = release.tagName.replace(/^v/, '');
  const groupes = analyserCorps(release.body);
  const titre = titreDe(release);

  // Le groupe qui porte déjà le titre **garde ses points** : on lui retire son étiquette,
  // sinon son contenu (les 27 cartes de l'Atelier, par exemple) disparaîtrait de la note.
  const points = groupes.flatMap((groupe) =>
    groupe.points.map((texte) =>
      groupe.titre && !memeTitre(groupe.titre, titre) ? { groupe: groupe.titre, texte } : { texte }
    )
  );

  const note = { version, date: jourDe(release), titre, points };
  if (release.isDraft) note.brouillon = true;
  return note;
}

/** Les releases, de la plus récente à la plus ancienne. `gh` est injecté : le test n'appelle rien. */
export function lireReleases(gh = ghJson) {
  const liste = gh(['release', 'list', '--limit', '200', '--json', 'tagName,publishedAt,name,isDraft']);
  const releases = liste
    .map((release) => gh(['release', 'view', release.tagName, '--json', 'tagName,name,body,publishedAt,isDraft']))
    // Un tag qui n'est pas une version (`v0.1.1` oui, `alpha-2026` non) n'a pas sa note ici.
    .filter((release) => /^v\d+\.\d+\.\d+$/.test(release.tagName));
  return releases.sort((a, b) => comparer(b.tagName.replace(/^v/, ''), a.tagName.replace(/^v/, '')));
}

function ghJson(args) {
  try {
    return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', cwd: root }));
  } catch (erreur) {
    stop(
      `gh a échoué (${args.join(' ')}) : ${String(erreur.stderr ?? erreur.message).trim()}\n` +
        '  Vérifie `gh auth status` — le dépôt est privé, donc le jeton est nécessaire.'
    );
  }
}

/** Les trois nombres, comparés un à un : `0.1.10` vient après `0.1.9`. */
export function comparer(a, b) {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

/**
 * Le **brouillon** déjà écrit à la main, conservé jusqu'à sa publication.
 *
 * On relit le fichier par un `import` (Node 24 lit le TypeScript tout seul) plutôt qu'à
 * coups d'expressions régulières : la forme est celle du fichier, et une entrée mal
 * écrite se voit tout de suite. Une version **publiée sur GitHub** remplace le brouillon
 * du même numéro — c'est le geste de la publication, et rien d'autre.
 */
export async function brouillonsEnPlace(chemin = CIBLE) {
  let notes;
  try {
    notes = (await import(`${pathToFileURL(chemin).href}?v=${Date.now()}`)).NOTES_VERSIONS;
  } catch (erreur) {
    // Premier passage, ou fichier absent : il n'y a alors aucun brouillon à garder.
    if (/Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(erreur))) return [];
    throw erreur;
  }
  const brouillons = (notes ?? []).filter((note) => note.brouillon);
  for (const note of brouillons) {
    if (!note.points?.every((point) => point && typeof point.texte === 'string')) {
      stop(
        `le brouillon ${note.version} n'a pas la forme attendue (des points { texte, groupe? }) : ` +
          'corrige-le à la main, le script ne devine pas.'
      );
    }
  }
  return brouillons;
}

/** Le fichier entier : l'en-tête, les types, l'historique, et les deux fonctions. */
export function rendreFichier(notes) {
  const corps = notes.map(rendreEntree).join(',\n');
  return `/**
 * **Le journal des versions** — ce que chaque version publiée contient.
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par
 * \`npm run notes:versions\` (\`scripts/notes-versions.mjs\`) à partir des **releases
 * GitHub** du dépôt, qui restent la source des notes. Une version publiée sans release
 * n'a donc pas d'entrée ici, et \`src/data/versions.test.ts\` refuse que la version de
 * \`package.json\` manque.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : le dépôt est **privé**,
 * l'API répond \`404\` sans jeton, et un jeton dans le bundle se lit dans les DevTools.
 * L'application lit donc ce fichier, embarqué au build : elle marche **hors ligne**, et
 * il n'y a rien à configurer. Le pont avec GitHub est le script, lancé **avant de
 * taguer** (\`docs/VERSIONS.md\` §4).
 *
 * **Une seule entorse à la règle « aucun numéro en dur dans \`src/\` »**, et elle est
 * voulue : ce fichier **est** l'historique, donc il nomme les versions passées. La garde
 * de \`src/version.test.ts\` l'admet nommément ; la version **courante**, elle, ne se lit
 * que par \`APP_LABEL\` (\`src/version.ts\`), et \`versions.test.ts\` vérifie qu'elle a bien
 * sa note ici.
 *
 * **L'ordre des gestes, quand on publie** (\`docs/VERSIONS.md\` §4) : on écrit d'abord la
 * note de la version à venir ici — le tag part **avant** la release GitHub, donc exiger la
 * release rendrait la garde inapplicable au moment où elle sert. La release publiée
 * remplace ensuite cette entrée (\`npm run notes:versions\`), et le drapeau \`brouillon\`
 * tombe avec elle.
 */

export interface PointNote {
  /** Le groupe de la release, quand elle en avait un (« Jeu », « Interface et captures »). */
  groupe?: string;
  /** Le point lui-même, en clair : le markdown de la release est retiré à la génération. */
  texte: string;
}

export interface NoteVersion {
  /** Le numéro, sans le \`v\` du tag : \`0.1.6\`. C'est lui qu'on compare à \`package.json\`. */
  version: string;
  /** Le jour de la publication, au format \`AAAA-MM-JJ\` (celui de la release). */
  date: string;
  /** Le titre de la release, raccourci quand il portait le libellé complet. */
  titre: string;
  /** Ce que la version change, groupé par thème quand il y a beaucoup à dire. */
  points: PointNote[];
  /**
   * Une note **écrite d'avance**, que GitHub ne connaît pas encore : elle attend sa
   * release. Elle **compte** pour la garde (« on ne publie pas une version sans sa note »,
   * et le tag part avant la release) ; l'écran, lui, ne montre pas la note d'une version
   * qui n'est pas celle sous les yeux. La release publiée prendra sa place, et le drapeau
   * tombera avec elle.
   */
  brouillon?: boolean;
}

/**
 * L'historique, **de la plus récente à la plus ancienne**.
 *
 * La forme est gardée par \`versions.test.ts\` : une version publiée sans entrée, un ordre
 * cassé, une date mal écrite ou une entrée vide font échouer la suite.
 */
export const NOTES_VERSIONS: NoteVersion[] = [
${corps}
];

/** La note d'une version — publiée, ou écrite d'avance. */
export function noteDe(
  version: string,
  notes: NoteVersion[] = NOTES_VERSIONS
): NoteVersion | undefined {
  return notes.find((note) => note.version === version);
}

/**
 * **La garde** : \`true\` quand la version courante n'a **aucune** note.
 *
 * C'est la règle de \`docs/VERSIONS.md\` rendue exécutable : on ne publie pas une version
 * sans sa note. Une note écrite d'avance compte — le tag part **avant** la release GitHub,
 * donc exiger la release rendrait la règle inapplicable au moment où elle sert.
 *
 * La fonction prend ses notes en paramètre pour que le test puisse la confronter à un
 * **cas fautif** — sans quoi l'assertion ne garderait rien.
 */
export function noteManquante(
  version: string,
  notes: NoteVersion[] = NOTES_VERSIONS
): boolean {
  return noteDe(version, notes) === undefined;
}
`;
}

/** Une entrée, mise en forme comme le reste du dépôt : deux espaces, guillemets simples. */
function rendreEntree(note) {
  const q = (texte) => `'${String(texte).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const points = note.points
    .map((point) => {
      const texte = `        texte: ${q(point.texte)}`;
      return point.groupe
        ? `      {\n        groupe: ${q(point.groupe)},\n${texte}\n      }`
        : `      {\n${texte}\n      }`;
    })
    .join(',\n');

  return `  {
    version: ${q(note.version)},
    date: ${q(note.date)},
    titre: ${q(note.titre)},${note.brouillon ? '\n    brouillon: true,' : ''}
    points: [
${points}
    ]
  }`;
}

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/** Ce que le script a produit : les notes, et ce qu'il faut savoir sur elles. */
export async function construire(releases, chemin = CIBLE) {
  const surGithub = releases.map(entreeDe);
  const numeros = new Set(surGithub.map((note) => note.version));
  // Un brouillon qui n'est pas encore publié est conservé tel quel ; celui dont la
  // release est sortie est remplacé par elle (le drapeau tombe avec le tag).
  const brouillons = (await brouillonsEnPlace(chemin)).filter((note) => !numeros.has(note.version));
  const notes = [...surGithub, ...brouillons].sort((a, b) => comparer(b.version, a.version));
  return { notes, brouillons, surGithub };
}

// `import.meta.main` n'existe pas encore partout : on regarde si ce fichier est l'entrée.
// **Tout le CLI est sous cette garde** : un test qui importe le module ne doit ni lire
// `process.argv` (vitest y met ses propres options), ni appeler `gh`.
const estEntree = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (estEntree) {
  const option = process.argv.slice(1).find((arg) => arg.startsWith('--'));
  if (option && !['--verifie', '--json'].includes(option)) {
    stop(`option inconnue : ${option} (attendu : --verifie, --json)`);
  }

  const { notes, brouillons, surGithub } = await construire(lireReleases());
  const contenu = rendreFichier(notes);

  if (option === '--json') {
    console.log(JSON.stringify({ notes, brouillons: brouillons.map((note) => note.version) }, null, 2));
  } else if (option === '--verifie') {
    const actuel = readFileSync(CIBLE, 'utf8');
    if (actuel !== contenu) {
      const avant = new Set((actuel.match(/version: '([^']+)'/g) ?? []).map((ligne) => ligne.slice(10, -1)));
      const apres = new Set(notes.map((note) => note.version));
      const absentes = notes.filter((note) => !avant.has(note.version)).map((note) => note.version);
      const enTrop = [...avant].filter((version) => !apres.has(version));
      stop(
        'src/data/versions.ts a divergé de GitHub — lance `npm run notes:versions`.\n' +
          (absentes.length ? `  manquantes : ${absentes.join(', ')}\n` : '') +
          (enTrop.length ? `  en trop : ${enTrop.join(', ')}\n` : '')
      );
    }
    console.log(`✔ src/data/versions.ts est à jour (${notes.length} notes, dont ${brouillons.length} brouillon(s))`);
  } else {
    writeFileSync(CIBLE, contenu);
    console.log(
      `✔ src/data/versions.ts écrit — ${surGithub.length} release(s) lue(s) sur GitHub, ` +
        `${brouillons.length} brouillon(s) conservé(s)` +
        (brouillons.length ? ` : ${brouillons.map((note) => note.version).join(', ')}` : '')
    );
  }
}
