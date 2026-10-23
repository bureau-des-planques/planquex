// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Un `lie` **qui ne résout pas** ne doit pas casser la page (D-085).
 *
 * Le contrôle du fichier signale déjà l'id absent (`src/store/mur.test.ts`) ; ici on
 * simule le cas où la page reçoit quand même le document, pour prouver que la résolution
 * est défensive : `id absent` → `associe` nul → le gueulage s'affiche **seul**.
 */
const MUR = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-gueule',
      kind: null,
      titre: "c'est de la merde ton jeux",
      texte: "Titre fabriqué avec les premiers mots du message.\n\nc'est de la merde ton jeux",
      ecran: '',
      pseudo: 'Moi',
      version: 'je sais pas',
      statut: 'en attente',
      raison: '',
      ticket: null,
      gueulage: true,
      lie: 'p-absent',
      position: { x: 8, y: 6, angle: 1 },
      votes: { up: 0, down: 0 }
    }
  ]
}));

vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return {
    ...vrai,
    lireMur: () => ({
      mur: MUR,
      erreurs: ['postits[0].lie : « p-absent » ne désigne aucun post-it du fichier']
    })
  };
});

import { BoiteAIdees } from './BoiteAIdees';

describe('un `lie` non résolu n’empêche pas le gueulage de s’afficher (D-085)', () => {
  it('affiche le gueulage seul, et signale l’id absent', () => {
    render(
      <MemoryRouter>
        <BoiteAIdees />
      </MemoryRouter>
    );

    const gueulage = screen.getByText("c'est de la merde ton jeux").closest<HTMLElement>('[data-postit]');
    expect(gueulage).not.toBeNull();
    expect(within(gueulage as HTMLElement).getByText('Gueulage')).toBeInTheDocument();
    // Aucun post-it collé : le gueulage est seul.
    expect(gueulage?.querySelector('[data-associe]')).toBeNull();
    // Le contrôle du fichier a parlé, lui : l'erreur est affichée.
    expect(screen.getByText(/ne désigne aucun post-it/)).toBeInTheDocument();
  });
});
