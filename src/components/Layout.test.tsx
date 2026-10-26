// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
          {/* Une route de combat : `enCombat` se lit dans l'adresse (#213). */}
          <Route path="battle" element={<p>écran de combat</p>} />
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

describe('Layout — la barre à cinq onglets (#213, D-097 (4))', () => {
  function barre() {
    return screen.getByRole('navigation', { name: 'Navigation principale' });
  }

  it('les cinq onglets, dans l’ordre — Comité remplace Réglages', () => {
    monter('/sain');
    const liens = within(barre()).getAllByRole('link');
    // La liste entière, pas seulement la présence : remettre Réglages dans la barre
    // (six entrées) ou déplacer Comité ailleurs fait échouer ce test.
    expect(liens.map((lien) => lien.textContent)).toEqual([
      'Accueil',
      'Collection',
      'Deck',
      'Combat',
      'Comité'
    ]);
    expect(within(barre()).getByRole('link', { name: 'Comité' })).toHaveAttribute('href', '/comite');
    expect(within(barre()).queryByRole('link', { name: 'Réglages' })).toBeNull();
  });

  it('l’engrenage des Réglages est dans l’en-tête, à côté du pseudo', () => {
    monter('/sain');
    const entete = screen.getByRole('banner');
    const engrenage = within(entete).getByRole('link', { name: 'Réglages' });
    expect(engrenage).toHaveAttribute('href', '/settings');
    // « Collé au pseudo » : l'engrenage suit le nom dans l'en-tête, il ne le remplace pas.
    expect(within(entete).getByText('Testeur')).toBeInTheDocument();
  });

  it('en combat, l’onglet Comité s’efface — on ne quitte pas une partie en cours', () => {
    monter('/battle');
    expect(within(barre()).queryByRole('link', { name: 'Comité' })).toBeNull();
    // Les quatre autres restent, à leur place : la barre ne se vide pas.
    expect(within(barre()).getAllByRole('link').map((lien) => lien.textContent)).toEqual([
      'Accueil',
      'Collection',
      'Deck',
      'Combat'
    ]);
  });
});
