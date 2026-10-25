// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Le rangement du mur lu **depuis la base** (#185), vu de l'écran.
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. le mode de placement **s'ouvre** sur la base — il était masqué, et c'est le défaut
 *    constaté : des post-its empilés qu'on ne pouvait pas bouger ;
 * 2. un glisser sur **son** post-it écrit sa place en base (`deplacerPostit`), à la place
 *    calculée par le glisser — c'est-à-dire que le lâcher ne se contente pas de bouger l'écran ;
 * 3. le post-it d'un **autre** ne se prend pas : la politique de `0001`/`0005` ne l'autorise
 *    pas, et l'écran ne propose donc pas ce qu'elle refuserait ;
 * 4. un refus de la base **remet** le post-it à la dernière place acceptée, avec un message.
 *
 * `src/lib/murBase.ts` est mocké pour sa couture réseau seulement : le calcul des places et
 * la validation (`verifierPosition`) sont les vrais.
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
      version: 'Alpha · 0.1.7',
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
  charger: vi.fn(),
  deplacer: vi.fn()
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
    deplacerPostit: mocks.deplacer
  };
});

import type { Compte } from '@/lib/comptes';
import { BoiteAIdees } from './BoiteAIdees';
import { useComptes } from '@/store/comptes';
import { useStore } from '@/store/useStore';

const BASE = {
  kind: 'IP' as const,
  texte: 'Lu dans la vue postits_avec_votes.',
  ecran: 'Combat' as const,
  pseudo: 'Employé 404',
  version: 'Alpha · 0.1.7',
  statut: 'en attente' as const,
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null
};

/** Un post-it d'un collègue : je le lis, je ne le range pas. */
const AUTRE = {
  ...BASE,
  id: 'p-autre',
  titre: 'Idée d’un collègue',
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 1, down: 0, mon: null },
  mien: false
};

/** Le mien : c'est lui qui se prend. */
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
  created_at: '2026-10-20T10:00:00.000Z'
};

/** Le compte du moment : sans configuration, l'alpha n'a pas d'administration (#186). */
function poserCompte(etat: Partial<Compte> | null = null) {
  useComptes.setState({
    configure: etat !== null,
    chargement: false,
    session: etat ? { id: 'compte-a', courriel: 'a@exemple.test' } : null,
    compte: etat ? { ...COMPTE, ...etat } : null,
    erreur: null,
    rafraichir: vi.fn(async () => {}),
    connecterCourriel: vi.fn(async () => null),
    inscrireCourriel: vi.fn(async () => ({ erreur: null, courrielEnvoye: false })),
    connecterGoogle: vi.fn(async () => null),
    deconnecter: vi.fn(async () => {})
  });
}

/** Un rectangle de `getBoundingClientRect` : jsdom rend zéro partout sans ça. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({ left, top, width, height })
  } as DOMRect;
}

/**
 * Le tableau fait 1000 × 600 px, le post-it visé est posé à (200, 100) et mesure 236 × 200.
 * Un glisser de (220, 120) à (700, 400) déplace donc le post-it de 2 % et 3,3 % de sa prise.
 */
function mesurer(id: string) {
  const postit = document.querySelector<HTMLElement>(`[data-postit="${id}"]`);
  if (!postit) throw new Error(`pas de post-it ${id}`);
  const tableau = postit.parentElement;
  if (!tableau) throw new Error('pas de tableau');
  tableau.getBoundingClientRect = () => rect(0, 0, 1000, 600);
  postit.getBoundingClientRect = () => rect(200, 100, 236, 200);
  return postit;
}

function glisser(postit: HTMLElement, de: [number, number], vers: [number, number]) {
  fireEvent.pointerDown(postit, { clientX: de[0], clientY: de[1], pointerId: 1, isPrimary: true });
  fireEvent.pointerMove(postit, { clientX: vers[0], clientY: vers[1], pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(postit, { clientX: vers[0], clientY: vers[1], pointerId: 1, isPrimary: true });
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
  mocks.charger.mockResolvedValue([structuredClone(AUTRE), structuredClone(MOI)]);
  mocks.deplacer.mockReset();
  mocks.deplacer.mockResolvedValue({ x: 68, y: 63.3, angle: 0 });
  useStore.setState({ name: 'Employé 404' });
  poserCompte();
  // jsdom n'implémente pas la capture de pointeur : le glisser n'en a pas besoin ici.
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

afterEach(cleanup);

describe('le rangement s’ouvre sur la base (#185)', () => {
  it('le mode de placement est proposé, et se referme', async () => {
    rendre();
    await screen.findByText('Mon idée');

    fireEvent.click(screen.getByRole('button', { name: /Mode de placement/ }));

    expect(screen.getByRole('button', { name: /Terminer le placement/ })).toBeInTheDocument();
    // L'export du fichier, lui, n'a plus de sens ici : c'est la base qui porte la place.
    expect(screen.queryByRole('button', { name: /Télécharger le fichier/ })).not.toBeInTheDocument();
  });

  it('sans configuration de base, le rangement reste celui du fichier', async () => {
    mocks.murEstConfigure.mockReturnValue(false);
    rendre();

    fireEvent.click(await screen.findByRole('button', { name: /Mode de placement/ }));

    expect(screen.getByRole('button', { name: /Télécharger le fichier/ })).toBeInTheDocument();
  });
});

describe('glisser écrit la place en base (#185)', () => {
  it('un lâcher sur son post-it envoie la place calculée, et l’écran la reprend', async () => {
    rendre();
    await screen.findByText('Mon idée');
    fireEvent.click(screen.getByRole('button', { name: /Mode de placement/ }));

    glisser(mesurer('p-moi'), [220, 120], [700, 400]);

    await waitFor(() => expect(mocks.deplacer).toHaveBeenCalledTimes(1));
    expect(mocks.deplacer).toHaveBeenCalledWith('p-moi', { x: 68, y: 63.3, angle: 0 });
    // La place rendue par la base est celle que le mur affiche.
    await waitFor(() =>
      expect(document.querySelector<HTMLElement>('[data-postit="p-moi"]')?.style.left).toBe('68%')
    );
  });

  it('le post-it d’un autre ne se prend pas', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');
    fireEvent.click(screen.getByRole('button', { name: /Mode de placement/ }));

    const autre = mesurer('p-autre');
    // L'écran ne donne même pas la prise : la base refuserait de toute façon.
    expect(autre).toHaveAttribute('title', 'On ne range que ses propres post-its.');
    glisser(autre, [220, 120], [700, 400]);

    expect(mocks.deplacer).not.toHaveBeenCalled();
    expect(autre.style.left).toBe('10%');
  });

  it('l’administrateur prend le post-it d’un autre : c’est le rangement du mur (#186)', async () => {
    poserCompte({ administrateur: true });
    rendre();
    await screen.findByText('Idée d’un collègue');
    fireEvent.click(screen.getByRole('button', { name: /Mode de placement/ }));

    const autre = mesurer('p-autre');
    expect(autre).not.toHaveAttribute('title');
    glisser(autre, [220, 120], [700, 400]);

    await waitFor(() => expect(mocks.deplacer).toHaveBeenCalledTimes(1));
    expect(mocks.deplacer).toHaveBeenCalledWith('p-autre', { x: 68, y: 63.3, angle: 0 });
  });

  it('un refus de la base remet le post-it à la place acceptée, et le dit', async () => {
    mocks.deplacer.mockRejectedValue(new Error('La base refuse ce déplacement : on ne range que ses propres post-its.'));
    rendre();
    await screen.findByText('Mon idée');
    fireEvent.click(screen.getByRole('button', { name: /Mode de placement/ }));

    glisser(mesurer('p-moi'), [220, 120], [700, 400]);

    expect(await screen.findByText(/on ne range que ses propres post-its/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector<HTMLElement>('[data-postit="p-moi"]')?.style.left).toBe('50%')
    );
  });
});
