// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useComptes } from '@/store/comptes';
import type { Compte, EtatCompte } from '@/lib/comptes';

/**
 * L'écran d'administration (D-088, #181).
 *
 * Ce que ces tests gardent : un compte **non administrateur** ne voit pas la liste et ne
 * peut rien décider (le test regarde le rendu **et** vérifie que la lecture n'est même pas
 * tentée) ; un administrateur approuve, refuse avec une raison, et lit les états de D-060
 * (chargement, erreur, vide). La base empêche de toute façon un non-administrateur
 * d'approuver : c'est `supabase/comptes.test.ts` qui le prouve côté SQL.
 */
const mocks = vi.hoisted(() => ({
  lister: vi.fn(),
  decider: vi.fn(),
}));

vi.mock('@/lib/comptes', async () => {
  const vrai = await vi.importActual<typeof import('@/lib/comptes')>('@/lib/comptes');
  return {
    ...vrai,
    listerComptes: mocks.lister,
    deciderCompte: mocks.decider,
  };
});

import { Administration } from './Administration';
import { App } from '@/App';
import { setupTestStore } from '@/test/test-utils';

const EN_ATTENTE: Compte = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'en attente',
  raison: '',
  administrateur: false,
  created_at: '2026-10-23T10:00:00.000Z',
};
const APPROUVE: Compte = {
  id: 'compte-b',
  courriel: 'b@exemple.test',
  etat: 'approuve',
  raison: '',
  administrateur: false,
  created_at: '2026-10-22T09:00:00.000Z',
};
const ADMIN: Compte = {
  id: 'compte-admin',
  courriel: 'bastien@exemple.test',
  etat: 'approuve',
  raison: '',
  administrateur: true,
  created_at: '2026-10-21T09:00:00.000Z',
};

const actions = () => ({
  rafraichir: vi.fn(async () => {}),
  connecterCourriel: vi.fn(async (_courriel: string, _motDePasse: string): Promise<string | null> => null),
  inscrireCourriel: vi.fn(
    async (_courriel: string, _motDePasse: string): Promise<{ erreur: string | null; courrielEnvoye: boolean }> => ({
      erreur: null,
      courrielEnvoye: false,
    }),
  ),
  connecterGoogle: vi.fn(async (_redirectTo?: string): Promise<string | null> => null),
  deconnecter: vi.fn(async () => {}),
});

function poser(etat: Partial<ReturnType<typeof useComptes.getState>> = {}) {
  useComptes.setState({
    configure: true,
    chargement: false,
    session: { id: ADMIN.id, courriel: ADMIN.courriel },
    compte: ADMIN,
    erreur: null,
    ...actions(),
    ...etat,
  });
}

function rendre() {
  return render(
    <MemoryRouter>
      <Administration />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.lister.mockReset();
  mocks.lister.mockResolvedValue([EN_ATTENTE, APPROUVE]);
  mocks.decider.mockReset();
  mocks.decider.mockImplementation(async (id: string, etat: EtatCompte, raison: string) => ({
    ...(id === EN_ATTENTE.id ? EN_ATTENTE : APPROUVE),
    etat,
    raison,
  }));
  poser();
});
afterEach(cleanup);

describe('la route n’est pas ouverte à un compte non administrateur', () => {
  it('l’écran refuse, et la liste n’est même pas demandée', () => {
    poser({ compte: { ...APPROUVE }, session: { id: APPROUVE.id, courriel: APPROUVE.courriel } });
    rendre();

    expect(screen.getByRole('heading', { level: 1, name: /Réservé à l’administration/ })).toBeInTheDocument();
    expect(screen.queryByText('a@exemple.test')).toBeNull();
    expect(mocks.lister).not.toHaveBeenCalled();
  });

  it('la route /administration, atteinte par l’adresse, refuse aussi', () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
    poser({ compte: { ...APPROUVE }, session: { id: APPROUVE.id, courriel: APPROUVE.courriel } });

    render(
      <MemoryRouter initialEntries={['/administration']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Réservé à l’administration/ })).toBeInTheDocument();
    expect(mocks.lister).not.toHaveBeenCalled();
  });

  it('sans configuration, il n’y a pas de comptes à administrer', () => {
    poser({ configure: false });
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /Pas de comptes sans base/ })).toBeInTheDocument();
    expect(mocks.lister).not.toHaveBeenCalled();
  });
});

describe('un administrateur approuve et refuse', () => {
  it('liste les comptes, l’attente d’abord', async () => {
    rendre();
    expect(await screen.findByRole('heading', { name: /En attente \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('a@exemple.test')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Décidés \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('b@exemple.test')).toBeInTheDocument();
    expect(mocks.lister).toHaveBeenCalledTimes(1);
  });

  it('approuver envoie « approuve », et la ligne passe dans les décidés', async () => {
    rendre();
    await screen.findByText('a@exemple.test');

    fireEvent.click(screen.getByRole('button', { name: /Approuver a@exemple.test/ }));

    await waitFor(() =>
      expect(mocks.decider).toHaveBeenCalledWith(EN_ATTENTE.id, 'approuve', ''),
    );
    expect(await screen.findByText(/est approuvé/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /En attente \(0\)/ })).toBeInTheDocument();
  });

  it('un refus exige une raison, puis l’envoie', async () => {
    rendre();
    await screen.findByText('a@exemple.test');

    fireEvent.click(screen.getByRole('button', { name: /Refuser a@exemple.test/ }));
    const confirmer = screen.getByRole('button', { name: /Confirmer le refus/ });
    expect(confirmer).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Raison du refus pour a@exemple.test/), {
      target: { value: 'Je ne connais pas cette adresse.' },
    });
    expect(confirmer).not.toBeDisabled();
    fireEvent.click(confirmer);

    await waitFor(() =>
      expect(mocks.decider).toHaveBeenCalledWith(
        EN_ATTENTE.id,
        'refuse',
        'Je ne connais pas cette adresse.',
      ),
    );
    expect(await screen.findByText(/est refusé/)).toBeInTheDocument();
  });

  it('un refus sans raison ne part pas (double garde : l’écran et la base)', async () => {
    rendre();
    await screen.findByText('a@exemple.test');

    fireEvent.click(screen.getByRole('button', { name: /Refuser a@exemple.test/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le refus/ }));

    expect(mocks.decider).not.toHaveBeenCalled();
  });
});

describe('les états de D-060', () => {
  it('chargement avant de connaître le compte : on patiente', () => {
    poser({ chargement: true, compte: null });
    rendre();
    expect(screen.getByText(/Vérification de ton compte/)).toBeInTheDocument();
    expect(mocks.lister).not.toHaveBeenCalled();
  });

  it('la liste vide le dit', async () => {
    mocks.lister.mockResolvedValue([]);
    rendre();
    expect(await screen.findByText(/Aucun compte pour l’instant/)).toBeInTheDocument();
  });

  it('une erreur de lecture s’affiche, et « Rafraîchir » réessaie', async () => {
    mocks.lister.mockRejectedValueOnce(new Error('Lecture des comptes impossible : réseau.'));
    rendre();
    expect(await screen.findByRole('alert')).toHaveTextContent(/réseau/);

    mocks.lister.mockResolvedValueOnce([EN_ATTENTE]);
    fireEvent.click(screen.getByRole('button', { name: /Rafraîchir/ }));
    await waitFor(() => expect(mocks.lister).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('a@exemple.test')).toBeInTheDocument();
  });

  it('l’absence de compte en attente est un état normal', async () => {
    mocks.lister.mockResolvedValue([APPROUVE]);
    rendre();
    expect(await screen.findByText(/Aucun compte en attente/)).toBeInTheDocument();
  });
});
