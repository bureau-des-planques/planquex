// Lenteur justifiée (D-143 (5)) — l'expectiminimax explore un arbre de coups à chaque cas
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, CardInstance } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions } from '@/game/engine';
import {
  DEFAULT_EXPECTIMINIMAX_OPTIONS,
  DEFAULT_SEARCH_OPTIONS,
  expectiminimaxDecision,
  expectiminimaxWorlds,
  nextAction,
  nextExpectiminimaxAction,
  nextSearchAction,
  unknownPool
} from '@/game/ia';
import type { ExpectiminimaxOptions } from '@/game/ia';
import { factionDeck } from '@/game/simulation';

/**
 * **Niveau 3 — expectiminimax + déterminisations** (ticket #94, spec #92).
 *
 * Ce que ces tests tiennent :
 *
 * - la recherche ne propose **jamais** une action que `legalActions` refuserait ;
 * - elle est **déterministe** : même position, mêmes options → même coup ;
 * - elle **ne modifie pas** la position qu'on lui donne, et ne consomme pas son générateur ;
 * - **information cachée** : les déterminisations ne reprennent jamais le **contenu** de la
 *   main ni du Deck adverses (elles les tirent dans `unknownPool`, comme le niveau 2) ;
 * - **budget** : plafond de nœuds et échéance murale bornent le travail, avec repli sur le
 *   glouton du niveau 2 (`nextAction(state, 2)`) — jamais une erreur, jamais un coup nul ;
 * - **profondeur et K réglables** : ce sont des paramètres, pas des constantes cachées.
 *
 * Le test d'équité porte sur **les mondes tirés**, pas sur la décision seule : la décision
 * bouge rarement quand la main adverse change (`docs/ia/111-essais-recherche-2-coups.md`
 * §7.2), un test de décision serait un garde-fou sans pouvoir. Le monde, lui, mord.
 */

/**
 * Les options des tests de **rejeu** (déterminisme, équité) : la garde de temps (`maxMs`)
 * est le seul terme non déterministe de la décision (#172) ; la neutraliser garde ces
 * tests reproductibles même sur une CI chargée. Le plafond de nœuds, lui, reste actif.
 */
const SANS_GARDE_DE_TEMPS: ExpectiminimaxOptions = {
  ...DEFAULT_EXPECTIMINIMAX_OPTIONS,
  maxMs: Infinity
};

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

describe('niveau 3 — légalité et déterminisme', () => {
  const positions = [1, 7].flatMap((seed) => aiDecisionPositions(seed, 4));

  it('trouve des positions de décision pour la Direction', () => {
    expect(positions.length).toBeGreaterThanOrEqual(4);
  });

  it('ne propose jamais une action refusée par le moteur', () => {
    for (const state of positions) {
      const action = nextExpectiminimaxAction(state, SANS_GARDE_DE_TEMPS);
      expect(action).not.toBeNull();
      expect(legalActions(state)).toContainEqual(action);
    }
  });

  it('est déterministe : même position, mêmes options, même coup', () => {
    for (const state of positions) {
      const first = nextExpectiminimaxAction(state, SANS_GARDE_DE_TEMPS);
      const again = nextExpectiminimaxAction(structuredClone(state), SANS_GARDE_DE_TEMPS);
      expect(again).toEqual(first);
    }
  });

  it("ne modifie pas la position qu'elle reçoit — ni son générateur", () => {
    for (const state of positions) {
      const before = structuredClone(state);
      nextExpectiminimaxAction(state, SANS_GARDE_DE_TEMPS);
      expect(state).toEqual(before);
      expect(state.rng).toBe(before.rng);
    }
  });

  it('profondeur et K sont des paramètres, pas des constantes', () => {
    const state = positions[0];
    if (!state) throw new Error('aucune position de décision');
    expect(expectiminimaxWorlds(state, 'ai', { ...SANS_GARDE_DE_TEMPS, worlds: 2 })).toHaveLength(2);
    expect(expectiminimaxWorlds(state, 'ai', { ...SANS_GARDE_DE_TEMPS, worlds: 5 })).toHaveLength(5);
    // Profondeur : les deux réglages restent légaux (le contrat de la politique ne change pas).
    for (const depth of [2, 3]) {
      const action = nextExpectiminimaxAction(state, { ...SANS_GARDE_DE_TEMPS, depth });
      expect(legalActions(state)).toContainEqual(action);
    }
  });
});

describe("niveau 3 — information cachée (l'IA ne lit jamais la main adverse)", () => {
  const positions = [1, 7].flatMap((seed) => aiDecisionPositions(seed, 3));

  it("le monde tiré ne reprend jamais la main ni le Deck réels de l'adversaire", () => {
    // **Le test qui mord** : si les mondes reprenaient `hidden.hand` / `hidden.deck`, les
    // contenus suivraient la permutation ci-dessous. Ils doivent au contraire rester ceux
    // du tirage dans le pool, indépendants du contenu réel des cartes cachées.
    for (const state of positions) {
      const swapped: BattleState = structuredClone(state);
      swapped.players.player.hand = reshuffleIds(state.players.player.hand, 4);
      swapped.players.player.deck = reshuffleIds(state.players.player.deck, 6);
      for (const index of [0, 1]) {
        const real = expectiminimaxWorlds(state, 'ai', SANS_GARDE_DE_TEMPS)[index]?.players.player;
        const other = expectiminimaxWorlds(swapped, 'ai', SANS_GARDE_DE_TEMPS)[index]?.players.player;
        expect(other?.hand.map((card) => card.cardId)).toEqual(real?.hand.map((card) => card.cardId));
        expect(other?.deck.map((card) => card.cardId)).toEqual(real?.deck.map((card) => card.cardId));
      }
    }
  });

  it('les mondes gardent les comptes adverses et ne tirent que dans le pool', () => {
    for (const state of positions) {
      const pool = new Set(unknownPool(state, 'ai'));
      const opponent = state.players.player;
      for (const world of expectiminimaxWorlds(state, 'ai', SANS_GARDE_DE_TEMPS)) {
        expect(world.players.player.hand).toHaveLength(opponent.hand.length);
        expect(world.players.player.deck).toHaveLength(opponent.deck.length);
        // Aucune carte tirée ne sort du pool des cartes inconnues.
        for (const card of [...world.players.player.hand, ...world.players.player.deck]) {
          expect(pool.has(card.cardId)).toBe(true);
        }
      }
    }
  });

  it("la décision est indépendante du contenu caché de l'adversaire", () => {
    for (const state of positions) {
      const swapped: BattleState = structuredClone(state);
      swapped.players.player.hand = reshuffleIds(state.players.player.hand, 3);
      swapped.players.player.deck = reshuffleIds(state.players.player.deck, 5);
      expect(nextExpectiminimaxAction(swapped, SANS_GARDE_DE_TEMPS)).toEqual(
        nextExpectiminimaxAction(state, SANS_GARDE_DE_TEMPS)
      );
    }
  });
});

/**
 * **État pathologique** du budget : une position de décision réelle, puis les deux camps
 * pourvus d'une **main pleine** (10 Objets « pioche 2 ») et d'un **Deck plein** (20 cartes) —
 * la forme qui a produit les pics de temps du niveau 2 (#172).
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

describe('niveau 3 — budget', () => {
  const LARGE: ExpectiminimaxOptions = {
    ...DEFAULT_EXPECTIMINIMAX_OPTIONS,
    depth: 3,
    candidates: 8,
    replies: 5,
    followups: 4,
    worlds: 6,
    maxMs: Infinity
  };

  afterEach(() => vi.restoreAllMocks());

  it('ne dépasse jamais le plafond de nœuds et replie sur le niveau 2 acté', () => {
    const state = pathologicalState();
    const debut = performance.now();
    const decision = expectiminimaxDecision(state, LARGE);
    const duree = performance.now() - debut;

    expect(decision.action).not.toBeNull();
    expect(legalActions(state)).toContainEqual(decision.action);
    expect(decision.fallback).toBe(true);
    expect(decision.nodes).toBeLessThanOrEqual(LARGE.maxNodes);
    // Le repli est la **recherche à deux coups** (D-084), pas le glouton : un niveau 3 qui
    // épuise son budget ne doit pas jouer moins bien que le niveau 2 qu'il remplace.
    // `LARGE.maxMs` est `Infinity`, donc le repli l'est aussi : la décision est reproductible.
    const niveau2 = nextSearchAction(state, { ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity });
    expect(decision.action).toEqual(niveau2);
    // Fumigène : sans budget, cet état coûte bien plus que la garde (cf. niveau 2, #172).
    expect(duree).toBeLessThan(5000);
  });

  it('sans le plafond, le même état coûte bien plus que le budget (le test mord)', () => {
    const state = pathologicalState();
    const unbounded = expectiminimaxDecision(state, { ...LARGE, maxNodes: 10_000_000 });
    expect(unbounded.fallback).toBe(false);
    expect(unbounded.nodes).toBeGreaterThan(LARGE.maxNodes);
  });

  it('la garde de temps abandonne elle aussi, sur le même repli', () => {
    const state = pathologicalState();
    // Horloge figée : la garde à 0 ms mord dès la première vérification, et le repli du
    // niveau 2 (garde à 60 ms, non neutralisée ici) ne dépend pas de la charge machine.
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const decision = expectiminimaxDecision(state, { ...LARGE, maxNodes: 10_000_000, maxMs: 0 });
    expect(decision.fallback).toBe(true);
    expect(decision.action).toEqual(nextSearchAction(state, { ...DEFAULT_SEARCH_OPTIONS, maxMs: Infinity }));
  });
});

describe('niveau 3 — hasard seedé', () => {
  it('les échantillons de hasard ne consomment pas le générateur de la partie', () => {
    for (const state of aiDecisionPositions(42, 3)) {
      const before = state.rng;
      // Plusieurs échantillons de hasard : le flux réel ne doit pas avancer d'un cran.
      nextExpectiminimaxAction(state, { ...SANS_GARDE_DE_TEMPS, chanceSamples: 3 });
      expect(state.rng).toBe(before);
    }
  });

  it('même graine de partie → même décision, même nombre de nœuds', () => {
    for (const state of aiDecisionPositions(11, 3)) {
      const first = expectiminimaxDecision(state, SANS_GARDE_DE_TEMPS);
      const again = expectiminimaxDecision(structuredClone(state), SANS_GARDE_DE_TEMPS);
      expect(again.action).toEqual(first.action);
      expect(again.nodes).toBe(first.nodes);
    }
  });
});
