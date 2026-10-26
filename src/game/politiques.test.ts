import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isBasic } from '@/data';
import { applyAction, createBattle } from '@/game/engine';
import { nextAction, nextAiAction, nextSearchAction, politique } from '@/game/ia';
import type { BattleState } from '@/data/types';

/**
 * **Les politiques portent un nom** (#253).
 *
 * Le mal que ce test garde : `nextAction(state, 2)` et `nextAiAction(state, 2)` ne jouaient
 * pas la même chose — le glouton d'un côté, la recherche à deux coups de l'autre — et les
 * deux s'appelaient « 2 ». Le nom supprime l'ambiguïté, et ce test vérifie qu'il ne
 * désigne pas deux choses à la fois.
 */

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

/** Une partie où c'est à la Direction de jouer. */
function tourDeLaDirection(): BattleState {
  let state = createBattle(DECK, DECK, 7);
  for (let i = 0; i < 8 && state.current !== 'ai'; i += 1) {
    state = applyAction(state, { type: 'endTurn' });
  }
  if (state.current !== 'ai') throw new Error('La Direction ne joue pas dans cette graine');
  return state;
}

describe('politiques nommées (#253)', () => {
  it('chaque nom désigne la politique qu’il annonce', () => {
    const state = tourDeLaDirection();

    expect(politique('scripte')(state)).toEqual(nextAction(state, 1));
    expect(politique('glouton')(state)).toEqual(nextAction(state, 2));
    expect(politique('recherche')(state)).toEqual(nextSearchAction(state));
  });

  it('l’écran joue la recherche, pas le glouton, et le dit', () => {
    const state = tourDeLaDirection();

    // Le défaut de `nextAiAction` est la recherche (D-084) : le nom le dit maintenant.
    expect(nextAiAction(state)).toEqual(nextSearchAction(state));
    expect(nextAiAction(state, 'recherche')).toEqual(nextSearchAction(state));
    // Contrôle : demander explicitement le glouton n'est pas la même demande.
    expect(nextAiAction(state, 'glouton')).toEqual(nextAction(state, 2));
  });
});
