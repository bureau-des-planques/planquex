#!/usr/bin/env node
/**
 * **Les fonctionnalités prévues, prises à GitHub** — ticket #214, D-097 (3).
 *
 * La feuille de route (`/feuille-de-route`) montre ce qui arrive : les **issues `alpha`
 * ouvertes** du dépôt. Elles ne se recopient pas à la main — une liste tenue à la main
 * se désynchronise en silence — elles sont lues ici et écrites dans
 * `src/data/plan-dev.ts`, sur le patron de `npm run notes:versions` (D-090).
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : le dépôt est **privé**,
 * l'API répond `404` sans jeton (mesuré le 24/10/2026 pour les notes de version), et un
 * jeton dans le bundle se lit dans les DevTools. L'écran lit donc un fichier **commité**,
 * embarqué au build : il marche **hors ligne**, et il n'y a rien à configurer. Ce script
 * est le seul pont avec GitHub, et il tourne au build de l'auteur, jamais dans la CI.
 *
 * **Sans lien** : le dépôt est privé, donc `#214` se lit mais `https://github.com/…` ne
 * s'ouvre pas pour un invité (D-097 (3)). Le fichier ne porte donc **jamais** d'URL, et
 * le test le vérifie.
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

const root = fileURLToPath(new URL('..', import.meta.url));
const CIBLE = join(root, 'src/data/plan-dev.ts');

/** Le libellé des issues qui entrent : celles de l'**étape en cours** (D-048). */
export const LABEL = 'alpha';

/**
 * Une issue GitHub → une entrée de `plan-dev.ts`.
 *
 * Elle **lève** au lieu de tolérer une entrée vide : une puce sans titre ne dit rien, et
 * un générateur qui l'accepterait la publierait sans que personne le voie. C'est la garde
 * qui mord, et `scripts/plan-dev.test.ts` la confronte à une issue fautive.
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
  return { numero, titre };
}

/**
 * Les issues **`alpha` ouvertes**, de la plus récente à la plus ancienne.
 *
 * `gh` est injecté : le test n'appelle rien et ne dépend ni du réseau ni de l'état du
 * dépôt un jour donné.
 */
export function lireIssues(gh = ghJson) {
  const liste = gh(['issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '200', '--json', 'number,title']);
  if (!Array.isArray(liste)) throw new Error('gh n’a pas rendu une liste d’issues');
  return liste.map(entreeDe).sort((a, b) => b.numero - a.numero);
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

/** Le fichier entier : l'en-tête, le type, la liste. Aucune URL, jamais (D-097 (3)). */
export function rendreFichier(features) {
  const corps = features
    .map((feature) => `  {\n    numero: ${feature.numero},\n    titre: ${q(feature.titre)}\n  }`)
    .join(',\n');
  return `/**
 * **Les fonctionnalités prévues** — ce que la feuille de route annonce (D-097 (3), #214).
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par \`npm run plan:dev\`
 * (\`scripts/plan-dev.mjs\`) à partir des **issues \`alpha\` ouvertes** du dépôt, qui
 * restent la source de ce qui arrive. Fermer une issue la retire de cette liste à la
 * génération suivante.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : le dépôt est **privé**,
 * l'API répond \`404\` sans jeton, et un jeton dans le bundle se lit dans les DevTools.
 * L'écran lit donc ce fichier, embarqué au build : il marche **hors ligne**. Le pont avec
 * GitHub est le script, lancé au build de l'auteur — jamais dans la CI, qui n'a ni \`gh\`
 * ni réseau vers GitHub.
 *
 * **Sans lien** : un invité lit \`#214\` et son titre ; une adresse du dépôt ne
 * l'ouvrirait pas, le dépôt étant privé (D-097 (3)). Aucune URL n'est donc écrite ici, et
 * \`scripts/plan-dev.test.ts\` le vérifie.
 */

export interface FeaturePrevue {
  /** Le numéro de l'issue, affiché \`#214\` : c'est ce qui permet de la retrouver. */
  numero: number;
  /** Le titre de l'issue, sur une ligne. */
  titre: string;
}

/** Les issues \`alpha\` ouvertes, **de la plus récente à la plus ancienne**. */
export const FEATURES_PREVUES: FeaturePrevue[] = [
${corps}
];
`;
}

/**
 * **Le contrôle de fraîcheur, hors réseau** : `null` quand le fichier est exactement ce
 * que le générateur écrirait, sinon la phrase qui dit l'écart et le geste à faire.
 *
 * Exporté pour que `scripts/plan-dev.test.ts` le confronte à un fichier **volontairement
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
    console.log(`✔ src/data/plan-dev.ts est à jour (${features.length} issue(s) alpha ouverte(s))`);
  } else {
    writeFileSync(CIBLE, contenu);
    console.log(`✔ src/data/plan-dev.ts écrit — ${features.length} issue(s) alpha ouverte(s) sur GitHub`);
  }
}
