import { describe, expect, it } from 'vitest';
import { FACTION_META } from '@/data';
import type { CafeType } from '@/data/types';
import { COLORLESS_CAFE, cafeSatisfies, isValidCafeCost, satisfiesCafeCost } from '@/game/rules';

/** Les dix types de café, dans l'ordre des factions (AGENTS.md §3.2). */
const CAFE_TYPES = Object.keys(FACTION_META) as CafeType[];

describe('Café typé — coût d’une Pression (#30)', () => {
  it('un café incolore satisfait n’importe quel coût typé', () => {
    expect(COLORLESS_CAFE).toBe('SUPPORT');
    for (const type of CAFE_TYPES) {
      expect(cafeSatisfies(COLORLESS_CAFE, type), type).toBe(true);
    }
  });

  it('un café typé ne paie que son propre type', () => {
    expect(cafeSatisfies('SSE', 'SSE')).toBe(true);
    expect(cafeSatisfies('SSE', 'MANAGEMENT')).toBe(false);
    expect(cafeSatisfies('INTERIM', 'ATELIER')).toBe(false);
  });

  it('compte les cafés : chaque café ne paie qu’une fois', () => {
    const cost = { type: 'QVT', amount: 2 } as const;

    expect(satisfiesCafeCost(['QVT', 'QVT'], cost)).toBe(true);
    expect(satisfiesCafeCost(['QVT', COLORLESS_CAFE], cost)).toBe(true);
    expect(satisfiesCafeCost([COLORLESS_CAFE, COLORLESS_CAFE, 'SSE'], cost)).toBe(true);
    expect(satisfiesCafeCost(['QVT', 'SSE'], cost)).toBe(false);
    expect(satisfiesCafeCost(['QVT'], cost)).toBe(false);
    expect(satisfiesCafeCost([], cost)).toBe(false);
  });

  it('exige un coût typé d’au moins 1 café entier', () => {
    expect(isValidCafeCost({ type: 'SSE', amount: 1 })).toBe(true);
    expect(isValidCafeCost({ type: 'SSE', amount: 2 })).toBe(true);
    expect(isValidCafeCost({ type: 'SSE', amount: 0 })).toBe(false);
    expect(isValidCafeCost({ type: 'SSE', amount: 1.5 })).toBe(false);
    expect(satisfiesCafeCost(['SSE'], { type: 'SSE', amount: 0 })).toBe(false);
  });

  it('ne plafonne pas le nombre de types de café disponibles (§4, D-022)', () => {
    const cost = { type: 'DIRECTION', amount: 1 } as const;

    expect(satisfiesCafeCost(CAFE_TYPES, cost)).toBe(true);
    expect(satisfiesCafeCost(['SSE', 'MANAGEMENT', 'QVT', 'AMELIORATION', 'RH', 'DIRECTION'], cost)).toBe(true);
  });
});
