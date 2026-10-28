import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isBasic } from '@/data';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import {
  DIFFICULTE_PAR_DEFAUT,
  POLITIQUE_DE_DIFFICULTE,
  POLITIQUE_DU_NIVEAU,
  nextAction,
  nextAiAction,
  nextSearchAction,
  politique
} from '@/game/ia';
import type { AiLevel, Politique } from '@/game/ia';
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
function tourDeLaDirection(seed = 7): BattleState {
  let state = createBattle(DECK, DECK, seed);
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

describe('niveaux et difficulté nommés (#251, D-125)', () => {
  /**
   * Une partie où, à un tour de la Direction, le script et le glouton jouent des coups
   * différents. On joue la partie au glouton pour les deux camps, en s'arrêtant au premier
   * tour de la Direction qui départage les deux politiques.
   */
  function tourOuLesPolitiquesDiffèrent(): BattleState {
    for (let seed = 1; seed < 80; seed += 1) {
      let state = createBattle(DECK, DECK, seed);
      for (let step = 0; step < 400 && state.phase !== 'ended'; step += 1) {
        if (state.current === 'ai' && !state.pendingPromotion) {
          if (JSON.stringify(nextAction(state, 1)) !== JSON.stringify(nextAction(state, 2))) return state;
        }
        const action = nextAction(state, 2) ?? legalActions(state).find((a) => a.type === 'endTurn');
        if (!action) break;
        state = applyAction(state, action);
      }
    }
    throw new Error('Aucune partie ne distingue le script du glouton');
  }

  it('chaque niveau numérique joue la politique que son nom annonce', () => {
    const state = tourOuLesPolitiquesDiffèrent();
    const niveaux: AiLevel[] = [1, 2];
    for (const niveau of niveaux) {
      expect(politique(POLITIQUE_DU_NIVEAU[niveau])(state)).toEqual(nextAction(state, niveau));
    }
  });

  it('contrôle mord : une table inversée est refusée par le même test', () => {
    const state = tourOuLesPolitiquesDiffèrent();
    const inversee: Record<AiLevel, Politique> = { 1: 'glouton', 2: 'scripte' };
    expect(politique(inversee[1])(state)).not.toEqual(nextAction(state, 1));
  });

  it('la difficulté par défaut est Normal, c’est-à-dire la recherche de l’écran (D-084, D-145)', () => {
    const state = tourDeLaDirection();
    expect(DIFFICULTE_PAR_DEFAUT).toBe('normal');
    expect(POLITIQUE_DE_DIFFICULTE[DIFFICULTE_PAR_DEFAUT]).toBe('recherche');
    expect(nextAiAction(state)).toEqual(politique(POLITIQUE_DE_DIFFICULTE[DIFFICULTE_PAR_DEFAUT])(state));
  });

  it('trois crans nommés, trois politiques nommées (D-145)', () => {
    expect(POLITIQUE_DE_DIFFICULTE.facile).toBe('scripte');
    expect(POLITIQUE_DE_DIFFICULTE.normal).toBe('recherche');
    expect(POLITIQUE_DE_DIFFICULTE.difficile).toBe('expectiminimax');
    // Le contrôle mord : aucun cran ne désigne la Direction par un chiffre.
    for (const politiqueDuCran of Object.values(POLITIQUE_DE_DIFFICULTE)) {
      expect(typeof politiqueDuCran).toBe('string');
      expect(['scripte', 'glouton', 'recherche', 'expectiminimax']).toContain(politiqueDuCran);
    }
  });
});
