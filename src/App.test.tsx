// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { rendreApplication } from '@/test/test-utils';

async function aLAdresse(chemin: string) {
  return rendreApplication({ chemin });
}

describe('App — le mouvement réduit relié au CSS (#192)', () => {
  it('le réglage du store pose l’attribut que `styles.css` lit sur la racine', async () => {
    const premier = await rendreApplication({ chemin: '/', storeState: { reducedMotion: true } });
    expect(document.documentElement).toHaveAttribute('data-mouvement-reduit', 'true');
    premier.unmount();
  });

  it('sans le réglage, l’attribut dit faux — et le média reste la seconde demande', async () => {
    await rendreApplication({ chemin: '/', storeState: { reducedMotion: false } });
    expect(document.documentElement).toHaveAttribute('data-mouvement-reduit', 'false');
  });
});

describe('App — les adresses (#131)', () => {
  it('une adresse inconnue le dit, et ne se fait pas passer pour l’Accueil', async () => {
    await aLAdresse('/couloir-inexistant');
    expect(screen.getByRole('heading', { level: 1, name: /ne m\u00e8ne nulle part/ })).toBeInTheDocument();
    expect(screen.getByText('/couloir-inexistant')).toBeInTheDocument();
    // Ni le titre de l'Accueil, ni son bouton d'Arrivage.
    expect(screen.queryByText(/Ton atelier\./)).toBeNull();
    expect(screen.queryByRole('button', { name: /Ouvrir un Arrivage/ })).toBeNull();
    // La sortie existe : un lien vers l'accueil (en plus de l'onglet de la barre).
    expect(screen.getByRole('link', { name: /Retour \u00e0 l\u2019accueil/ })).toHaveAttribute('href', '/');
  });

  it('la racine reste l’Accueil', async () => {
    await aLAdresse('/');
    expect(screen.getByText(/Ton atelier\./)).toBeInTheDocument();
    expect(screen.queryByText(/ne m\u00e8ne nulle part/)).toBeNull();
  });

  it('une ancienne adresse redirige toujours (D-075), elle ne tombe pas dans l’erreur', async () => {
    await aLAdresse('/parc');
    expect(screen.queryByText(/ne m\u00e8ne nulle part/)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /cartes/ })).toBeInTheDocument();
  });
});
