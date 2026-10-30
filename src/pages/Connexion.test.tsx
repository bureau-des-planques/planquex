// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useComptes } from '@/store/comptes';
import { useProfil } from '@/store/profil';
import { useStore } from '@/store/useStore';
import type { Compte } from '@/lib/comptes';
import type { Profil } from '@/lib/profil';
import { Connexion } from './Connexion';

/**
 * L'écran de connexion (D-088, #181).
 *
 * Ce que ces tests gardent : **sans configuration**, il n'y a rien à faire et l'écran le
 * dit ; avec elle, les deux portes existent (Google, courriel + mot de passe) ; un compte
 * déjà connecté repart vers l'attente ou le bureau ; et les trois états de D-060
 * (chargement, erreur, succès) sont rendus.
 *
 * Le store est piloté directement (`useComptes.setState`) : c'est lui que les écrans
 * lisent, et c'est ce qui permet de poser « un compte en attente » sans réseau. La couture
 * réseau elle-même est gardée par `src/lib/comptes.test.ts`.
 */

const PENDING: Compte = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'en attente',
  raison: '',
  administrateur: false,
  medaille_periode_essai: false,
  medaille_periode_essai_le: null,
  created_at: '2026-10-23T10:00:00.000Z'
};

const actions = () => ({
  rafraichir: vi.fn(async () => {}),
  connecterCourriel: vi.fn(async (_courriel: string, _motDePasse: string): Promise<string | null> => null),
  inscrireCourriel: vi.fn(
    async (_courriel: string, _motDePasse: string): Promise<{ erreur: string | null; courrielEnvoye: boolean }> => ({
      erreur: null,
      courrielEnvoye: false
    })
  ),
  connecterGoogle: vi.fn(async (_redirectTo?: string): Promise<string | null> => null),
  deconnecter: vi.fn(async () => {})
});

/** Un profil complet : le parcours est fini, la connexion mène où elle menait avant #325. */
const PROFIL_FAIT: Profil = {
  id: 'compte-a',
  pseudo: 'Anaïs',
  service: '2e',
  intitule: 'sculpteur de fumée',
  intitule_relances: 0
};

function poser(
  etat: Partial<ReturnType<typeof useComptes.getState>> = {},
  profil: Partial<Profil> | null = PROFIL_FAIT
) {
  useComptes.setState({
    configure: true,
    chargement: false,
    session: null,
    compte: null,
    erreur: null,
    ...actions(),
    ...etat
  });
  // Le profil est posé d'avance (pas de réseau) : `charger` ne fait rien.
  useProfil.setState({
    charge: true,
    chargement: false,
    lectureEchouee: false,
    erreur: null,
    charger: async () => {},
    profil: profil === null ? null : { ...PROFIL_FAIT, ...profil }
  });
}

function rendre(initial = '/connexion') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/attente" element={<p>écran d’attente</p>} />
        <Route path="/" element={<p>le bureau</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => poser());
afterEach(cleanup);

describe('sans configuration, l’écran ne propose rien (comportement d’avant D-088)', () => {
  it('dit qu’il n’y a pas de compte, sans formulaire', () => {
    poser({ configure: false });
    rendre();

    expect(screen.getByRole('heading', { level: 1, name: /Pas de compte sans base/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continuer avec Google/ })).toBeNull();
    expect(screen.queryByLabelText(/Mot de passe/)).toBeNull();
    expect(screen.getByRole('link', { name: /Retour au bureau/ })).toHaveAttribute('href', '/');
  });
});

describe('les deux portes (D-088)', () => {
  it('montre Google et le courriel, et rappelle pourquoi un compte est nécessaire', () => {
    rendre();
    expect(screen.getByRole('button', { name: /Continuer avec Google/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Courriel/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument();
    expect(screen.getByText(/validé à la main/)).toBeInTheDocument();
  });

  it('le bouton Google appelle la connexion OAuth', async () => {
    const etat = actions();
    poser(etat);
    rendre();

    fireEvent.click(screen.getByRole('button', { name: /Continuer avec Google/ }));
    await waitFor(() => expect(etat.connecterGoogle).toHaveBeenCalledTimes(1));
  });

  it('le formulaire envoie le courriel et le mot de passe — seulement quand ils sont valides', async () => {
    const etat = actions();
    poser(etat);
    rendre();

    const bouton = screen.getByRole('button', { name: 'Se connecter' });
    expect(bouton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Courriel/), { target: { value: 'a@exemple.test' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: 'secret1' } });
    expect(bouton).not.toBeDisabled();

    fireEvent.click(bouton);
    await waitFor(() => expect(etat.connecterCourriel).toHaveBeenCalledWith('a@exemple.test', 'secret1'));
  });

  it('un refus de connexion s’affiche en alerte', async () => {
    const etat = actions();
    etat.connecterCourriel.mockResolvedValueOnce('Courriel ou mot de passe incorrect.');
    poser(etat);
    rendre();

    fireEvent.change(screen.getByLabelText(/Courriel/), { target: { value: 'a@exemple.test' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mot de passe incorrect/i);
  });

  it('l’inscription bascule le formulaire et demande un compte', async () => {
    const etat = actions();
    poser(etat);
    rendre();

    fireEvent.click(screen.getByRole('button', { name: /Pas encore de compte/ }));
    fireEvent.change(screen.getByLabelText(/Courriel/), { target: { value: 'neuf@exemple.test' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    await waitFor(() => expect(etat.inscrireCourriel).toHaveBeenCalledWith('neuf@exemple.test', 'secret1'));
  });

  it('une confirmation de courriel attendue est dite, sans prétendre à une session', async () => {
    const etat = actions();
    etat.inscrireCourriel.mockResolvedValueOnce({ erreur: null, courrielEnvoye: true });
    poser(etat);
    rendre();

    fireEvent.click(screen.getByRole('button', { name: /Pas encore de compte/ }));
    fireEvent.change(screen.getByLabelText(/Courriel/), { target: { value: 'neuf@exemple.test' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/courriel de confirmation/i);
  });

  it('l’erreur du store s’affiche aussi (session expirée, réseau)', () => {
    poser({ erreur: 'Ta session a expiré : reconnecte-toi.' });
    rendre();
    expect(screen.getByRole('alert')).toHaveTextContent(/session a expiré/);
  });
});

describe('un compte déjà connecté ne reste pas sur la page', () => {
  it('un compte en attente part vers l’attente', async () => {
    poser({
      session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
      compte: PENDING
    });
    rendre();
    expect(await screen.findByText('écran d’attente')).toBeInTheDocument();
  });

  it('un compte approuvé part vers le bureau', async () => {
    poser({
      session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
      compte: { ...PENDING, etat: 'approuve' }
    });
    rendre();
    expect(await screen.findByText('le bureau')).toBeInTheDocument();
  });

  it('un compte connecté sans profil fait le parcours avant d’aller au bureau', async () => {
    poser(
      {
        session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
        compte: { ...PENDING, etat: 'approuve' }
      },
      null
    );
    rendre();
    expect(await screen.findByRole('heading', { name: /Ton pseudo/ })).toBeInTheDocument();
    expect(screen.queryByText('le bureau')).toBeNull();
    expect(screen.queryByText('écran d’attente')).toBeNull();
  });

  it('pendant la vérification de la session, on patiente au lieu de demander un mot de passe', () => {
    poser({ chargement: true });
    rendre();
    expect(screen.getByText(/Vérification de ta session/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Mot de passe/)).toBeNull();
  });
});

/**
 * Revue du 30/10/2026 — les trois fautes de la première connexion que ces tests gardent : un compte **refusé**
 * ne fait pas le parcours (D-156 (3)), la fin est un moment qui rend le badge, et le pseudo
 * remplace « Employé 404 » dans l'en-tête du jeu.
 */
describe('le parcours de première connexion (revue du 30/10/2026)', () => {
  beforeEach(() => {
    useStore.setState({ name: 'Employé 404' });
  });

  it('un compte refusé n’entre pas dans le parcours : il part vers l’attente', async () => {
    poser(
      {
        session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
        compte: { ...PENDING, etat: 'refuse', raison: 'Pas cette fois.' }
      },
      null
    );
    rendre();

    // La redirection part tout de suite : le parcours ne s'affiche à aucun moment.
    expect(await screen.findByText('écran d’attente')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Ton pseudo/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Ton compte est refusé/ })).toBeNull();
  });

  it('un profil illisible ne renvoie pas au pseudo : il propose de réessayer', async () => {
    const etat = actions();
    poser(
      {
        session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
        compte: { ...PENDING, etat: 'approuve' },
        ...etat
      },
      null
    );
    useProfil.setState({ lectureEchouee: true, erreur: 'Réseau indisponible.' });
    rendre();

    expect(screen.getByRole('heading', { name: /n’a pas pu être lu/ })).toBeInTheDocument();
    // Le contrôle mord : sans `lectureEchouee`, l'étape 1 s'afficherait à la place.
    expect(screen.queryByRole('heading', { name: /Ton pseudo/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Me déconnecter' }));
    await waitFor(() => expect(etat.deconnecter).toHaveBeenCalledTimes(1));
  });

  it('la fin du parcours montre le badge, puis entre d’où le testeur venait', async () => {
    poser(
      {
        session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
        compte: { ...PENDING, etat: 'approuve' }
      },
      { pseudo: 'Anaïs', service: '2e', intitule: null }
    );

    render(
      <MemoryRouter initialEntries={[{ pathname: '/connexion', state: { depuis: '/comite' } }]}>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/attente" element={<p>écran d’attente</p>} />
          <Route path="/" element={<p>le bureau</p>} />
          <Route path="/comite" element={<p>le mur du comité</p>} />
        </Routes>
      </MemoryRouter>
    );

    // Le parcours est en cours : c'est son passage qui ouvre droit au badge.
    expect(await screen.findByRole('heading', { name: /Ton intitulé/ })).toBeInTheDocument();

    act(() => useProfil.setState({ profil: PROFIL_FAIT }));

    const entrer = await screen.findByRole('button', { name: 'Entrer dans le bureau' });
    expect(screen.getByText(/Anaïs \/ planqué du 2e — sculpteur de fumée/)).toBeInTheDocument();

    fireEvent.click(entrer);
    expect(await screen.findByText('le mur du comité')).toBeInTheDocument();
    expect(screen.queryByText('le bureau')).toBeNull();
  });

  it('le pseudo remplace « Employé 404 » à l’entrée (continuité d’identité)', async () => {
    poser(
      {
        session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
        compte: { ...PENDING, etat: 'approuve' }
      },
      { pseudo: 'Anaïs', service: '2e', intitule: null }
    );
    rendre();

    expect(await screen.findByRole('heading', { name: /Ton intitulé/ })).toBeInTheDocument();
    act(() => useProfil.setState({ profil: PROFIL_FAIT }));

    fireEvent.click(await screen.findByRole('button', { name: 'Entrer dans le bureau' }));
    await waitFor(() => expect(useStore.getState().name).toBe('Anaïs'));
  });

  it('un nom déjà choisi dans Réglages n’est pas écrasé par le pseudo', async () => {
    useStore.setState({ name: 'Le Stagiaire' });
    poser(
      {
        session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
        compte: { ...PENDING, etat: 'approuve' }
      },
      { pseudo: 'Anaïs', service: '2e', intitule: null }
    );
    rendre();

    expect(await screen.findByRole('heading', { name: /Ton intitulé/ })).toBeInTheDocument();
    act(() => useProfil.setState({ profil: PROFIL_FAIT }));

    fireEvent.click(await screen.findByRole('button', { name: 'Entrer dans le bureau' }));
    await waitFor(() => expect(useStore.getState().name).toBe('Le Stagiaire'));
  });
});
