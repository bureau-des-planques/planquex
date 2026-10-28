// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Settings } from './Settings';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { reglageDirection } from '@/game/deck-direction';

/**
 * **Le sélecteur de difficulté** (#251, D-145) : trois crans nommés, chacun disant la
 * **politique** qu'il règle (par son nom) et le **Deck** que la Direction joue.
 */
describe('Settings — difficulté de la Direction (#251)', () => {
  it('propose trois crans nommés, et Normal est coché par défaut', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const groupe = screen.getByRole('radiogroup', { name: /Difficulté de la Direction/i });
    const crans = within(groupe).getAllByRole('radio');
    expect(crans.map((cran) => cran.getAttribute('value'))).toEqual(['facile', 'normal', 'difficile']);
    expect(within(groupe).getByRole('radio', { name: /Normal/i })).toBeChecked();
  });

  it('nomme la politique et le Deck de chaque cran, sans chiffre', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });
    const groupe = screen.getByRole('radiogroup', { name: /Difficulté de la Direction/i });

    for (const cran of ['facile', 'normal', 'difficile'] as const) {
      const reglage = reglageDirection(cran);
      const ligne = within(groupe).getByRole('radio', { name: new RegExp(reglage.deck.name, 'i') });
      expect(ligne.closest('label')?.textContent).toContain(reglage.deck.name);
      expect(ligne.closest('label')?.textContent).toContain(
        { scripte: 'Scriptee', glouton: 'Glouton', recherche: 'Recherche', expectiminimax: 'Expectiminimax' }[
          reglage.politique
        ]
      );
    }
  });

  it('un clic pose le cran dans le store (persisté), et le contrôle mord', () => {
    renderWithStore(<Settings />, { difficulte: 'normal', tutorielVu: true, pasAPasCombatVu: true });
    const groupe = screen.getByRole('radiogroup', { name: /Difficulté de la Direction/i });

    fireEvent.click(within(groupe).getByRole('radio', { name: /Difficile/i }));
    expect(useStore.getState().difficulte).toBe('difficile');
    expect(within(groupe).getByRole('radio', { name: /Difficile/i })).toBeChecked();
    expect(within(groupe).getByRole('radio', { name: /Normal/i })).not.toBeChecked();
  });
});
