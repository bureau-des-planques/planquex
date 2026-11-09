import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PauseCafe } from './PauseCafe';

/**
 * **La pause café** (D-190) : l'espace social, annoncé et pas encore jouable. La page doit dire
 * qu'elle arrive (« Bientôt ») et annoncer le **tiroir du voisin** sous son nom satirique —
 * jamais sous le nom du jeu de référence.
 */
function monter() {
  return render(
    <MemoryRouter>
      <PauseCafe />
    </MemoryRouter>
  );
}

describe('La pause café (D-190)', () => {
  it('porte son titre et dit qu’elle arrive', () => {
    monter();
    expect(screen.getByRole('heading', { level: 1, name: 'La pause café' })).toBeInTheDocument();
    expect(screen.getByText('Bientôt')).toBeInTheDocument();
  });

  it('annonce les collègues et le tiroir du voisin', () => {
    monter();
    expect(screen.getByRole('heading', { level: 2, name: 'Les collègues' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Le tiroir du voisin' })).toBeInTheDocument();
  });

  it('ne cite jamais le nom du jeu de référence', () => {
    const { container } = monter();
    expect(container.textContent ?? '').not.toMatch(/wonder|pick|pokémon|pocket/i);
  });

  it('ramène au bureau', () => {
    monter();
    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute('href', '/');
  });
});
