// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErreurDeRendu } from './ErreurDeRendu';

/** Un écran qui plante au rendu, tant que `cassé` vaut vrai. */
let casse = true;
function Bombe() {
  if (casse) throw new Error('Seuil introuvable');
  return <p>écran sain</p>;
}

describe('ErreurDeRendu — le garde-fou contre l’écran blanc (#131)', () => {
  beforeEach(() => {
    casse = true;
    // React journalise l'erreur attrapée ; c'est voulu (`componentDidCatch`), pas du bruit à garder.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('un écran sain passe tel quel', () => {
    casse = false;
    render(
      <ErreurDeRendu>
        <Bombe />
      </ErreurDeRendu>
    );
    expect(screen.getByText('écran sain')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('une exception de rendu donne un écran qui le dit, avec une sortie', () => {
    render(
      <ErreurDeRendu>
        <Bombe />
      </ErreurDeRendu>
    );
    const alerte = screen.getByRole('alert');
    expect(alerte).toHaveTextContent('Cet écran a planté');
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /accueil/i })).toHaveAttribute('href', '/');
    // Le message de l'erreur est donné, pour un post-it OUF.
    expect(alerte).toHaveTextContent('Seuil introuvable');
  });

  it('l’erreur est aussi journalisée : elle ne se perd pas en silence', () => {
    render(
      <ErreurDeRendu>
        <Bombe />
      </ErreurDeRendu>
    );
    const messages = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);
    expect(messages).toContain('Erreur de rendu :');
  });

  it('changer d’adresse referme l’erreur : le plantage ne suit pas dans les autres écrans', () => {
    const { rerender } = render(
      <ErreurDeRendu reinitialiseSur="/combat">
        <Bombe />
      </ErreurDeRendu>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    casse = false;
    rerender(
      <ErreurDeRendu reinitialiseSur="/deck">
        <Bombe />
      </ErreurDeRendu>
    );
    expect(screen.getByText('écran sain')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sans changement d’adresse, l’erreur reste affichée', () => {
    const { rerender } = render(
      <ErreurDeRendu reinitialiseSur="/combat">
        <Bombe />
      </ErreurDeRendu>
    );
    casse = false;
    rerender(
      <ErreurDeRendu reinitialiseSur="/combat">
        <Bombe />
      </ErreurDeRendu>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
