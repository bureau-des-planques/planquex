#!/usr/bin/env node
/**
 * Pesage — **le niveau 2 bat-il le niveau 1 ?** (tickets #93, #108, #109, #111)
 *
 * ## Pourquoi un script
 *
 * La question a été posée **quatre fois** en une session, et chaque fois à la main : dix appels
 * à `scripts/preuves/simulate.mjs` (5 graines × 2 sièges), un agrégat sur `results[].winner`, un ratio,
 * un taux, un verdict. Trois fois le chiffre a été **contesté** — et une fois, il était
 * **faux** (#108 : le gain de #93 était un artefact de mesure).
 *
 * Un protocole qu'on rejoue à la main dérive : graines choisies après coup, seuil ajusté au
 * résultat, sièges non appariés. Ce script **fige le protocole** et le rend vérifiable :
 *
 * - **graines d'entraînement et de contrôle disjointes**, et c'est une **erreur** si elles se
 *   recouvrent (on ne juge pas sur les graines qui ont servi à régler) ;
 * - **seuil décidé d'avance** : ≥ 55 % des parties **décidées** *et* ≥ 1,15 × les victoires du
 *   niveau 1 (le seuil de #111) ; les deux sont affichés, avec le verdict ;
 * - **miroir apparié** : les deux sièges partagent graine et appariement de factions, donc
 *   l'avantage du premier joueur s'annule ;
 * - **intervalle de confiance à 95 %** du taux des décidées, pour distinguer un gain d'un bruit.
 *
 * ## Usage
 *
 * ```bash
 * npm run pesage                                   # entraînement + contrôle (#111)
 * npm run pesage -- --seeds 1,7,42,99,1234         # un jeu unique, sans contrôle
 * npm run pesage -- --games 100 --json             # plus de parties, sortie machine
 * npm run pesage -- --seuil-taux 0.55 --seuil-ratio 1.15
 * npm run pesage -- --direction recherche          # la recherche à deux coups (expérimentale)
 * npm run pesage -- --direction recherche --candidats 6 --mondes 3 --reponses 4
 * npm run pesage -- --direction recherche --noeuds 1000  # le plafond de nœuds (#172)
 * npm run pesage -- --direction recherche --noeuds 100000000 --ms Infinity  # plafonds neutralisés (témoin)
 * npm run pesage -- --direction niveau3 --adversaire recherche           # le niveau 3 (#94) contre le niveau 2
 * npm run pesage -- --direction niveau3 --adversaire recherche --profondeur 3 --n3-mondes 3
 * npm run pesage -- --en-processus                 # le niveau 2 joué en processus (contrôle du harnais)
 * ```
 *
 * `--direction recherche` remplace le niveau 2 de la Direction (et du joueur, au siège B) par
 * la recherche à deux coups de `src/game/ia.ts` (`nextSearchAction`), jouée **en processus** :
 * le même protocole que `simulate.mjs` (graine maîtresse, appariement, graine de partie), seule
 * la politique change. Le chiffre de la Direction est donc comparable à la référence du CLI.
 * Les réglages (`--candidats`, `--mondes`, `--reponses`) et le temps par coup sont consignés
 * dans `docs/ia/111-essais-recherche-2-coups.md`.
 *
 * `--direction niveau3 --adversaire recherche` oppose le **niveau 3** (expectiminimax +
 * déterminisations, #94) au **niveau 2 acté** — le protocole est le même (entraînement puis
 * un contrôle, seuil inchangé), seul l'adversaire change. `--adversaire 1` (défaut) garde la
 * comparaison au niveau 1. Réglages : `--profondeur`, `--n3-candidats`, `--n3-reponses`,
 * `--n3-suites`, `--n3-mondes`, `--n3-hasard`, `--n3-noeuds`, `--n3-ms`.
 *
 * ⚠️ Depuis #113, le **simulateur** est la pièce à vérifier avant de croire un chiffre : tant
 * qu'un Deck d'archétype ne peut pas payer ses Pressions, la mesure compare des politiques
 * sur des Decks **désarmés**. Ce script ne corrige pas cela — il le dit.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Les jeux de graines du protocole de #111 — **disjoints** par construction. */
const ENTRAINEMENT = [1, 7, 42, 11, 23];
const CONTROLE = [99, 1234, 2024, 777, 31337];

function lireArguments(argv) {
  const options = {
    seeds: null,
    games: 60,
    json: false,
    seuilTaux: 0.55,
    seuilRatio: 1.15,
    maxTurns: 200,
    // La Direction : `niveau2` (la référence #93/#111, le CLI du simulateur) ou `recherche`
    // (le niveau 2 acté (D-084) — `docs/ia/111-essais-recherche-2-coups.md`).
    direction: 'niveau2',
    // Politique de l'**adversaire** dans le miroir (défaut : le niveau 1 historique).
    // `recherche` oppose donc le niveau 2 acté au niveau 1, et `niveau3` au niveau 2.
    adversaire: 1,
    enProcessus: false,
    // `maxNodes` : le plafond de nœuds d'une décision (#172), repli glouton au-delà.
    // `maxMs` : la garde de temps de la même décision (filet pour les machines chargées).
    recherche: { candidates: 6, worlds: 3, replies: 4, maxNodes: 800, maxMs: 60 },
    // Le niveau 3 (#94) : ses réglages sont **distincts** de la recherche à deux coups.
    expectiminimax: {
      depth: 3,
      candidates: 3,
      replies: 2,
      followups: 2,
      worlds: 2,
      chanceSamples: 2,
      maxNodes: 800,
      maxMs: 60
    }
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const valeur = () => argv[(i += 1)];
    if (arg === '--seeds')
      options.seeds = valeur()
        .split(',')
        .map((n) => Number(n.trim()));
    else if (arg === '--games') options.games = Number(valeur());
    else if (arg === '--max-turns') options.maxTurns = Number(valeur());
    else if (arg === '--seuil-taux') options.seuilTaux = Number(valeur());
    else if (arg === '--seuil-ratio') options.seuilRatio = Number(valeur());
    else if (arg === '--json') options.json = true;
    else if (arg === '--direction') {
      options.direction = valeur();
      if (!['niveau2', 'recherche', 'niveau3'].includes(options.direction)) {
        console.error(`--direction attend niveau2, recherche ou niveau3, reçu « ${options.direction} ».`);
        process.exit(2);
      }
    } else if (arg === '--adversaire') {
      const brut = valeur();
      options.adversaire = brut === 'recherche' ? 'recherche' : Number(brut);
      if (![1, 2, 'recherche'].includes(options.adversaire)) {
        console.error(`--adversaire attend 1, 2 ou recherche, reçu « ${brut} ».`);
        process.exit(2);
      }
    } else if (arg === '--en-processus') options.enProcessus = true;
    else if (arg === '--candidats') options.recherche.candidates = Number(valeur());
    else if (arg === '--mondes') options.recherche.worlds = Number(valeur());
    else if (arg === '--reponses') options.recherche.replies = Number(valeur());
    else if (arg === '--noeuds') options.recherche.maxNodes = Number(valeur());
    else if (arg === '--ms') options.recherche.maxMs = Number(valeur());
    else if (arg === '--profondeur') options.expectiminimax.depth = Number(valeur());
    else if (arg === '--n3-candidats') options.expectiminimax.candidates = Number(valeur());
    else if (arg === '--n3-reponses') options.expectiminimax.replies = Number(valeur());
    else if (arg === '--n3-suites') options.expectiminimax.followups = Number(valeur());
    else if (arg === '--n3-mondes') options.expectiminimax.worlds = Number(valeur());
    else if (arg === '--n3-hasard') options.expectiminimax.chanceSamples = Number(valeur());
    else if (arg === '--n3-noeuds') options.expectiminimax.maxNodes = Number(valeur());
    else if (arg === '--n3-ms') options.expectiminimax.maxMs = Number(valeur());
    else if (arg === '--aide' || arg === '-h') {
      console.log(
        readFileSync(fileURLToPath(import.meta.url), 'utf8')
          .split('*/')[0]
          .replace('/**', '')
      );
      process.exit(0);
    } else {
      console.error(`Argument inconnu : ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

/**
 * Modules du **moteur** et de la **politique**, chargés par Vite (TypeScript), une fois.
 * Ils ne servent qu'au mode en processus (`--direction recherche` ou `--en-processus`) :
 * la recherche n'existe pas dans le CLI du simulateur, et le mode en processus rejoue le
 * **même** protocole que `simulate.mjs` (même graine maîtresse, même appariement, même
 * `gameSeed`), ce que le test de non-régression vérifie.
 */
async function chargerModules() {
  const server = await createServer({
    root: racine,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  return {
    server,
    simulation: await server.ssrLoadModule('/src/game/simulation.ts'),
    engine: await server.ssrLoadModule('/src/game/engine.ts'),
    ia: await server.ssrLoadModule('/src/game/ia.ts'),
    rng: await server.ssrLoadModule('/src/game/rng.ts')
  };
}

/** Modules chargés à la demande de `main` (null tant que le mode en processus n'est pas requis). */
let MODULES = null;

/**
 * Un coup de la politique demandée : `1`, `2` (référence) ou `recherche` (le niveau 2 acté).
 * La recherche rend aussi son **travail** : le repli sur le glouton quand le plafond de
 * nœuds mord (#172) est compté et publié, pour que la mesure dise si le budget contraint.
 */
function choisir(niveau, state, options) {
  if (niveau === 'recherche') {
    const decision = MODULES.ia.searchDecision(state, options.recherche);
    return { action: decision.action, repli: decision.fallback };
  }
  if (niveau === 'niveau3') {
    const decision = MODULES.ia.expectiminimaxDecision(state, options.expectiminimax);
    return { action: decision.action, repli: decision.fallback };
  }
  return { action: MODULES.ia.nextAction(state, niveau), repli: false };
}

/** Les politiques **en processus** : la recherche (niveau 2 acté) et le niveau 3 expérimental. */
const EN_PROCESSUS = new Set(['recherche', 'niveau3']);

/**
 * Le même protocole que `simulate()` (`src/game/simulation.ts`), joué **en processus** : la
 * graine maîtresse, l'appariement de factions (`pairFactions`) et la graine de chaque partie
 * (`drawRandom`) sont ceux du simulateur ; seule la politique change. Rend `results` au
 * format de `simulate --json` (`winner`), plus le temps passé dans la Direction.
 */
function executerEnProcessus(seed, niveaux, options) {
  const { simulation, engine, rng } = MODULES;
  // La politique comparée (celle dont on chronomètre les décisions) — pas l'adversaire.
  const candidat = options.direction === 'niveau2' ? 2 : options.direction;
  const factions = simulation.FACTION_ORDER;
  const decks = simulation.factionDecks(factions);
  const cafeTypes = new Map(factions.map((faction) => [faction, simulation.factionCafeTypes(faction)]));
  const master = { rng: rng.seedRng(seed) };
  const results = [];
  const durees = [];
  let coups = 0;
  let tempsMs = 0;
  let tempsMaxMs = 0;
  let replis = 0;

  for (let index = 0; index < options.games; index += 1) {
    const [player, ai] = simulation.pairFactions(factions, index);
    const gameSeed = Math.floor(rng.drawRandom(master) * 0x100000000) >>> 0;
    let state = engine.createBattle(decks.get(player) ?? [], decks.get(ai) ?? [], gameSeed, {
      playerCafeTypes: cafeTypes.get(player),
      aiCafeTypes: cafeTypes.get(ai)
    });
    while (state.phase === 'playing' && state.turn <= options.maxTurns) {
      const who = state.pendingPromotion ?? state.current;
      const niveau = who === 'ai' ? niveaux.direction : niveaux.joueur;
      const debut = performance.now();
      const decision = choisir(niveau, state, options);
      const duree = performance.now() - debut;
      // Le **candidat** est la politique en processus comparée : c'est son coût qu'on
      // consigne, sur les **deux** sièges (il joue `ai` au siège A, `player` au B). Le camp
      // adverse (`--adversaire recherche`) n'entre pas dans ces compteurs.
      if (niveau === candidat) {
        coups += 1;
        tempsMs += duree;
        tempsMaxMs = Math.max(tempsMaxMs, duree);
        durees.push(duree);
        if (decision.repli) replis += 1;
      }
      const action = decision.action;
      if (!action) break;
      const after = engine.applyAction(state, action);
      if (after === state) break;
      state = after;
    }
    results.push({ game: index + 1, seed: gameSeed, player, ai, winner: state.winner });
  }
  return { results, coups, tempsMs, tempsMaxMs, durees, replis };
}

/**
 * Une exécution du simulateur, **une commande = une chaîne** (le harnais du dépôt), et le
 * `--json` est lu sur la sortie standard de `node`, sans passer par `npm`. En mode
 * recherche (ou `--en-processus`), le même protocole est joué en processus.
 */
function executer(seed, niveaux, options) {
  if (options.enProcessus || EN_PROCESSUS.has(niveaux.joueur) || EN_PROCESSUS.has(niveaux.direction)) {
    return executerEnProcessus(seed, niveaux, options);
  }
  const sortie = execFileSync(
    'node',
    [
      'scripts/preuves/simulate.mjs',
      '--games',
      String(options.games),
      '--seed',
      String(seed),
      '--max-turns',
      String(options.maxTurns),
      '--json',
      '--player-level',
      String(niveaux.joueur),
      '--ai-level',
      String(niveaux.direction)
    ],
    { cwd: racine, encoding: 'utf8' }
  );
  return JSON.parse(sortie);
}

/** Agrège un jeu de graines en **miroir apparié** : le niveau 2 occupe les deux sièges. */
function peser(seeds, options) {
  let n2 = 0;
  let n1 = 0;
  let nulles = 0;
  let coups = 0;
  let tempsMs = 0;
  let tempsMaxMs = 0;
  let replis = 0;
  const durees = [];
  const parGraine = [];
  // La politique **candidate** du protocole : le niveau 2 (référence), la recherche ou le niveau 3.
  const candidat = options.direction === 'recherche' ? 'recherche' : options.direction === 'niveau3' ? 'niveau3' : 2;
  // La politique **adverse** : le niveau 1 (protocole historique) ou le niveau 2 acté.
  const adversaire = options.adversaire;
  for (const seed of seeds) {
    // Siège A : joueur = adversaire, Direction = candidat.
    const a = executer(seed, { joueur: adversaire, direction: candidat }, options);
    // Siège B : joueur = candidat, Direction = adversaire (même graine, même appariement).
    const b = executer(seed, { joueur: candidat, direction: adversaire }, options);
    for (const jeu of [a, b]) {
      coups += jeu.coups ?? 0;
      tempsMs += jeu.tempsMs ?? 0;
      tempsMaxMs = Math.max(tempsMaxMs, jeu.tempsMaxMs ?? 0);
      replis += jeu.replis ?? 0;
      if (jeu.durees) durees.push(...jeu.durees);
    }
    let g2 = 0;
    let g1 = 0;
    let gn = 0;
    for (const resultat of a.results) {
      if (resultat.winner === 'ai') g2 += 1;
      else if (resultat.winner === 'player') g1 += 1;
      else gn += 1;
    }
    for (const resultat of b.results) {
      if (resultat.winner === 'player') g2 += 1;
      else if (resultat.winner === 'ai') g1 += 1;
      else gn += 1;
    }
    parGraine.push({ seed, n2: g2, n1: g1, nulles: gn, parties: a.results.length + b.results.length });
    n2 += g2;
    n1 += g1;
    nulles += gn;
  }
  const decidees = n2 + n1;
  const taux = decidees === 0 ? 0 : n2 / decidees;
  const ratio = n1 === 0 ? Infinity : n2 / n1;
  // Intervalle de confiance à 95 % de Wald sur le taux des décidées : un gain qui ne sort pas
  // de l'intervalle n'est pas un gain.
  const marge = decidees === 0 ? 0 : 1.96 * Math.sqrt((taux * (1 - taux)) / decidees);
  // Quantiles du temps par décision (#172) : la moyenne ne suffit pas, c'est la queue
  // (p95, p99, max) qui décide du budget perçu à l'écran.
  durees.sort((x, y) => x - y);
  const quantile = (q) =>
    durees.length === 0 ? null : Number(durees[Math.min(durees.length - 1, Math.floor(q * durees.length))].toFixed(2));
  const budget = options.direction === 'niveau3' ? options.expectiminimax : options.recherche;
  return {
    seeds,
    direction: options.direction,
    adversaire: String(options.adversaire),
    // Temps du candidat (mode en processus) : coups joués par la recherche et leur coût.
    coupsRecherche: coups,
    msParCoup: coups === 0 ? null : Number((tempsMs / coups).toFixed(2)),
    msP50Coup: quantile(0.5),
    msP95Coup: quantile(0.95),
    msP99Coup: quantile(0.99),
    msMaxCoup: coups === 0 ? null : Number(tempsMaxMs.toFixed(2)),
    // Décisions où le plafond de nœuds a mordu : le glouton a rendu le coup (#172).
    replisBudget: replis,
    maxNoeuds: budget.maxNodes,
    maxMs: budget.maxMs,
    parties: n2 + n1 + nulles,
    decidees,
    niveau2: n2,
    niveau1: n1,
    nulles,
    taux,
    ratio,
    intervalle: [Math.max(0, taux - marge), Math.min(1, taux + marge)],
    parGraine,
    tient: taux >= options.seuilTaux && ratio >= options.seuilRatio,
    tientTaux: taux >= options.seuilTaux,
    tientRatio: ratio >= options.seuilRatio
  };
}

const pourcent = (valeur) => `${(100 * valeur).toFixed(2)} %`;
const nombre = (valeur) => valeur.toFixed(3);

function tableau(titre, resultat, options) {
  const candidat = `${resultat.direction} (candidat)`;
  const adverse = `niveau ${resultat.adversaire} (adversaire)`;
  console.log(`\n${titre} — graines ${resultat.seeds.join(', ')} — ${resultat.parties} parties`);
  console.log(`  graine      ${candidat.padStart(20)}   ${adverse.padStart(20)}   nulles`);
  for (const ligne of resultat.parGraine) {
    console.log(
      `  ${String(ligne.seed).padStart(6)}   ${String(ligne.n2).padStart(8)}   ${String(ligne.n1).padStart(8)}   ${String(ligne.nulles).padStart(6)}`
    );
  }
  console.log(
    `  ${'TOTAL'.padStart(6)}   ${String(resultat.niveau2).padStart(8)}   ${String(resultat.niveau1).padStart(8)}   ${String(resultat.nulles).padStart(6)}`
  );
  console.log(
    `  taux des décidées ${pourcent(resultat.taux)} (seuil ${pourcent(options.seuilTaux)}) · ratio ${nombre(resultat.ratio)} (seuil ${nombre(options.seuilRatio)})`
  );
  console.log(
    `  intervalle à 95 % du taux : ${pourcent(resultat.intervalle[0])} – ${pourcent(resultat.intervalle[1])}`
  );
  console.log(
    `  verdict : ${resultat.tient ? 'le candidat est démontré meilleur' : 'supériorité NON démontrée'}` +
      ` (taux ${resultat.tientTaux ? 'ok' : 'non'}, ratio ${resultat.tientRatio ? 'ok' : 'non'})`
  );
}

const options = lireArguments(process.argv.slice(2));

async function main() {
  if (options.enProcessus || options.direction !== 'niveau2' || options.adversaire === 'recherche') {
    MODULES = await chargerModules();
  }
  try {
    if (options.seeds) {
      const resultat = peser(options.seeds, options);
      if (options.json) console.log(JSON.stringify(resultat, null, 2));
      else tableau('Pesage', resultat, options);
    } else {
      const recouvrement = ENTRAINEMENT.filter((seed) => CONTROLE.includes(seed));
      if (recouvrement.length > 0) {
        console.error(`✖ Graines d'entraînement et de contrôle recouvrantes : ${recouvrement.join(', ')}`);
        process.exit(2);
      }
      const entrainement = peser(ENTRAINEMENT, options);
      const controle = peser(CONTROLE, options);
      if (options.json) {
        console.log(JSON.stringify({ entrainement, controle }, null, 2));
      } else {
        tableau('Entraînement', entrainement, options);
        tableau('Contrôle (décidé d’avance)', controle, options);
        console.log(
          '\nRappel : un gain doit tenir sur le CONTRÔLE. Un gain d’entraînement qui s’évapore n’est pas un gain.'
        );
        console.log('Rappel : la mesure n’a de sens que si le simulateur sait faire payer les Pressions (voir #113).');
      }
    }
  } finally {
    if (MODULES) await MODULES.server.close();
  }
  // Le verdict est un **fait mesuré**, pas un échec de commande : on sort toujours en 0.
  // (Un seuil non atteint n'est pas une erreur — c'est le résultat.)
  process.exit(0);
}

await main();
