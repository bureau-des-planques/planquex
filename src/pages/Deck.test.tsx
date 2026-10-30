// @vitest-environment jsdom
// Lent : à la limite des 5 s, chaque cas rend l'écran du Deck dans jsdom avec le catalogue entier ; le coût est le rendu.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { ALL_CARDS } from '@/data';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { deckLegal } from '@/game/deck';

describe('Deck — écran du Deck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre avec le nombre de cartes dans le Deck', () => {
    const deck = ['sse-infirmier-site', 'management-responsable-unite'];
    renderWithStore(<Deck />, { deck, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/2\/20 cartes/)).toBeInTheDocument();
  });

  it('affiche les boutons Remplir et Vider', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByRole('button', { name: /Remplir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vider/i })).toBeInTheDocument();
  });

  it('affiche le sélecteur de types de café', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Machine à café/i)).toBeInTheDocument();
    expect(screen.getByText(/Proposition automatique/i)).toBeInTheDocument();
  });

  it('nomme la section « Decks proposés », sans le mot retiré par D-075', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    const section = screen.getByRole('heading', { name: /Decks proposés/i }).closest('section') as HTMLElement;
    expect(within(section).getByText(/Des Decks prêts à jouer/)).toBeInTheDocument();
    // Le mot retiré par D-075 ne revient pas à l'écran : c'est `src/renommages.test.ts` qui le garde.
  });

  it('charge un Deck proposé en un geste : 20 cartes légales et ses types de café, sans Collection', () => {
    renderWithStore(<Deck />, { deck: [], owned: {}, tutorielVu: true, pasAPasCombatVu: true });
    const deckPropose = DECKS_PROPOSES[0];

    expect(screen.getByText(deckPropose.strategie)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(deckPropose.faiblesse.slice(0, 20)))).toBeInTheDocument();

    const item = screen.getByText(deckPropose.name).closest('li') as HTMLElement;
    fireEvent.click(within(item).getByRole('button', { name: /Charger/i }));

    const state = useStore.getState();
    expect(state.deck).toEqual([...deckPropose.cartes]);
    expect(deckLegal(state.deck).ok).toBe(true);
    expect(state.cafeTypes).toEqual([...deckPropose.cafeTypes]);
  });

  it('permet de cocher et décocher un type de café via le groupe café-picker', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    const group = screen.getByRole('group', { name: /Types de café du Deck/i });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    const sseButton = buttons.find((b) => b.textContent?.includes('SSE'));
    expect(sseButton).toBeTruthy();
    expect(sseButton!).not.toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(sseButton!);
    expect(sseButton!).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(sseButton!);
    expect(sseButton!).not.toHaveAttribute('aria-pressed', 'true');
  });

  it('plafonne à 3 types de café', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    const group = screen.getByRole('group', { name: /Types de café du Deck/i });
    const buttons = within(group).getAllByRole('button');

    let checked = 0;
    for (const btn of buttons) {
      if ((btn as HTMLButtonElement).disabled === false && checked < 3) {
        fireEvent.click(btn);
        expect(btn).toHaveAttribute('aria-pressed', 'true');
        checked++;
      }
    }
    expect(checked).toBe(3);

    const remainingEnabled = buttons.filter(
      (b) => (b as HTMLButtonElement).disabled === false && !b.getAttribute('aria-pressed')
    );
    expect(remainingEnabled.length).toBe(0);
  });

  it('affiche la proposition automatique basée sur le Deck', () => {
    const deck = ['sse-infirmier-site', 'management-responsable-unite'];
    renderWithStore(<Deck />, { deck, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Proposition automatique : SSE, MGT/i)).toBeInTheDocument();
  });

  it('remplit le Deck via le bouton Remplir', () => {
    const owned: Record<string, number> = {};
    for (const card of ALL_CARDS) {
      if (['1D', '2D'].includes(card.rarity)) {
        owned[card.id] = 2;
      }
    }

    renderWithStore(<Deck />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    const fillButton = screen.getByRole('button', { name: /Remplir/i });
    expect(fillButton).not.toBeDisabled();

    fireEvent.click(fillButton);

    const state = useStore.getState();
    expect(state.deck.length).toBe(20);
  });

  it('vide le Deck via le bouton Vider', () => {
    const deck = ['sse-infirmier-site', 'management-responsable-unite'];
    renderWithStore(<Deck />, { deck, tutorielVu: true, pasAPasCombatVu: true });

    const clearButton = screen.getByRole('button', { name: /Vider/i });
    fireEvent.click(clearButton);

    const state = useStore.getState();
    expect(state.deck).toEqual([]);
  });

  it('affiche la section "Dedans" avec le nombre de cartes', () => {
    const deck = ['sse-infirmier-site'];
    renderWithStore(<Deck />, { deck, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Dedans \(1\)/i)).toBeInTheDocument();
  });

  it('affiche les erreurs de validation pour un Deck vide', () => {
    renderWithStore(<Deck />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Il faut au moins un Planqué Entrant/i)).toBeInTheDocument();
  });
});

/** Les ids des cartes d'une section du Deck, dans l'ordre où l'écran les range. */
function ordreDe(section: HTMLElement): string[] {
  return Array.from(section.querySelectorAll<HTMLElement>('.card-slot')).map((slot) => slot.dataset.cardId ?? '');
}

describe('Deck — tri et gabarit (#179)', () => {
  // Quatre cartes possédées, dans un ordre qui n'est ni celui du nom ni celui de la rareté.
  const choisies = ALL_CARDS.filter((carte) => ['1D', '2D', '3D'].includes(carte.rarity)).slice(0, 40);
  const owned = Object.fromEntries(choisies.map((carte) => [carte.id, 1]));
  const deck = [choisies[30].id, choisies[3].id, choisies[17].id, choisies[9].id];
  const reglage = { owned, deck, tutorielVu: true, pasAPasCombatVu: true };

  const sectionDedans = () => screen.getByRole('heading', { name: /Dedans/ }).closest('section') as HTMLElement;
  const sectionCollection = () =>
    screen.getByRole('heading', { name: /^Collection/ }).closest('section') as HTMLElement;

  it('le tri range « Dedans » et « Collection » avec le même choix', () => {
    renderWithStore(<Deck />, reglage);
    const dedansAvant = ordreDe(sectionDedans());
    const collectionAvant = ordreDe(sectionCollection());
    expect(dedansAvant).toEqual(deck);

    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'nom' } });

    const dedans = ordreDe(sectionDedans());
    const collection = ordreDe(sectionCollection());
    expect(dedans).not.toEqual(dedansAvant);
    expect(collection).not.toEqual(collectionAvant);
    for (const ordre of [dedans, collection]) {
      const noms = ordre.map((id) => ALL_CARDS.find((c) => c.id === id)!.name);
      expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
    }
  });

  it('« Réinitialiser » rend l’ordre du Deck et celui de la Collection', () => {
    renderWithStore(<Deck />, reglage);
    const dedansAvant = ordreDe(sectionDedans());
    const collectionAvant = ordreDe(sectionCollection());
    const reinit = screen.getByRole('button', { name: /Réinitialiser le tri/i });
    expect(reinit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'rarete' } });
    expect(reinit).toBeEnabled();
    fireEvent.click(reinit);

    expect(screen.getByLabelText(/Trier par/i)).toHaveValue('defaut');
    expect(ordreDe(sectionDedans())).toEqual(dedansAvant);
    expect(ordreDe(sectionCollection())).toEqual(collectionAvant);
  });

  it('les cartes du Deck portent la pastille « Deck » ; celles de la Collection, leur possession', () => {
    renderWithStore(<Deck />, reglage);
    const slot = sectionDedans().querySelector<HTMLElement>(`.card-slot[data-card-id="${deck[0]}"]`)!;
    expect(within(slot).getByText('Deck ×1')).toBeInTheDocument();

    const enCollection = sectionCollection().querySelector<HTMLElement>(
      `.card-slot[data-card-id="${choisies[0].id}"]`
    )!;
    expect(within(enCollection).getByText('×1')).toBeInTheDocument();
    expect(enCollection).not.toHaveClass('is-missing');
  });
});

describe('Deck — les panneaux longs se replient', () => {
  const base = { tutorielVu: true, pasAPasCombatVu: true };
  const volet = (titre: RegExp) =>
    screen.getByRole('heading', { name: titre }).closest('details') as HTMLDetailsElement;

  it('Deck vide : les Decks proposés sont ouverts (on commence là), le partage est replié', () => {
    renderWithStore(<Deck />, { ...base, deck: [] });
    expect(volet(/Decks proposés/).open).toBe(true);
    expect(volet(/Partager le Deck/).open).toBe(false);
  });

  it('Deck commencé : les Decks proposés se replient aussi (le contrôle mord : seul le Deck vide les ouvre)', () => {
    renderWithStore(<Deck />, { ...base, deck: ['sse-infirmier-site'] });
    expect(volet(/Decks proposés/).open).toBe(false);
    // Replié n'est pas retiré : les Decks restent dans la page, prêts à s'ouvrir.
    expect(screen.getAllByRole('button', { name: 'Charger' })).toHaveLength(DECKS_PROPOSES.length);
  });
});
