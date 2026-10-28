// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Postit } from '@/store/mur';

/**
 * **Du post-it au ticket** (#281), vu de l'écran.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. chaque ligne de suivi dit son **statut**, son **écran** et son **ticket** — le numéro,
 *    et un **lien GitHub composé à partir du numéro** (aucun appel réseau depuis la page) ;
 * 2. un `écarté` porte sa raison (D-059) ;
 * 3. un **`en attente` ne prétend pas avoir de ticket** : même si la base portait un numéro,
 *    l'écran n'affiche ni lien ni numéro. **Le contrôle mord** : le même post-it passé `en
 *    cours` affiche bel et bien ce lien — sans quoi l'assertion du point 3 serait vide.
 *
 * `src/lib/murBase.ts` est mocké pour sa **couture réseau** seulement.
 */
const DOCUMENT = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-page-cours',
      kind: 'OUF',
      titre: 'Le bouton Fin du tour',
      texte: 'Le bouton reste grisé.',
      ecran: 'Combat',
      pseudo: 'Employé 404',
      version: 'Alpha · 0.1.14',
      statut: 'en cours',
      raison: '',
      ticket: 400,
      gueulage: false,
      lie: null,
      position: { x: 8, y: 6, angle: 1 },
      votes: { up: 2, down: 0 }
    }
  ]
}));

const mocks = vi.hoisted(() => ({
  murEstConfigure: vi.fn(() => true),
  charger: vi.fn(),
  marquer: vi.fn()
}));

vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return { ...vrai, DOCUMENT_MUR: DOCUMENT };
});

vi.mock('@/lib/murBase', async () => {
  const { portDepuisMocks } = await import('@/test/murDeTest');
  const vrai = await vi.importActual<typeof import('@/lib/murBase')>('@/lib/murBase');
  return {
    ...vrai,
    murDuJeu: (options?: { secours?: boolean }) => portDepuisMocks(mocks, options),
    murEstConfigure: mocks.murEstConfigure,
    marquerComiteVu: mocks.marquer
  };
});

import { LigneSuivi, Suivi, lienTicket, ticketDuSuivi } from './Suivi';

const BASE: Postit = {
  id: 'p-base',
  kind: 'OUF',
  titre: 'Un signalement',
  texte: 'Le texte du signalement.',
  ecran: 'Combat',
  pseudo: 'Employé 404',
  version: 'Alpha · 0.1.14',
  statut: 'en cours',
  raison: '',
  ticket: 400,
  gueulage: false,
  lie: null,
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 2, down: 0 }
};

/** Les quatre statuts qu'une ligne peut porter, chacun avec ce qu'il doit montrer. */
const QUATRE: Postit[] = [
  { ...BASE, id: 'p-attente', titre: 'Pas encore trié', statut: 'en attente', ticket: 999 },
  { ...BASE, id: 'p-cours', titre: 'En travaux', statut: 'en cours', ticket: 400 },
  { ...BASE, id: 'p-fait', titre: 'Corrigé', statut: 'fait', ticket: 401 },
  {
    ...BASE,
    id: 'p-ecarte',
    titre: 'Un mode nuit',
    statut: 'écarté',
    ticket: null,
    raison: 'Le thème sombre est déjà le seul.'
  }
];

afterEach(cleanup);

describe('une ligne de suivi dit son statut, son écran et son ticket (#281)', () => {
  it('couvre les quatre statuts, avec le libellé de chacun', () => {
    render(
      <ul>
        {QUATRE.map((postit) => (
          <LigneSuivi postit={postit} key={postit.id} />
        ))}
      </ul>
    );

    for (const [id, libelle] of [
      ['p-attente', 'En attente'],
      ['p-cours', 'En cours'],
      ['p-fait', 'Fait'],
      ['p-ecarte', 'Écarté']
    ]) {
      const ligne = document.querySelector<HTMLElement>(`[data-suivi="${id}"]`);
      expect(ligne).not.toBeNull();
      expect(within(ligne as HTMLElement).getByText(libelle)).toBeInTheDocument();
      expect(within(ligne as HTMLElement).getByText('Écran : Combat')).toBeInTheDocument();
    }
  });

  it('le ticket est un numéro et un lien GitHub composé, jamais un appel réseau', () => {
    render(
      <ul>
        <LigneSuivi postit={QUATRE[1]} />
      </ul>
    );

    const lien = screen.getByRole('link', { name: 'Ticket #400' });
    expect(lien).toHaveAttribute('href', 'https://github.com/bureau-des-planques/planquex/issues/400');
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', 'noopener noreferrer');
    expect(lienTicket(400)).toBe('https://github.com/bureau-des-planques/planquex/issues/400');
  });

  it('un écarté montre sa raison, et n’invente pas de ticket', () => {
    render(
      <ul>
        <LigneSuivi postit={QUATRE[3]} />
      </ul>
    );
    expect(screen.getByText(/Le thème sombre est déjà le seul\./)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('un en attente ne prétend pas avoir de ticket — et le contrôle mord', () => {
    const { unmount } = render(
      <ul>
        <LigneSuivi postit={QUATRE[0]} />
      </ul>
    );

    // La base porte `ticket: 999`, mais le post-it n'a pas été trié.
    expect(ticketDuSuivi(QUATRE[0])).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/#999/)).toBeNull();
    expect(screen.getByText(/Pas encore de ticket/)).toBeInTheDocument();
    unmount();

    // Le contrôle mord : le même post-it, trié `en cours`, affiche son lien.
    render(
      <ul>
        <LigneSuivi postit={{ ...QUATRE[0], statut: 'en cours' }} />
      </ul>
    );
    expect(ticketDuSuivi({ ...QUATRE[0], statut: 'en cours' })).toBe(999);
    expect(screen.getByRole('link', { name: 'Ticket #999' })).toHaveAttribute(
      'href',
      'https://github.com/bureau-des-planques/planquex/issues/999'
    );
  });
});

describe('la page de suivi affiche le ticket d’un post-it trié (#281)', () => {
  beforeEach(() => {
    mocks.murEstConfigure.mockReturnValue(true);
    mocks.charger.mockReset();
    mocks.charger.mockResolvedValue(structuredClone(DOCUMENT.postits));
    mocks.marquer.mockReset();
    mocks.marquer.mockResolvedValue('2026-10-28T10:00:00.000Z');
  });

  it('montre le statut, l’écran et le lien du ticket', async () => {
    render(
      <MemoryRouter initialEntries={['/comite/suivi']}>
        <Suivi />
      </MemoryRouter>
    );

    const ligne = await screen.findByText('Le bouton Fin du tour');
    const carte = ligne.closest('[data-suivi]') as HTMLElement;
    expect(carte).not.toBeNull();
    expect(carte.dataset.statut).toBe('en cours');
    expect(within(carte).getByText('En cours')).toBeInTheDocument();
    expect(within(carte).getByText('Écran : Combat')).toBeInTheDocument();
    expect(within(carte).getByRole('link', { name: 'Ticket #400' })).toHaveAttribute(
      'href',
      'https://github.com/bureau-des-planques/planquex/issues/400'
    );
  });
});
