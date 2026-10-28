// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { deckDeLaDirection } from '@/game/deck-direction';
import { DIFFICULTES } from '@/game/ia';

/**
 * **Le Deck de la Direction suit la difficulté** (#251, D-145) : le combat solo oppose le
 * Deck proposé du cran réglé, et le range dans la partie persistée (donc dans son rejeu).
 */
describe('Battle — le Deck de la Direction suit la difficulté (#251)', () => {
  const joueur = [...DECKS_PROPOSES[0].cartes];

  for (const cran of DIFFICULTES) {
    it(`le combat oppose le Deck de la Direction de « ${cran} »`, () => {
      renderWithStore(<Battle />, { deck: joueur, difficulte: cran, tutorielVu: true, pasAPasCombatVu: true });

      const partie = useStore.getState().partie;
      expect(partie?.aiDeck).toEqual([...deckDeLaDirection(cran).cartes]);
      expect(partie?.playerDeck).toEqual(joueur);
    });
  }
});
