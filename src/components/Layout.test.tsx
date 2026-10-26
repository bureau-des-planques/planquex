// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { setupTestStore } from '@/test/test-utils';

/**
 * Le compteur « choses à voir » du comité (#212). La **couture réseau** est mockée — comme
 * dans `Suivi.test.tsx` : l'écran se juge sans base et sans réseau.
 */
const mocks = vi.hoisted(() => ({
  murEstConfigure: vi.fn(),
  compter: vi.fn()
}));

vi.mock('@/lib/murBase', async () => {
  const vrai = await vi.importActual<typeof import('@/lib/murBase')>('@/lib/murBase');
  return {
    ...vrai,
    murEstConfigure: mocks.murEstConfigure,
    compterChosesAVoir: mocks.compter
  };
});

function Plante(): never {
  throw new Error('rendu cassé');
}

function monter(chemin: string) {
  setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route element={<Layout />}>
          {/* L'accueil : sans lui, revenir à `/` démonterait `Layout` — et le compteur
              ne serait pas relu (#212). */}
          <Route index element={<p>écran d’accueil</p>} />
          <Route path="plante" element={<Plante />} />
          <Route path="sain" element={<p>écran sain</p>} />
          {/* Une route de combat : `enCombat` se lit dans l'adresse (#213). */}
          <Route path="battle" element={<p>écran de combat</p>} />
          {/* Les deux pages du comité (D-097 (2)) : le compteur s'y éteint (#212). */}
          <Route path="comite" element={<p>écran du mur</p>} />
          <Route path="comite/suivi" element={<p>écran du suivi</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  // Par défaut, **pas de base** — c'est l'état de `.env.test`, et celui de la production
  // sans variables : rien n'est contacté, rien ne s'affiche (#212).
  mocks.murEstConfigure.mockReturnValue(false);
  mocks.compter.mockReset();
});

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

/**
 * Le compteur « choses à voir » (#212, D-097 (5)), vu de la coquille : une pastille sur
 * l'onglet **Comité**, et l'alerte flottante (`AlerteComite`) qui mène au suivi.
 *
 * Trois absences, une seule règle : **à zéro, sans base, et en combat** — on ne quitte pas
 * une partie en cours pour un post-it (D-058). Sur **Le suivi**, l'alerte s'efface aussi :
 * c'est la page qui vient de les voir.
 */
describe('Layout — le compteur du comité (#212, D-097 (5))', () => {
  function barre() {
    return screen.getByRole('navigation', { name: 'Navigation principale' });
  }

  const ALERTE = /Ouvrir le suivi du comité/;

  it('avec des choses à voir, l’onglet porte le nombre et l’alerte mène au suivi', async () => {
    mocks.murEstConfigure.mockReturnValue(true);
    mocks.compter.mockResolvedValue(3);
    monter('/sain');

    const onglet = await screen.findByRole('link', { name: 'Comité — 3 choses à voir' });
    expect(onglet).toHaveAttribute('href', '/comite');
    // La pastille est **numérotée**, pas un simple point d'alerte.
    expect(within(onglet).getByText('3')).toBeInTheDocument();

    const alerte = screen.getByRole('link', { name: ALERTE });
    expect(alerte).toHaveAttribute('href', '/comite/suivi');
    expect(alerte).toHaveTextContent('3');
  });

  it('à zéro, ni pastille ni alerte — le compteur ne crie pas pour rien', async () => {
    mocks.murEstConfigure.mockReturnValue(true);
    mocks.compter.mockResolvedValue(0);
    monter('/sain');

    await waitFor(() => expect(mocks.compter).toHaveBeenCalled());
    expect(within(barre()).getByRole('link', { name: 'Comité' })).toBeInTheDocument();
    expect(within(barre()).queryByText('0')).toBeNull();
    expect(screen.queryByRole('link', { name: ALERTE })).toBeNull();
  });

  it('sans base, rien n’est compté et rien ne s’affiche (repli inerte)', () => {
    monter('/sain');

    expect(within(barre()).getByRole('link', { name: 'Comité' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: ALERTE })).toBeNull();
    expect(mocks.compter).not.toHaveBeenCalled();
  });

  it('en combat, ni onglet Comité ni alerte, et aucune lecture', () => {
    mocks.murEstConfigure.mockReturnValue(true);
    mocks.compter.mockResolvedValue(3);
    monter('/battle');

    expect(within(barre()).queryByRole('link', { name: /Comité/ })).toBeNull();
    expect(screen.queryByRole('link', { name: ALERTE })).toBeNull();
    expect(mocks.compter).not.toHaveBeenCalled();
  });

  it('sur Le suivi, l’alerte s’efface : c’est la page qui vient de les voir', async () => {
    mocks.murEstConfigure.mockReturnValue(true);
    mocks.compter.mockResolvedValue(3);
    monter('/comite/suivi');

    expect(await screen.findByText('écran du suivi')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: ALERTE })).toBeNull();
    expect(within(barre()).queryByText('3')).toBeNull();
  });

  it('l’alerte mène au suivi, et en revenant le compteur est relu — il rend 0', async () => {
    mocks.murEstConfigure.mockReturnValue(true);
    // Les 3 choses sont vues en ouvrant le suivi (le repère s'y pose, #211) : la lecture
    // suivante, en quittant la page, rend 0.
    mocks.compter.mockResolvedValueOnce(3).mockResolvedValue(0);
    monter('/sain');

    await userEvent.click(await screen.findByRole('link', { name: ALERTE }));
    expect(await screen.findByText('écran du suivi')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: /Accueil/ }));
    await waitFor(() => expect(mocks.compter).toHaveBeenCalledTimes(2));
    expect(within(barre()).getByRole('link', { name: 'Comité' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: ALERTE })).toBeNull();
  });
});
