// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Le mur affiche un post-it écrit par `npm run mur:import` (#177), sans autre travail.
 *
 * Le document ci-dessous est **exactement** la forme que produit le script : `statut`
 * `en attente`, `ticket` nul, `votes` à zéro, position en pourcentage, et la capture
 * déjà fondue dans le `texte` (le post-it n'a pas de champ pour elle, §3). Le test de
 * `scripts/mur-import.test.ts` vérifie que ce document passe `lireMur` ; celui-ci rend
 * la page sur ce même document et regarde ce que l'invité voit.
 *
 * On mocke `DOCUMENT_MUR` parce que la page le lit **une fois**, à l'import du module.
 * Le reste du contrat (`lireMur`, `exporterMur`) est le vrai.
 */
const DOCUMENT = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-23-10-2026-15-00-00-le-bouton-fin-du-tour-reste-grise',
      kind: 'OUF',
      titre: 'Le bouton Fin du tour reste grisé',
      texte: 'Ce que tu faisais : J’étais au combat.\n\nCapture : https://exemple.test/capture.png',
      ecran: 'Combat',
      pseudo: 'anonyme',
      version: 'Alpha · 0.1.4',
      statut: 'en attente',
      raison: '',
      ticket: null,
      gueulage: false,
      position: { x: 12, y: 24, angle: -2 },
      votes: { up: 0, down: 0 }
    }
  ]
}));

vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return { ...vrai, DOCUMENT_MUR: DOCUMENT };
});

import { Comite } from './Comite';

describe('le mur rend un post-it importé du formulaire (#177)', () => {
  it('affiche la famille, le titre, le texte, le pseudo, le statut et la version', () => {
    render(
      <MemoryRouter>
        <Comite />
      </MemoryRouter>
    );

    // « OUF » apparaît aussi dans la légende : le post-it le porte en plus.
    expect(screen.getAllByText('OUF').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Le bouton Fin du tour reste grisé')).toBeInTheDocument();
    expect(screen.getByText(/J’étais au combat/)).toBeInTheDocument();
    expect(screen.getByText(/Capture : https:\/\/exemple\.test\/capture\.png/)).toBeInTheDocument();
    expect(screen.getByText('anonyme')).toBeInTheDocument();
    expect(screen.getByText('en attente')).toBeInTheDocument();
    expect(screen.getByText('Écrit en Alpha · 0.1.4')).toBeInTheDocument();
  });
});
