// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from './Settings';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';

/** La passe de finition de l'alpha (#131, D-060) : Réglages. */
describe('Settings — finition', () => {
  it('le gras de la sauvegarde est du gras : aucun astérisque de Markdown à l’écran', () => {
    const { container } = renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });
    expect(container.textContent).not.toContain('**');
    const gras = within(screen.getByText(/Ta progression de jeu/)).getByText(
      /vider les données du navigateur l’efface/
    );
    expect(gras.tagName).toBe('STRONG');
  });

  describe('« Réinitialiser la progression » demande confirmation', () => {
    it('le clic ouvre une confirmation et n’efface encore rien', () => {
      renderWithStore(<Settings />, { name: 'Camille', owned: { 'sse-infirmier-site': 3 }, tutorielVu: true, pasAPasCombatVu: true });

      fireEvent.click(screen.getByRole('button', { name: /Réinitialiser la progression/ }));

      const dialogue = screen.getByRole('dialog', { name: /Réinitialiser la progression/ });
      expect(dialogue).toHaveTextContent(/sans retour possible/);
      expect(useStore.getState().name).toBe('Camille');
      expect(useStore.getState().owned['sse-infirmier-site']).toBe(3);
    });

    it('annuler (bouton ou Échap) garde la progression', async () => {
      renderWithStore(<Settings />, { name: 'Camille', tutorielVu: true, pasAPasCombatVu: true });

      fireEvent.click(screen.getByRole('button', { name: /Réinitialiser la progression/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(useStore.getState().name).toBe('Camille');

      fireEvent.click(screen.getByRole('button', { name: /Réinitialiser la progression/ }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(useStore.getState().name).toBe('Camille');
    });

    it('confirmer efface, et le champ du nom suit', () => {
      renderWithStore(<Settings />, { name: 'Camille', owned: { 'sse-infirmier-site': 3 }, tutorielVu: true, pasAPasCombatVu: true });

      fireEvent.click(screen.getByRole('button', { name: /Réinitialiser la progression/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));

      expect(useStore.getState().name).toBe('Employé 404');
      expect(screen.getByLabelText(/Nom affiché/)).toHaveValue('Employé 404');
    });
  });

  it('un refus d’import est annoncé (role=alert), un succès est un statut (role=status)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });
    const zone = screen.getByPlaceholderText(/Ta sauvegarde apparaîtra ici/);

    fireEvent.change(zone, { target: { value: 'pas une sauvegarde' } });
    fireEvent.click(screen.getByRole('button', { name: /Restaurer ce texte/ }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
