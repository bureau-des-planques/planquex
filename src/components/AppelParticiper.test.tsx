// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppelParticiper, ROUTE_COMITE } from './AppelParticiper';
import { DEPOT_PUBLIC } from '@/lib/depot';

/**
 * L'appel à participer (#271) — la ligne et ses deux portes, rendues.
 *
 * Ce qui peut échouer : une porte retirée (le lien n'existe plus, `getByRole` lève), une
 * cible fausse (le comité ou le dépôt), un lien externe sans ses attributs de sécurité, ou
 * un lien comité qui ne ferme pas la Journée avant de naviguer.
 */
function monter(surComite = vi.fn()) {
  render(
    <MemoryRouter>
      <AppelParticiper surComite={surComite} />
    </MemoryRouter>
  );
  return surComite;
}

describe('l’appel à participer — les deux portes', () => {
  it('la porte du comité mène à la route interne, et ferme la Journée avant', async () => {
    const surComite = monter();
    const comite = screen.getByRole('link', { name: 'le comité' });
    expect(comite).toHaveAttribute('href', ROUTE_COMITE);
    expect(comite).not.toHaveAttribute('target');

    await userEvent.click(comite);
    // **Le contrôle mord** : sans `onClick`, la Journée resterait « non vue » et se
    // rouvrirait au retour du mur.
    expect(surComite).toHaveBeenCalledTimes(1);
  });

  it('la porte du dépôt ouvre le dépôt public dans un nouvel onglet, sans fermer la Journée', async () => {
    const surComite = monter();
    const depot = screen.getByRole('link', { name: 'le dépôt GitHub' });
    expect(depot).toHaveAttribute('href', DEPOT_PUBLIC);
    expect(depot).toHaveAttribute('target', '_blank');
    expect(depot.getAttribute('rel')).toMatch(/noreferrer/);
    expect(depot.getAttribute('rel')).toMatch(/noopener/);

    await userEvent.click(depot);
    expect(surComite).not.toHaveBeenCalled();
  });

  it('le dépôt visé est le dépôt public du jeu, pas une autre adresse', () => {
    expect(DEPOT_PUBLIC).toBe('https://github.com/bureau-des-planques/planquex');
  });

  it('ne pose aucun tiers : ni iframe, ni script, ni embed', () => {
    const { container } = render(
      <MemoryRouter>
        <AppelParticiper surComite={() => {}} />
      </MemoryRouter>
    );
    expect(container.querySelector('iframe, script, embed')).toBeNull();
  });
});
