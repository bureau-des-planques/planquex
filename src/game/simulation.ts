import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import type { BattleAction, BattleState, CardInstance, Faction, PlayerId } from '@/data/types';
import { DECK_SIZE, deckCanAdd, deckLegal } from '@/game/deck';
import {
  applyAction,
  attackPreview,
  canEvolve,
  canPlayAction,
  createBattle,
  endTurn,
  promoteActive
} from '@/game/engine';
import { drawRandom, seedRng } from '@/game/rng';

/**
 * **Simulateur headless seedé** (ticket #34).
 *
 * Il ne juge rien : le rapport dit qui gagne et en combien de tours, il ne compare
 * aucun taux à une cible. Les valeurs cibles (45–55 %) viendront avec le contenu,
 * quand les dix factions auront leurs cartes.
 *
 * Ce que le module garantit :
 *
 * - **même graine, même rapport** : une graine maîtresse produit une graine par
 *   partie (tirage `drawRandom`), et rien d'autre n'apporte de hasard ;
 * - **aucun accès au navigateur ni au DOM** : le moteur est pur, la simulation l'est aussi ;
 * - **politique déterministe** : chaque camp joue la même heuristique simple, sans
 *   aucun tirage hors du générateur seedé de la partie.
 *
 * Ce n'est **pas** une IA de jeu : la politique sert à faire avancer les parties
 * jusqu'à un vainqueur, pas à mesurer la force d'un archétype.
 */

export const FACTION_ORDER: readonly Faction[] = [
  'SSE',
  'MANAGEMENT',
  'QVT',
  'AMELIORATION',
  'RH',
  'ATELIER',
  'DIRECTION',
  'SYNDICAT',
  'INTERIM',
  'SUPPORT'
];

export interface SimulationOptions {
  /** Nombre de parties à jouer. */
  games: number;
  /** Graine maîtresse : deux appels avec la même valeur donnent le même rapport. */
  seed: number;
  /** Factions à opposer. Par défaut, les dix de `FACTION_ORDER`. */
  factions?: readonly Faction[];
  /**
   * Garde-fou : une partie qui n'est pas finie à ce tour est comptée nulle.
   * Ce n'est pas une règle du jeu, seulement un arrêt d'urgence pour la simulation.
   */
  maxTurns?: number;
}

export interface GameResult {
  /** Numéro de la partie, à partir de 1. */
  game: number;
  /** Graine réellement passée à `createBattle`. */
  seed: number;
  /** Faction au Poste du joueur (`player`). */
  player: Faction;
  /** Faction au Poste de la Direction (`ai`). */
  ai: Faction;
  /** `null` quand la partie est arrêtée à `maxTurns` sans vainqueur. */
  winner: PlayerId | null;
  /** Faction du vainqueur, `null` pour une partie nulle. */
  winnerFaction: Faction | null;
  /** Numéro du tour où la partie s'est arrêtée (`BattleState.turn`, un tour par camp). */
  turns: number;
}

export interface FactionResult {
  faction: Faction;
  games: number;
  wins: number;
  losses: number;
  /** Parties arrêtées à `maxTurns` : un compte, pas un jugement. */
  draws: number;
  /** Tours moyens des parties de cette faction, arrondis au centième. */
  averageTurns: number;
}

export interface SimulationReport {
  seed: number;
  games: number;
  maxTurns: number;
  factions: FactionResult[];
  results: GameResult[];
}

/* ------------------------------------------------------------------ */
/* Chariots                                                            */
/* ------------------------------------------------------------------ */

/** Entrant → N+1 → N+2 (D-026) ; sert uniquement à ordonner un Chariot. */
const STAGE_ORDER = { ENTRANT: 0, 'N+1': 1, 'N+2': 2 } as const;

function addCard(deck: string[], cardId: string) {
  if (deck.length >= DECK_SIZE) return;
  if (deckCanAdd(deck, cardId)) deck.push(cardId);
}

/**
 * Chariot d'archétype d'une faction : ses cartes d'abord, complétées si besoin.
 *
 * Deux factions n'ont pas encore 20 cartes (Syndicat, Intérim) : leur Chariot est
 * complété par des cartes des autres factions, dans l'ordre de `ALL_CARDS`. Il
 * reste **légal** (20 cartes, 2 par nom, au moins un Entrant) et il est étiqueté
 * par sa faction d'origine — c'est l'archétype mesuré, pas une liste figée.
 */
export function factionDeck(faction: Faction): string[] {
  const deck: string[] = [];
  const own = ALL_CARDS.filter((card) => card.faction === faction && !card.variantOf);
  const others = ALL_CARDS.filter((card) => card.faction !== faction && !card.variantOf);

  for (const pool of [own, others]) {
    const planques = pool
      .filter(isPlanque)
      .sort(
        (a, b) =>
          STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
          // Comparaison par point de code, pas `localeCompare` : le rapport doit
          // être identique d'une machine à l'autre, pas seulement d'une exécution à l'autre.
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );

    // 1. un Entrant de chaque, socle du Chariot.
    for (const card of planques) {
      if (card.stage === 'ENTRANT') addCard(deck, card.id);
    }
    // 2. les évolutions dont la base est déjà là, N+1 puis N+2.
    for (const stage of ['N+1', 'N+2'] as const) {
      for (const card of planques) {
        if (card.stage === stage && card.evolvesFrom && deck.includes(card.evolvesFrom)) {
          addCard(deck, card.id);
        }
      }
    }
    // 3. les cartes Action de la faction (elles ne se posent pas, mais se jouent).
    for (const card of pool) {
      if (!isPlanque(card)) addCard(deck, card.id);
    }
    // 4. un second exemplaire, pour épaissir les lignes déjà présentes.
    for (const card of planques) addCard(deck, card.id);

    if (deck.length >= DECK_SIZE) break;
  }

  // 5. dernier recours : n'importe quelle carte encore légale.
  for (const card of [...own, ...others]) {
    if (deck.length >= DECK_SIZE) break;
    addCard(deck, card.id);
  }

  const trimmed = deck.slice(0, DECK_SIZE);
  const { ok, reasons } = deckLegal(trimmed);
  if (!ok) throw new Error(`Chariot de simulation illégal (${faction}) : ${reasons.join(' ')}`);
  return trimmed;
}

/** Les Chariots des factions demandées, construits une fois par exécution. */
export function factionDecks(factions: readonly Faction[] = FACTION_ORDER): Map<Faction, string[]> {
  return new Map(factions.map((faction) => [faction, factionDeck(faction)]));
}

/**
 * Appariement déterministe : la partie `index` oppose deux factions **distinctes**
 * tant que la liste en contient au moins deux. La seconde tourne à chaque manche
 * pour ne pas rejouer toujours les mêmes duels.
 */
export function pairFactions(factions: readonly Faction[], index: number): [Faction, Faction] {
  const count = factions.length;
  if (count === 0) throw new Error('Aucune faction à opposer.');
  const player = factions[index % count];
  const ai = factions[(index + 1 + Math.floor(index / count)) % count];
  if (ai !== player) return [player, ai];
  return [player, factions[(index + 2) % count]];
}

/* ------------------------------------------------------------------ */
/* Politique                                                           */
/* ------------------------------------------------------------------ */

function inPlay(player: BattleState['players'][PlayerId]): CardInstance[] {
  return [player.active, ...player.bench].filter(Boolean) as CardInstance[];
}

/**
 * Prochaine action **non terminale** du camp au trait : évolution, carte Action,
 * pose d'un Entrant, Talent, puis attachement de café. `null` quand il n'y a plus
 * rien à faire — l'attaque est traitée séparément, une seule fois par tour.
 */
function nextAction(state: BattleState): BattleAction | null {
  const player = state.players[state.current];

  // Une carte Action d'abord : elle peut piocher l'évolution qu'on attend.
  for (const handCard of player.hand) {
    if (canPlayAction(state, handCard.uid)) return { type: 'playAction', uid: handCard.uid };
  }

  // Évoluer, en préférant le Poste au Rack.
  for (const handCard of player.hand) {
    const card = getCard(handCard.cardId);
    if (!isPlanque(card) || !card.evolvesFrom) continue;
    for (const target of inPlay(player)) {
      if (canEvolve(state, handCard.uid, target.uid)) {
        return { type: 'evolve', uid: handCard.uid, targetUid: target.uid };
      }
    }
  }

  // Poser les Entrants : au Poste s'il est vide, sinon au premier Rack libre.
  const basics = player.hand.filter((handCard) => isBasic(getCard(handCard.cardId)));
  if (!player.active && basics[0]) return { type: 'playBasic', uid: basics[0].uid, slot: 'active' };
  const freeSlot = player.bench.findIndex((slot) => !slot);
  if (freeSlot >= 0 && basics[0]) return { type: 'playBasic', uid: basics[0].uid, slot: freeSlot };

  // Talent du Poste : les primitives existantes du moteur rendent toujours service.
  if (!player.hasUsedAbility && player.active) {
    const card = getCard(player.active.cardId);
    if (isPlanque(card) && card.ability) return { type: 'ability' };
  }

  // Un café par tour, sur le Poste. Le premier tour du joueur en est privé (§4, D-030).
  const firstPlayerFirstTurn = state.turn === 1 && state.current === 'player';
  if (!player.energyAttached && player.energyZone > 0 && player.active && !firstPlayerFirstTurn) {
    return { type: 'attachEnergy', targetUid: player.active.uid };
  }

  return null;
}

/** Meilleure attaque légale, au sens des dégâts effectifs (`attackPreview`). */
function chooseAttack(state: BattleState): BattleAction | null {
  const player = state.players[state.current];
  if (player.hasAttacked || !player.active) return null;
  const card = getCard(player.active.cardId);
  if (!isPlanque(card)) return null;

  let best: number | null = null;
  let bestDamage = -1;
  for (let index = 0; index < card.attacks.length; index += 1) {
    const move = card.attacks[index];
    if (!move || player.active.energy < move.cost) continue;
    const damage = attackPreview(state, index);
    if (damage > bestDamage) {
      best = index;
      bestDamage = damage;
    }
  }
  return best === null ? null : { type: 'attack', attackIndex: best };
}

/**
 * L'IA du simulateur joue une action de `applyAction` — le même dispatcher que
 * l'écran de combat (#58). Les transitions d'avant vivaient ici : elles sont
 * maintenant dans `@/game/engine`, à côté de `legalActions`.
 */

/** Relève : le Rack le plus solide, premier index en cas d'égalité. */
function chooseBench(state: BattleState, who: PlayerId): number {
  const bench = state.players[who].bench;
  let best = -1;
  let bestHp = -1;
  for (let index = 0; index < bench.length; index += 1) {
    const card = bench[index];
    if (card && card.hp > bestHp) {
      best = index;
      bestHp = card.hp;
    }
  }
  return best < 0 ? bench.findIndex(Boolean) : best;
}

/**
 * Joue un tour complet : toutes les actions non terminales jusqu'à épuisement,
 * **une** tentative d'attaque, puis la fin du tour. Le garde-fou évite qu'une
 * action acceptée mais sans effet ne boucle.
 */
function takeTurn(state: BattleState): BattleState {
  let next = state;
  for (let guard = 0; guard < 40; guard += 1) {
    const action = nextAction(next);
    // D-030 : le forfait est une décision humaine. La politique du simulateur ne le
    // construit jamais (`nextAction` ne l'énumère pas) ; cette garde le rend explicite,
    // pour que la simulation ne s'abandonne pas même si `legalActions` l'offrait un jour.
    if (!action || action.type === 'forfeit') break;
    const after = applyAction(next, action);
    if (after === next) break;
    next = after;
    if (next.phase === 'ended' || next.pendingPromotion) return next;
  }

  const move = chooseAttack(next);
  if (move) next = applyAction(next, move);
  if (next.phase === 'ended' || next.pendingPromotion) return next;

  return endTurn(next);
}

/* ------------------------------------------------------------------ */
/* Rapport                                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_TURNS = 200;

/**
 * Joue **une** partie headless avec la politique du module et renvoie l'état final.
 * `state.turn` vaut `maxTurns + 1` quand la partie est arrêtée sans vainqueur.
 */
export function playGame(
  playerDeck: string[],
  aiDeck: string[],
  seed: number,
  maxTurns = DEFAULT_MAX_TURNS
): BattleState {
  let state = createBattle(playerDeck, aiDeck, seed);
  while (state.phase === 'playing' && state.turn <= maxTurns) {
    if (state.pendingPromotion) {
      const who = state.pendingPromotion;
      const benchIndex = chooseBench(state, who);
      // Le moteur ne pose `pendingPromotion` que si le Rack n'est pas vide ; cette
      // garde évite une boucle si une future règle changeait ce contrat.
      if (benchIndex < 0) break;
      state = promoteActive(state, benchIndex);
      continue;
    }
    const before = state;
    state = takeTurn(state);
    // Sécurité : une transition qui ne change rien arrête la partie.
    if (state === before) break;
  }
  return state;
}

/**
 * Joue `games` parties et renvoie un rapport **comparable** : aucun horodatage,
 * aucun ordre dépendant d'un `Map` ou d'un `Set`.
 */
export function simulate(options: SimulationOptions): SimulationReport {
  const { games, seed, maxTurns = DEFAULT_MAX_TURNS } = options;
  if (!Number.isInteger(games) || games <= 0) {
    throw new Error(`Nombre de parties invalide : ${games}. Il faut un entier ≥ 1.`);
  }
  if (!Number.isFinite(seed)) throw new Error(`Graine invalide : ${seed}.`);
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new Error(`Limite de tours invalide : ${maxTurns}. Il faut un entier ≥ 1.`);
  }

  const factions = [
    ...new Set(options.factions?.length ? options.factions : FACTION_ORDER)
  ];
  const unknown = factions.filter((faction) => !FACTION_ORDER.includes(faction));
  if (unknown.length > 0) {
    throw new Error(`Faction(s) inconnue(s) : ${unknown.join(', ')}.`);
  }
  const decks = factionDecks(factions);
  // Une graine par partie, tirée de la graine maîtresse : les Chariots sont
  // différents d'une partie à l'autre, mais la suite entière se rejoue.
  const master = { rng: seedRng(seed) };
  const results: GameResult[] = [];

  for (let index = 0; index < games; index += 1) {
    const [player, ai] = pairFactions(factions, index);
    const gameSeed = Math.floor(drawRandom(master) * 0x100000000) >>> 0;
    const state = playGame(decks.get(player) ?? [], decks.get(ai) ?? [], gameSeed, maxTurns);

    const winnerFaction =
      state.winner === 'player' ? player : state.winner === 'ai' ? ai : null;
    results.push({
      game: index + 1,
      seed: gameSeed,
      player,
      ai,
      winner: state.winner,
      winnerFaction,
      turns: Math.min(state.turn, maxTurns)
    });
  }

  return {
    seed,
    games,
    maxTurns,
    factions: aggregateFactions(factions, results),
    results
  };
}

/** Agrégat par faction : parties, victoires, défaites, nulles, tours moyens. */
export function aggregateFactions(
  factions: readonly Faction[],
  results: readonly GameResult[]
): FactionResult[] {
  return factions.map((faction) => {
    const played = results.filter((result) => result.player === faction || result.ai === faction);
    const wins = played.filter((result) => result.winnerFaction === faction).length;
    const draws = played.filter((result) => result.winner === null).length;
    const turns = played.reduce((sum, result) => sum + result.turns, 0);
    return {
      faction,
      games: played.length,
      wins,
      losses: played.length - wins - draws,
      draws,
      averageTurns: played.length === 0 ? 0 : Math.round((turns / played.length) * 100) / 100
    };
  });
}

/** Rapport lisible en console : une ligne par partie, puis l'agrégat par faction. */
export function formatReport(report: SimulationReport): string {
  const pad = (value: string | number, width: number) => String(value).padEnd(width);
  const num = (value: number, width: number) => String(value).padStart(width);

  const lines = [
    `Simulation — ${report.games} partie(s), graine ${report.seed}, limite ${report.maxTurns} tours`,
    '',
    `${'N°'.padEnd(4)}${'graine'.padEnd(12)}${'Poste'.padEnd(22)}${'Rack'.padEnd(22)}${'Vainqueur'.padEnd(22)}Tours`,
    '-'.repeat(88)
  ];

  for (const result of report.results) {
    lines.push(
      `${pad(result.game, 4)}${pad(result.seed, 12)}${pad(result.player, 22)}${pad(result.ai, 22)}${pad(
        result.winnerFaction ?? 'nulle',
        22
      )}${num(result.turns, 5)}`
    );
  }

  lines.push('', 'Agrégat par faction', '');
  lines.push(`${'Faction'.padEnd(22)}${'Parties'.padStart(8)}${'Victoires'.padStart(11)}${'Défaites'.padStart(10)}${'Nulles'.padStart(8)}${'Tours moy.'.padStart(12)}`);
  lines.push('-'.repeat(71));
  for (const faction of report.factions) {
    lines.push(
      `${pad(faction.faction, 22)}${num(faction.games, 8)}${num(faction.wins, 11)}${num(
        faction.losses,
        10
      )}${num(faction.draws, 8)}${num(faction.averageTurns, 12)}`
    );
  }

  return lines.join('\n');
}
