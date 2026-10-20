#!/usr/bin/env node
/**
 * Garde-fous — **la suite de tests peut-elle échouer ?**
 *
 * ## Le problème (ticket #112)
 *
 * Trois fois dans la session du 20/10/2026, un test a été pris en flagrant délit de **faux
 * garde-fou** — une assertion qui **ne peut pas échouer**, donc qui ne garde rien :
 *
 * - #101 : le contrôle du coût typé imposait la **position** du café (`cost[0] === faction`)
 *   et sautait les coûts vides — plus strict que la règle sur un point, plus laxiste sur
 *   l'autre ;
 * - #107 : les variantes d'Action acceptaient `3S`/`COU` alors que leurs **ids** restaient
 *   bornés à `-star`/`-star2` — le test **autorisait** ce que la règle interdit ;
 * - #103 : la table des écarts connus était **ouverte** et sa garde d'expiration codée en
 *   dur sur `1D` — un agent futur pouvait y ajouter `'3D': -5` et **silencier une
 *   régression de contenu**.
 *
 * Chaque fois, la correction a été locale. Ce script répond au problème de **classe** : il
 * **mute** le code sur un invariant critique et **exige que la suite échoue**. Une mutation
 * qui passe inaperçue désigne une garde **morte**, pas un code correct.
 *
 * ## Pourquoi ce harnais plutôt qu'une bibliothèque de mutation testing
 *
 * `AGENTS.md` §1.7 : pas de dépendance sans nécessité démontrée. Une table **courte et
 * choisie** de mutations, sur les invariants qui portent une **règle** (le café typé, la
 * rareté portée par le suffixe, la migration du store, la position du café, la table des
 * écarts, la payabilité d'une ligne d'évolution), suffit à répondre à la question posée,
 * se lit, et **site le ticket** de chaque garde. Une couverture exhaustive (Stryker)
 * reste une option documentée, à trancher par décision si le besoin grandit.
 *
 * ## Contrat
 *
 * - `node scripts/garde-fous.mjs` — applique chaque mutation, lance les tests ciblés,
 *   **exige un échec**, restaure le fichier. Sort 1 si une mutation n'échoue pas, ou si un
 *   motif a disparu du code (entrée périmée : à réancrer, pas à ignorer).
 * - `node scripts/garde-fous.mjs --verifie` — **contrôle statique** : chaque motif est
 *   présent, chaque fichier de test existe. Ne mute rien, ne lance aucun test. C'est ce que
 *   `scripts/garde-fous.test.ts` appelle, pour que la table ne pourrisse pas en silence.
 *
 * Le dossier de travail n'est jamais laissé dans un état intermédiaire : chaque fichier est
 * restauré dans un `finally`, et l'égalité est **relue** après restauration.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = join(racine, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest');

/**
 * La table. Chaque entrée doit **casser** au moins un des tests listés.
 *
 * `motif` est une chaîne **exacte** du code : si elle disparaît (renommage, refactor), le
 * harnais **échoue** au lieu de sauter l'entrée — une entrée périmée est un garde-fou qui
 * a cessé d'exister, et c'est exactement ce qu'on cherche à voir.
 */
export const MUTATIONS = [
  {
    ticket: 91,
    titre: 'un choix de café qui n’est pas une liste est toléré',
    fichier: 'src/game/deck.ts',
    motif: 'if (!Array.isArray(types)) return [];',
    remplacement: 'if (!Array.isArray(types) && false) return [];',
    tests: ['src/game/deck.test.ts'],
    garde: 'sans elle, un `localStorage` trafiqué lève une TypeError pendant la migration'
  },
  {
    ticket: 88,
    titre: 'un symbole typé est payé par n’importe quel café',
    fichier: 'src/game/rules.ts',
    motif: '|| available === required;',
    remplacement: ';',
    tests: ['src/game/rules.test.ts'],
    garde: 'c’est la règle même du café typé (D-037) : un symbole exige un café de son type'
  },
  {
    ticket: 87,
    titre: 'le suffixe d’id cesse de porter la rareté',
    fichier: 'src/data/planque.ts',
    motif: "star3: '3S',",
    remplacement: "star3: '2S',",
    tests: ['src/data/planque.test.ts', 'src/data/cards.test.ts'],
    garde: 'un id peut alors mentir sur sa rareté — le *Mysterious Name* que §5 proscrit'
  },
  {
    ticket: 49,
    titre: 'la migration du store ne remappe plus les ids',
    fichier: 'src/store/useStore.ts',
    motif: 'const migrated = version < 3 ? withRenamedCardIds(state) : state;',
    remplacement: 'const migrated = state;',
    tests: ['src/store/useStore.test.ts'],
    garde: 'une carte renommée quitterait le Parc et le Chariot du joueur, en silence'
  },
  {
    ticket: 101,
    titre: 'le café typé ne peut plus être à toute position',
    fichier: 'src/data/cards.test.ts',
    motif: 'cost.includes(faction) &&',
    remplacement: 'cost[0] === faction &&',
    tests: ['src/data/cards.test.ts'],
    garde: 'c’est le faux garde-fou que #101 a corrigé : la règle ne fixe aucune position'
  },
  {
    ticket: 103,
    titre: 'la table des écarts connus accepte une clé de plus',
    fichier: 'src/data/cards.test.ts',
    motif: "  '1D': { ecart: -1, ticket: 104 }",
    remplacement: "  '1D': { ecart: -1, ticket: 104 },\n  '3D': { ecart: -1, ticket: 999 }",
    tests: ['src/data/cards.test.ts'],
    garde: 'sans fermeture, une régression de contenu (3 cartes 3◆ disparues) passe inaperçue'
  },
  {
    ticket: 118,
    titre: 'le nettoyage d’une mutation de la table globale ne restaure plus rien',
    fichier: 'src/game/cafe-type.test.ts',
    motif: 'for (const { id, original } of PATCHES.splice(0).reverse()) CARD_BY_ID.set(id, original);',
    remplacement: 'PATCHES.splice(0);',
    tests: ['src/game/cafe-type.test.ts'],
    garde:
      'sans restauration, la carte patchée survit au test : le détecteur de `beforeEach` la nomme'
  },
  {
    ticket: 116,
    titre: 'une ligne d’évolution de l’Intérim réclame un quatrième type',
    fichier: 'src/data/interim.ts',
    motif: "cost: ['QVT', 'MANAGEMENT'],",
    remplacement: "cost: ['QVT', 'AMELIORATION'],",
    tests: ['src/data/interim.test.ts'],
    garde: 'une ligne payable en 3 types au plus (D-034) redevient injouable en cours d’évolution'
  },
  {
    ticket: 113,
    titre: 'le simulateur repasse par la dérivation des types de café',
    fichier: 'src/game/simulation.ts',
    motif: 'playerCafeTypes: cafeTypes.get(player),',
    remplacement: 'playerCafeTypes: undefined,',
    tests: ['src/game/simulation.test.ts'],
    garde:
      'sans le choix explicite, le Chariot SUPPORT ne produit aucun café et ne lance aucune Pression : la mesure du niveau 2 est biaisée'
  },
  {
    ticket: 114,
    titre: 'l’évaluation du niveau 2 repart du flux de hasard de la partie',
    fichier: 'src/game/ia.ts',
    motif: 'rng: evaluationRng(state, index)',
    remplacement: 'rng: state.rng',
    tests: ['src/game/ia-hasard.test.ts'],
    garde:
      'sans la sous-graine dérivée, le clone tire le lancer que l’action réelle tirera : la Direction sait d’avance que sa Pression sous Dérive échoue'
  }
];

const VERIFIE = process.argv.includes('--verifie');

function lire(chemin) {
  return readFileSync(join(racine, chemin), 'utf8');
}

/** Contrôle statique : les motifs sont présents, les tests existent. Ne mute rien. */
function verifierTable() {
  const problemes = [];
  for (const mutation of MUTATIONS) {
    if (!existsSync(join(racine, mutation.fichier))) {
      problemes.push(`${mutation.fichier} : fichier introuvable (entrée #${mutation.ticket})`);
      continue;
    }
    if (!lire(mutation.fichier).includes(mutation.motif)) {
      problemes.push(
        `${mutation.fichier} : motif introuvable pour « ${mutation.titre} » (#${mutation.ticket}) — réancrer l'entrée`
      );
    }
    if (mutation.motif === mutation.remplacement) {
      problemes.push(`#${mutation.ticket} : la mutation ne change rien`);
    }
    for (const test of mutation.tests) {
      if (!existsSync(join(racine, test))) {
        problemes.push(`#${mutation.ticket} : ${test} introuvable`);
      }
    }
  }
  return problemes;
}

const problemes = verifierTable();
if (problemes.length > 0) {
  console.error('✖ Table des garde-fous incohérente :');
  for (const probleme of problemes) console.error(`  - ${probleme}`);
  process.exit(1);
}

if (VERIFIE) {
  // `--json` sert à `scripts/garde-fous.test.ts` : il compare la table à une **liste
  // attendue**, donc retirer une entrée fait échouer `npm test`. Un harnais qu'on peut
  // vider discrètement serait le faux garde-fou de plus.
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({
        count: MUTATIONS.length,
        tickets: MUTATIONS.map((mutation) => mutation.ticket).sort((a, b) => a - b),
        fichiers: MUTATIONS.map((mutation) => mutation.fichier)
      })
    );
  } else {
    console.log(`✔ ${MUTATIONS.length} garde-fous ancrés, et leurs tests ciblés existent.`);
  }
  process.exit(0);
}

console.log(`Garde-fous — ${MUTATIONS.length} mutations critiques, chacune DOIT faire échouer la suite.\n`);

const resultats = [];
for (const mutation of MUTATIONS) {
  const chemin = join(racine, mutation.fichier);
  const original = readFileSync(chemin, 'utf8');
  let echoue = false;
  let sortie = '';
  try {
    writeFileSync(chemin, original.replace(mutation.motif, mutation.remplacement));
    try {
      execFileSync(vitest, ['run', ...mutation.tests], { cwd: racine, stdio: 'pipe', timeout: 300_000 });
    } catch (erreur) {
      echoue = true;
      sortie = String(erreur.stdout ?? '').split('\n').find((l) => l.includes('FAIL')) ?? '';
    }
  } finally {
    writeFileSync(chemin, original);
  }
  // La restauration est **relue** : une entrée qui laissrait un fichier muté serait pire
  // que le défaut qu'elle surveille.
  const restaure = readFileSync(chemin, 'utf8') === original;
  resultats.push({ mutation, echoue, restaure, sortie });
  const marque = echoue ? '✔ échoue' : '✖ MORTE  ';
  console.log(`${marque}  #${mutation.ticket}  ${mutation.titre}`);
  if (!echoue) console.log(`         └ garde vivante ? ${mutation.garde}`);
  else if (sortie) console.log(`         └ ${sortie.trim()}`);
  if (!restaure) console.log(`         └ ✖ FICHIER NON RESTAURÉ : ${mutation.fichier}`);
}

const mortes = resultats.filter((r) => !r.echoue);
const nonRestaures = resultats.filter((r) => !r.restaure);
console.log(`\n${resultats.length - mortes.length}/${resultats.length} mutations font échouer la suite.`);

if (nonRestaures.length > 0) {
  console.error(`✖ ${nonRestaures.length} fichier(s) laissé(s) muté(s) — état du dépôt compromis.`);
  process.exit(2);
}
if (mortes.length > 0) {
  console.error(
    `\n✖ ${mortes.length} garde-fou(s) mort(s) : la suite passe alors que le code est cassé.\n` +
      '  Ce n’est pas la mutation qu’il faut retirer, c’est le test qu’il faut renforcer.'
  );
  process.exit(1);
}
console.log('✔ Toutes les gardes sont vivantes : le code muté casse bien la suite.');