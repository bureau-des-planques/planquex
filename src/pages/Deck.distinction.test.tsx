// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Deck, SELECTEUR_CARTES } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS } from '@/data';

/**
 * **Le Deck est « ce que je joue »** (#276) : il ne déroule pas la Collection.
 *
 * La page montre le Deck, ses contraintes, et un **sélecteur borné** — un sous-ensemble de la
 * Collection, jamais son tout. La Collection entière se parcourt sur `/collection`.
 */
describe('Deck — le rôle de la page (#276)', () => {
  it('n’affiche jamais tout le catalogue : le sélecteur est borné', () => {
    // Toutes les cartes possédées : le pire cas pour une page qui « déroulerait la Collection ».
    const owned = Object.fromEntries(ALL_CARDS.map((carte) => [carte.id, 2]));
    const { container } = renderWithStore(<Deck />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    const cartes = container.querySelectorAll('.card-slot').length;
    expect(owned[ALL_CARDS[0].id]).toBe(2);
    // Le Deck est vide ici : toutes les cartes à l'écran viennent du sélecteur, borné.
    expect(cartes).toBe(SELECTEUR_CARTES);
    expect(cartes).toBeLessThan(ALL_CARDS.length);
  });

  it('ne montre pas les cartes que le testeur ne possède pas, et dit ses contraintes', () => {
    renderWithStore(<Deck />, {
      owned: { 'sse-infirmier-site': 1 },
      tutorielVu: true,
      pasAPasCombatVu: true
    });

    // Une carte absente de la Collection n'a rien à faire sur la page Deck.
    expect(document.querySelector('.card-slot[data-card-id="management-responsable-unite"]')).toBeNull();
    // La page dit ce qu'elle demande, en quatre lignes.
    const contraintes = screen
      .getByRole('heading', { name: /Ce que le Deck doit respecter/i })
      .closest('section') as HTMLElement;
    expect(contraintes.textContent).toContain('au moins 1 Planqué Entrant');
    expect(contraintes.textContent).toContain('2 exemplaires au plus du même nom');
  });

  it('n’est pas la Collection : la recherche du sélecteur ne sort pas du Deck', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByPlaceholderText(/Chercher dans ma Collection/i)).toBeInTheDocument();
    // Les filtres de la Collection (faction, stade) n'existent pas ici : ce sont deux lieux.
    expect(screen.queryByLabelText(/^Faction$/i)).toBeNull();
    expect(screen.queryByLabelText(/^Stade$/i)).toBeNull();
  });
});
