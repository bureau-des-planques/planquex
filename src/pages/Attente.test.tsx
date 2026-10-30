// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useComptes } from '@/store/comptes';
import type { Compte } from '@/lib/comptes';
import { Attente } from './Attente';

/**
 * L'écran d'attente (D-088, #181).
 *
 * Il doit dire trois choses, et rien de faux : **où en est le compte**, **ce qu'on peut
 * faire en attendant**, et **pourquoi** un refus a été prononcé. Les états de D-060 sont
 * rendus : chargement, erreur, compte absent de la base.
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

function poser(etat: Partial<ReturnType<typeof useComptes.getState>> = {}) {
  useComptes.setState({
    configure: true,
    chargement: false,
    session: { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false },
    compte: PENDING,
    erreur: null,
    ...actions(),
    ...etat
  });
}

function rendre() {
  return render(
    <MemoryRouter>
      <Attente />
    </MemoryRouter>
  );
}

beforeEach(() => poser());
afterEach(cleanup);

describe('un compte en attente voit son état, et ce qu’il peut faire', () => {
  it('le titre dit l’attente, la phrase dit pourquoi, et ce qui reste ouvert est listé', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /Ton compte attend d’être validé/ })).toBeInTheDocument();
    expect(screen.getByText(/Bastien valide les comptes à la main/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Jouer une partie/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Lire le mur/ })).toHaveAttribute('href', '/comite');
    // L'état et le courriel sont lisibles, pas devinés.
    expect(screen.getByText(/a@exemple.test/)).toBeInTheDocument();
    expect(screen.getByText(/en attente de validation/)).toBeInTheDocument();
  });

  it('« Revérifier mon état » relit le compte', async () => {
    const etat = actions();
    poser(etat);
    rendre();

    fireEvent.click(screen.getByRole('button', { name: /Revérifier mon état/ }));
    await waitFor(() => expect(etat.rafraichir).toHaveBeenCalled());
  });

  it('« Se déconnecter » appelle la déconnexion', async () => {
    const etat = actions();
    poser(etat);
    rendre();

    fireEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }));
    await waitFor(() => expect(etat.deconnecter).toHaveBeenCalled());
  });
});

describe('un compte refusé lit sa raison', () => {
  it('la raison est affichée telle quelle', () => {
    poser({ compte: { ...PENDING, etat: 'refuse', raison: 'Je ne connais pas cette adresse.' } });
    rendre();

    expect(screen.getByRole('heading', { level: 1, name: /Ton compte est refusé/ })).toBeInTheDocument();
    expect(screen.getByText(/Je ne connais pas cette adresse/)).toBeInTheDocument();
  });

  it('un refus sans raison ne fait pas croire à une raison', () => {
    poser({ compte: { ...PENDING, etat: 'refuse', raison: '' } });
    rendre();
    expect(screen.getByText(/aucune raison donnée/)).toBeInTheDocument();
  });
});

describe('un compte approuvé, et les états de D-060', () => {
  it('un compte approuvé le lit', () => {
    poser({ compte: { ...PENDING, etat: 'approuve' } });
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /Ton compte est validé/ })).toBeInTheDocument();
  });

  it('chargement : la lecture du compte est annoncée', () => {
    poser({ chargement: true, compte: null });
    rendre();
    expect(screen.getByText(/Lecture de ton compte/)).toBeInTheDocument();
  });

  it('erreur : le message est une alerte, et l’écran reste utilisable', () => {
    poser({ erreur: 'Lecture de ton compte impossible : réseau.' });
    rendre();
    expect(screen.getByRole('alert')).toHaveTextContent(/réseau/);
    expect(screen.getByRole('button', { name: /Revérifier mon état/ })).toBeInTheDocument();
  });

  it('compte absent de la base : on le dit, sans inventer un état', () => {
    poser({ compte: null });
    rendre();
    expect(screen.getByText(/la base ne le connaît pas encore/)).toBeInTheDocument();
  });

  it('sans session : un lien vers la connexion', () => {
    poser({ session: null, compte: null });
    rendre();
    expect(screen.getByRole('link', { name: /Se connecter/ })).toHaveAttribute('href', '/connexion');
  });

  it('sans configuration, il n’y a pas d’attente', () => {
    poser({ configure: false, session: null, compte: null });
    rendre();
    expect(screen.getByRole('heading', { level: 1, name: /Pas de compte sans base/ })).toBeInTheDocument();
  });
});
