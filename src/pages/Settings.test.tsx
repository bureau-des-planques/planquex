// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from './Settings';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { APP_LABEL } from '@/version';

describe('Settings — écran des Réglages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre "Ton poste de travail"', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ton poste de travail/)).toBeInTheDocument();
  });

  it('affiche la section Identité avec le nom actuel', () => {
    renderWithStore(<Settings />, { name: 'Testeur', tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Identité/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Testeur')).toBeInTheDocument();
  });

  it('permet de changer le nom', () => {
    renderWithStore(<Settings />, { name: 'Testeur', tutorielVu: true, pasAPasCombatVu: true });

    const input = screen.getByDisplayValue('Testeur');
    fireEvent.change(input, { target: { value: 'Nouveau Nom' } });

    const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    const state = useStore.getState();
    expect(state.name).toBe('Nouveau Nom');
  });

  it('désactive le bouton Enregistrer si le nom n\'a pas changé', () => {
    renderWithStore(<Settings />, { name: 'Testeur', tutorielVu: true, pasAPasCombatVu: true });

    const saveButton = screen.getByRole('button', { name: /Enregistrer/i });
    expect(saveButton).toBeDisabled();
  });

  it('affiche la section Affichage avec l\'option Réduire les animations', () => {
    renderWithStore(<Settings />, { reducedMotion: false, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Affichage/)).toBeInTheDocument();
    expect(screen.getByText(/Réduire les animations/)).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', { name: /Réduire les animations/i });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const state = useStore.getState();
    expect(state.reducedMotion).toBe(true);
  });

  it('coche « Raccourcis clavier au combat » par défaut, et la décoche (#189)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const checkbox = screen.getByRole('checkbox', { name: /Raccourcis clavier au combat/i });
    expect(checkbox).toBeChecked();
    expect(useStore.getState().raccourcisCombat).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(useStore.getState().raccourcisCombat).toBe(false);
  });

  it('affiche la section Journée d\'intégration', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Journée d.intégration/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoir la journée d.intégration/i })).toBeInTheDocument();
  });

  it('remet le tutoriel à false au clic sur "Revoir la journée d\'intégration"', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const button = screen.getByRole('button', { name: /Revoir la journée d.intégration/i });
    fireEvent.click(button);

    const state = useStore.getState();
    expect(state.tutorielVu).toBe(false);
  });

  it('affiche la section Pas-à-pas du combat', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Pas-à-pas du combat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoir le pas-à-pas du combat/i })).toBeInTheDocument();
  });

  it('remet le pas-à-pas à false au clic', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const button = screen.getByRole('button', { name: /Revoir le pas-à-pas du combat/i });
    fireEvent.click(button);

    const state = useStore.getState();
    expect(state.pasAPasCombatVu).toBe(false);
  });

  it('affiche la section Sauvegarde', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Sauvegarde/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer ma sauvegarde/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restaurer ce texte/i })).toBeInTheDocument();
  });

  it('crée une sauvegarde et l\'affiche dans le textarea', async () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    const createButton = screen.getByRole('button', { name: /Créer ma sauvegarde/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Ta sauvegarde apparaîtra ici/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('bureau-des-planques');
    });
  });

  it('dit que les parties solo terminées sont gardées sous le compte, sans case à cocher (D-086, D-088)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/parties solo terminées sont gardées sous ton compte/i)).toBeInTheDocument();
    // D-086 : une **mention**, pas un consentement par combat — aucune case ne concerne
    // les traces. Les deux cases de l'écran sont des réglages d'affichage : le mouvement
    // réduit, et les raccourcis clavier du combat (#189).
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    for (const nom of [/Réduire les animations/i, /Raccourcis clavier au combat/i]) {
      expect(screen.getByRole('checkbox', { name: nom })).toBeInTheDocument();
    }
  });

  it('affiche la section Données locales avec le bouton Réinitialiser', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Données locales/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réinitialiser la progression/i })).toBeInTheDocument();
  });

  it('affiche la version de l\'application', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Version/)).toBeInTheDocument();
    expect(screen.getByText(APP_LABEL)).toBeInTheDocument();
  });

  it('mène à la page des nouveautés depuis la section Version (D-090)', () => {
    renderWithStore(<Settings />, { tutorielVu: true, pasAPasCombatVu: true });

    // Le libellé seul ne dit pas ce que la version contient : la section Version doit
    // mener à l'écran qui le dit, sinon la note reste invisible depuis le jeu.
    const lien = screen.getByRole('link', { name: /la page des nouveautés/i });
    expect(lien).toHaveAttribute('href', '/nouveautes');
  });
});