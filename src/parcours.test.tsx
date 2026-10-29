// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { rendreApplication } from '@/test/test-utils';
import { EXCEPTIONS, RACINE, cheminInterne, evaluerParcours, routesDeclarees } from '../scripts/preuves/parcours.mjs';

/**
 * Le seuil de parcours (#429) sur le graphe **rendu** de l'application, sans navigateur.
 *
 * Chaque route de `src/App.tsx` est rendue à sa propre adresse ; ses liens (`a[href]`) forment le
 * graphe, et `evaluerParcours` (`scripts/preuves/parcours.mjs`) mesure les gestes depuis l'accueil et le
 * retour. Un écran qui dépasse le seuil, ou dont le retour manque, échoue **avec son nom**.
 *
 * Le graphe est construit ici, et non réutilisé de `src/sorties.test.tsx` : celui-ci ne rend que les
 * écrans **atteints** depuis l'accueil, alors que le retour se mesure **depuis chaque écran**. Les
 * exceptions (`EXCEPTIONS`) sont la liste de `scripts/preuves/parcours.mjs`, la même que celle de #426.
 *
 * Le contrôle mord : `scripts/preuves/parcours.test.ts` confronte `evaluerParcours` à des graphes fautifs.
 */

const ecrans = routesDeclarees(readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8'));

function liensRendus(conteneur: HTMLElement): string[] {
  const liens = new Set<string>();
  for (const a of Array.from(conteneur.querySelectorAll('a[href]'))) {
    const chemin = cheminInterne(a.getAttribute('href'));
    if (chemin !== null) liens.add(chemin);
  }
  return [...liens];
}

describe('le parcours (#429) — chaque écran rendu', () => {
  afterEach(cleanup);

  it('chaque écran est atteignable depuis l’accueil dans le seuil, et l’on en revient dans le seuil', async () => {
    const graphe: Record<string, string[]> = {};
    for (const chemin of [RACINE, ...ecrans]) {
      const { container, unmount } = await rendreApplication({ chemin, storeState: { deck: [] } });
      graphe[chemin] = liensRendus(container);
      unmount();
      cleanup();
    }
    const { echecs } = evaluerParcours(graphe, { ecrans, exceptions: EXCEPTIONS });
    expect(echecs).toEqual([]);
  }, 180_000);
});
