// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useComptes } from '@/store/comptes';
import type { Compte } from '@/lib/comptes';
import { oublierLienDeRecuperation, retenirLienDeRecuperation } from '@/lib/lien-recuperation';
import { rendreApplication } from '@/test/test-utils';

/**
 * #654 — le lien « mot de passe oublié » connectait sans demander de mot de passe neuf.
 *
 * **La course, telle qu'elle est mesurée en production** : le client Supabase est créé par
 * l'effet d'`App` avec `detectSessionInUrl: true` ; sa création **consomme et efface** le
 * fragment (`…&type=recovery`) à 254 ms, et le morceau paresseux `Connexion` ne se rend
 * qu'à 260 ms. Ce test rejoue l'ordre : le drapeau est retenu **avant** la création du
 * client (comme `main.tsx`), puis `App` est monté et son client efface le fragment **avant**
 * que `Connexion` ne se rende. `Connexion` doit lire le drapeau retenu, pas le fragment vide.
 *
 * Le test rend `App` **entier** — c'est ce qui manquait à `Connexion.test.tsx`, qui rendait
 * le composant seul et ne pouvait donc pas voir la course.
 */
const { lireMonCompte, changerMotDePasse } = vi.hoisted(() => ({
  lireMonCompte: vi.fn(),
  changerMotDePasse: vi.fn(async (_motDePasse: string) => {})
}));

vi.mock('@/lib/comptes', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/comptes')>();
  return { ...mod, lireMonCompte };
});

vi.mock('@/lib/recuperation', () => ({
  changerMotDePasse,
  recuperationMotDePasse: vi.fn(async () => {})
}));

const COMPTE: Compte = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'approuve',
  raison: '',
  administrateur: false,
  medaille_periode_essai: false,
  medaille_periode_essai_le: null,
  created_at: '2026-11-03T10:00:00.000Z'
};

const SESSION = { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false };

beforeEach(() => {
  changerMotDePasse.mockClear();
  // Le client, une fois créé, consomme le fragment puis rend la session du lien (production :
  // fragment effacé à 254 ms, `Connexion` rendu à 260 ms).
  lireMonCompte.mockImplementation(async () => {
    window.history.replaceState(null, '', '/connexion');
    return { session: SESSION, compte: COMPTE, erreur: null };
  });
  useComptes.setState({
    configure: true,
    configurationCassee: null,
    chargement: true,
    session: null,
    compte: null,
    erreur: null
  });
});

afterEach(() => {
  cleanup();
  oublierLienDeRecuperation();
  window.history.replaceState(null, '', '/');
});

describe('le lien de récupération, monté par App (#654)', () => {
  it('le fragment consommé par le client n’empêche plus de demander un mot de passe neuf', async () => {
    // L'adresse telle que le courriel l'ouvre.
    window.history.replaceState(null, '', '/connexion#access_token=jeton&type=recovery');
    // `main.tsx` retient le drapeau **avant** `createRoot`, donc avant tout client Supabase.
    retenirLienDeRecuperation();

    await rendreApplication({ chemin: '/connexion' });

    expect(await screen.findByRole('heading', { name: 'Un nouveau mot de passe' })).toBeInTheDocument();
    // Le contrôle mord : sans le drapeau, la session ouverte par le lien mènerait au bureau
    // (ici le parcours de profil), pas au panneau du nouveau mot de passe.
    expect(screen.queryByText(/Bienvenue dans le bureau/)).toBeNull();

    // Le panneau **exige** un mot de passe neuf : le bouton reste fermé tant qu'il manque.
    const bouton = screen.getByRole('button', { name: 'Changer mon mot de passe' });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: 'tout-neuf' } });
    fireEvent.click(bouton);
    await waitFor(() => expect(changerMotDePasse).toHaveBeenCalledWith('tout-neuf'));
  });
});
