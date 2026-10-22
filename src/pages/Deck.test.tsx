// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { ALL_CARDS } from '@/data';

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

    const remainingEnabled = buttons.filter((b) => (b as HTMLButtonElement).disabled === false && !b.getAttribute('aria-pressed'));
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