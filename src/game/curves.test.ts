import { describe, expect, it } from 'vitest';
import { DAMAGE_BY_COST, HP_BAND, damageBand, hpBand } from '@/game/curves';

/**
 * Invariants de forme des bandes de `CARD-SPEC.md` §2 (ticket #55).
 *
 * Ce fichier ne **recopie** aucune borne : le sens des valeurs est vérifié par
 * `src/data/cards.test.ts` (les cartes réelles) et `src/game/pace.test.ts` (le
 * rythme). Ici, seulement ce qui reste vrai quelle que soit la bande : des bornes
 * ordonnées, lisibles, et des accès qui ne fabriquent rien.
 */
const ALL_BANDS = [...Object.entries(DAMAGE_BY_COST), ...Object.entries(HP_BAND)];

describe('Règles chiffrées — bandes de CARD-SPEC.md §2 (#55)', () => {
  it('donne à chaque bande deux bornes ordonnées, multiples de 10', () => {
    expect(ALL_BANDS.length).toBeGreaterThan(0);
    for (const [key, band] of ALL_BANDS) {
      expect(band, key).toBeDefined();
      if (!band) continue;
      expect(band[0], `${key} : bas > haut`).toBeLessThanOrEqual(band[1]);
      for (const bound of band) {
        expect(Number.isInteger(bound / 10), `${key} : ${bound} non multiple de 10`).toBe(true);
      }
    }
  });

  it('ne fait jamais baisser les dégâts quand le café monte', () => {
    const costs = Object.keys(DAMAGE_BY_COST)
      .map(Number)
      .sort((a, b) => a - b);
    for (const [index, cost] of costs.entries()) {
      const band = damageBand(cost);
      const previous = index > 0 ? damageBand(costs[index - 1]) : undefined;
      expect(band, `coût ${cost}`).toBeDefined();
      if (!band || !previous) continue;
      expect(band[0], `coût ${cost} : bas sous celui de ${costs[index - 1]}`).toBeGreaterThanOrEqual(previous[0]);
      expect(band[1], `coût ${cost} : haut sous celui de ${costs[index - 1]}`).toBeGreaterThanOrEqual(previous[1]);
    }
  });

  it('retrouve la table par les accès, et ne fabrique rien hors table', () => {
    expect(hpBand('ENTRANT', '1D')).toBe(HP_BAND['ENTRANT/1D']);
    expect(hpBand('N+2', '4D')).toBe(HP_BAND['N+2/4D']);
    expect(damageBand(2)).toBe(DAMAGE_BY_COST[2]);

    // Hors table : `undefined`, jamais une bande par défaut silencieuse.
    expect(hpBand('N+2', '1D')).toBeUndefined();
    expect(damageBand(5)).toBeUndefined();
  });
});
