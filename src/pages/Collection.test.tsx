// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Collection } from './Collection';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { ALL_CARDS, isPlanque } from '@/data';

describe('Collection — écran du Parc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre avec le nombre de cartes possédées', () => {
    const owned = { 'sse-infirmier-site': 2, 'management-responsable-unite': 1 };
    renderWithStore(<Collection />, { owned, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/2\/300 cartes/)).toBeInTheDocument();
    expect(screen.getByText(/300 affichés/)).toBeInTheDocument();
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

  it('ajoute une carte au Chariot via le bouton +', () => {
    const entrant = ALL_CARDS.find((c) => isPlanque(c) && c.stage === 'ENTRANT' && !c.ex && c.id === 'sse-infirmier-site');
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

  it('indique les cartes déjà dans le Chariot', () => {
    const entrant = ALL_CARDS.find((c) => isPlanque(c) && c.stage === 'ENTRANT' && !c.ex && c.id === 'sse-infirmier-site');
    expect(entrant).toBeTruthy();

    renderWithStore(<Collection />, { deck: [entrant!.id], tutorielVu: true, pasAPasCombatVu: true });

    const cardButtons = screen.getAllByRole('button', { name: /Infirmier de site/i });
    const cardViewButton = cardButtons[0];
    const cardSlot = cardViewButton.closest('.card-slot') as HTMLElement;
    expect(cardSlot).toHaveClass('card-slot');
    expect(within(cardSlot).getByText('×1')).toBeInTheDocument();
  });
});