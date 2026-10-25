// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';

const base = { tutorielVu: true, pasAPasCombatVu: true };

/** Attend le tour du joueur : la Direction, si elle ouvre, joue seule (délai nul, mouvement réduit). */
async function auTourDuJoueur() {
  await waitFor(() => expect(screen.getByText(/à toi/)).toBeInTheDocument(), { timeout: 5000 });
}

/** La passe de finition de l'alpha (#131, D-060) : Combat. */
describe('Battle — finition', () => {
  // La graine d'une partie vient de l'horloge (`createBattle`) : on fige la date pour que ces
  // parties soient **les mêmes** à chaque passage — sans quoi qui ouvre, et donc le test, varie.
  // Seule `Date` est figée : les délais (`setTimeout`) et `waitFor` gardent leur vraie horloge.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 22, 9, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('l’écran ne parle pas du moteur au joueur', () => {
    renderWithStore(<Battle />, base);
    expect(screen.queryByText(/IA de niveau/)).toBeNull();
    expect(screen.queryByText(/liste du moteur/)).toBeNull();
    expect(screen.queryByText(/joue toute seule/)).toBeNull();
  });

  it('pendant que la Direction joue, l’attente est dite ; elle disparaît quand le tour revient', async () => {
    renderWithStore(<Battle />, base);
    await auTourDuJoueur();
    // À toi : aucune attente.
    expect(screen.queryByText('La Direction réfléchit…')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Fin du tour/ }));

    // Dans le rendu qui suit le clic, avant que le premier coup de la Direction ne soit joué.
    const attente = screen.getByRole('status');
    expect(attente).toHaveTextContent('La Direction réfléchit…');

    await auTourDuJoueur();
    expect(screen.queryByText('La Direction réfléchit…')).toBeNull();
  });

  describe('Abandonner demande confirmation', () => {
    it('le clic ouvre la question et ne met pas fin à la partie', async () => {
      renderWithStore(<Battle />, base);
      await auTourDuJoueur();

      fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));

      const dialogue = screen.getByRole('dialog', { name: /Déclarer forfait/ });
      expect(dialogue).toHaveTextContent(/La Direction l’emporte, quel que soit le score/);
      expect(screen.queryByText(/partie terminée/)).toBeNull();
    });

    it('Annuler et Échap gardent la partie', async () => {
      renderWithStore(<Battle />, base);
      await auTourDuJoueur();

      fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByText(/partie terminée/)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.queryByText(/partie terminée/)).toBeNull();
    });

    it('confirmer déclare le forfait', async () => {
      renderWithStore(<Battle />, base);
      await auTourDuJoueur();

      fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
      const dialogue = screen.getByRole('dialog');
      fireEvent.click(within(dialogue).getByRole('button', { name: 'Abandonner' }));

      await waitFor(() => expect(screen.getByText(/partie terminée/)).toBeInTheDocument());
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
