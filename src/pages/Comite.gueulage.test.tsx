// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * D-085 : le gueulage est **à part**, et le post-it qu'il a produit se **colle** dessus.
 *
 * Le document est conforme au contrat (`lireMur` est le vrai) : le gueulage ne porte
 * **aucune** famille, et `lie` désigne l'OUF de la même réponse. L'écran doit donc :
 * - étiqueter « Gueulage » — jamais « Gueulage · OUF » ;
 * - rendre l'OUF **dans** le gueulage, et **pas** comme un post-it libre de plus.
 *
 * `DOCUMENT_MUR` est mocké : la page le lit une fois, à l'import du module.
 */
const DOCUMENT = vi.hoisted(() => ({
  formulaire: 'https://exemple.test/formulaire',
  postits: [
    {
      id: 'p-gueule',
      titre: "c'est de la merde ton jeux",
      texte: "Titre fabriqué avec les premiers mots du message.\n\nc'est de la merde ton jeux",
      ecran: '',
      pseudo: 'Moi',
      version: 'je sais pas',
      statut: 'en attente',
      raison: '',
      ticket: null,
      gueulage: true,
      lie: 'p-ouf',
      position: { x: 8, y: 6, angle: 1 },
      votes: { up: 0, down: 0 }
    },
    {
      id: 'p-ouf',
      kind: 'OUF',
      titre: 'Le bouton Fin du tour reste grisé',
      texte: 'Ce que tu faisais : j’étais au combat.',
      ecran: 'Combat',
      pseudo: "L'autre",
      version: 'Alpha · 0.1.4',
      statut: 'retenu',
      raison: '',
      ticket: null,
      gueulage: false,
      lie: null,
      position: { x: 40, y: 6, angle: -2 },
      votes: { up: 0, down: 0 }
    },
    {
      id: 'p-ip',
      kind: 'IP',
      titre: 'Voir combien d’Arrivages il reste',
      texte: 'Un compteur dans la Collection.',
      ecran: 'Collection',
      pseudo: 'Employé 404',
      version: 'Alpha · 0.1.4',
      statut: 'en attente',
      raison: '',
      ticket: null,
      gueulage: false,
      lie: null,
      position: { x: 70, y: 6, angle: 2 },
      votes: { up: 0, down: 0 }
    }
  ]
}));

vi.mock('@/store/mur', async () => {
  const vrai = await vi.importActual<typeof import('@/store/mur')>('@/store/mur');
  return { ...vrai, DOCUMENT_MUR: DOCUMENT };
});

import { Comite } from './Comite';

function rendre() {
  return render(
    <MemoryRouter>
      <Comite />
    </MemoryRouter>
  );
}

describe('le gueulage est une nature à part (D-085)', () => {
  it('l’étiquette dit « Gueulage », et jamais « IP » ni « OUF »', () => {
    rendre();

    const gueulage = screen.getByText("c'est de la merde ton jeux").closest<HTMLElement>('[data-postit]');
    expect(gueulage).not.toBeNull();
    expect(within(gueulage as HTMLElement).getByText('Gueulage')).toBeInTheDocument();
    // Une seule étiquette « Gueulage » sur la page : la légende écrit « un gueulage ».
    expect(screen.getAllByText('Gueulage')).toHaveLength(1);
    expect(gueulage?.textContent).not.toMatch(/\b(IP|OUF)\b/);
  });

  it('colle l’OUF associé sur le gueulage, et ne l’affiche pas ailleurs', () => {
    rendre();

    const gueulage = screen.getByText("c'est de la merde ton jeux").closest<HTMLElement>('[data-postit]');
    // Le post-it associé est **dans** le gueulage : titre, statut et pseudo.
    expect(within(gueulage as HTMLElement).getByText('Le bouton Fin du tour reste grisé')).toBeInTheDocument();
    expect(within(gueulage as HTMLElement).getByText('retenu')).toBeInTheDocument();
    expect(within(gueulage as HTMLElement).getByText("L'autre")).toBeInTheDocument();

    // Et il n'existe **pas** de second post-it libre à son id : une seule occurrence.
    expect(screen.getAllByText('Le bouton Fin du tour reste grisé')).toHaveLength(1);
    expect(document.querySelector('[data-postit="p-ouf"]')).toBeNull();

    // Le post-it libre, lui, reste à sa place.
    expect(screen.getByText('Voir combien d’Arrivages il reste')).toBeInTheDocument();
  });
});
