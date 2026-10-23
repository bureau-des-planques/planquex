// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { setupTestStore } from '@/test/test-utils';

function Plante(): never {
  throw new Error('rendu cassé');
}

function monter(chemin: string) {
  setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="plante" element={<Plante />} />
          <Route path="sain" element={<p>écran sain</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout — les états transverses (#131)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('un écran qui plante laisse la barre de navigation debout, et on en sort par elle', async () => {
    monter('/plante');
    expect(screen.getByRole('alert')).toHaveTextContent('Cet écran a planté');
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(nav).toBeInTheDocument();

    // Aller ailleurs referme l'erreur : le plantage ne suit pas.
    await userEvent.click(screen.getByRole('link', { name: /Accueil/ }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hors ligne, le bandeau est dans la page ; en ligne, il n’y est pas', () => {
    const reseau = vi.spyOn(window.navigator, 'onLine', 'get');

    reseau.mockReturnValue(true);
    const enLigne = monter('/sain');
    expect(screen.queryByText(/Hors ligne/)).toBeNull();
    enLigne.unmount();

    reseau.mockReturnValue(false);
    monter('/sain');
    expect(screen.getByRole('status')).toHaveTextContent('Hors ligne');
  });

  it('le nom du joueur tient sur une ligne et se lit en entier au survol', () => {
    setupTestStore({ name: 'Responsable des Affaires Générales', tutorielVu: true, pasAPasCombatVu: true });
    render(
      <MemoryRouter initialEntries={['/sain']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="sain" element={<p>écran sain</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    const nom = screen.getByText('Responsable des Affaires Générales');
    expect(nom).toHaveAttribute('title', 'Responsable des Affaires Générales');
  });
});
