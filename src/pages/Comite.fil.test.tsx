// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Compte } from '@/lib/comptes';
import type { Commentaire } from '@/lib/murBase';

/**
 * Le fil d'un post-it (#138) et sa relecture (#139), vus de l'écran.
 *
 * Ce que ces tests gardent :
 *
 * - le fil se lit **sous son post-it**, du **plus ancien au plus récent**, avec le pseudo et
 *   la date ; il n'existe pas sans la base (le fichier n'en porte pas) ;
 * - un compte **en attente** lit le fil et **lit pourquoi** il n'écrit pas encore ;
 * - un compte approuvé commente, et le commentaire s'ajoute au fil ;
 * - **je ne retire que mon commentaire** ;
 * - mon post-it `en attente` se **corrige** ; après un changement de statut, l'écran
 *   **dit pourquoi** il ne se corrige plus ;
 * - le **retrait** passe par la confirmation, puis le post-it disparaît.
 *
 * `src/lib/murBase.ts` est mocké pour sa couture réseau : ce que la **base** refuse est
 * prouvé par `supabase/mur-ecriture.test.ts`, pas ici.
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
      version: 'Alpha · 0.1.8',
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
  chargerCommentaires: vi.fn(),
  commenter: vi.fn(),
  supprimer: vi.fn(),
  corriger: vi.fn(),
  retirer: vi.fn()
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
    chargerCommentaires: mocks.chargerCommentaires,
    commenterPostit: mocks.commenter,
    supprimerCommentaire: mocks.supprimer
  };
});

import { Comite } from './Comite';
import { useComptes } from '@/store/comptes';
import { useStore } from '@/store/useStore';

const BASE = {
  kind: 'IP' as const,
  texte: 'Lu dans la vue postits_avec_votes.',
  ecran: 'Combat' as const,
  pseudo: 'Anonyme',
  version: 'Alpha · 0.1.8',
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

/** Le commentaire d'un autre, et le mien — du plus ancien au plus récent. */
const COMMENTAIRE_AUTRE: Commentaire = {
  id: 1,
  postitId: 'p-autre',
  texte: 'Pareil chez moi, au deuxième tour.',
  pseudo: 'Employé 404',
  creeLe: '2026-10-22T09:00:00.000Z',
  mien: false
};
const COMMENTAIRE_MIEN: Commentaire = {
  id: 2,
  postitId: 'p-autre',
  texte: 'Et chez moi donc.',
  pseudo: 'Anonyme',
  creeLe: '2026-10-23T09:00:00.000Z',
  mien: true
};

function poserCompte(etat: Partial<Compte> | null = {}) {
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
    <MemoryRouter>
      <Comite />
    </MemoryRouter>
  );
}

/** Ouvre un post-it : c'est là que vivent le fil et la relecture (D-068). */
function agrandir(titre: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Agrandir le post-it « ${titre} »`) }));
}

const fil = (id: string) => document.querySelector<HTMLElement>(`[data-fil="${id}"]`);

beforeEach(() => {
  mocks.murEstConfigure.mockReturnValue(true);
  mocks.charger.mockReset();
  mocks.charger.mockResolvedValue([structuredClone(AUTRE), structuredClone(MOI)]);
  mocks.chargerCommentaires.mockReset();
  mocks.chargerCommentaires.mockResolvedValue([structuredClone(COMMENTAIRE_AUTRE), structuredClone(COMMENTAIRE_MIEN)]);
  mocks.commenter.mockReset();
  mocks.supprimer.mockReset();
  mocks.supprimer.mockResolvedValue(undefined);
  mocks.corriger.mockReset();
  mocks.retirer.mockReset();
  mocks.retirer.mockResolvedValue(undefined);
  poserCompte();
  useStore.setState({ name: 'Employé 404' });
});

afterEach(cleanup);

describe('le fil d’un post-it (#138)', () => {
  it('se lit sous son post-it, du plus ancien au plus récent, signé et daté', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');
    // Replié, le post-it dit qu'il y a un fil : sans ça, personne n'irait le chercher.
    expect(screen.getByText(/2 commentaires — ouvrir pour lire/)).toBeInTheDocument();

    agrandir('Idée d’un collègue');

    const zone = fil('p-autre');
    expect(zone).not.toBeNull();
    const items = within(zone as HTMLElement).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Employé 404');
    expect(items[0]).toHaveTextContent('Pareil chez moi, au deuxième tour.');
    expect(items[0]).toHaveTextContent('22/10/2026');
    expect(items[1]).toHaveTextContent('Et chez moi donc.');
    // Le plus ancien d'abord : c'est l'ordre de lecture, sans imbrication.
    expect(items[0]).toHaveTextContent('Employé 404');
    expect(items[1]).not.toHaveTextContent('Employé 404');
  });

  it('le fichier n’en porte pas : sans la base, ni fil ni commentaire', async () => {
    mocks.murEstConfigure.mockReturnValue(false);
    rendre();

    expect(screen.getByText('Post-it du fichier')).toBeInTheDocument();
    expect(document.querySelector('[data-fil]')).toBeNull();
    expect(screen.queryByText(/Commentaires/)).toBeNull();
    expect(mocks.chargerCommentaires).not.toHaveBeenCalled();
  });

  it('un compte en attente lit le fil et lit pourquoi il n’écrit pas encore', async () => {
    poserCompte({ etat: 'en attente' });
    rendre();
    await screen.findByText('Idée d’un collègue');

    agrandir('Idée d’un collègue');

    const zone = fil('p-autre') as HTMLElement;
    expect(within(zone).getByText('Pareil chez moi, au deuxième tour.')).toBeInTheDocument();
    expect(within(zone).queryByRole('textbox')).toBeNull();
    expect(within(zone).getByText(/Ton compte attend d’être validé/)).toBeInTheDocument();
  });

  it('un compte approuvé commente : la couture reçoit le texte, et le fil s’allonge', async () => {
    mocks.commenter.mockResolvedValue({
      id: 3,
      postitId: 'p-autre',
      texte: 'Le même cas, au troisième tour.',
      pseudo: 'Anonyme',
      creeLe: '2026-10-23T10:00:00.000Z',
      mien: true
    });
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    const zone = fil('p-autre') as HTMLElement;
    fireEvent.change(within(zone).getByLabelText('Commenter « Idée d’un collègue »'), {
      target: { value: 'Le même cas, au troisième tour.' }
    });
    fireEvent.click(within(zone).getByRole('button', { name: 'Commenter' }));

    await waitFor(() => expect(mocks.commenter).toHaveBeenCalledTimes(1));
    expect(mocks.commenter).toHaveBeenCalledWith('p-autre', 'Le même cas, au troisième tour.', {
      pseudo: 'Employé 404'
    });
    expect(await within(zone).findByText('Le même cas, au troisième tour.')).toBeInTheDocument();
    expect(within(zone).getAllByRole('listitem')).toHaveLength(3);
  });

  it('je ne retire que mon commentaire', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    const zone = fil('p-autre') as HTMLElement;
    expect(within(zone).getAllByRole('button', { name: /Retirer mon commentaire/ })).toHaveLength(1);
    expect(within(zone).getByRole('button', { name: /Retirer mon commentaire du 23\/10\/2026/ })).toBeInTheDocument();
  });

  it('retirer mon commentaire appelle la couture et le fait disparaître du fil', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    const zone = fil('p-autre') as HTMLElement;
    fireEvent.click(within(zone).getByRole('button', { name: /Retirer mon commentaire/ }));

    await waitFor(() => expect(mocks.supprimer).toHaveBeenCalledWith(COMMENTAIRE_MIEN.id));
    await waitFor(() => expect(within(zone).queryByText('Et chez moi donc.')).not.toBeInTheDocument());
    expect(within(zone).getByText('Pareil chez moi, au deuxième tour.')).toBeInTheDocument();
  });

  it('une panne de lecture du fil ne jette pas le mur : le post-it reste, le fil le dit', async () => {
    mocks.chargerCommentaires.mockRejectedValue(new Error('TypeError: Failed to fetch'));
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    const zone = fil('p-autre') as HTMLElement;
    expect(within(zone).getByRole('status')).toHaveTextContent(/n’ont pas pu être lus/);
    // Le mur, lui, n'est pas retombé sur le fichier pour autant.
    expect(screen.getByText('Mon idée')).toBeInTheDocument();
  });

  it('la longueur maximale se dit pendant la frappe, et bloque l’envoi', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    const zone = fil('p-autre') as HTMLElement;
    fireEvent.change(within(zone).getByLabelText('Commenter « Idée d’un collègue »'), {
      target: { value: 'x'.repeat(501) }
    });

    expect(
      within(zone).getByText(/Un commentaire fait au plus 500 caractères \(le tien en fait 501\)/)
    ).toBeInTheDocument();
    expect(within(zone).getByRole('button', { name: 'Commenter' })).toBeDisabled();
    expect(mocks.commenter).not.toHaveBeenCalled();
  });
});

describe('relire ou retirer son post-it (#139)', () => {
  it('mon post-it en attente se corrige : le formulaire envoie le titre et le texte', async () => {
    mocks.corriger.mockResolvedValue({ titre: 'Mon idée corrigée', texte: 'Texte corrigé.' });
    rendre();
    await screen.findByText('Mon idée');
    agrandir('Mon idée');

    const zone = document.querySelector<HTMLElement>('[data-correction="ouverte"]') as HTMLElement;
    expect(zone).not.toBeNull();

    fireEvent.change(within(zone).getByLabelText('Corriger le titre de « Mon idée »'), {
      target: { value: 'Mon idée corrigée' }
    });
    fireEvent.change(within(zone).getByLabelText('Corriger le texte de « Mon idée »'), {
      target: { value: 'Texte corrigé.' }
    });
    fireEvent.click(within(zone).getByRole('button', { name: 'Enregistrer la correction' }));

    await waitFor(() => expect(mocks.corriger).toHaveBeenCalledTimes(1));
    expect(mocks.corriger).toHaveBeenCalledWith('p-moi', {
      titre: 'Mon idée corrigée',
      texte: 'Texte corrigé.'
    });
    expect(await screen.findByText('Mon idée corrigée')).toBeInTheDocument();
  });

  it('après un statut, la correction est fermée, et l’écran dit pourquoi', async () => {
    mocks.charger.mockResolvedValue([{ ...structuredClone(MOI), statut: 'retenu' }]);
    rendre();
    await screen.findByText('Mon idée');
    agrandir('Mon idée');

    const zone = document.querySelector<HTMLElement>('[data-correction="gele"]') as HTMLElement;
    expect(zone).not.toBeNull();
    expect(within(zone).getByText(/a bougé de statut \(« retenu »\)/)).toBeInTheDocument();
    expect(within(zone).getByText(/on ne le corrige plus/)).toBeInTheDocument();
    // Ni formulaire de correction, ni bouton de retrait : le refus est dans la base.
    expect(within(zone).queryByRole('textbox')).toBeNull();
    expect(within(zone).queryByRole('button', { name: /Retirer ce post-it/ })).toBeNull();
    expect(mocks.corriger).not.toHaveBeenCalled();
  });

  it('retirer mon post-it passe par la confirmation, puis par la couture', async () => {
    rendre();
    await screen.findByText('Mon idée');
    agrandir('Mon idée');

    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce post-it' }));

    const dialogue = await screen.findByRole('dialog', { name: /Retirer ce post-it \?/ });
    expect(dialogue).toHaveTextContent(/supprimé du mur/);
    // Rien n'est parti tant qu'on n'a pas confirmé.
    expect(mocks.retirer).not.toHaveBeenCalled();

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Retirer le post-it' }));

    await waitFor(() => expect(mocks.retirer).toHaveBeenCalledWith('p-moi'));
    await waitFor(() => expect(screen.queryByText('Mon idée')).not.toBeInTheDocument());
    expect(screen.getByText(/Ton post-it est retiré du mur/)).toBeInTheDocument();
  });

  it('annuler la confirmation ne retire rien', async () => {
    rendre();
    await screen.findByText('Mon idée');
    agrandir('Mon idée');

    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce post-it' }));
    const dialogue = await screen.findByRole('dialog', { name: /Retirer ce post-it \?/ });
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }));

    expect(mocks.retirer).not.toHaveBeenCalled();
    expect(screen.getByText('Mon idée')).toBeInTheDocument();
  });

  it('le post-it d’un autre ne montre ni correction ni retrait', async () => {
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    expect(document.querySelector('[data-correction]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirer ce post-it' })).toBeNull();
  });
});

describe('le retrait d’administration (#186)', () => {
  it('l’administration trouve le retrait sur le post-it d’un autre, et pas sur le sien', async () => {
    poserCompte({ administrateur: true });
    rendre();
    await screen.findByText('Idée d’un collègue');

    agrandir('Idée d’un collègue');
    const zone = document.querySelector<HTMLElement>('[data-retrait="administration"]');
    expect(zone).not.toBeNull();
    expect(within(zone as HTMLElement).getByRole('button', { name: 'Retirer ce post-it' })).toBeInTheDocument();
    // Pas de correction du texte d'autrui : `0006` ne la donne à personne (D-088).
    expect(document.querySelector('[data-correction]')).toBeNull();

    agrandir('Mon idée');
    // Sur le sien, c'est la relecture de l'auteur — pas le retrait d'administration.
    expect(document.querySelector('[data-retrait="administration"]')).toBeNull();
    expect(document.querySelector('[data-correction="ouverte"]')).not.toBeNull();
  });

  it('retirer le post-it d’un autre passe par la confirmation, puis par la couture', async () => {
    poserCompte({ administrateur: true });
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce post-it' }));

    const dialogue = await screen.findByRole('dialog', { name: /Retirer le post-it d’un autre \?/ });
    expect(dialogue).toHaveTextContent(/avec ses votes et ses commentaires/);
    // Rien n'est parti tant qu'on n'a pas confirmé.
    expect(mocks.retirer).not.toHaveBeenCalled();

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Retirer le post-it' }));

    await waitFor(() => expect(mocks.retirer).toHaveBeenCalledWith('p-autre'));
    await waitFor(() => expect(screen.queryByText('Idée d’un collègue')).not.toBeInTheDocument());
    expect(screen.getByText(/Le post-it de Anonyme est retiré du mur/)).toBeInTheDocument();
  });

  it('un compte approuvé qui n’est pas administrateur ne voit rien de tout ça', async () => {
    poserCompte();
    rendre();
    await screen.findByText('Idée d’un collègue');
    agrandir('Idée d’un collègue');

    expect(document.querySelector('[data-retrait="administration"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirer ce post-it' })).toBeNull();
  });
});
