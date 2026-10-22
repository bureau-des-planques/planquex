import { describe, expect, it } from 'vitest';
import type { BattleState, CardInstance } from '@/data/types';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { nextAction, nextSearchAction, sampleWorld, unknownPool } from '@/game/ia';
import { factionDeck } from '@/game/simulation';

/**
 * **Recherche à deux coups** (expérimentale, `src/game/ia.ts`, `docs/ESSAIS-IA.md`).
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
      const action = nextSearchAction(state);
      expect(action).not.toBeNull();
      expect(legalActions(state)).toContainEqual(action);
    }
  });

  it('est déterministe : même position, même coup', () => {
    for (const state of positions) {
      const first = nextSearchAction(state);
      const again = nextSearchAction(structuredClone(state));
      expect(again).toEqual(first);
    }
  });

  it("ne modifie pas la position qu'elle reçoit", () => {
    for (const state of positions) {
      const before = structuredClone(state);
      nextSearchAction(state);
      expect(state).toEqual(before);
    }
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
      expect(nextSearchAction(swapped)).toEqual(nextSearchAction(state));
    }
  });

  it("le monde tiré ne reprend jamais la main ni le Deck réels de l'adversaire", () => {
    // Le test qui **mord** : la décision, elle, bouge rarement quand la main adverse change
    // (1 position sur 77 — `docs/ESSAIS-IA.md`). Le contenu du monde, lui, doit être le même.
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
