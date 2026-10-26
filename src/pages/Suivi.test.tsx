// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * **Le suivi** du comité (#211, D-097 (2) et (5)), vu de l'écran.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. la page rend **trois groupes** — `en cours`, `fait`, `écarté` — et **pas** `en attente`
 *    ni `retenu`, qui restent sur le mur (D-097 (2)) ;
 * 2. `fait` s'affiche **« Fait »** : un seul nom pour un état ;
 * 3. **la raison d'un écarté s'affiche** — c'est la règle de D-059, et une garde qui la
 *    retirerait doit faire tomber ce fichier (`npm run garde-fous`, entrée #211) ;
 * 4. le repère `vu_le` se pose **à l'ouverture, une fois** (`marquerComiteVu`), et **pas** du
 *    tout sans base configurée (repli inerte) ;
 * 5. la barre de sous-onglets mène au mur (`/comite`) et au suivi (`/comite/suivi`).
 *
 * `src/lib/murBase.ts` est mocké pour sa **couture réseau** seulement : `lireMur` et la forme
 * du contrat sont les vrais.
 */
const DOCUMENT = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-fichier-cours',
      kind: 'IP',
      titre: 'Post-it du fichier, en cours',
      texte: 'Le fichier reste la source sans backend.',
      ecran: 'Collection',
      pseudo: 'Employé 404',
      version: 'Alpha · 0.1.12',
      statut: 'en cours',
      raison: '',
      ticket: null,
      gueulage: false,
      lie: null,
      position: { x: 8, y: 6, angle: 1 },
      votes: { up: 0, down: 0 }
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
    // Le port du jeu, branché sur les `vi.fn()` ci-dessus (#254).
    murDuJeu: (options?: { secours?: boolean }) => portDepuisMocks(mocks, options),
    murEstConfigure: mocks.murEstConfigure,
    marquerComiteVu: mocks.marquer
  };
});

import { Suivi } from './Suivi';

const BASE = {
  kind: 'IP' as const,
  texte: 'Un post-it lu en base.',
  ecran: 'Combat' as const,
  pseudo: 'Employé 404',
  version: 'Alpha · 0.1.12',
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null,
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 0, down: 0, mon: null },
  mien: false
};

const POSTITS = [
  { ...BASE, id: 'p-attente', titre: 'Une idée pas encore lue', statut: 'en attente' as const },
  { ...BASE, id: 'p-retenu', titre: 'Une idée retenue', statut: 'retenu' as const },
  {
    ...BASE,
    id: 'p-cours',
    titre: 'Le bouton Fin du tour',
    statut: 'en cours' as const,
    ticket: 140
  },
  {
    ...BASE,
    id: 'p-fait',
    titre: 'Le compteur de cafés',
    statut: 'fait' as const,
    ticket: 141
  },
  {
    ...BASE,
    id: 'p-ecarte',
    titre: 'Un mode nuit',
    statut: 'écarté' as const,
    raison: 'Le thème sombre est déjà le seul : un mode nuit n’ajoute rien.'
  }
];

function rendre() {
  return render(
    <MemoryRouter initialEntries={['/comite/suivi']}>
      <Suivi />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.murEstConfigure.mockReturnValue(true);
  mocks.charger.mockReset();
  mocks.charger.mockResolvedValue(structuredClone(POSTITS));
  mocks.marquer.mockReset();
  mocks.marquer.mockResolvedValue('2026-10-26T10:00:00.000Z');
});

afterEach(cleanup);

describe('les trois groupes du suivi (D-097 (2))', () => {
  it('rend « En cours », « Fait » et « Écarté »', async () => {
    rendre();

    expect(await screen.findByRole('heading', { level: 2, name: 'En cours' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Fait' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Écarté' })).toBeInTheDocument();

    expect(screen.getByText('Le bouton Fin du tour')).toBeInTheDocument();
    expect(screen.getByText('Le compteur de cafés')).toBeInTheDocument();
    expect(screen.getByText('Un mode nuit')).toBeInTheDocument();
  });

  it('« Fait » est le libellé — jamais le statut brut', async () => {
    rendre();
    await screen.findByRole('heading', { level: 2, name: 'Fait' });

    // Le statut reste `fait` dans les données ; l'écran, lui, ne l'écrit pas en minuscules.
    expect(screen.queryByRole('heading', { level: 2, name: 'fait' })).toBeNull();
  });

  it('laisse `en attente` et `retenu` sur le mur', async () => {
    rendre();
    await screen.findByRole('heading', { level: 2, name: 'Fait' });

    expect(screen.queryByText('Une idée pas encore lue')).toBeNull();
    expect(screen.queryByText('Une idée retenue')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: /attente|retenu/i })).toBeNull();
  });

  it('affiche la raison d’un écarté (D-059)', async () => {
    rendre();
    await screen.findByText('Un mode nuit');

    expect(screen.getByText(/Le thème sombre est déjà le seul : un mode nuit n’ajoute rien\./)).toBeInTheDocument();
    expect(screen.getByText(/Pourquoi c’est écarté/)).toBeInTheDocument();
  });
});

describe('le repère `vu_le` se pose à l’ouverture (D-097 (5), #211)', () => {
  it('appelle `marquerComiteVu` une seule fois, sans attendre les post-its', async () => {
    rendre();

    // Le repère part au montage : il n'attend pas la lecture de la base.
    expect(mocks.marquer).toHaveBeenCalledTimes(1);
    await screen.findByRole('heading', { level: 2, name: 'Fait' });
    expect(mocks.marquer).toHaveBeenCalledTimes(1);
  });

  it('sans base configurée, ne marque rien et lit le fichier', async () => {
    mocks.murEstConfigure.mockReturnValue(false);
    rendre();

    expect(await screen.findByText('Post-it du fichier, en cours')).toBeInTheDocument();
    expect(mocks.marquer).not.toHaveBeenCalled();
    expect(mocks.charger).not.toHaveBeenCalled();
  });

  it('un refus du repère ne casse pas le suivi, et se dit', async () => {
    mocks.marquer.mockRejectedValue(
      new Error('Le repère du suivi demande un compte : sans compte, il n’y a rien à marquer.')
    );
    rendre();

    expect(await screen.findByText(/Le repère du suivi demande un compte/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Fait' })).toBeInTheDocument();
  });
});

describe('la barre de sous-onglets (D-097 (2))', () => {
  it('mène au mur et au suivi, et dit lequel est ouvert', async () => {
    rendre();
    await screen.findByRole('heading', { level: 2, name: 'Fait' });

    const mur = screen.getByRole('link', { name: 'Le mur' });
    const suivi = screen.getByRole('link', { name: 'Le suivi' });
    expect(mur).toHaveAttribute('href', '/comite');
    expect(suivi).toHaveAttribute('href', '/comite/suivi');
    expect(suivi).toHaveAttribute('aria-current', 'page');
    expect(mur).not.toHaveAttribute('aria-current');
  });
});
