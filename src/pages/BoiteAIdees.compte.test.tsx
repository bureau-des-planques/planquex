// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Compte } from '@/lib/comptes';

/**
 * Le mur et le compte (D-088, #181), vu de l'écran.
 *
 * Ce que ces tests gardent : un compte **en attente** (ou refusé) **lit** le mur — les
 * post-its sont là — mais l'écran ne lui propose **ni formulaire ni pouce**, et il lui dit
 * pourquoi, avec un lien vers son état. Un compte approuvé, lui, retrouve les deux. La base
 * refuse de toute façon l'écriture : c'est `supabase/comptes.test.ts` qui le prouve.
 */
const DOCUMENT = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [],
}));

const mocks = vi.hoisted(() => ({
  murEstConfigure: vi.fn(() => true),
  charger: vi.fn(),
}));

vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return { ...vrai, DOCUMENT_MUR: DOCUMENT };
});

vi.mock('@/lib/murBase', async () => {
  const vrai = await vi.importActual<typeof import('@/lib/murBase')>('@/lib/murBase');
  return {
    ...vrai,
    murEstConfigure: mocks.murEstConfigure,
    chargerPostitsDuMur: mocks.charger,
  };
});

import { BoiteAIdees } from './BoiteAIdees';
import { useComptes } from '@/store/comptes';

const POSTIT = {
  id: 'p-autre',
  kind: 'IP' as const,
  titre: 'Idée d’un collègue',
  texte: 'Lu dans la vue postits_avec_votes.',
  ecran: 'Combat' as const,
  pseudo: 'Anonyme',
  version: 'Alpha · 0.1.8',
  statut: 'en attente' as const,
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null,
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 2, down: 1, mon: null },
  mien: false,
};

const COMPTE: Compte = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'en attente',
  raison: '',
  administrateur: false,
  created_at: '2026-10-23T10:00:00.000Z',
};

function poserCompte(etat: Partial<Compte> | null = {}) {
  useComptes.setState({
    configure: true,
    chargement: false,
    session: etat ? { id: 'compte-a', courriel: 'a@exemple.test' } : null,
    compte: etat ? { ...COMPTE, ...etat } : null,
    erreur: null,
  });
}

function rendre() {
  return render(
    <MemoryRouter>
      <BoiteAIdees />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.murEstConfigure.mockReturnValue(true);
  mocks.charger.mockReset();
  mocks.charger.mockResolvedValue([structuredClone(POSTIT)]);
  poserCompte();
});
afterEach(cleanup);

describe('un compte non approuvé lit le mur mais n’écrit pas', () => {
  it('en attente : le post-it se lit, ni bouton ni pouce, et un lien vers l’attente', async () => {
    rendre();
    expect(await screen.findByText('Idée d’un collègue')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Poster une idée/ })).toBeNull();
    expect(document.querySelector('[data-pouces]')).toBeNull();
    expect(screen.getByRole('link', { name: /Voir mon compte/ })).toHaveAttribute('href', '/attente');
    expect(screen.getByText(/Ton compte attend d’être validé/)).toBeInTheDocument();
    // Et il ne range pas non plus : la base ne laisse déplacer que ses post-its, à un compte
    // approuvé (#185). L'écran ne propose donc pas ce qu'elle refuserait.
    expect(screen.queryByRole('button', { name: /Mode de placement/ })).toBeNull();
  });

  it('refusé : même chose, et la lecture reste ouverte', async () => {
    poserCompte({ etat: 'refuse', raison: 'Pas un invité.' });
    rendre();
    expect(await screen.findByText('Idée d’un collègue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Poster une idée/ })).toBeNull();
    expect(document.querySelector('[data-pouces]')).toBeNull();
  });

  it('sans session (si la garde laissait passer), un lien vers la connexion', async () => {
    poserCompte(null);
    rendre();
    expect(await screen.findByText('Idée d’un collègue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Se connecter/ })).toHaveAttribute('href', '/connexion');
    expect(screen.queryByRole('button', { name: /Poster une idée/ })).toBeNull();
  });

  it('approuvé : le bouton de dépôt et les pouces reviennent', async () => {
    poserCompte({ etat: 'approuve' });
    rendre();
    expect(await screen.findByText('Idée d’un collègue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poster une idée/ })).toBeInTheDocument();
    // Le rangement aussi : le compte approuvé range ses post-its (ceux de la base, #185).
    expect(screen.getByRole('button', { name: /Mode de placement/ })).toBeInTheDocument();
    expect(document.querySelector('[data-pouces]')).not.toBeNull();
  });
});
