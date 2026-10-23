// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Le mur **poste depuis le jeu**, et lit la base quand elle est configurée (#136).
 *
 * Ce fichier garde les quatre choses que le ticket demande de prouver :
 *
 * - la base **remplace** le fichier quand elle est configurée (et le loader est le vrai
 *   contrat : `posterPostit` rend un `Postit` déjà normalisé) ;
 * - **sans configuration**, le fichier reste la source et rien n'est écrit ;
 * - une **erreur réseau** à la lecture retombe sur le fichier, avec un message — jamais un
 *   écran cassé ni un mur vide qui aurait l'air vrai ;
 * - le formulaire envoie les champs du §4, signés du **pseudo local**, et un gueulage
 *   part **sans famille** (D-085).
 *
 * `src/lib/murBase.ts` est mocké : c'est la couture. Ses propres tests
 * (`src/lib/murBase.test.ts`) regardent la requête envoyée, sans réseau.
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
  poster: vi.fn()
}));

vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return { ...vrai, DOCUMENT_MUR: DOCUMENT };
});

vi.mock('@/lib/murBase', async () => {
  // Les vraies fonctions restent : un faux module **entier** rendrait `chargerCommentaires`
  // indéfini, et la page retomberait sur le fichier pour une raison qui n'a rien à voir
  // avec ce que ce test mesure (#138).
  const vrai = await vi.importActual<typeof import('@/lib/murBase')>('@/lib/murBase');
  return {
    ...vrai,
    murEstConfigure: mocks.murEstConfigure,
    chargerPostitsDuMur: mocks.charger,
    posterPostit: mocks.poster
  };
});

import { BoiteAIdees } from './BoiteAIdees';
import { useStore } from '@/store/useStore';

const POSTIT_BASE = {
  id: 'p-base',
  kind: 'OUF' as const,
  titre: 'Post-it de la base',
  texte: 'Lu dans la vue postits_avec_votes.',
  ecran: 'Combat' as const,
  pseudo: 'Anonyme',
  version: 'Alpha · 0.1.6',
  statut: 'en attente' as const,
  raison: '',
  ticket: null,
  gueulage: false,
  lie: null,
  position: { x: 30, y: 30, angle: 0 },
  votes: { up: 0, down: 0 }
};

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
  mocks.charger.mockResolvedValue([POSTIT_BASE]);
  mocks.poster.mockReset();
  useStore.setState({ name: 'Employé 404' });
});

afterEach(cleanup);

describe('la base remplace le fichier comme source du mur (#136)', () => {
  it('affiche les post-its de la base, et le bouton de dépôt', async () => {
    rendre();

    expect(await screen.findByText('Post-it de la base')).toBeInTheDocument();
    expect(screen.queryByText('Post-it du fichier')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poster une idée/ })).toBeInTheDocument();
  });

  it('une erreur réseau retombe sur le fichier, sans écran cassé', async () => {
    mocks.charger.mockRejectedValue(new Error('TypeError: Failed to fetch'));
    rendre();

    expect(await screen.findByText(/La base n’a pas répondu/)).toBeInTheDocument();
    expect(screen.getByText('Post-it du fichier')).toBeInTheDocument();
    expect(screen.queryByText('Post-it de la base')).not.toBeInTheDocument();
    // Le bouton reste là : la panne est expliquée, pas masquée.
    expect(screen.getByRole('button', { name: /Poster une idée/ })).toBeInTheDocument();
  });

  it('sans configuration, le fichier reste la source et rien n’est chargé', async () => {
    mocks.murEstConfigure.mockReturnValue(false);
    rendre();

    expect(screen.getByText('Post-it du fichier')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Poster une idée/ })).not.toBeInTheDocument();
    // La porte d'écriture de l'alpha reste le formulaire externe.
    expect(screen.getByRole('link', { name: /Proposer une idée/ })).toBeInTheDocument();
    expect(mocks.charger).not.toHaveBeenCalled();
    expect(mocks.poster).not.toHaveBeenCalled();
  });
});

describe('le formulaire de dépôt (#136)', () => {
  it('envoie les champs du §4, signés du pseudo local, avec l’écran et le lien de capture', async () => {
    mocks.poster.mockResolvedValue({
      ...POSTIT_BASE,
      id: 'p-neuf',
      kind: 'OUF',
      titre: 'Le bouton Fin du tour reste grisé',
      texte: 'Au combat, il ne répond pas.\n\nCapture : https://exemple.test/capture.png'
    });

    rendre();
    await screen.findByText('Post-it de la base');
    fireEvent.click(screen.getByRole('button', { name: /Poster une idée/ }));

    fireEvent.click(screen.getByRole('radio', { name: /OUF/ }));
    fireEvent.change(screen.getByLabelText('Titre'), {
      target: { value: 'Le bouton Fin du tour reste grisé' }
    });
    fireEvent.change(screen.getByLabelText(/Ce qui s’est passé/), {
      target: { value: 'Au combat, il ne répond pas.' }
    });
    fireEvent.change(screen.getByLabelText('Écran'), { target: { value: 'Combat' } });
    fireEvent.change(screen.getByLabelText(/Capture/), {
      target: { value: 'https://exemple.test/capture.png' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Coller le post-it/ }));

    await waitFor(() => expect(mocks.poster).toHaveBeenCalledTimes(1));
    expect(mocks.poster).toHaveBeenCalledWith(
      {
        famille: 'OUF',
        gueulage: false,
        titre: 'Le bouton Fin du tour reste grisé',
        texte: 'Au combat, il ne répond pas.',
        ecran: 'Combat',
        capture: 'https://exemple.test/capture.png'
      },
      { pseudo: 'Employé 404' }
    );

    expect(await screen.findByText(/Ton post-it est collé au mur/)).toBeInTheDocument();
    // Le post-it rendu par la couture s'ajoute sans attendre un rechargement.
    expect(await screen.findByText('Le bouton Fin du tour reste grisé')).toBeInTheDocument();
  });

  it('un gueulage n’a pas de titre et part sans famille (D-085)', async () => {
    mocks.poster.mockResolvedValue({ ...POSTIT_BASE, id: 'p-gueule', kind: null, gueulage: true });

    rendre();
    await screen.findByText('Post-it de la base');
    fireEvent.click(screen.getByRole('button', { name: /Poster une idée/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Gueulage/ }));

    // Pas de champ Titre : le gueulage ne s'en voit pas imposer un (D-085).
    expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Exprime-toi'), {
      target: { value: 'Non mais ça va pas la tête' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Coller le post-it/ }));

    await waitFor(() => expect(mocks.poster).toHaveBeenCalledTimes(1));
    expect(mocks.poster).toHaveBeenCalledWith(
      {
        famille: null,
        gueulage: true,
        titre: '',
        texte: 'Non mais ça va pas la tête',
        ecran: '',
        capture: ''
      },
      { pseudo: 'Employé 404' }
    );
  });

  it('affiche le refus de la base, et ne prétend pas que c’est collé', async () => {
    mocks.poster.mockRejectedValue(
      new Error('Le post-it n’a pas pu être collé : new row violates row-level security policy')
    );

    rendre();
    await screen.findByText('Post-it de la base');
    fireEvent.click(screen.getByRole('button', { name: /Poster une idée/ }));
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Une idée' } });
    fireEvent.change(screen.getByLabelText('L’idée'), { target: { value: 'Un texte.' } });
    fireEvent.click(screen.getByRole('button', { name: /Coller le post-it/ }));

    expect(await screen.findByText(/row-level security policy/)).toBeInTheDocument();
    expect(screen.queryByText(/Ton post-it est collé au mur/)).not.toBeInTheDocument();
  });
});
