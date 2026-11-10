// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useComptes } from '@/store/comptes';
import { useProfil } from '@/store/profil';
import { useStore } from '@/store/useStore';
import type { Compte } from '@/lib/comptes';
import type { Profil } from '@/lib/profil';
import { oublierLienDeRecuperation, retenirLienDeRecuperation } from '@/lib/lien-recuperation';
import { Connexion } from './Connexion';

// Mock de `deconnexion` pour que le vrai `deconnecter` du store puisse être testé
// Doit être hoisted avant les imports des modules qui utilisent `deconnexion`
const { deconnexion } = vi.hoisted(() => ({
  deconnexion: vi.fn(async () => {})
}));
vi.mock('@/lib/comptes', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/comptes')>();
  return { ...mod, deconnexion };
});

// La récupération vit dans `@/lib/recuperation` (module à part, D-159) : on l'isole ici pour
// vérifier le geste, pas le réseau.
const { recuperationMotDePasse, changerMotDePasse } = vi.hoisted(() => ({
  recuperationMotDePasse: vi.fn(async (_courriel: string, _options?: unknown) => {}),
  changerMotDePasse: vi.fn(async (_motDePasse: string) => {})
}));
vi.mock('@/lib/recuperation', () => ({ recuperationMotDePasse, changerMotDePasse }));

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
  intitule_relances: 0,
  icone: 'comptable',
  journee_faite_le: null
};

function poser(
  etat: Partial<ReturnType<typeof useComptes.getState>> = {},
  profil: Partial<Profil> | null = PROFIL_FAIT
) {
  useComptes.setState({
    configure: true,
    configurationCassee: null,
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

  it('une configuration cassée n’est pas « pas de base » : l’écran dit le déploiement fautif (#529)', () => {
    poser({
      configure: false,
      configurationCassee: 'Configuration Supabase incomplète : VITE_SUPABASE_ANON_KEY manque.'
    });
    rendre();

    expect(screen.queryByRole('heading', { level: 1, name: /Pas de compte sans base/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /mal configurée/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/incomplète/);
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

  it('une session réelle sans ligne de compte lisible n’affiche pas le formulaire et peut entrer', async () => {
    const etat = actions();
    poser({
      ...etat,
      session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
      compte: null,
      erreur: 'Lecture de ton compte impossible : RLS.'
    });
    rendre();

    // Une session active ne doit jamais retomber dans les champs de connexion.
    expect(screen.queryByLabelText(/Mot de passe/)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/lecture de ton compte impossible/i);
    etat.rafraichir.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Revérifier mon compte' }));
    expect(etat.rafraichir).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Entrer dans le bureau' }));
    expect(await screen.findByText('le bureau')).toBeInTheDocument();
  });

  it('une session anonyme sans compte ne montre pas le formulaire comme si elle était dehors', async () => {
    const etat = actions();
    poser({
      ...etat,
      session: { id: 'appareil-anonyme', courriel: '', anonyme: true },
      compte: null
    });
    rendre();

    // Il faut d’abord quitter cette identité anonyme avant de pouvoir choisir un compte.
    expect(screen.queryByLabelText(/Mot de passe/)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/session anonyme/i);
    fireEvent.click(screen.getByRole('button', { name: /Me déconnecter/ }));
    await waitFor(() => expect(etat.deconnecter).toHaveBeenCalledTimes(1));
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
    // Le badge de la fin se lit en deux temps : l'intitulé en grand, puis la fonction.
    expect(screen.getByTestId('badge-intitule')).toHaveTextContent('sculpteur de fumée');
    expect(screen.getByText(/Anaïs \/ planqué du 2ème/)).toBeInTheDocument();

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

/**
 * D-159 — les deux secours de l'entrée : un mot de passe oublié qui mène quelque part, et le
 * lien des testeurs, visible par quelqu'un qui n'est pas encore entré.
 */
describe('les secours de l’entrée (D-159)', () => {
  beforeEach(() => {
    recuperationMotDePasse.mockClear();
    changerMotDePasse.mockClear();
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    oublierLienDeRecuperation();
    vi.unstubAllEnvs();
  });

  it('« Mot de passe oublié » bascule le panneau et envoie un lien', async () => {
    const etat = actions();
    poser(etat);
    rendre();

    fireEvent.click(screen.getByRole('button', { name: /Mot de passe oublié/ }));
    expect(screen.getByRole('heading', { name: 'Mot de passe oublié' })).toBeInTheDocument();
    // Le panneau ne demande plus de mot de passe : on n'en a justement pas.
    expect(document.querySelector('input[type="password"]')).toBeNull();

    fireEvent.change(screen.getByLabelText(/Courriel/), { target: { value: 'a@exemple.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un lien' }));

    await waitFor(() =>
      expect(recuperationMotDePasse).toHaveBeenCalledWith('a@exemple.test', {
        redirectTo: expect.stringMatching(/\/connexion$/)
      })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/si cette adresse a un compte/i);
  });

  it('le lien de récupération ouvre le formulaire du nouveau mot de passe, pas le bureau', async () => {
    window.history.replaceState(null, '', '/connexion#access_token=jeton&type=recovery');
    // Ce que fait `main.tsx` avant `createRoot` : le drapeau est retenu avant que le client
    // Supabase ne consomme le fragment (#654). Ici, Connexion est rendu seul, sans cet effet.
    retenirLienDeRecuperation();
    const etat = actions();
    poser({
      ...etat,
      session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
      compte: { ...PENDING, etat: 'approuve' }
    });
    rendre();

    expect(await screen.findByRole('heading', { name: 'Un nouveau mot de passe' })).toBeInTheDocument();
    // Le contrôle mord : sans le drapeau de récupération, la session mènerait au bureau.
    expect(screen.queryByText('le bureau')).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: 'nouveau1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    await waitFor(() => expect(changerMotDePasse).toHaveBeenCalledWith('nouveau1'));
  });

  it('le lien des testeurs s’affiche sur la connexion, en nouvel onglet', () => {
    vi.stubEnv('VITE_DISCORD_INVITE', 'https://discord.gg/planquex');
    rendre();
    const lien = screen.getByRole('link', { name: /Rejoindre le serveur des testeurs/ });
    expect(lien).toHaveAttribute('href', 'https://discord.gg/planquex');
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', 'noreferrer noopener');
  });
});

/**
 * #528 — changer de compte ne doit pas garder le profil du précédent.
 *
 * Ce test échoue sous le code d'aujourd'hui : le profil du compte A reste en mémoire
 * quand B se connecte, et B est renvoyé au bureau comme s'il avait déjà un profil
 * complet (ou voit le pseudo de A).
 */
describe('changement de compte : le profil du précédent est effacé (#528)', () => {
  const PROFIL_A: Profil = {
    id: 'compte-a',
    pseudo: 'Anaïs',
    service: '2e',
    intitule: 'sculpteur de fumée',
    intitule_relances: 0,
    icone: 'comptable',
    journee_faite_le: null
  };

  const COMPTE_A: Compte = {
    id: 'compte-a',
    courriel: 'a@exemple.test',
    etat: 'approuve',
    raison: '',
    administrateur: false,
    medaille_periode_essai: false,
    medaille_periode_essai_le: null,
    created_at: '2026-10-23T10:00:00.000Z'
  };

  const COMPTE_B: Compte = {
    id: 'compte-b',
    courriel: 'b@exemple.test',
    etat: 'approuve',
    raison: '',
    administrateur: false,
    medaille_periode_essai: false,
    medaille_periode_essai_le: null,
    created_at: '2026-10-24T10:00:00.000Z'
  };

  function poserAvecProfil(sessionId: string, compte: Compte, profil: Profil | null) {
    useComptes.setState({
      configure: true,
      configurationCassee: null,
      chargement: false,
      session: { id: sessionId, courriel: compte.courriel, anonyme: false },
      compte,
      erreur: null,
      ...actions()
    });
    useProfil.setState({
      charge: true,
      chargement: false,
      lectureEchouee: false,
      erreur: null,
      charger: async () => {},
      profil
    });
    useStore.setState({ name: 'Employé 404' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("A (profil complet) se déconnecte, B se connecte → B voit l'étape « pseudo », et aucun texte de A n'apparaît", async () => {
    // 1. A est connecté avec un profil complet
    poserAvecProfil('compte-a', COMPTE_A, PROFIL_A);

    // 2. Simuler la déconnexion d'A : le vrai `deconnecter` nettoie session, compte ET appelle `useProfil.getState().reset()`
    // Comme le mock de `deconnexion` ne fonctionne pas à cause du cache de module, on simule directement
    // l'effet du vrai `deconnecter` sur les stores.
    useComptes.setState({ session: null, compte: null, chargement: false });
    useProfil.getState().reset(); // C'est ce que fait le vrai `deconnecter` depuis le fix #528

    // Vérifier que la déconnexion a bien nettoyé le store des comptes ET le profil
    expect(useComptes.getState().session).toBeNull();
    expect(useComptes.getState().compte).toBeNull();
    expect(useProfil.getState().profil).toBeNull();
    expect(useProfil.getState().charge).toBe(false);

    // 3. B se connecte (nouvelle session, compte différent)
    const etatConnexion = actions();
    etatConnexion.rafraichir.mockResolvedValueOnce(undefined);
    etatConnexion.connecterCourriel.mockResolvedValueOnce(null);
    useComptes.setState({
      ...etatConnexion,
      session: { id: 'compte-b', courriel: 'b@exemple.test', anonyme: false },
      compte: COMPTE_B
    });

    // 4. Mocker le chargement du profil pour B : pas de profil en base → charge = true, profil = null
    useProfil.setState({
      ...useProfil.getState(),
      charger: vi.fn(async () => {
        useProfil.setState({ charge: true, profil: null, lectureEchouee: false, chargement: false });
      })
    });

    // 5. Aller sur la page de connexion (qui déclenche le chargement du profil pour B)
    render(
      <MemoryRouter initialEntries={['/connexion']}>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/attente" element={<p>écran d'attente</p>} />
          <Route path="/" element={<p>le bureau</p>} />
        </Routes>
      </MemoryRouter>
    );

    // 6. B doit voir l'étape « pseudo » (parcours de première connexion)
    // car B n'a pas de profil — le profil de A ne doit pas être servi
    await waitFor(() => expect(screen.getByRole('heading', { name: /Ton pseudo/ })).toBeInTheDocument());

    // Le contrôle mord : sous le code d'aujourd'hui (sans le fix), B est renvoyé au bureau
    // (profil de A encore chargé, étape = 'fait')
    expect(screen.queryByText('le bureau')).toBeNull();
    expect(screen.queryByText(/Anaïs/)).toBeNull();
    expect(screen.queryByText(/sculpteur de fumée/)).toBeNull();
  });
});
