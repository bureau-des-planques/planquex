// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Les pouces du mur (#137), vus de l'écran.
 *
 * - **sans configuration, ni bouton ni compteur**, et rien n'est contacté ;
 * - quand la base a répondu : un 👍 et un 👎 par post-it, chacun avec son compte, et **mon** vote
 *   distinct du total ;
 * - un clic bouge le compte **tout de suite** ; le même pouce **défait** le vote et **remet** le
 *   compteur ; l'autre pouce **change** le vote ;
 * - une **erreur réseau** annule le vote à l'écran, avec un message discret, sans casser la page ;
 * - on ne vote pas pour **son** post-it (l'écran ne le propose pas ; la base le refuse, voir
 *   `supabase/pouces.test.ts`).
 *
 * `src/lib/murBase.ts` est mocké pour sa couture réseau seulement : le calcul des compteurs
 * (`compterApres`) est le vrai. Les requêtes envoyées sont gardées par `src/lib/murBase.test.ts`.
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
      version: 'Alpha · 0.1.6',
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
  voter: vi.fn()
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
    voterPourPostit: mocks.voter
  };
});

import { Comite } from './Comite';
import { useStore } from '@/store/useStore';

const BASE = {
  kind: 'IP' as const,
  texte: 'Lu dans la vue postits_avec_votes.',
  ecran: 'Combat' as const,
  pseudo: 'Anonyme',
  version: 'Alpha · 0.1.7',
  statut: 'en attente' as const,
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null
};

const LUI = {
  ...BASE,
  id: 'p-autre',
  titre: 'Idée d’un collègue',
  position: { x: 10, y: 10, angle: 0 },
  votes: { up: 2, down: 1, mon: null },
  mien: false
};
const MOI = {
  ...BASE,
  id: 'p-moi',
  titre: 'Mon idée',
  position: { x: 50, y: 40, angle: 0 },
  votes: { up: 3, down: 0, mon: null },
  mien: true
};

function rendre() {
  return render(
    <MemoryRouter>
      <Comite />
    </MemoryRouter>
  );
}

/** Le pouce `sens` du post-it dont l'id est donné. */
function pouce(id: string, sens: 'levé' | 'baissé') {
  const barre = document.querySelector<HTMLElement>(`[data-pouces="${id}"]`);
  if (!barre) throw new Error(`pas de pouces sur ${id}`);
  return within(barre).getByRole('button', { name: new RegExp(`pouce ${sens}`) });
}

beforeEach(() => {
  mocks.murEstConfigure.mockReturnValue(true);
  mocks.charger.mockReset();
  mocks.charger.mockResolvedValue([structuredClone(LUI), structuredClone(MOI)]);
  mocks.voter.mockReset();
  mocks.voter.mockResolvedValue(null);
  useStore.setState({ name: 'Employé 404' });
});

afterEach(cleanup);

describe('les pouces ne s’ouvrent qu’avec la base (#137)', () => {
  it('sans configuration : ni bouton ni compteur, et rien n’est contacté', async () => {
    mocks.murEstConfigure.mockReturnValue(false);
    rendre();

    expect(screen.getByText('Post-it du fichier')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pouce/ })).not.toBeInTheDocument();
    expect(document.querySelector('[data-pouces]')).toBeNull();
    expect(mocks.charger).not.toHaveBeenCalled();
    expect(mocks.voter).not.toHaveBeenCalled();
  });

  it('configurée mais muette : la page retombe sur le fichier, sans pouces', async () => {
    mocks.charger.mockRejectedValue(new Error('TypeError: Failed to fetch'));
    rendre();

    expect(await screen.findByText(/La base n’a pas répondu/)).toBeInTheDocument();
    expect(screen.getByText('Post-it du fichier')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pouce/ })).not.toBeInTheDocument();
  });

  it('avec la base : un pouce levé et un pouce baissé par post-it, chacun avec son compte', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');

    expect(pouce('p-autre', 'levé')).toHaveAccessibleName(/2 votes/);
    expect(pouce('p-autre', 'baissé')).toHaveAccessibleName(/1 vote\b/);
    expect(pouce('p-autre', 'levé')).toHaveAttribute('aria-pressed', 'false');
    expect(pouce('p-autre', 'baissé')).toHaveAttribute('aria-pressed', 'false');
  });

  it('mon vote se distingue du total : pouce plein et « ton vote »', async () => {
    mocks.charger.mockResolvedValue([{ ...structuredClone(LUI), votes: { up: 2, down: 1, mon: 'down' } }]);
    rendre();
    await screen.findByText('Idée d’un collègue');

    const bas = pouce('p-autre', 'baissé');
    expect(bas).toHaveAttribute('aria-pressed', 'true');
    expect(bas).toHaveTextContent('ton vote');
    expect(bas).toHaveAccessibleName(/ton vote/);
    expect(pouce('p-autre', 'levé')).toHaveAttribute('aria-pressed', 'false');
    // Le total, lui, reste le total : mon vote y est compris, il ne s'y ajoute pas.
    expect(bas).toHaveTextContent('1');
  });
});

describe('voter, changer d’avis, défaire (#137)', () => {
  it('un clic lève le pouce, le compte suit tout de suite, et la couture reçoit l’ancien vote', async () => {
    mocks.voter.mockResolvedValue('up');
    rendre();
    await screen.findByText('Idée d’un collègue');

    fireEvent.click(pouce('p-autre', 'levé'));

    await waitFor(() => expect(pouce('p-autre', 'levé')).toHaveAttribute('aria-pressed', 'true'));
    expect(pouce('p-autre', 'levé')).toHaveAccessibleName(/3 votes/);
    expect(mocks.voter).toHaveBeenCalledWith('p-autre', 'up', null);
  });

  it('(d) le même pouce défait le vote et remet le compteur', async () => {
    mocks.voter.mockResolvedValueOnce('up').mockResolvedValueOnce(null);
    rendre();
    await screen.findByText('Idée d’un collègue');

    fireEvent.click(pouce('p-autre', 'levé'));
    await waitFor(() => expect(pouce('p-autre', 'levé')).toHaveAccessibleName(/3 votes/));
    await waitFor(() => expect(pouce('p-autre', 'levé')).not.toBeDisabled());

    fireEvent.click(pouce('p-autre', 'levé'));
    await waitFor(() => expect(pouce('p-autre', 'levé')).toHaveAccessibleName(/2 votes/));
    expect(pouce('p-autre', 'levé')).toHaveAttribute('aria-pressed', 'false');
    expect(mocks.voter).toHaveBeenNthCalledWith(2, 'p-autre', 'up', 'up');
  });

  it('l’autre pouce change mon vote : un de moins d’un côté, un de plus de l’autre', async () => {
    mocks.charger.mockResolvedValue([{ ...structuredClone(LUI), votes: { up: 2, down: 1, mon: 'up' } }]);
    mocks.voter.mockResolvedValue('down');
    rendre();
    await screen.findByText('Idée d’un collègue');

    fireEvent.click(pouce('p-autre', 'baissé'));

    await waitFor(() => expect(pouce('p-autre', 'baissé')).toHaveAttribute('aria-pressed', 'true'));
    expect(pouce('p-autre', 'baissé')).toHaveAccessibleName(/2 votes/);
    expect(pouce('p-autre', 'levé')).toHaveAccessibleName(/1 vote\b/);
    expect(mocks.voter).toHaveBeenCalledWith('p-autre', 'down', 'up');
  });

  it('une erreur réseau annule le vote à l’écran, avec un message discret, sans casser la page', async () => {
    mocks.voter.mockRejectedValue(new Error('Le vote n’est pas passé (TypeError: Failed to fetch).'));
    rendre();
    await screen.findByText('Idée d’un collègue');

    fireEvent.click(pouce('p-autre', 'levé'));

    expect(await screen.findByText(/Le vote n’est pas passé/)).toBeInTheDocument();
    // Retour exact à l'état d'avant : compteur, pouce plein.
    expect(pouce('p-autre', 'levé')).toHaveAccessibleName(/2 votes/);
    expect(pouce('p-autre', 'levé')).toHaveAttribute('aria-pressed', 'false');
    // La page est entière : les post-its sont là, le bouton de dépôt aussi.
    expect(screen.getByText('Idée d’un collègue')).toBeInTheDocument();
    expect(screen.getByText('Mon idée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poster une idée/ })).toBeInTheDocument();
    // Et le pouce reste utilisable : on peut réessayer.
    expect(pouce('p-autre', 'levé')).not.toBeDisabled();
  });

  it('le message d’erreur s’efface au clic suivant', async () => {
    mocks.voter.mockRejectedValueOnce(new Error('Le vote n’est pas passé (réseau).')).mockResolvedValueOnce('up');
    rendre();
    await screen.findByText('Idée d’un collègue');

    fireEvent.click(pouce('p-autre', 'levé'));
    await screen.findByText(/Le vote n’est pas passé/);

    fireEvent.click(pouce('p-autre', 'levé'));
    await waitFor(() => expect(screen.queryByText(/Le vote n’est pas passé/)).not.toBeInTheDocument());
    await waitFor(() => expect(pouce('p-autre', 'levé')).toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('pas pour soi (#137)', () => {
  it('sur mon post-it, les comptes se voient mais les pouces sont fermés, et rien n’est envoyé', async () => {
    rendre();
    await screen.findByText('Mon idée');

    expect(pouce('p-moi', 'levé')).toBeDisabled();
    expect(pouce('p-moi', 'baissé')).toBeDisabled();
    expect(pouce('p-moi', 'levé')).toHaveAccessibleName(/3 votes/);
    expect(screen.getByText(/C’est ton post-it/)).toBeInTheDocument();

    fireEvent.click(pouce('p-moi', 'levé'));
    expect(mocks.voter).not.toHaveBeenCalled();
    // Les pouces des autres restent ouverts.
    expect(pouce('p-autre', 'levé')).not.toBeDisabled();
  });
});
