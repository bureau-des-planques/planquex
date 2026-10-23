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
  chargerMur: vi.fn(),
  trier: vi.fn(),
}));

vi.mock('@/lib/murBase', async () => {
  const vrai = await vi.importActual<typeof import('@/lib/murBase')>('@/lib/murBase');
  return {
    ...vrai,
    chargerPostitsDuMur: mocks.chargerMur,
    trierPostit: mocks.trier,
  };
});

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
const POSTIT = {
  id: 'p-autre',
  kind: 'IP' as const,
  titre: 'Le bouton Fin du tour reste grisé',
  texte: 'Au combat, au deuxième tour.',
  ecran: 'Combat' as const,
  pseudo: 'Employé 404',
  version: 'Alpha · 0.1.8',
  statut: 'en attente' as const,
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null,
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 2, down: 0, mon: null },
  mien: false,
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
  mocks.chargerMur.mockReset();
  mocks.chargerMur.mockResolvedValue([{ ...POSTIT }]);
  mocks.trier.mockReset();
  mocks.trier.mockImplementation(async (_id: string, tri: unknown) => tri);
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

describe('le tri du mur par l’administration (#0006, D-088)', () => {
  it('liste les post-its avec leur statut, leur raison et leur ticket', async () => {
    rendre();
    expect(await screen.findByRole('heading', { name: /Le mur — le tri \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('Le bouton Fin du tour reste grisé')).toBeInTheDocument();
    expect(screen.getByLabelText('Statut de « Le bouton Fin du tour reste grisé »')).toHaveValue(
      'en attente',
    );
    // Rien à enregistrer tant que rien n'a bougé.
    expect(screen.getByRole('button', { name: /Enregistrer le tri/ })).toBeDisabled();
  });

  it('le titre et le texte ne se modifient pas ici — ils sont à leur auteur (#139)', async () => {
    rendre();
    await screen.findByText('Le bouton Fin du tour reste grisé');
    expect(screen.queryByLabelText(/Corriger le titre/)).toBeNull();
    expect(screen.queryByLabelText(/Corriger le texte/)).toBeNull();
  });

  it('écarter exige une raison, puis envoie le statut, la raison et le ticket', async () => {
    rendre();
    await screen.findByText('Le bouton Fin du tour reste grisé');

    fireEvent.change(screen.getByLabelText('Statut de « Le bouton Fin du tour reste grisé »'), {
      target: { value: 'écarté' },
    });
    const enregistrer = screen.getByRole('button', { name: /Enregistrer le tri/ });
    expect(enregistrer).toBeDisabled();
    expect(screen.getByText(/Écarter exige une raison écrite/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Raison de l’écart de « Le bouton Fin du tour reste grisé »'), {
      target: { value: 'Hors périmètre du lancement.' },
    });
    fireEvent.change(screen.getByLabelText('Ticket de « Le bouton Fin du tour reste grisé »'), {
      target: { value: '140' },
    });
    expect(enregistrer).not.toBeDisabled();
    fireEvent.click(enregistrer);

    await waitFor(() =>
      expect(mocks.trier).toHaveBeenCalledWith(POSTIT.id, {
        statut: 'écarté',
        raison: 'Hors périmètre du lancement.',
        ticket: 140,
      }),
    );
    expect(
      screen.getByLabelText('Raison de l’écart de « Le bouton Fin du tour reste grisé »'),
    ).toHaveValue('Hors périmètre du lancement.');
    expect(await screen.findByText(/« Le bouton Fin du tour reste grisé » : écarté/)).toBeInTheDocument();
  });

  it('un refus de la base se lit, et rien ne prétend avoir été trié', async () => {
    mocks.trier.mockRejectedValue(
      new Error('La base refuse : seul un administrateur trie le mur (D-088, migration 0006).'),
    );
    rendre();
    await screen.findByText('Le bouton Fin du tour reste grisé');

    fireEvent.change(screen.getByLabelText('Statut de « Le bouton Fin du tour reste grisé »'), {
      target: { value: 'retenu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le tri/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/seul un administrateur trie le mur/);
    // La ligne du mur, elle, n'a pas bougé : le brouillon de l'écran attend, le mur non.
    expect(document.querySelector('[data-tri="p-autre"]')).toHaveTextContent(
      'IP · Employé 404 · en attente',
    );
  });

  it('un mur vide le dit, et une erreur de lecture s’affiche avec « Réessayer »', async () => {
    mocks.chargerMur.mockResolvedValueOnce([]);
    rendre();
    expect(await screen.findByText(/Aucun post-it sur le mur pour l’instant/)).toBeInTheDocument();

    cleanup();
    mocks.chargerMur.mockReset();
    mocks.chargerMur.mockRejectedValueOnce(new Error('Lecture du mur impossible : réseau.'));
    rendre();
    expect(await screen.findByRole('alert')).toHaveTextContent(/réseau/);

    mocks.chargerMur.mockResolvedValueOnce([{ ...POSTIT }]);
    fireEvent.click(screen.getByRole('button', { name: /Réessayer la lecture du mur/ }));
    expect(await screen.findByText('Le bouton Fin du tour reste grisé')).toBeInTheDocument();
  });

  it('la lecture du mur patiente visiblement (D-060)', async () => {
    mocks.chargerMur.mockReturnValue(new Promise(() => {}));
    rendre();
    expect(await screen.findByText(/Le mur se charge…/)).toBeInTheDocument();
  });
});
