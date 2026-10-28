// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { deckDeLaDirection } from '@/game/deck-direction';
import { DIFFICULTES } from '@/game/ia';
import { LIBELLE_DIFFICULTE } from '@/components/difficulte';

/**
 * **La présentation d'un Deck proposé** (#251) : un panneau qui dit la stratégie, la
 * difficulté à jouer et le contenu, et qui charge le Deck depuis la lecture.
 */
describe('Deck — présentation d’un Deck proposé (#251)', () => {
  const deckPropose = DECKS_PROPOSES[0];

  it('s’ouvre au clic sur le nom du Deck, sans quitter l’écran', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Présentation de ${deckPropose.name}`, 'i') }));

    const panneau = screen.getByRole('dialog', { name: deckPropose.name });
    expect(within(panneau).getByText(deckPropose.strategie)).toBeInTheDocument();
    expect(within(panneau).getByText(/Difficulté à jouer/i)).toBeInTheDocument();
    expect(within(panneau).getByText(/Ce qu’il contient/i)).toBeInTheDocument();
    // Le contenu : les 20 cartes, groupées par nom.
    expect(within(panneau).getByText(new RegExp(`${deckPropose.cartes.length} cartes`))).toBeInTheDocument();
  });

  it('charge le Deck depuis le panneau, avec ses types de café', () => {
    renderWithStore(<Deck />, { deck: [], owned: {}, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Présentation de ${deckPropose.name}`, 'i') }));
    const panneau = screen.getByRole('dialog', { name: deckPropose.name });
    fireEvent.click(within(panneau).getByRole('button', { name: /Charger ce Deck/i }));

    const state = useStore.getState();
    expect(state.deck).toEqual([...deckPropose.cartes]);
    expect(state.cafeTypes).toEqual([...deckPropose.cafeTypes]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dit quel cran de difficulté joue la Direction avec ce Deck', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    for (const cran of DIFFICULTES) {
      const deck = deckDeLaDirection(cran);
      const ligne = screen.getByText(deck.name).closest('h3') as HTMLElement;
      expect(within(ligne).getByText(`Direction en ${LIBELLE_DIFFICULTE[cran]}`)).toBeInTheDocument();
    }
  });
});
