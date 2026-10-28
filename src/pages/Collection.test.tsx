// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Collection } from './Collection';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { ALL_CARDS, isPlanque } from '@/data';

describe('Collection — écran de la Collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre avec le nombre de cartes possédées', () => {
    const owned = { 'sse-infirmier-site': 2, 'management-responsable-unite': 1 };
    renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    // Le **total** se dérive d'`ALL_CARDS`, il ne se recopie pas : #352 a fait passer le
    // catalogue de 300 à 308, et ce test annonçait encore « 300 ».
    const total = ALL_CARDS.length;
    expect(screen.getByText(new RegExp(`2/${total} cartes`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${total} affichés`))).toBeInTheDocument();
  });

  it('affiche les filtres de recherche', () => {
    renderWithStore(<Collection />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByPlaceholderText(/Chercher une carte/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Faction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stade/i)).toBeInTheDocument();
  });

  it('filtre les cartes par recherche textuelle', () => {
    const owned = { 'sse-infirmier-site': 1 };
    renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    const searchInput = screen.getByPlaceholderText(/Chercher une carte/i);
    fireEvent.input(searchInput, { target: { value: 'infirmier' } });

    expect(screen.getByText(/Infirmier de site/)).toBeInTheDocument();
  });

  it('filtre les cartes par faction', () => {
    const owned = { 'sse-infirmier-site': 1, 'management-responsable-unite': 1 };
    renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    const factionSelect = screen.getByLabelText(/Faction/i);
    fireEvent.change(factionSelect, { target: { value: 'SSE' } });

    expect(factionSelect).toHaveValue('SSE');
    expect(screen.getByText(/Infirmier de site/)).toBeInTheDocument();
    expect(screen.queryByText(/Responsable d'unité/)).not.toBeInTheDocument();
  });

  it('filtre les cartes par stade', () => {
    const owned = { 'sse-infirmier-site': 1 };
    renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    const stageSelect = screen.getByLabelText(/Stade/i);
    fireEvent.change(stageSelect, { target: { value: 'ENTRANT' } });

    expect(stageSelect).toHaveValue('ENTRANT');
    expect(screen.getByText(/Infirmier de site/)).toBeInTheDocument();
  });

  it('affiche un message quand aucune carte ne correspond', () => {
    renderWithStore(<Collection />, { tutorielVu: true, pasAPasCombatVu: true });

    const searchInput = screen.getByPlaceholderText(/Chercher une carte/i);
    fireEvent.input(searchInput, { target: { value: 'carteinexistante123' } });

    expect(screen.getByText(/Aucune carte ne correspond/i)).toBeInTheDocument();
  });

  it('ajoute une carte au Deck via le bouton +', () => {
    const entrant = ALL_CARDS.find(
      (c) => isPlanque(c) && c.stage === 'ENTRANT' && !c.ex && c.id === 'sse-infirmier-site'
    );
    expect(entrant).toBeTruthy();

    renderWithStore(<Collection />, { tutorielVu: true, pasAPasCombatVu: true });

    const cardButtons = screen.getAllByRole('button', { name: /Infirmier de site/i });
    const cardViewButton = cardButtons[0];
    const cardSlot = cardViewButton.closest('.card-slot') as HTMLElement;
    const addButton = within(cardSlot).getByRole('button', { name: /Ajouter/i });
    fireEvent.click(addButton);

    const state = useStore.getState();
    expect(state.deck).toContain(entrant!.id);
  });

  it('ouvre la fiche de détail au clic sur une carte', () => {
    const owned = { 'sse-infirmier-site': 1 };
    renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    const cardButtons = screen.getAllByRole('button', { name: /Infirmier de site/i });
    const cardViewButton = cardButtons[0];
    fireEvent.click(cardViewButton);

    expect(screen.getByRole('heading', { name: /Infirmier de site/ })).toBeInTheDocument();
    expect(screen.getByText(/Seuil/)).toBeInTheDocument();
  });

  it('indique les cartes déjà dans le Deck', () => {
    const entrant = ALL_CARDS.find(
      (c) => isPlanque(c) && c.stage === 'ENTRANT' && !c.ex && c.id === 'sse-infirmier-site'
    );
    expect(entrant).toBeTruthy();

    renderWithStore(<Collection />, { deck: [entrant!.id], tutorielVu: true, pasAPasCombatVu: true });

    const cardButtons = screen.getAllByRole('button', { name: /Infirmier de site/i });
    const cardViewButton = cardButtons[0];
    const cardSlot = cardViewButton.closest('.card-slot') as HTMLElement;
    expect(cardSlot).toHaveClass('card-slot');
    // La possession (×1) et le Deck (« Deck ×1 ») sont deux pastilles, pas une seule.
    expect(within(cardSlot).getByText('Deck ×1')).toBeInTheDocument();
  });
});

/** Les ids des cartes de la grille, dans l'ordre où l'écran les range. */
function ordreDeLaGrille(conteneur: HTMLElement): string[] {
  return Array.from(conteneur.querySelectorAll<HTMLElement>('.card-slot')).map((slot) => slot.dataset.cardId ?? '');
}

describe('Collection — tri (#179)', () => {
  const derniere = ALL_CARDS[ALL_CARDS.length - 1];
  const owned = { [derniere.id]: 3, 'management-responsable-unite': 1 };
  const reglage = { owned, tutorielVu: true, pasAPasCombatVu: true };

  it('propose les cinq tris et « par défaut », « par défaut » étant le choix de départ', () => {
    renderWithStore(<Collection />, reglage);
    const tri = screen.getByLabelText(/Trier par/i) as HTMLSelectElement;
    expect(tri).toHaveValue('defaut');
    const libelles = within(tri)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(libelles).toEqual(['Par défaut', 'Faction', 'Stade', 'Rareté', 'Nom', 'Possédées d’abord']);
  });

  it('un tri change l’ordre de la grille', () => {
    const { container } = renderWithStore(<Collection />, reglage);
    const parDefaut = ordreDeLaGrille(container);
    expect(parDefaut).toHaveLength(ALL_CARDS.length);

    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'nom' } });
    const parNom = ordreDeLaGrille(container);

    expect(parNom).not.toEqual(parDefaut);
    const noms = parNom.map((id) => ALL_CARDS.find((c) => c.id === id)!.name);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('« possédées d’abord » met la carte possédée en tête de grille', () => {
    const { container } = renderWithStore(<Collection />, reglage);
    expect(ordreDeLaGrille(container)[0]).not.toBe(derniere.id);

    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'possedees' } });
    const ordre = ordreDeLaGrille(container);
    expect(ordre[0]).toBe(derniere.id);
    expect(ordre[1]).toBe('management-responsable-unite');
  });

  it('le tri garde les filtres : il range ce qui est affiché, rien de plus', () => {
    const { container } = renderWithStore(<Collection />, reglage);
    fireEvent.change(screen.getByLabelText(/Faction/i), { target: { value: 'SSE' } });
    const avant = ordreDeLaGrille(container).length;
    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'rarete' } });
    expect(ordreDeLaGrille(container)).toHaveLength(avant);
  });

  it('le choix reste visible, et « Réinitialiser » le rend à « par défaut »', () => {
    const { container } = renderWithStore(<Collection />, reglage);
    const parDefaut = ordreDeLaGrille(container);
    const reinit = screen.getByRole('button', { name: /Réinitialiser le tri/i });
    expect(reinit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'rarete' } });
    expect(screen.getByLabelText(/Trier par/i)).toHaveValue('rarete');
    expect(reinit).toBeEnabled();
    expect(ordreDeLaGrille(container)).not.toEqual(parDefaut);

    fireEvent.click(reinit);
    expect(screen.getByLabelText(/Trier par/i)).toHaveValue('defaut');
    expect(ordreDeLaGrille(container)).toEqual(parDefaut);
    expect(reinit).toBeDisabled();
  });
});

describe('Collection — cartes possédées lisibles (#179)', () => {
  const owned = { 'sse-infirmier-site': 2 };

  function slotDe(id: string, conteneur: HTMLElement): HTMLElement {
    const slot = conteneur.querySelector<HTMLElement>(`.card-slot[data-card-id="${id}"]`);
    expect(slot, `la carte ${id} est dans la grille`).not.toBeNull();
    return slot!;
  }

  it('une carte non possédée porte la classe d’atténuation et écrit « ×0 » et « Non possédée »', () => {
    const { container } = renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });
    const absente = slotDe('management-responsable-unite', container);
    expect(absente).toHaveClass('is-missing');
    expect(within(absente).getByText('×0')).toBeInTheDocument();
    expect(within(absente).getByText('Non possédée')).toBeInTheDocument();
  });

  it('une carte possédée n’est pas atténuée et affiche son nombre d’exemplaires', () => {
    const { container } = renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });
    const presente = slotDe('sse-infirmier-site', container);
    expect(presente).not.toHaveClass('is-missing');
    expect(within(presente).getByText('×2')).toBeInTheDocument();
    expect(within(presente).queryByText('Non possédée')).not.toBeInTheDocument();
  });

  it('seules les cartes absentes sont atténuées : autant de classes que de cartes à zéro', () => {
    const { container } = renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });
    expect(container.querySelectorAll('.card-slot.is-missing')).toHaveLength(ALL_CARDS.length - 1);
  });
});
