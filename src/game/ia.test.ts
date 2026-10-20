import { describe, expect, it } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { nextAiAction } from '@/game/ia';
import { factionDeck } from '@/game/simulation';

/**
 * **IA de niveau 1 — la Direction**.
 *
 * Ce que ces tests tiennent : la politique (`@/game/ia`) a un seul point d'entrée
 * pour l'écran (`nextAiAction`), elle ne produit aucune action illégale — elle
 * choisit **dans** `legalActions` —, elle attaque quand elle peut, elle ne joue
 * jamais pour le camp `player`, et elle est **déterministe par graine**.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

/** Une action pousse-t-elle l'état ? La politique ne doit jamais en produire une qui ne fait rien. */
function applied(state: BattleState, action: BattleAction): boolean {
  return applyAction(state, action) !== state;
}

/**
 * Joue une partie en pilotant la Direction par `nextAiAction` et l'humain par la
 * seule fin de tour (on ne teste pas le jeu du joueur, seulement celui de l'IA).
 * Renvoie la suite des actions de l'IA, avec l'état qui les a produites.
 */
function playSeed(seed: number): {
  state: BattleState;
  ai: { state: BattleState; action: BattleAction }[];
} {
  let state = createBattle(PLAYER_DECK, AI_DECK, seed);
  const ai: { state: BattleState; action: BattleAction }[] = [];

  for (let guard = 0; guard < 4000 && state.phase === 'playing'; guard += 1) {
    if (state.pendingPromotion) {
      // La politique choisit sa relève pour `ai` ; pour `player`, le test la choisit
      // à sa place (ce n'est pas le sujet).
      const action =
        nextAiAction(state) ?? legalActions(state).find((entry) => entry.type === 'promoteActive');
      if (!action) break;
      state = applyAction(state, action);
      continue;
    }
    if (state.current === 'ai') {
      const action = nextAiAction(state);
      if (!action) break;
      ai.push({ state, action });
      state = applyAction(state, action);
    } else {
      state = applyAction(state, { type: 'endTurn' });
    }
  }
  return { state, ai };
}

describe('IA de niveau 1 — la Direction', () => {
  it('chaque action renvoyée appartient à legalActions, et pousse l’état', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const { ai } = playSeed(seed);
      expect(ai.length, `graine ${seed} : l'IA n'a rien joué`).toBeGreaterThan(0);
      for (const { state, action } of ai) {
        const legal = legalActions(state);
        expect(
          legal.some((entry) => JSON.stringify(entry) === JSON.stringify(action)),
          `action illégale (graine ${seed}) : ${JSON.stringify(action)}`
        ).toBe(true);
        expect(applied(state, action), `action sans effet (graine ${seed})`).toBe(true);
      }
    }
  });

  it('ne joue jamais pour le camp player', () => {
    // Amène l'état sur le tour du joueur, puis vérifie le refus.
    let state = createBattle(PLAYER_DECK, AI_DECK, 1);
    let guard = 0;
    while (state.current === 'ai' && state.phase === 'playing' && guard < 100) {
      state = applyAction(state, { type: 'endTurn' });
      guard += 1;
    }
    expect(state.current).toBe('player');
    expect(nextAiAction(state)).toBeNull();
  });

  it('termine son tour : plus rien après endTurn', () => {
    // Trouve une fin de tour produite par l'IA, l'applique, puis vérifie le silence.
    for (const seed of [1, 7, 42, 99, 1234]) {
      let state = createBattle(PLAYER_DECK, AI_DECK, seed);
      for (let guard = 0; guard < 4000 && state.phase === 'playing'; guard += 1) {
        if (state.current === 'player' && !state.pendingPromotion) {
          state = applyAction(state, { type: 'endTurn' });
          continue;
        }
        const action = nextAiAction(state);
        if (!action) {
          // Relève du joueur : on la trance à sa place et on continue.
          const promotion = legalActions(state).find((entry) => entry.type === 'promoteActive');
          if (!promotion) break;
          state = applyAction(state, promotion);
          continue;
        }
        const after = applyAction(state, action);
        if (action.type === 'endTurn') {
          expect(nextAiAction(after), `graine ${seed} : l'IA continue après endTurn`).toBeNull();
          return;
        }
        state = after;
      }
    }
    throw new Error('aucune fin de tour de l’IA trouvée');
  });

  it('attaque quand elle peut', () => {
    const attacks = [1, 7, 42, 99, 1234]
      .flatMap((seed) => playSeed(seed).ai)
      .filter(({ action }) => action.type === 'attack');
    expect(attacks.length, 'l’IA n’a jamais attaqué sur ces graines').toBeGreaterThan(0);
  });

  it('est déterministe par graine : même graine, même suite', () => {
    const first = playSeed(123).ai.map(({ action }) => action);
    const second = playSeed(123).ai.map(({ action }) => action);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it('se tait une fois la partie finie', () => {
    const { state } = playSeed(42);
    expect(state.phase).toBe('ended');
    expect(nextAiAction(state)).toBeNull();
  });
});
