// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { RetourEcran } from '@/components/RetourEcran';
import { setupTestStore } from '@/test/test-utils';

/**
 * Le retour des écrans sans barre du bas (#428, parent #425).
 *
 * - **Chaque écran hors `Layout` et chaque écran secondaire a une voie de retour** : un lien
 *   « Retour… » dans la page rendue, sur les routes réelles de `App`.
 * - **Le retour va d'où l'on vient** quand une entrée précède l'écran ; sinon au parent nommé.
 * - **La cible fait au moins 44 px** : la hauteur minimale de `.button` (et donc de
 *   `.retour-ecran`) se lit dans `src/styles.css`.
 *
 * **Le contrôle mord** : les fonctions pures (`ecransSansRetour`, `hauteurMinimale`) sont
 * confrontées à un cas fautif — un écran qui perd son retour, une cible à 32 px — et doivent
 * les signaler.
 */

/** Les écrans qui n'ont pas la barre du bas : hors `Layout`, ou secondaires. */
export const ECRANS_SANS_BARRE = [
  '/connexion',
  '/confidentialite',
  '/feuille-de-route',
  '/installation',
  '/comite/suivi',
  '/administration',
  '/attente'
];

/** Les chemins dont la page rendue n'a aucun lien « Retour… ». Fonction pure. */
export function ecransSansRetour(liensParEcran: Readonly<Record<string, readonly string[]>>): string[] {
  return Object.keys(liensParEcran)
    .filter((chemin) => !liensParEcran[chemin].some((libelle) => /^Retour/.test(libelle)))
    .sort();
}

/**
 * La hauteur minimale, en px, d'une règle `sélecteur { min-height: … }` du CSS.
 * `null` si la règle ou la propriété n'existe pas. 1 rem = 16 px.
 */
export function hauteurMinimale(css: string, selecteur: string): number | null {
  const corps = new RegExp(`${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  if (!corps) return null;
  const valeur = /min-height:\s*([\d.]+)(rem|px)/.exec(corps[1]);
  if (!valeur) return null;
  return valeur[2] === 'rem' ? Number(valeur[1]) * 16 : Number(valeur[1]);
}

const CSS = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8');

describe('le retour — le contrôle mord', () => {
  it('un écran dont la page n’a plus de lien « Retour » est signalé', () => {
    const liens = {
      '/confidentialite': ['Retour au bureau'],
      '/installation': ['Accueil'],
      '/comite/suivi': ['Retour au bureau']
    };
    expect(ecransSansRetour(liens)).toEqual(['/installation']);
  });

  it('une cible sous 44 px est signalée', () => {
    expect(hauteurMinimale('.retour-ecran { min-height: 2rem; }', '.retour-ecran')).toBe(32);
    expect(hauteurMinimale('.retour-ecran { min-height: 2rem; }', '.retour-ecran')).toBeLessThan(44);
  });

  it('une règle sans hauteur minimale ne compte pas comme une cible à 44 px', () => {
    expect(hauteurMinimale('.retour-ecran { margin: 0; }', '.retour-ecran')).toBeNull();
  });
});

describe('RetourEcran', () => {
  afterEach(cleanup);

  it('sans entrée précédente : le parent nommé, par un lien réel', () => {
    render(
      <MemoryRouter initialEntries={['/confidentialite']}>
        <RetourEcran vers="/" libelle="Retour au bureau" />
      </MemoryRouter>
    );
    const lien = screen.getByRole('link', { name: 'Retour au bureau' });
    expect(lien).toHaveAttribute('href', '/');
  });

  it('avec une entrée précédente : revient d’où l’on vient', async () => {
    render(
      <MemoryRouter initialEntries={['/collection', '/confidentialite']} initialIndex={1}>
        <Routes>
          <Route path="/collection" element={<p>Écran Collection</p>} />
          <Route path="/confidentialite" element={<RetourEcran vers="/" libelle="Retour au bureau" />} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('link', { name: 'Retour' }));
    expect(await screen.findByText('Écran Collection')).toBeInTheDocument();
  });

  it('la cible fait au moins 44 px : `.button` et `.retour-ecran` le disent dans styles.css', () => {
    expect(hauteurMinimale(CSS, '.button')).toBeGreaterThanOrEqual(44);
    expect(hauteurMinimale(CSS, '.retour-ecran')).toBeNull(); // hérite de `.button`, sans la réduire
  });
});

describe('App — chaque écran sans barre a un retour', () => {
  afterEach(cleanup);

  it('chaque route sans barre rend un lien « Retour… »', () => {
    const liens: Record<string, string[]> = {};
    for (const chemin of ECRANS_SANS_BARRE) {
      setupTestStore({ deck: [], tutorielVu: true, pasAPasCombatVu: true });
      const { container, unmount } = render(
        <MemoryRouter initialEntries={[chemin]}>
          <App />
        </MemoryRouter>
      );
      liens[chemin] = [...container.querySelectorAll('a')].map((a) => a.textContent?.trim() ?? '');
      unmount();
      cleanup();
    }
    expect(ecransSansRetour(liens)).toEqual([]);
  }, 60_000);
});
