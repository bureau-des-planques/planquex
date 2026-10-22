#!/usr/bin/env node
/**
 * Pesage — **le niveau 2 bat-il le niveau 1 ?** (tickets #93, #108, #109, #111)
 *
 * ## Pourquoi un script
 *
 * La question a été posée **quatre fois** en une session, et chaque fois à la main : dix appels
 * à `scripts/simulate.mjs` (5 graines × 2 sièges), un agrégat sur `results[].winner`, un ratio,
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
 * ⚠️ Depuis #113, le **simulateur** est la pièce à vérifier avant de croire un chiffre : tant
 * qu'un Deck d'archétype ne peut pas payer ses Pressions, la mesure compare des politiques
 * sur des Decks **désarmés**. Ce script ne corrige pas cela — il le dit.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

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
    enProcessus: false,
    recherche: { candidates: 6, worlds: 3, replies: 4 }
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const valeur = () => argv[(i += 1)];
    if (arg === '--seeds') options.seeds = valeur().split(',').map((n) => Number(n.trim()));
    else if (arg === '--games') options.games = Number(valeur());
    else if (arg === '--max-turns') options.maxTurns = Number(valeur());
    else if (arg === '--seuil-taux') options.seuilTaux = Number(valeur());
    else if (arg === '--seuil-ratio') options.seuilRatio = Number(valeur());
    else if (arg === '--json') options.json = true;
    else if (arg === '--direction') {
      options.direction = valeur();
      if (!['niveau2', 'recherche'].includes(options.direction)) {
        console.error(`--direction attend niveau2 ou recherche, reçu « ${options.direction} ».`);
        process.exit(2);
      }
    }
    else if (arg === '--en-processus') options.enProcessus = true;
    else if (arg === '--candidats') options.recherche.candidates = Number(valeur());
    else if (arg === '--mondes') options.recherche.worlds = Number(valeur());
    else if (arg === '--reponses') options.recherche.replies = Number(valeur());
    else if (arg === '--aide' || arg === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('/**', ''));
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

/** Un coup de la politique demandée : `1`, `2` (référence) ou `recherche` (expérimentale). */
function choisir(niveau, state, options) {
  if (niveau === 'recherche') return MODULES.ia.nextSearchAction(state, options.recherche);
  return MODULES.ia.nextAction(state, niveau);
}

/**
 * Le même protocole que `simulate()` (`src/game/simulation.ts`), joué **en processus** : la
 * graine maîtresse, l'appariement de factions (`pairFactions`) et la graine de chaque partie
 * (`drawRandom`) sont ceux du simulateur ; seule la politique change. Rend `results` au
 * format de `simulate --json` (`winner`), plus le temps passé dans la Direction.
 */
function executerEnProcessus(seed, niveaux, options) {
  const { simulation, engine, rng } = MODULES;
  const factions = simulation.FACTION_ORDER;
  const decks = simulation.factionDecks(factions);
  const cafeTypes = new Map(factions.map((faction) => [faction, simulation.factionCafeTypes(faction)]));
  const master = { rng: rng.seedRng(seed) };
  const results = [];
  let coups = 0;
  let tempsMs = 0;
  let tempsMaxMs = 0;

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
      const action = choisir(niveau, state, options);
      const duree = performance.now() - debut;
      if (niveau === 'recherche' && who === 'ai') {
        coups += 1;
        tempsMs += duree;
        tempsMaxMs = Math.max(tempsMaxMs, duree);
      }
      if (!action) break;
      const after = engine.applyAction(state, action);
      if (after === state) break;
      state = after;
    }
    results.push({ game: index + 1, seed: gameSeed, player, ai, winner: state.winner });
  }
  return { results, coups, tempsMs, tempsMaxMs };
}

/**
 * Une exécution du simulateur, **une commande = une chaîne** (le harnais du dépôt), et le
 * `--json` est lu sur la sortie standard de `node`, sans passer par `npm`. En mode
 * recherche (ou `--en-processus`), le même protocole est joué en processus.
 */
function executer(seed, niveaux, options) {
  if (options.enProcessus || niveaux.joueur === 'recherche' || niveaux.direction === 'recherche') {
    return executerEnProcessus(seed, niveaux, options);
  }
  const sortie = execFileSync(
    'node',
    [
      'scripts/simulate.mjs',
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
  const parGraine = [];
  // La politique « niveau 2 » du protocole : le niveau 2 (référence) ou la recherche.
  const deux = options.direction === 'recherche' ? 'recherche' : 2;
  for (const seed of seeds) {
    // Siège A : joueur = niveau 1, Direction = niveau 2 (ou recherche).
    const a = executer(seed, { joueur: 1, direction: deux }, options);
    // Siège B : joueur = niveau 2 (ou recherche), Direction = niveau 1 (même graine, même appariement).
    const b = executer(seed, { joueur: deux, direction: 1 }, options);
    for (const jeu of [a, b]) {
      coups += jeu.coups ?? 0;
      tempsMs += jeu.tempsMs ?? 0;
      tempsMaxMs = Math.max(tempsMaxMs, jeu.tempsMaxMs ?? 0);
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
  return {
    seeds,
    direction: options.direction,
    // Temps de la Direction (mode en processus) : coups joués par la recherche et leur coût.
    coupsRecherche: coups,
    msParCoup: coups === 0 ? null : Number((tempsMs / coups).toFixed(2)),
    msMaxCoup: coups === 0 ? null : Number(tempsMaxMs.toFixed(2)),
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
  console.log(`\n${titre} — graines ${resultat.seeds.join(', ')} — ${resultat.parties} parties`);
  console.log('  graine   niveau 2   niveau 1   nulles');
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
    `  verdict : ${resultat.tient ? 'le niveau 2 est démontré meilleur' : 'supériorité NON démontrée'}` +
      ` (taux ${resultat.tientTaux ? 'ok' : 'non'}, ratio ${resultat.tientRatio ? 'ok' : 'non'})`
  );
}

const options = lireArguments(process.argv.slice(2));

async function main() {
  if (options.enProcessus || options.direction === 'recherche') MODULES = await chargerModules();
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
        console.log(
          'Rappel : la mesure n’a de sens que si le simulateur sait faire payer les Pressions (voir #113).'
        );
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
