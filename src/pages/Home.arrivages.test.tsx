// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Home } from './Home';
import { renderWithStore } from '@/test/test-utils';

/**
 * **Les Arrivages à ouvrir et leur compteur** (#273).
 *
 * Décision du grilling du 27/10/2026 : pendant l'alpha on ne limite rien (D-127, `openPack`
 * est illimité et gratuit). L'accueil montre donc le geste et le nombre, et **aucun quota** :
 * la cadence, les Tickets et l'achat sont une décision de beta.
 */
describe('Home — le gros bouton et le compteur d’Arrivages (#273)', () => {
  it('à zéro : une invitation, le compteur à zéro, et le bouton reste actif', () => {
    renderWithStore(<Home />, { packsOpened: 0, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText('0 Arrivage ouvert')).toBeInTheDocument();
    expect(screen.getByText(/Aucun Arrivage ouvert : le premier est pour toi\./)).toBeInTheDocument();

    const bouton = screen.getByRole('button', { name: /Ouvrir un Arrivage/i });
    expect(bouton).toBeEnabled();
    // Aucune limite ne s'affiche pendant l'alpha (D-127) : ni quota, ni Ticket, ni prix.
    expect(screen.queryByText(/Tickets?\b/i)).toBeNull();
    expect(screen.queryByText(/\bprix\b/i)).toBeNull();
  });

  it('à trois : le nombre se lit tel quel', () => {
    renderWithStore(<Home />, { packsOpened: 3, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText('3 Arrivages ouverts')).toBeInTheDocument();
    // L'invitation de l'état zéro ne s'affiche plus quand il y a eu des ouvertures.
    expect(screen.queryByText(/Aucun Arrivage ouvert/)).toBeNull();
  });

  it('le compteur suit le store : 3, puis 4 après une ouverture', async () => {
    renderWithStore(<Home />, { packsOpened: 3, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/i }));

    // **Le contrôle mord** : un compteur figé (« 0 » ou « 3 » écrit à la main) échouerait
    // ici comme dans le test de l'état zéro. La valeur vient du store, pas d'un littéral.
    await waitFor(() => expect(screen.getByText('4 Arrivages ouverts')).toBeInTheDocument());
  });
});
