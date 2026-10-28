// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParcoursProfil } from './ParcoursProfil';
import { tirerIntitule } from '@/game/intitule';
import { useProfil } from '@/store/profil';
import type { Profil } from '@/lib/profil';

/**
 * Le parcours de première connexion à l'écran (#325, D-148) : trois étapes dans l'ordre, un
 * intitulé tiré au sort (le même tirage que le moteur, seedé), une relance possible une fois,
 * et plus de relance ensuite. Les gestes réseau sont remplacés par des gestes qui posent
 * l'état du store, comme le fait la base : le test parle au store, pas à Supabase.
 *
 * **Le contrôle mord** : sans la borne d'une relance, le bouton « Relancer une fois » resterait
 * affiché après la relance — le test « une seule relance » échoue alors.
 */
const UID = 'compte-a';

/** Pose un champ du profil, sans toucher aux autres (comme la relecture de la base). */
function geste(champs: Partial<Profil>) {
  const actuel = useProfil.getState().profil ?? {
    id: UID,
    pseudo: 'Anaïs',
    service: null,
    intitule: null,
    intitule_relances: 0
  };
  useProfil.setState({ profil: { ...actuel, ...champs } as Profil });
}

function poserStore(profil: Profil | null) {
  useProfil.setState({
    profil,
    charge: true,
    chargement: false,
    erreur: null,
    creerPseudo: vi.fn(async (_uid: string, pseudo: string) => {
      geste({ pseudo });
      return null;
    }),
    choisirService: vi.fn(async (_uid: string, service: Profil['service']) => {
      geste({ service });
      return null;
    }),
    relancer: vi.fn(async () => {
      geste({ intitule_relances: (useProfil.getState().profil?.intitule_relances ?? 0) + 1 });
      return null;
    }),
    valider: vi.fn(async (_uid: string, intitule: string) => {
      geste({ intitule });
      return null;
    })
  });
}

beforeEach(() => poserStore(null));
afterEach(cleanup);

describe('le parcours, à l’écran (#325, D-148)', () => {
  it('commence par le pseudo, à l’étape 1 sur 3', () => {
    render(<ParcoursProfil uid={UID} />);
    expect(screen.getByText('Étape 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Ton pseudo/ })).toBeInTheDocument();
  });

  it('fait les trois étapes dans l’ordre, et tire l’intitulé du compte', async () => {
    const { container } = render(<ParcoursProfil uid={UID} />);

    fireEvent.change(screen.getByLabelText(/Pseudo/), { target: { value: 'Anaïs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByRole('heading', { name: /Ton service/ })).toBeInTheDocument();
    expect(container.querySelector('[data-etape]')).toHaveAttribute('data-etape', 'service');

    fireEvent.click(screen.getByLabelText('2e'));
    fireEvent.click(screen.getByRole('button', { name: /Valider mon service/ }));
    expect(await screen.findByRole('heading', { name: /Ton intitulé/ })).toBeInTheDocument();
    expect(useProfil.getState().profil?.service).toBe('2e');

    // L'intitulé affiché est celui du tirage seedé, et l'aperçu suit le gabarit du ticket.
    const tire = tirerIntitule(UID, 0);
    expect(screen.getByTestId('intitule-tire')).toHaveTextContent(tire);
    expect(screen.getByTestId('apercu-profil')).toHaveTextContent(`Anaïs / planqué du 2e — ${tire}`);
  });

  it('relance l’intitulé une fois, puis plus de relance', async () => {
    poserStore({ id: UID, pseudo: 'Anaïs', service: '3e', intitule: null, intitule_relances: 0 });
    render(<ParcoursProfil uid={UID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Relancer une fois' }));
    await waitFor(() => expect(useProfil.getState().profil?.intitule_relances).toBe(1));
    // Le contrôle mord : après la relance, le bouton n'existe plus.
    expect(screen.queryByRole('button', { name: 'Relancer une fois' })).toBeNull();
    expect(screen.getByTestId('intitule-tire')).toHaveTextContent(tirerIntitule(UID, 1));
  });

  it('garder l’intitulé l’enregistre et le fige (le parcours est fini)', async () => {
    poserStore({ id: UID, pseudo: 'Anaïs', service: '1er', intitule: null, intitule_relances: 0 });
    const { container } = render(<ParcoursProfil uid={UID} />);
    const tire = screen.getByTestId('intitule-tire').textContent ?? '';

    fireEvent.click(screen.getByRole('button', { name: 'Garder cet intitulé' }));
    await waitFor(() => expect(useProfil.getState().profil?.intitule).toBe(tire));
    expect(container.firstChild).toBeNull();
  });
});
