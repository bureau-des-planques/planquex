import { ALL_CARDS, isPlanque } from '@/data';
import type { BattleState, CafeType, Faction, PlayerId } from '@/data/types';
import { DECK_SIZE, deckCanAdd, deckLegal } from '@/game/deck';
import { applyAction, createBattle } from '@/game/engine';
import type { BattleCafeTypes } from '@/game/engine';
import { nextAction } from '@/game/ia';
import type { AiLevel } from '@/game/ia';
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
 *   aucun tirage hors du générateur seedé de la partie ;
 * - **niveaux mesurables** : les deux camps peuvent jouer des **niveaux d'IA**
 *   différents (`playerLevel`, `aiLevel`, ticket #93). C'est ainsi qu'on compare le
 *   niveau 2 au niveau 1 à graine, appariement et Decks identiques.
 * - **Decks armés** : les archétypes dont la dérivation ne donne aucun café payable
 *   (`SUPPORT`, `INTERIM`) reçoivent des **types explicites** (`factionCafeTypes`,
 *   ticket #113) — sinon un match sur trois opposait un Deck incapable d'attaquer.
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
  /**
   * Niveau de la Direction **du joueur** (`player`). 1 (défaut) : la Direction
   * scriptée. 2 : la Direction qui évalue (ticket #93). Les deux camps peuvent
   * jouer des niveaux différents : c'est ainsi qu'on **mesure** le niveau 2 contre
   * le niveau 1, à graine et appariement identiques.
   */
  playerLevel?: AiLevel;
  /** Niveau de la Direction **adverse** (`ai`). 1 (défaut), 2 : la Direction qui évalue. */
  aiLevel?: AiLevel;
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
  /**
   * **Pressions lancées** par chaque camp pendant la partie (harnais, ticket #113).
   * Un compteur, pas un jugement : il sert à voir si un Deck était **armé** — un
   * camp à `0` n'a jamais attaqué, ce qui est le symptôme d'un Deck sans café
   * payable. Consigné pour que la mesure du niveau 2 reste auditable.
   */
  attacks: Record<PlayerId, number>;
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
  /** Niveau joué par le camp `player` dans ce rapport. */
  playerLevel: AiLevel;
  /** Niveau joué par le camp `ai` dans ce rapport. */
  aiLevel: AiLevel;
  factions: FactionResult[];
  results: GameResult[];
}

/* ------------------------------------------------------------------ */
/* Decks                                                            */
/* ------------------------------------------------------------------ */

/** Entrant → N+1 → N+2 (D-026) ; sert uniquement à ordonner un Deck. */
const STAGE_ORDER = { ENTRANT: 0, 'N+1': 1, 'N+2': 2 } as const;

function addCard(deck: string[], cardId: string) {
  if (deck.length >= DECK_SIZE) return;
  if (deckCanAdd(deck, cardId)) deck.push(cardId);
}

/**
 * Deck d'archétype d'une faction : ses cartes d'abord, complétées si besoin.
 *
 * Deux factions n'ont pas encore 20 cartes (Syndicat, Intérim) : leur Deck est
 * complété par des cartes des autres factions, dans l'ordre de `ALL_CARDS`. Il
 * reste **légal** (20 cartes, 2 par nom, au moins un Entrant) et il est étiqueté
 * par sa faction d'origine — c'est l'archétype mesuré, pas une liste figée.
 */
export function factionDeck(faction: Faction): string[] {
  const deck: string[] = [];
  const own = ALL_CARDS.filter((card) => card.faction === faction && !card.variantOf);
  const others = ALL_CARDS.filter((card) => card.faction !== faction && !card.variantOf);

  for (const pool of [own, others]) {
    const planques = pool.filter(isPlanque).sort(
      (a, b) =>
        STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
        // Comparaison par point de code, pas `localeCompare` : le rapport doit
        // être identique d'une machine à l'autre, pas seulement d'une exécution à l'autre.
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );

    // 1. un Entrant de chaque, socle du Deck.
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
  if (!ok) throw new Error(`Deck de simulation illégal (${faction}) : ${reasons.join(' ')}`);
  return trimmed;
}

/** Les Decks des factions demandées, construits une fois par exécution. */
export function factionDecks(factions: readonly Faction[] = FACTION_ORDER): Map<Faction, string[]> {
  return new Map(factions.map((faction) => [faction, factionDeck(faction)]));
}

/* ------------------------------------------------------------------ */
/* Types de café des Decks simulés (ticket #113)                    */
/* ------------------------------------------------------------------ */

/**
 * Les **types de café choisis** pour les archétypes que la dérivation du Deck ne
 * sait pas armer (ticket #113, D-037 (4)). Absente, une faction garde la
 * **dérivation** (`deckCafeTypes`), qui suffit à ses propres coûts.
 *
 * Pourquoi une table et pas la dérivation partout :
 *
 * - **`SUPPORT`** n'a que des coûts **incolores**, mais la dérivation jette `SUPPORT`
 *   (`CAFE_FACTIONS` exclut les types que la Machine ne produit jamais, D-034) : un
 *   Deck exclusivement `SUPPORT` n'avait donc **aucun type**, la Machine ne
 *   produisait **aucun café**, et aucune de ses Pressions n'était payable. Un seul
 *   type productible suffit à tout payer (D-037 (2) : l'incolore accepte n'importe
 *   quel café) ; `SSE` est le premier de `CAFE_FACTIONS`, donc le choix est stable.
 * - **`INTERIM`** est Dragon : sa faction n'est jamais un type de zone, et ses
 *   Pressions mêlent **deux types produits distincts** (D-037 (3)). La dérivation ne
 *   retient que les factions **productibles** et n'en trouve donc aucune dans sa
 *   ligne : elle prenait les types des **cartes de complément** (les Entrants
 *   `amelioration-*`, servis par l'ordre des `id`), qui ne recouvrent aucune des
 *   paires exigées par ses Pressions. On donne l'**Entrant** (`SSE` : sa seule
 *   Pression) et la paire **`RH` + `ATELIER`**, celle qui arme les deux Pressions du
 *   COMEX (`interim-interimaire-legendaire-ex`) et celle de
 *   `interim-responsable-interim` : chaque stade de la ligne peut lancer une Pression.
 *
 * Le plafond reste **3** (`MAX_DECK_CAFE_TYPES`) et seuls des types **productibles**
 * sont retenus : `resolveCafeTypes` écarterait les autres (`normalizeCafeTypes`).
 */
export const SIMULATION_CAFE_TYPES: Partial<Record<Faction, readonly CafeType[]>> = {
  SUPPORT: ['SSE'],
  INTERIM: ['SSE', 'RH', 'ATELIER']
};

/**
 * Le **choix de types** d'un Deck de simulation : la table ci-dessus quand
 * l'archétype en a besoin, `undefined` sinon — et `undefined` laisse `createBattle`
 * appliquer la dérivation du Deck, c'est-à-dire le comportement d'avant #113.
 */
export function factionCafeTypes(faction: Faction): CafeType[] | undefined {
  const chosen = SIMULATION_CAFE_TYPES[faction];
  return chosen ? [...chosen] : undefined;
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

/**
 * La politique vit **une seule fois**, dans `@/game/ia` (`nextAction`) : le
 * simulateur et l'écran de combat la lisent tous les deux. Ici, chaque camp joue
 * une action à la fois jusqu'à la fin du tour — c'est le même dispatcher
 * `applyAction` que l'écran (#58), et le forfait, décision humaine (D-030), n'est
 * jamais produit par la politique (`nextAction` ne l'énumère pas).
 */

/* ------------------------------------------------------------------ */
/* Rapport                                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_TURNS = 200;

/** État final d'une partie **et** compteurs du harnais (ticket #113). */
export interface GameOutcome {
  state: BattleState;
  /** Pressions réellement appliquées, par camp. */
  attacks: Record<PlayerId, number>;
}

/**
 * Joue **une** partie headless avec la politique partagée (`@/game/ia`) et renvoie
 * l'état final **et** les compteurs du harnais. `state.turn` vaut `maxTurns + 1`
 * quand la partie est arrêtée sans vainqueur.
 *
 * Chaque itération applique **une** action de la politique, relève comprise. Une
 * action qui ne change rien (`applyAction` rend l'état d'entrée) arrête la partie :
 * c'est le même garde-fou qu'avant, action par action au lieu d'un tour à la fois.
 *
 * `levels` donne le **niveau de chaque camp** (1 : la Direction scriptée, 2 : la
 * Direction qui évalue, ticket #93). Le niveau est celui du camp **qui joue** : lors
 * d'une relève, c'est le camp qui relève qui tranche, donc c'est son niveau qui
 * compte.
 *
 * `cafeTypes` porte les **types de café explicites** des deux Decks (ticket #113),
 * ceux que `simulate` tire de `factionCafeTypes`. Omis, `createBattle` applique la
 * dérivation du Deck — le comportement d'avant #113, que gardent les autres
 * appelants.
 */
export function playGameWithStats(
  playerDeck: string[],
  aiDeck: string[],
  seed: number,
  maxTurns = DEFAULT_MAX_TURNS,
  levels: { player?: AiLevel; ai?: AiLevel } = {},
  cafeTypes: BattleCafeTypes = {}
): GameOutcome {
  let state = createBattle(playerDeck, aiDeck, seed, cafeTypes);
  const attacks: Record<PlayerId, number> = { player: 0, ai: 0 };
  while (state.phase === 'playing' && state.turn <= maxTurns) {
    const who = state.pendingPromotion ?? state.current;
    const level = who === 'ai' ? (levels.ai ?? 1) : (levels.player ?? 1);
    const action = nextAction(state, level);
    if (!action) break;
    const after = applyAction(state, action);
    if (after === state) break;
    // Une Pression **appliquée** seulement : le compteur du harnais suit le journal.
    if (action.type === 'attack') attacks[who] += 1;
    state = after;
  }
  return { state, attacks };
}

/** `playGame` sans les compteurs : l'état final seul, pour les appelants d'avant #113. */
export function playGame(
  playerDeck: string[],
  aiDeck: string[],
  seed: number,
  maxTurns = DEFAULT_MAX_TURNS,
  levels: { player?: AiLevel; ai?: AiLevel } = {},
  cafeTypes: BattleCafeTypes = {}
): BattleState {
  return playGameWithStats(playerDeck, aiDeck, seed, maxTurns, levels, cafeTypes).state;
}

/**
 * Joue `games` parties et renvoie un rapport **comparable** : aucun horodatage,
 * aucun ordre dépendant d'un `Map` ou d'un `Set`.
 */
export function simulate(options: SimulationOptions): SimulationReport {
  const { games, seed, maxTurns = DEFAULT_MAX_TURNS } = options;
  const playerLevel = options.playerLevel ?? 1;
  const aiLevel = options.aiLevel ?? 1;
  if (!Number.isInteger(games) || games <= 0) {
    throw new Error(`Nombre de parties invalide : ${games}. Il faut un entier ≥ 1.`);
  }
  if (!Number.isFinite(seed)) throw new Error(`Graine invalide : ${seed}.`);
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new Error(`Limite de tours invalide : ${maxTurns}. Il faut un entier ≥ 1.`);
  }
  if (![1, 2].includes(playerLevel) || ![1, 2].includes(aiLevel)) {
    throw new Error(`Niveau d'IA invalide : ${playerLevel}/${aiLevel}. Les niveaux sont 1 et 2.`);
  }

  const factions = [...new Set(options.factions?.length ? options.factions : FACTION_ORDER)];
  const unknown = factions.filter((faction) => !FACTION_ORDER.includes(faction));
  if (unknown.length > 0) {
    throw new Error(`Faction(s) inconnue(s) : ${unknown.join(', ')}.`);
  }
  const decks = factionDecks(factions);
  // Le **choix de types explicite** des archétypes que la dérivation n'arme pas
  // (`SUPPORT`, `INTERIM`, ticket #113) : sans lui, `createBattle` dérive les types du
  // Deck, et ces deux Decks n'ont alors **aucun café à payer** — la Machine ne
  // produit rien pour `SUPPORT` (la dérivation exclut `SUPPORT`, D-034) et `INTERIM`
  // hérite de types qui ne couvrent aucune de ses Pressions. Un Deck désarmé ne
  // lance jamais de Pression, et la mesure du niveau 2 s'en trouvait biaisée. Les
  // autres factions passent `undefined` et gardent la dérivation.
  const cafeTypes = new Map(factions.map((faction) => [faction, factionCafeTypes(faction)]));
  // Une graine par partie, tirée de la graine maîtresse : les Decks sont
  // différents d'une partie à l'autre, mais la suite entière se rejoue.
  const master = { rng: seedRng(seed) };
  const results: GameResult[] = [];

  for (let index = 0; index < games; index += 1) {
    const [player, ai] = pairFactions(factions, index);
    const gameSeed = Math.floor(drawRandom(master) * 0x100000000) >>> 0;
    const { state, attacks } = playGameWithStats(
      decks.get(player) ?? [],
      decks.get(ai) ?? [],
      gameSeed,
      maxTurns,
      {
        player: playerLevel,
        ai: aiLevel
      },
      {
        playerCafeTypes: cafeTypes.get(player),
        aiCafeTypes: cafeTypes.get(ai)
      }
    );

    const winnerFaction = state.winner === 'player' ? player : state.winner === 'ai' ? ai : null;
    results.push({
      game: index + 1,
      seed: gameSeed,
      player,
      ai,
      winner: state.winner,
      winnerFaction,
      turns: Math.min(state.turn, maxTurns),
      attacks
    });
  }

  return {
    seed,
    games,
    maxTurns,
    playerLevel,
    aiLevel,
    factions: aggregateFactions(factions, results),
    results
  };
}

/** Agrégat par faction : parties, victoires, défaites, nulles, tours moyens. */
export function aggregateFactions(factions: readonly Faction[], results: readonly GameResult[]): FactionResult[] {
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
    `Niveaux — joueur : niveau ${report.playerLevel}, Direction : niveau ${report.aiLevel}`,
    '',
    `${'N°'.padEnd(4)}${'graine'.padEnd(12)}${'Poste'.padEnd(22)}${'Banc'.padEnd(22)}${'Vainqueur'.padEnd(22)}Tours`,
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
  lines.push(
    `${'Faction'.padEnd(22)}${'Parties'.padStart(8)}${'Victoires'.padStart(11)}${'Défaites'.padStart(10)}${'Nulles'.padStart(8)}${'Tours moy.'.padStart(12)}`
  );
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
