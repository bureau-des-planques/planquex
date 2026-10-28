// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';

/**
 * **La création guidée d'un Deck** (#251) : les contraintes sont affichées **avant** la
 * validation, et un Deck invalide est refusé en nommant la règle en cause — pas un refus
 * muet. Le bandeau et le verdict lisent les constantes du moteur, jamais une copie.
 */
describe('Deck — contraintes et refus expliqué (#251)', () => {
  const legal = [...DECKS_PROPOSES[0].cartes];

  it('dit les quatre contraintes avant toute validation', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    const contraintes = screen
      .getByRole('heading', { name: /Ce que le Deck doit respecter/i })
      .closest('section') as HTMLElement;
    expect(contraintes.textContent).toContain(`${DECK_SIZE}`);
    expect(contraintes.textContent).toContain(`${MAX_COPIES_PER_NAME} exemplaires au plus du même nom`);
    expect(contraintes.textContent).toContain('au moins 1 Planqué Entrant');
    expect(contraintes.textContent).toContain('jusqu’à 3 types de café');
  });

  it('un Deck de 20 cartes est validé', () => {
    renderWithStore(<Deck />, { deck: legal, tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByText(/Deck valide : il peut partir au combat/)).toBeInTheDocument();
  });

  it('un Deck de 21 cartes est refusé avec le compte en cause (le contrôle mord)', () => {
    renderWithStore(<Deck />, { deck: [...legal, legal[0]], tutorielVu: true, pasAPasCombatVu: true });

    expect(
      screen.getByText(new RegExp(`Le Deck doit contenir ${DECK_SIZE} cartes \\(21/${DECK_SIZE}\\)`))
    ).toBeInTheDocument();
    expect(screen.queryByText(/Deck valide/)).toBeNull();
  });

  it('un troisième exemplaire du même nom est refusé en nommant le plafond', () => {
    renderWithStore(<Deck />, { deck: [...legal.slice(0, 18), legal[0]], tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(new RegExp(`Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom`))).toBeInTheDocument();
  });
});
