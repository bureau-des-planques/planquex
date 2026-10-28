// @vitest-environment jsdom
// Lenteur justifiée (D-143 (5)) — le rôle de la Collection (#276), rendu sous jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Collection } from './Collection';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS } from '@/data';

/**
 * **La Collection est « ce que je possède »** (#276) : on y cherche, on voit, on filtre.
 *
 * Elle ne porte ni les emplacements du Deck, ni sa machine à café : deux pages, deux rôles.
 * Le `+` de la Collection (user story 4 de #276) reste : ajouter une carte au Deck **depuis**
 * la Collection, c'est un geste de la Collection, pas un second écran de Deck.
 */
describe('Collection — le rôle de la page (#276)', () => {
  it('n’affiche ni les emplacements du Deck, ni la machine à café', () => {
    renderWithStore(<Collection />, {
      owned: { 'sse-infirmier-site': 1 },
      tutorielVu: true,
      pasAPasCombatVu: true
    });

    expect(screen.queryByRole('heading', { name: /^Dedans/ })).toBeNull();
    expect(screen.queryByText(/Machine à café/i)).toBeNull();
    expect(screen.queryByRole('group', { name: /Types de café/i })).toBeNull();
  });

  it('déroule tout le catalogue possédé ou non, et dit son rôle', () => {
    const { container } = renderWithStore(<Collection />, {
      owned: { 'sse-infirmier-site': 1 },
      tutorielVu: true,
      pasAPasCombatVu: true
    });

    // La Collection, elle, va jusqu'au bout du catalogue : c'est son métier.
    expect(container.querySelectorAll('.card-slot')).toHaveLength(ALL_CARDS.length);
    expect(screen.getByText(/Tout ce que tu possèdes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /la page Deck/i })).toHaveAttribute('href', '/deck');
  });
});
