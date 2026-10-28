// Lenteur justifiée (D-143 (5)) — la recherche à deux coups explore l'arbre à chaque cas
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, CardInstance } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions } from '@/game/engine';
import {
  DEFAULT_SEARCH_OPTIONS,
  nextAction,
  nextAiAction,
  nextSearchAction,
  sampleWorld,
  searchDecision,
  unknownPool
} from '@/game/ia';
import type { SearchOptions } from '@/game/ia';
import { factionDeck } from '@/game/simulation';

/**
 * **Recherche à deux coups** (expérimentale, `src/game/ia.ts`, `docs/ia/111-essais-recherche-2-coups.md`).
 *
 * Ce que ces tests tiennent :
 *
 * - la recherche ne propose **jamais** une action que `legalActions` refuserait ;
 * - elle est **déterministe** : même position → même coup ;
 * - elle **ne modifie pas** la position qu'on lui donne ;
 * - **équité** : sa décision ne dépend **pas** de la main ni du Deck **adverses** (leurs
 *   contenus, pas leurs comptes) — on remplace ces cartes par d'autres, et le coup ne bouge
 *   pas ; le pool des cartes inconnues ne contient ni mes cartes ni les cartes publiques.
 *
 * Le test d'équité **ne suffit pas** seul : une lecture du code (`sampleWorld`,
 * `unknownPool`) reste nécessaire. Il attrape une fuite qui ferait varier la décision,
 * pas une fuite sans effet sur cette position.
 */

/**
 * Les options des tests de **rejeu** (déterminisme, équité) : la garde de temps (`maxMs`)
 * est le seul terme non déterministe de la décision (#172) ; la neutraliser garde ces
 * tests reproductibles même sur une CI chargée. Le plafond de nœuds, lui, reste actif.
 */
const SANS_GARDE_DE_TEMPS: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity };

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');
const OTHER_CARDS = factionDeck('RH');

/** Les positions où la Direction a un vrai choix, prises sur une partie scriptée. */
function aiDecisionPositions(seed: number, count: number): BattleState[] {
  let state = createBattle(PLAYER_DECK, AI_DECK, seed);
  const found: BattleState[] = [];
  for (let step = 0; step < 600 && state.phase === 'playing' && found.length < count; step += 1) {
    if (state.current === 'ai' && !state.pendingPromotion && legalActions(state).length > 2) {
      found.push(structuredClone(state));
    }
    const action = nextAction(state, 1);
    if (!action) break;
    const after = applyAction(state, action);
    if (after === state) break;
    state = after;
  }
  return found;
}

/** Remplace les **cartes** (identifiants) d'une liste cachée, en gardant les uids et les comptes. */
function reshuffleIds(cards: CardInstance[], offset: number): CardInstance[] {
  return cards.map((card, index) => ({
    ...card,
    cardId: OTHER_CARDS[(index + offset) % OTHER_CARDS.length] ?? card.cardId
  }));
}

describe('recherche à deux coups — légalité et déterminisme', () => {
  const positions = [1, 7].flatMap((seed) => aiDecisionPositions(seed, 4));

  it('trouve des positions de décision pour la Direction', () => {
    expect(positions.length).toBeGreaterThanOrEqual(4);
  });

  it('ne propose jamais une action refusée par le moteur', () => {
    for (const state of positions) {
      const action = nextSearchAction(state, SANS_GARDE_DE_TEMPS);
      expect(action).not.toBeNull();
      expect(legalActions(state)).toContainEqual(action);
    }
  });

  it('est déterministe : même position, même coup', () => {
    for (const state of positions) {
      const first = nextSearchAction(state, SANS_GARDE_DE_TEMPS);
      const again = nextSearchAction(structuredClone(state), SANS_GARDE_DE_TEMPS);
      expect(again).toEqual(first);
    }
  });

  it("ne modifie pas la position qu'elle reçoit", () => {
    for (const state of positions) {
      const before = structuredClone(state);
      nextSearchAction(state, SANS_GARDE_DE_TEMPS);
      expect(state).toEqual(before);
    }
  });
});

describe("l'écran joue le niveau 2 acté (D-084, #172 clos)", () => {
  const positions = [1, 7, 11].flatMap((seed) => aiDecisionPositions(seed, 8));

  // L'échéance de 60 ms replie la recherche sur le glouton quand la machine est chargée :
  // l'horloge est figée pour que ce test ne dépende que du plafond de nœuds.
  afterEach(() => vi.restoreAllMocks());

  it('nextAiAction, sans niveau demandé, rend le coup de la recherche et non celui du script', () => {
    const divergentes = positions.filter(
      (state) => JSON.stringify(nextAction(state, 1)) !== JSON.stringify(nextSearchAction(state, SANS_GARDE_DE_TEMPS))
    );
    // Sans position où les deux politiques divergent, le test ne prouverait rien.
    expect(divergentes.length).toBeGreaterThan(0);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    for (const state of divergentes) {
      expect(nextAiAction(state)).toEqual(nextSearchAction(state, SANS_GARDE_DE_TEMPS));
    }
  });

  it("le niveau 1 reste demandable explicitement (repli de l'écran)", () => {
    for (const state of positions) {
      expect(nextAiAction(state, 'scripte')).toEqual(nextAction(state, 1));
    }
  });
});

/**
 * **État pathologique** du budget (#172) : une position de décision réelle, puis les deux
 * camps pourvus d'une **main pleine** (10 Objets « pioche 2 ») et d'un **Deck plein**
 * (20 cartes). Les tours scriptés jouent ces Objets en boucle (chaque pioche en ramène
 * deux), et les actions légales sont nombreuses : c'est exactement la forme qui empilait
 * le plus de `applyAction` — chacun clone tout l'état — et produisait les pics de temps.
 */
function pathologicalState(): BattleState {
  const base = aiDecisionPositions(1, 1)[0];
  if (!base) throw new Error('aucune position de décision');
  const state = structuredClone(base);
  for (const who of ['player', 'ai'] as const) {
    const side = state.players[who];
    side.hand = Array.from({ length: 10 }, (_, i) =>
      createInstance('sse-trousse-secours', state.turn, `patho-${who}-h${i}`)
    );
    side.deck = Array.from({ length: 20 }, (_, i) =>
      createInstance('sse-trousse-secours', state.turn, `patho-${who}-d${i}`)
    );
  }
  return state;
}

describe('recherche à deux coups — budget (#172)', () => {
  // Une configuration **plus large** que le défaut (celle de l'essai V2 du journal : elle
  // a mesuré un pic à 325 ms). Le plafond, lui, est celui du défaut.
  const LARGE: SearchOptions = {
    ...DEFAULT_SEARCH_OPTIONS,
    candidates: 10,
    worlds: 6,
    replies: 8,
    maxMs: Infinity
  };

  it('ne dépasse jamais le plafond de nœuds et replie sur le glouton', () => {
    const state = pathologicalState();
    const debut = performance.now();
    const decision = searchDecision(state, LARGE);
    const duree = performance.now() - debut;

    expect(decision.action).not.toBeNull();
    expect(legalActions(state)).toContainEqual(decision.action);
    // Le budget a mordu : la décision est le repli glouton, pas une ligne tronquée.
    expect(decision.fallback).toBe(true);
    expect(decision.nodes).toBeLessThanOrEqual(LARGE.maxNodes);
    // **Garde de temps = fumigène, pas la preuve.** Le plafond déterministe est `nodes` ;
    // la mesure de temps vit dans `npm run pesage`. Cette assertion ne sert qu'à attraper
    // une régression grossière (l'état pathologique sans budget prend ~1 000 ms à vide).
    // À 500 ms elle tombait sur machine chargée (857 ms constatés le 25/10/2026, 100+ workers).
    expect(duree).toBeLessThan(3000);
  });

  it('sans le plafond, le même état coûte bien plus que le budget (le test mord)', () => {
    const state = pathologicalState();
    // Plafond **et** garde de temps neutralisés : on mesure le travail réel de l'état.
    const unbounded = searchDecision(state, { ...LARGE, maxNodes: 1_000_000 });
    expect(unbounded.fallback).toBe(false);
    expect(unbounded.nodes).toBeGreaterThan(LARGE.maxNodes);
  });

  it('la garde de temps abandonne elle aussi, sur le même repli', () => {
    const state = pathologicalState();
    // Échéance nulle : dépassée dès la première vérification, quel que soit le plafond de nœuds.
    const decision = searchDecision(state, { ...LARGE, maxNodes: 1_000_000, maxMs: 0 });
    expect(decision.fallback).toBe(true);
    expect(decision.action).toEqual(nextAction(state, 2));
  });

  it('le repli est le coup du niveau 2 glouton — jamais une erreur, jamais un coup nul', () => {
    const state = pathologicalState();
    const decision = searchDecision(state, { ...LARGE, maxNodes: 1 });
    expect(decision.fallback).toBe(true);
    expect(decision.action).not.toBeNull();
    expect(decision.action).toEqual(nextAction(state, 2));
  });
});

describe('recherche à deux coups — équité', () => {
  const positions = [1, 7].flatMap((seed) => aiDecisionPositions(seed, 3));

  it("ne dépend pas des cartes cachées de l'adversaire (main et Deck, contenus)", () => {
    for (const state of positions) {
      // Même camp adverse, mêmes comptes (`hand.length`, `deck.length`), autres cartes.
      const swapped: BattleState = structuredClone(state);
      swapped.players.player.hand = reshuffleIds(state.players.player.hand, 3);
      swapped.players.player.deck = reshuffleIds(state.players.player.deck, 5);
      expect(nextSearchAction(swapped, SANS_GARDE_DE_TEMPS)).toEqual(nextSearchAction(state, SANS_GARDE_DE_TEMPS));
    }
  });

  it("le monde tiré ne reprend jamais la main ni le Deck réels de l'adversaire", () => {
    // Le test qui **mord** : la décision, elle, bouge rarement quand la main adverse change
    // (1 position sur 77 — `docs/ia/111-essais-recherche-2-coups.md`). Le contenu du monde, lui, doit être le même.
    for (const state of positions) {
      const swapped: BattleState = structuredClone(state);
      swapped.players.player.hand = reshuffleIds(state.players.player.hand, 4);
      swapped.players.player.deck = reshuffleIds(state.players.player.deck, 6);
      for (const index of [0, 1, 2]) {
        const real = sampleWorld(state, 'ai', index).players.player;
        const other = sampleWorld(swapped, 'ai', index).players.player;
        expect(other.hand.map((card) => card.cardId)).toEqual(real.hand.map((card) => card.cardId));
        expect(other.deck.map((card) => card.cardId)).toEqual(real.deck.map((card) => card.cardId));
      }
    }
  });

  it("le pool des cartes inconnues ne lit ni la main ni le Deck de l'adversaire", () => {
    for (const state of positions) {
      const swapped: BattleState = structuredClone(state);
      swapped.players.player.hand = reshuffleIds(state.players.player.hand, 2);
      swapped.players.player.deck = reshuffleIds(state.players.player.deck, 7);
      expect(unknownPool(swapped, 'ai')).toEqual(unknownPool(state, 'ai'));
    }
  });

  it('le pool retire mes cartes et les cartes publiques, pas les cartes cachées', () => {
    const state = positions[0];
    if (!state) throw new Error('aucune position de décision');
    const pool = unknownPool(state, 'ai');
    const me = state.players.ai;
    const seen = [...me.hand, ...me.deck, ...me.discard, ...state.players.player.discard];
    for (const card of [me.active, ...me.bench, state.players.player.active, ...state.players.player.bench]) {
      if (card) seen.push(card);
    }
    // Une carte que j'ai en main ou en Deck, avec deux exemplaires permis : il en reste au plus un.
    const mine = me.hand[0]?.cardId;
    if (!mine) throw new Error('main vide');
    const known = seen.filter((card) => card.cardId === mine).length;
    const left = pool.filter((id) => id === mine).length;
    expect(left).toBe(Math.max(0, 2 - known));
    // Le pool ne dépasse jamais deux exemplaires d'un identifiant (règle §4, par identifiant ici).
    const counts = new Map<string, number>();
    for (const id of pool) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });
});

/**
 * **Le budget de candidats de #411** (D-134). La force de la recherche contre un joueur
 * scripté vient du nombre de **mes** coups explorés en entier : `candidates` est donc une
 * décision de jeu, pas un réglage de confort. Deux gardes, et chacune **peut** échouer :
 *
 * 1. la valeur par défaut est **celle qui a été mesurée** (52,95 %, D-134) — revenir à 6
 *    sans une nouvelle mesure casse ce test, et c'est voulu : c'est un cliquet, pas une
 *    opinion ;
 * 2. le réglage **mord** sur le travail de la décision (`nodes`) : à 1 candidat la
 *    recherche ne cherche rien et rend le coup du glouton ; à 2 puis 4 elle travaille
 *    strictement plus. Si `candidates` cessait d'être lu, le second point tomberait.
 */
describe('recherche à deux coups — le budget de candidats (#411)', () => {
  const positions = [1, 7, 11].flatMap((seed) => aiDecisionPositions(seed, 8));

  it('le défaut est le réglage mesuré contre la référence scriptée', () => {
    // Mesuré par `npm run mesure:direction` (graine 20261028, 1 000 parties) : 6 candidats
    // donnaient 62,57 % des décidées (hors bande), 2 donnent 52,95 % (dans la bande).
    expect(DEFAULT_SEARCH_OPTIONS.candidates).toBe(2);
  });

  it('le nombre de candidats borne le travail de la décision (le réglage mord)', () => {
    for (const state of positions) {
      const un = searchDecision(state, { ...SANS_GARDE_DE_TEMPS, candidates: 1 });
      const deux = searchDecision(state, { ...SANS_GARDE_DE_TEMPS, candidates: 2 });
      const quatre = searchDecision(state, { ...SANS_GARDE_DE_TEMPS, candidates: 4 });

      // Un seul candidat : aucune ligne à comparer, le coup est le glouton, zéro nœud.
      expect(un.nodes).toBe(0);
      expect(un.action).toEqual(nextAction(state, 2));
      // Deux et quatre candidats : de vrais nœuds, et strictement plus à quatre.
      expect(deux.nodes).toBeGreaterThan(0);
      expect(quatre.nodes).toBeGreaterThan(deux.nodes);
    }
  });
});
