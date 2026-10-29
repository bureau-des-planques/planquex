#!/usr/bin/env node
/**
 * **Les fonctionnalités prévues, prises à GitHub** — ticket #214, D-097 (3).
 *
 * La feuille de route (`/feuille-de-route`) montre ce qui arrive : les **issues `alpha`
 * et `beta` ouvertes** du dépôt. Le label dit **à quel jalon** un ticket appartient, pas
 * quand on le travaille : un ticket `beta` se travaille pendant l'alpha (#336). Elles ne
 * se recopient pas à la main — une liste tenue à la main se désynchronise en silence —
 * elles sont lues ici et écrites dans `src/data/plan-dev.ts`, sur le patron de
 * `npm run notes:versions` (D-090). Chaque entrée porte son étape.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : l'écran doit marcher
 * **hors ligne**, et lire `FEATURES_PREVUES` ne demande **rien à configurer** — ni jeton,
 * ni requête au chargement de la page, ni dépendance de plus dans le bundle. Le dépôt est
 * public depuis D-118, donc un appel serait possible ; il rendrait l'écran dépendant du
 * réseau et de l'API, pour une liste qui change quand une issue s'ouvre. Ce script est
 * donc le seul pont avec GitHub, lancé au build de l'auteur, jamais dans la CI.
 *
 * **Sans lien** : le fichier ne porte **jamais** d'URL. Les seuls liens vers le dépôt que
 * D-132 ouvre — les **releases** et les **chantiers ouverts** — sont composés par la page
 * (`lienIssue`, `LIEN_RELEASES`) à partir du **numéro** ; une adresse écrite ici
 * vieillirait avec l'état du tracker, et le test vérifie qu'aucune ne s'y glisse.
 *
 * Usage :
 *   npm run plan:dev              écrit src/data/plan-dev.ts
 *   npm run plan:dev -- --verifie n'écrit rien, et sort 1 si le fichier diverge
 *   npm run plan:dev -- --json    imprime la liste, sans écrire
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const CIBLE = join(root, 'src/data/plan-dev.ts');

/** Les libellés des issues qui entrent : une **étape du projet**, et rien d'autre (D-048, #336). */
export const ETAPES = ['alpha', 'beta'];

/**
 * Une issue GitHub → une entrée de `plan-dev.ts`.
 *
 * Elle **lève** au lieu de tolérer une entrée vide ou sans étape : une puce sans titre ne
 * dit rien, et une puce sans étape ne se range dans aucune des deux listes. C'est la garde
 * qui mord, et `scripts/generateurs/plan-dev.test.ts` la confronte à une issue fautive.
 */
export function entreeDe(issue) {
  const numero = Number(issue?.number);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`numéro d’issue invalide : ${JSON.stringify(issue?.number)}`);
  }
  // Un titre tient sur une ligne : GitHub n'y met pas de retour, mais un copier-coller
  // pourrait en glisser un, et il casserait le littéral écrit dans le fichier.
  const titre = String(issue?.title ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!titre) throw new Error(`l’issue #${numero} n’a pas de titre`);
  const etape = etapeDe(issue);
  if (!etape) {
    throw new Error(`l’issue #${numero} ne porte aucune étiquette d’étape (${ETAPES.join(' ou ')})`);
  }
  return { numero, titre, etape };
}

/** L'étape d'une issue : la première des étiquettes connues qu'elle porte, sinon `null`. */
function etapeDe(issue) {
  const noms = (Array.isArray(issue?.labels) ? issue.labels : [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .map((nom) => String(nom ?? '').toLowerCase());
  return ETAPES.find((etape) => noms.includes(etape)) ?? null;
}

/**
 * Les issues **`alpha` et `beta` ouvertes**, de la plus récente à la plus ancienne.
 *
 * `gh` est injecté : le test n'appelle rien et ne dépend ni du réseau ni de l'état du
 * dépôt un jour donné. La recherche `label:alpha,beta` est un **OU** : un ticket ne porte
 * qu'une étape (le triage l'interdit), et c'est `entreeDe` qui la lit dans ses étiquettes.
 */
export function lireIssues(gh = ghJson) {
  const liste = gh([
    'issue',
    'list',
    '--search',
    `label:${ETAPES.join(',')}`,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,labels'
  ]);
  if (!Array.isArray(liste)) throw new Error('gh n’a pas rendu une liste d’issues');
  return liste.map(entreeDe).sort((a, b) => b.numero - a.numero);
}

function ghJson(args) {
  try {
    return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', cwd: root }));
  } catch (erreur) {
    stop(
      `gh a échoué (${args.join(' ')}) : ${String(erreur.stderr ?? erreur.message).trim()}\n` +
        '  Vérifie `gh auth status` — la lecture des issues demande une session GitHub.'
    );
  }
}

/** Le fichier entier : l'en-tête, le type, la liste. Aucune URL, jamais (D-132). */
export function rendreFichier(features) {
  const corps = features
    .map(
      (feature) =>
        `  {\n    numero: ${feature.numero},\n    titre: ${q(feature.titre)},\n    etape: ${q(feature.etape)}\n  }`
    )
    .join(',\n');
  return `/**
 * **Ce qui arrive** — les chantiers prévus, par étape (D-097 (3), #214, #336).
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par \`npm run plan:dev\`
 * (\`scripts/generateurs/plan-dev.mjs\`) à partir des **issues \`alpha\` et \`beta\` ouvertes** du
 * dépôt, qui restent la source de ce qui arrive. Le label d'étape dit **à quel jalon un
 * ticket appartient**, pas quand on le travaille : un ticket \`beta\` se travaille pendant
 * l'alpha. Fermer une issue la retire de cette liste à la génération suivante.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : l'écran marche
 * **hors ligne**, et il n'y a **rien à configurer** — ni jeton, ni requête au chargement.
 * Le dépôt est public depuis D-118, donc un appel serait possible ; il rendrait l'écran
 * dépendant du réseau pour une liste qui bouge quand une issue s'ouvre. Le pont avec
 * GitHub est le script, lancé au build de l'auteur — jamais dans la CI, qui n'a ni \`gh\`
 * ni réseau vers GitHub.
 *
 * **Sans lien** : ce fichier ne porte **aucune URL**. Les seuls liens vers le dépôt que
 * D-132 ouvre — les **releases** et les **chantiers ouverts** — sont composés par la page
 * (\`lienIssue\`, \`LIEN_RELEASES\`) à partir du **numéro** ; une adresse écrite ici
 * vieillirait avec l'état du tracker, et \`scripts/generateurs/plan-dev.test.ts\` vérifie qu'aucune
 * ne s'y glisse.
 */

/** Une étape du projet : le jalon auquel un chantier appartient (D-048). */
export type EtapeProjet = 'alpha' | 'beta';

export interface FeaturePrevue {
  /** Le numéro de l'issue, affiché \`#214\` : c'est ce qui permet de la retrouver. */
  numero: number;
  /** Le titre de l'issue, sur une ligne. */
  titre: string;
  /** L'étape à laquelle le chantier appartient — affichée à côté de son numéro. */
  etape: EtapeProjet;
}

/** Les issues \`alpha\` et \`beta\` ouvertes, **de la plus récente à la plus ancienne**. */
export const FEATURES_PREVUES: FeaturePrevue[] = [
${corps}
];
`;
}

/**
 * **Le contrôle de fraîcheur, hors réseau** : `null` quand le fichier est exactement ce
 * que le générateur écrirait, sinon la phrase qui dit l'écart et le geste à faire.
 *
 * Exporté pour que `scripts/generateurs/plan-dev.test.ts` le confronte à un fichier **volontairement
 * périmé** : sans ce cas, on ne garderait que l'apparence du contrôle (#231). C'est la
 * fonction que le `--verifie` appelle, pas une copie — un test qui passe à côté du code
 * de production ne garde rien.
 */
export function divergence(actuel, attendu) {
  return actuel === attendu ? null : 'src/data/plan-dev.ts a divergé de GitHub — lance `npm run plan:dev`.';
}

/** Un titre mis en forme comme le reste du dépôt : guillemets simples, apostrophes typographiques. */
function q(texte) {
  return `'${String(texte).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

// `import.meta.main` n'existe pas partout : on regarde si ce fichier est l'entrée.
// **Tout le CLI est sous cette garde** : un test qui importe le module ne doit ni lire
// `process.argv` (vitest y met ses propres options), ni appeler `gh`.
const estEntree = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (estEntree) {
  const option = process.argv.slice(1).find((arg) => arg.startsWith('--'));
  if (option && !['--verifie', '--json'].includes(option)) {
    stop(`option inconnue : ${option} (attendu : --verifie, --json)`);
  }

  let features;
  try {
    features = lireIssues();
  } catch (erreur) {
    stop(String(erreur.message ?? erreur));
  }
  const contenu = rendreFichier(features);

  if (option === '--json') {
    console.log(JSON.stringify(features, null, 2));
  } else if (option === '--verifie') {
    let actuel;
    try {
      actuel = readFileSync(CIBLE, 'utf8');
    } catch {
      stop('src/data/plan-dev.ts est absent — lance `npm run plan:dev`.');
    }
    const ecart = divergence(actuel, contenu);
    if (ecart) stop(ecart);
    console.log(`✔ src/data/plan-dev.ts est à jour (${features.length} issue(s) alpha ou beta ouverte(s))`);
  } else {
    writeFileSync(CIBLE, contenu);
    console.log(`✔ src/data/plan-dev.ts écrit — ${features.length} issue(s) alpha ou beta ouverte(s) sur GitHub`);
  }
}
