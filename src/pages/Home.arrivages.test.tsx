// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Home } from './Home';
import { renderWithStore } from '@/test/test-utils';
import { CARTES_ARRIVAGE, cleAppelee, reponseArrivage, simulerArrivage } from '@/test/arrivageDeTest';

/**
 * **Les Arrivages à ouvrir et leur compteur** (#273).
 *
 * Décision du grilling du 27/10/2026 : pendant l'alpha on ne limite rien (D-127, `openPack`
 * est illimité et gratuit). L'accueil montre donc le geste et le nombre, et **aucun quota** :
 * la cadence, les Tickets et l'achat sont une décision de beta.
 */
describe('Home — le gros bouton et le compteur d’Arrivages (#273)', () => {
  afterEach(() => vi.restoreAllMocks());

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
    simulerArrivage();
    renderWithStore(<Home />, { packsOpened: 3, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/i }));

    // **Le contrôle mord** : un compteur figé (« 0 » ou « 3 » écrit à la main) échouerait
    // ici comme dans le test de l'état zéro. La valeur vient du store, pas d'un littéral.
    await waitFor(() => expect(screen.getByText('4 Arrivages ouverts')).toBeInTheDocument());
  });

  it('hors ligne : l’écran dit « connecte-toi pour ouvrir », le bouton ne part pas (D-179 (6))', () => {
    const fetchImpl = simulerArrivage({ enLigne: false });
    // `navigator.onLine` est en lecture seule : on la pilote par un espion sur le getter.
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    renderWithStore(<Home />, { packsOpened: 0, tutorielVu: true, pasAPasCombatVu: true });

    // Un **état** au sens de D-060 (3), pas un message d'erreur nu.
    expect(screen.getByRole('status')).toHaveTextContent(/connecte-toi pour ouvrir un Arrivage/i);
    const bouton = screen.getByRole('button', { name: /Ouvrir un Arrivage/i });
    expect(bouton).toBeDisabled();
    fireEvent.click(bouton);
    // Le contrôle mord : un écran qui laisserait partir la demande émettrait un appel.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('échec réseau : il propose de réessayer, et le second clic réutilise la même clé', async () => {
    let appels = 0;
    const fetchImpl = vi.fn(async () => {
      appels += 1;
      if (appels === 1) throw new TypeError('réseau coupé');
      return reponseArrivage({
        cards: CARTES_ARRIVAGE.map((carte) => ({ id: carte.id, rarity: carte.rarity })),
        seed: 7
      });
    });
    simulerArrivage({ fetchImpl });
    renderWithStore(<Home />, { packsOpened: 0, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/i }));
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(/réessaie/i);
    // Rien n'est acquis, rien n'est perdu : la scène ne s'est pas ouverte.
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // La même clé d'idempotence : c'est elle qui empêche le double crédit côté serveur.
    expect(cleAppelee(fetchImpl, 1)).toBe(cleAppelee(fetchImpl, 0));
  });

  it('double clic : un seul appel part, le bouton attend la réponse', async () => {
    let resoudre: ((reponse: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resoudre = resolve;
        })
    );
    simulerArrivage({ fetchImpl });
    renderWithStore(<Home />, { packsOpened: 0, tutorielVu: true, pasAPasCombatVu: true });

    const bouton = screen.getByRole('button', { name: /Ouvrir un Arrivage/i });
    fireEvent.click(bouton);
    // Le premier appel part après la session : on attend qu'il soit en vol, puis on reclique.
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    fireEvent.click(bouton);

    // Le contrôle mord : sans l'état d'attente, le second clic partirait lui aussi.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(bouton).toBeDisabled();

    resoudre?.(
      reponseArrivage({
        cards: CARTES_ARRIVAGE.map((carte) => ({ id: carte.id, rarity: carte.rarity })),
        seed: 7
      })
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
