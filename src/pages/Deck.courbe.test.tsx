// @vitest-environment jsdom
// Lenteur justifiée (D-143 (5)) — l'écran Deck sous jsdom, cas par cas sur la courbe de coût (#364)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS, getCard } from '@/data';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { filtrerCartes, FILTRES_DEFAUT } from '@/components/filtres-collection';
import type { Card } from '@/data/types';

/**
 * La courbe forcée du test « Coût 0 » (#555) : **aucune carte du set vivant** ne coûte 0, et
 * c'est justement le cas que la ligne retirée nommait. Le mock ne sert qu'à le produire ; par
 * défaut, la courbe est la vraie.
 */
const courbeForcee = vi.hoisted(() => ({
  valeur: null as null | {
    barres: { cout: number; cartes: number }[];
    plusHaute: number;
    actions: number;
    zero: string[];
  }
}));

vi.mock('@/components/courbe-deck', async () => {
  const vrai = await vi.importActual<typeof import('@/components/courbe-deck')>('@/components/courbe-deck');
  return {
    ...vrai,
    courbeDeck: (cartes: readonly Card[]) => courbeForcee.valeur ?? vrai.courbeDeck(cartes)
  };
});

const coupDeMarteau = DECKS_PROPOSES.find((d) => d.id === 'coup-de-marteau')!;
const toutePossedee = Object.fromEntries(ALL_CARDS.map((carte) => [carte.id, 1]));

/** La zone « Collection — ajouter une carte » : le sélecteur et son compte. */
const selecteur = () => screen.getByRole('heading', { name: /ajouter une carte/i }).closest('section') as HTMLElement;

describe('Deck — la courbe de coût à l’écran (#364)', () => {
  afterEach(() => {
    courbeForcee.valeur = null;
  });

  it('un Deck connu donne des barres connues : 8, 10 et 0 cartes aux coûts 1, 2 et 3', () => {
    renderWithStore(<Deck />, {
      deck: [...coupDeMarteau.cartes],
      owned: toutePossedee,
      tutorielVu: true,
      pasAPasCombatVu: true
    });

    const courbe = screen.getByRole('heading', { name: 'Courbe de coût' }).closest('section') as HTMLElement;
    const barres = within(courbe)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(barres).toEqual(['1 café8', '2 cafés10', '3 cafés0']);
    expect(within(courbe).getByText(/2 cartes Action/)).toBeInTheDocument();
  });

  it('le compte dit ce qui manque pour atteindre 20, puis « Deck complet »', () => {
    const { unmount } = renderWithStore(<Deck />, {
      deck: ['sse-infirmier-site', 'management-responsable-unite'],
      owned: toutePossedee,
      tutorielVu: true,
      pasAPasCombatVu: true
    });
    expect(selecteur().querySelector('.deck-compte')?.textContent).toContain('il en manque 18');
    unmount();

    renderWithStore(<Deck />, {
      deck: [...coupDeMarteau.cartes],
      owned: toutePossedee,
      tutorielVu: true,
      pasAPasCombatVu: true
    });
    expect(document.querySelector('.deck-compte')?.textContent).toContain('Deck complet');
  });

  it('le filtre de coût restreint la recherche, et le compte suit le filtre', () => {
    renderWithStore(<Deck />, { owned: toutePossedee, tutorielVu: true, pasAPasCombatVu: true });
    const toutes = filtrerCartes(ALL_CARDS, FILTRES_DEFAUT, toutePossedee).length;

    fireEvent.change(within(selecteur()).getByLabelText('Coût en café'), { target: { value: '3' } });

    const attendues = filtrerCartes(ALL_CARDS, { ...FILTRES_DEFAUT, cout: 3 }, toutePossedee).length;
    expect(attendues).toBeGreaterThan(0);
    expect(attendues).toBeLessThan(toutes);
    expect(selecteur().querySelector('.deck-compte')?.textContent).toContain(`${attendues} cartes trouvées`);
    expect(selecteur().querySelector('.filtres-actifs')?.textContent).toContain('1 filtre actif');
  });

  it('le filtre de rareté ne montre que cette rareté', () => {
    renderWithStore(<Deck />, { owned: toutePossedee, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.change(within(selecteur()).getByLabelText('Rareté'), { target: { value: '1D' } });

    const slots = selecteur().querySelectorAll('.card-slot');
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      const id = slot.getAttribute('data-card-id')!;
      expect(getCard(id)?.rarity).toBe('1D');
    });
  });

  it('une recherche sans résultat dit ce qu’elle cherche, au lieu d’une zone vide', () => {
    renderWithStore(<Deck />, { owned: toutePossedee, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.change(within(selecteur()).getByPlaceholderText(/Chercher dans ma Collection/i), {
      target: { value: 'zzzz-introuvable' }
    });

    const message = screen.getByRole('status');
    expect(message.textContent).toContain('Aucune carte de ta Collection ne correspond à cette recherche');
    expect(within(message).getByText(/Retire un filtre/)).toBeInTheDocument();
  });

  it('un filtre sans résultat nomme le filtre, et « Tout effacer » revient à la liste', () => {
    renderWithStore(<Deck />, { owned: toutePossedee, tutorielVu: true, pasAPasCombatVu: true });

    // Une rareté qu'aucune carte du catalogue ne porte au coût 3 en même temps : on pousse le
    // filtre jusqu'au vide avec la recherche d'un nom introuvable, puis on efface.
    fireEvent.change(within(selecteur()).getByPlaceholderText(/Chercher dans ma Collection/i), {
      target: { value: 'zzzz-introuvable' }
    });
    fireEvent.change(within(selecteur()).getByLabelText('Coût en café'), { target: { value: '2' } });
    expect(screen.getByRole('status').textContent).toContain('cette recherche et ces filtres');

    fireEvent.click(within(selecteur()).getByRole('button', { name: 'Tout effacer' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(selecteur().querySelectorAll('.card-slot').length).toBeGreaterThan(0);
  });

  it('une carte à coût 0 n’affiche pas de section « Coût 0 » (#555)', () => {
    // Aucune carte du set vivant ne coûte 0 : la ligne retirée (D-172) nommait un cas que la
    // donnée réelle ne produit jamais. On force la courbe sur ce cas — s'il revenait à l'écran,
    // ce test échouerait, ce qui est le seul intérêt d'un test sur une ligne absente.
    courbeForcee.valeur = {
      barres: [{ cout: 1, cartes: 0 }],
      plusHaute: 0,
      actions: 0,
      zero: ['Planqué gratuit']
    };
    renderWithStore(<Deck />, {
      deck: ['sse-infirmier-site'],
      owned: toutePossedee,
      tutorielVu: true,
      pasAPasCombatVu: true
    });

    const courbe = screen.getByRole('heading', { name: 'Courbe de coût' }).closest('section') as HTMLElement;
    expect(within(courbe).queryByText(/Coût 0/)).toBeNull();
    expect(courbe.querySelector('.deck-courbe__zero')).toBeNull();
  });
});
