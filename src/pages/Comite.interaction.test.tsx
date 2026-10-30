// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

/**
 * **Le post-it compact et la page interactive** (#280), vus de l'écran.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. au repos, le post-it est **compact** : son texte est replié à trois lignes, et le
 *    détail (fil, relecture, retrait) n'est pas rendu ;
 * 2. un clic **ouvre un seul** détail à la fois : ouvrir le second referme le premier ;
 * 3. le bouton d'ouverture est atteignable **au clavier**, et `aria-controls` désigne un
 *    élément qui existe ;
 * 4. les outils d'**administration** ne sont pas dans l'état compact : la carte au repos
 *    garde la même hauteur pour un testeur et pour un administrateur. **Le contrôle mord** :
 *    le même post-it ouvert les montre.
 *
 * `src/lib/murBase.ts` est mocké pour sa couture réseau seulement.
 */
const DOCUMENT = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-fichier',
      kind: 'IP',
      titre: 'Post-it du fichier',
      texte: 'Le fichier reste la source sans backend.',
      ecran: 'Collection',
      pseudo: 'Employé 404',
      version: 'Alpha · 0.1.14',
      statut: 'en attente',
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
  charger: vi.fn()
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
    murEstConfigure: mocks.murEstConfigure
  };
});

import type { Compte } from '@/lib/comptes';
import { Comite } from './Comite';
import { useComptes } from '@/store/comptes';
import { useStore } from '@/store/useStore';

const LONG = 'Un texte assez long pour dépasser trois lignes au repos, avec une suite de mots qui ne s’arrête pas.';

const BASE = {
  kind: 'IP' as const,
  texte: LONG,
  ecran: 'Combat' as const,
  pseudo: 'Employé 404',
  version: 'Alpha · 0.1.14',
  statut: 'en attente' as const,
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null
};

const AUTRE = {
  ...BASE,
  id: 'p-autre',
  titre: 'Idée d’un collègue',
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 1, down: 0, mon: null },
  mien: false
};

const MOI = {
  ...BASE,
  id: 'p-moi',
  titre: 'Mon idée',
  position: { x: 50, y: 40, angle: 0 },
  votes: { up: 0, down: 0, mon: null },
  mien: true
};

const COMPTE: Compte = {
  id: 'compte-a',
  courriel: 'a@exemple.test',
  etat: 'approuve',
  raison: '',
  administrateur: false,
  medaille_periode_essai: false,
  medaille_periode_essai_le: null,
  created_at: '2026-10-20T10:00:00.000Z'
};

function poserCompte(etat: Partial<Compte> | null = null) {
  useComptes.setState({
    configure: etat !== null,
    chargement: false,
    session: etat ? { id: 'compte-a', courriel: 'a@exemple.test', anonyme: false } : null,
    compte: etat ? { ...COMPTE, ...etat } : null,
    erreur: null,
    rafraichir: vi.fn(async () => {}),
    connecterCourriel: vi.fn(async () => null),
    inscrireCourriel: vi.fn(async () => ({ erreur: null, courrielEnvoye: false })),
    connecterGoogle: vi.fn(async () => null),
    deconnecter: vi.fn(async () => {})
  });
}

function rendre() {
  return render(
    <MemoryRouter initialEntries={['/comite']}>
      <Comite />
    </MemoryRouter>
  );
}

const carte = (id: string) => document.querySelector<HTMLElement>(`[data-postit="${id}"] article`) as HTMLElement;

beforeEach(() => {
  mocks.murEstConfigure.mockReturnValue(true);
  mocks.charger.mockReset();
  mocks.charger.mockResolvedValue([structuredClone(AUTRE), structuredClone(MOI)]);
  useStore.setState({ name: 'Employé 404' });
  poserCompte();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

afterEach(cleanup);

describe('le post-it compact (#280)', () => {
  it('replie son texte et ne rend pas le détail au repos', async () => {
    rendre();
    await screen.findByText('Mon idée');

    const texte = document.querySelector<HTMLElement>('[data-postit="p-moi"] [data-postit-texte]');
    expect(texte?.className).toContain('line-clamp-3');
    expect(carte('p-moi')).toHaveAttribute('data-ouvert', 'false');
    // Le fil n'existe qu'à l'ouverture (la base a répondu, mais le post-it est fermé).
    expect(document.querySelector('[data-fil="p-moi"]')).toBeNull();
  });

  it('un clic ouvre un seul détail à la fois', async () => {
    rendre();
    await screen.findByText('Mon idée');

    fireEvent.click(screen.getByRole('button', { name: 'Agrandir le post-it « Mon idée »' }));
    expect(carte('p-moi')).toHaveAttribute('data-ouvert', 'true');
    expect(carte('p-autre')).toHaveAttribute('data-ouvert', 'false');
    expect(document.querySelector('[data-fil="p-moi"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Agrandir le post-it « Idée d’un collègue »' }));
    expect(carte('p-moi')).toHaveAttribute('data-ouvert', 'false');
    expect(carte('p-autre')).toHaveAttribute('data-ouvert', 'true');
    expect(document.querySelector('[data-fil="p-moi"]')).toBeNull();
    expect(document.querySelector('[data-fil="p-autre"]')).not.toBeNull();

    // Le texte ouvert n'est plus replié.
    const texte = document.querySelector<HTMLElement>('[data-postit="p-autre"] [data-postit-texte]');
    expect(texte?.className).not.toContain('line-clamp-3');
  });

  it('le contrôle mord : deux détails ouverts à la fois est impossible', async () => {
    rendre();
    await screen.findByText('Mon idée');

    fireEvent.click(screen.getByRole('button', { name: 'Agrandir le post-it « Mon idée »' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir le post-it « Idée d’un collègue »' }));

    const ouverts = [...document.querySelectorAll('[data-postit] article')].filter(
      (article) => article.getAttribute('data-ouvert') === 'true'
    );
    expect(ouverts).toHaveLength(1);
  });
});

describe('la page interactive reste accessible (#280)', () => {
  it('le bouton d’ouverture est atteignable au clavier, et `aria-controls` désigne un vrai bloc', async () => {
    rendre();
    await screen.findByText('Mon idée');

    const bouton = screen.getByRole('button', { name: 'Agrandir le post-it « Mon idée »' });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');

    const cible = bouton.getAttribute('aria-controls');
    expect(cible).toBe('postit-detail-p-moi');
    expect(document.getElementById(cible as string)).not.toBeNull();

    await userEvent.tab();
    // Le clavier atteint le bouton du post-it : on tabule jusqu'à lui plutôt que de
    // supposer qu'il est le premier de la page.
    let atteint = document.activeElement === bouton;
    for (let i = 0; i < 25 && !atteint; i += 1) {
      await userEvent.tab();
      atteint = document.activeElement === bouton;
    }
    expect(atteint).toBe(true);

    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
  });

  it('les pouces restent des cibles de 44 px (classe `pouce`)', async () => {
    rendre();
    await screen.findByText('Mon idée');

    const zone = document.querySelector('[data-pouces="p-moi"]') as HTMLElement;
    expect(zone).not.toBeNull();
    for (const bouton of within(zone).getAllByRole('button')) {
      expect(bouton.className).toContain('pouce');
    }
  });
});

describe('l’administration reste hors de l’état compact (#280)', () => {
  it('les outils de tri ne sont pas rendus au repos, et le sont à l’ouverture', async () => {
    poserCompte({ administrateur: true });
    rendre();
    await screen.findByText('Idée d’un collègue');

    // Au repos, la carte est la même que pour un testeur : aucun outil d'administration.
    expect(screen.queryByRole('button', { name: 'Retirer ce post-it' })).toBeNull();
    expect(document.querySelector('[data-retrait="administration"]')).toBeNull();

    // Le contrôle mord : ouvert, le même post-it montre le retrait d'administration.
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir le post-it « Idée d’un collègue »' }));
    const retrait = document.querySelector('[data-retrait="administration"]') as HTMLElement;
    expect(retrait).not.toBeNull();
    expect(within(retrait).getByRole('button', { name: 'Retirer ce post-it' })).toBeInTheDocument();
  });
});
