// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';

describe('Battle — écran de combat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre "Combat" et le tour initial', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Combat/)).toBeInTheDocument();
    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();
  });

  it('affiche l\'indicateur de tour (à toi / à la Direction)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/à (toi|la Direction)/)).toBeInTheDocument();
  });

  it('affiche les sections principales du plateau', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const headings = screen.getAllByRole('heading', { level: 2 });
    const campHeadings = headings.filter((h) => h.textContent?.includes('Toi') || h.textContent?.includes('Direction'));
    expect(campHeadings.length).toBe(2);
  });

  it('affiche le Poste et le Rack (labels)', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const posteLabels = screen.getAllByText(/Poste/);
    const rackLabels = screen.getAllByText(/Rack/);
    expect(posteLabels.length).toBeGreaterThanOrEqual(2);
    expect(rackLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('affiche la Machine à café pour chaque camp', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const machines = screen.getAllByText(/Machine/);
    expect(machines.length).toBeGreaterThanOrEqual(2);
  });

  it('affiche la main du joueur', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ta main/)).toBeInTheDocument();
  });

  it('affiche la section Conditions', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Conditions/)).toBeInTheDocument();
    expect(screen.getByText(/ce qu.un Planqué au Poste peut subir/i)).toBeInTheDocument();
  });

  it('ouvre le dialogue Règles au clic sur le bouton', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const rulesButton = screen.getByRole('button', { name: /Règles/i });
    fireEvent.click(rulesButton);

    expect(screen.getByRole('dialog', { name: /Conditions/i })).toBeInTheDocument();
  });

  it('affiche le bouton Nouveau combat', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByRole('button', { name: /Nouveau combat/i })).toBeInTheDocument();
  });

  it('affiche le bouton Abandonner', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByRole('button', { name: /Abandonner/i })).toBeInTheDocument();
  });

  it('affiche la section Journal', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Journal/)).toBeInTheDocument();
  });

  it('affiche la section Partie à deux avec le bouton Créer', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Partie à deux/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer une partie à deux/i })).toBeInTheDocument();
  });

  it('redémarre le combat au clic sur Nouveau combat', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    const restartButton = screen.getByRole('button', { name: /Nouveau combat/i });
    fireEvent.click(restartButton);

    expect(screen.getByText(/Tour 1/)).toBeInTheDocument();
  });

  it('affiche le message d\'avertissement si le deck n\'est pas valide', () => {
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/deck de test/i)).toBeInTheDocument();
  });
});