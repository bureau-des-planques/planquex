// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Home } from './Home';
import { useStore } from '@/store/useStore';
import { renderWithStore } from '@/test/test-utils';
import { simulerArrivage } from '@/test/arrivageDeTest';

describe("Home — écran d'accueil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // L'Arrivage s'ouvre par un appel au serveur (#651) : le faux serveur rend cinq cartes.
    simulerArrivage();
  });

  it('affiche le titre et les actions principales', () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ton atelier\./)).toBeInTheDocument();
    expect(screen.getByText(/Tes Interventions\./)).toBeInTheDocument();
    expect(screen.getByText(/Ta survie\./)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Ouvrir un Arrivage/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Affronter la Direction/i })).toBeInTheDocument();
  });

  it('affiche les statistiques de la Collection et du Deck', () => {
    const owned = { 'sse-psychologue': 2, 'management-responsable-unite': 1 };
    renderWithStore(<Home />, { owned, deck: ['sse-psychologue'], tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Collection/)).toBeInTheDocument();
    expect(screen.getByText(/Deck/)).toBeInTheDocument();
    expect(screen.getByText(/1\/20/)).toBeInTheDocument();
  });

  it('ouvre un Arrivage au clic et affiche le modal de révélation', async () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });

    const openButton = screen.getByRole('button', { name: /Ouvrir un Arrivage/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByText(/Arrivage : 5 cartes/i)).toBeInTheDocument();
    });

    const packReveal = screen.getByText(/Arrivage : 5 cartes/i).closest('div');
    const cards = packReveal?.querySelectorAll('.card') ?? [];
    expect(cards.length).toBe(5);

    const closeButton = screen.getByRole('button', { name: /Ranger dans la Collection/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText(/Arrivage : 5 cartes/i)).not.toBeInTheDocument();
    });
  });

  it('garde le tirage après la fermeture et le rejoue sans ouvrir de paquet', async () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/i }));
    await waitFor(() => {
      expect(screen.getByText(/Arrivage : 5 cartes/i)).toBeInTheDocument();
    });
    const ouverts = useStore.getState().packsOpened;

    // Fermer au milieu ne perd plus le tirage (D-170) : les cartes sont déjà acquises, mais le
    // seul écran qui dit *ce qu'on a gagné* ne doit pas disparaître pour de bon.
    fireEvent.click(screen.getByRole('button', { name: /Ranger dans la Collection/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Arrivage : 5 cartes/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Revoir le dernier Arrivage/i }));
    await waitFor(() => {
      expect(screen.getByText(/Arrivage : 5 cartes/i)).toBeInTheDocument();
    });
    // Le contrôle mord : revoir n'est pas rouvrir — aucun paquet de plus, aucune carte de plus.
    expect(useStore.getState().packsOpened).toBe(ouverts);
  });

  it("incrémente le compteur d'Arrivages ouverts", () => {
    renderWithStore(<Home />, { packsOpened: 3, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/3 Arrivages? ouvert/)).toBeInTheDocument();
  });

  it('le lien "Affronter la Direction" navigue vers /battle', () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });

    const link = screen.getByRole('link', { name: /Affronter la Direction/i });
    expect(link).toHaveAttribute('href', '/battle');
  });

  it("n'affiche pas le modal tant qu'aucun Arrivage n'est ouvert", () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.queryByText(/Arrivage : 5 cartes/i)).not.toBeInTheDocument();
  });
});
