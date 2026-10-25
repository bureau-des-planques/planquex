// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { setupTestStore } from '@/test/test-utils';

function aLAdresse(chemin: string) {
  setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
    </MemoryRouter>
  );
}

describe('App — le mouvement réduit relié au CSS (#192)', () => {
  it('le réglage du store pose l’attribut que `styles.css` lit sur la racine', () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, reducedMotion: true });
    const premier = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(document.documentElement).toHaveAttribute('data-mouvement-reduit', 'true');
    premier.unmount();
  });

  it('sans le réglage, l’attribut dit faux — et le média reste la seconde demande', () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, reducedMotion: false });
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(document.documentElement).toHaveAttribute('data-mouvement-reduit', 'false');
  });
});

describe('App — les adresses (#131)', () => {
  it('une adresse inconnue le dit, et ne se fait pas passer pour l’Accueil', () => {
    aLAdresse('/couloir-inexistant');
    expect(screen.getByRole('heading', { level: 1, name: /ne mène nulle part/ })).toBeInTheDocument();
    expect(screen.getByText('/couloir-inexistant')).toBeInTheDocument();
    // Ni le titre de l'Accueil, ni son bouton d'Arrivage.
    expect(screen.queryByText(/Ton atelier\./)).toBeNull();
    expect(screen.queryByRole('button', { name: /Ouvrir un Arrivage/ })).toBeNull();
    // La sortie existe : un lien vers l'accueil (en plus de l'onglet de la barre).
    expect(screen.getByRole('link', { name: /Retour à l’accueil/ })).toHaveAttribute('href', '/');
  });

  it('la racine reste l’Accueil', () => {
    aLAdresse('/');
    expect(screen.getByText(/Ton atelier\./)).toBeInTheDocument();
    expect(screen.queryByText(/ne mène nulle part/)).toBeNull();
  });

  it('une ancienne adresse redirige toujours (D-075), elle ne tombe pas dans l’erreur', () => {
    aLAdresse('/parc');
    expect(screen.queryByText(/ne mène nulle part/)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /cartes/ })).toBeInTheDocument();
  });
});
