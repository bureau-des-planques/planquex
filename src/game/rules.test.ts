import { describe, expect, it } from 'vitest';
import { FACTION_META } from '@/data';
import type { CafeType } from '@/data/types';
import { COLORLESS_CAFE, cafeSatisfies, satisfiesCafeCost } from '@/game/rules';

/** Les dix types de café, dans l'ordre des factions (AGENTS.md §3.2). */
const CAFE_TYPES = Object.keys(FACTION_META) as CafeType[];

describe('Café typé — paiement d’un coût (D-037 (2))', () => {
  it('`INCOLORE` est distinct de `SUPPORT`', () => {
    expect(COLORLESS_CAFE).toBe('INCOLORE');
    expect(COLORLESS_CAFE).not.toBe('SUPPORT');
  });

  it('un café typé ne paie que son propre type', () => {
    expect(cafeSatisfies('SSE', 'SSE')).toBe(true);
    expect(cafeSatisfies('SSE', 'MANAGEMENT')).toBe(false);
    expect(cafeSatisfies('INTERIM', 'ATELIER')).toBe(false);
  });

  it('un symbole incolore accepte n’importe quel café', () => {
    for (const type of CAFE_TYPES) {
      expect(cafeSatisfies(type, COLORLESS_CAFE), type).toBe(true);
    }
  });

  it('un café incolore paie n’importe quel coût typé (jamais produit, D-034)', () => {
    expect(cafeSatisfies(COLORLESS_CAFE, 'SSE')).toBe(true);
    expect(cafeSatisfies(COLORLESS_CAFE, 'INTERIM')).toBe(true);
    expect(cafeSatisfies(COLORLESS_CAFE, COLORLESS_CAFE)).toBe(true);
  });
});

describe('Coût en café typé — liste de symboles (D-037 (1))', () => {
  it('couvre un coût typé et un coût incolore', () => {
    expect(satisfiesCafeCost(['QVT', 'QVT'], ['QVT', 'QVT'])).toBe(true);
    expect(satisfiesCafeCost(['SSE', 'MANAGEMENT'], ['INCOLORE', 'INCOLORE'])).toBe(true);
    expect(satisfiesCafeCost(['SSE'], ['SSE', 'INCOLORE'])).toBe(false);
  });

  it('un café incolore paie un symbole typé', () => {
    expect(satisfiesCafeCost([COLORLESS_CAFE, 'SSE'], ['QVT', 'SSE'])).toBe(true);
    expect(satisfiesCafeCost([COLORLESS_CAFE, COLORLESS_CAFE], ['SSE', 'MANAGEMENT'])).toBe(true);
  });

  it('ne compte chaque café qu’une fois', () => {
    expect(satisfiesCafeCost(['QVT'], ['QVT', 'QVT'])).toBe(false);
    expect(satisfiesCafeCost(['QVT', 'SSE'], ['QVT', 'QVT'])).toBe(false);
    expect(satisfiesCafeCost([], ['INCOLORE'])).toBe(false);
  });

  it('une attaque gratuite est toujours payable', () => {
    expect(satisfiesCafeCost([], [])).toBe(true);
  });

  it('ne gaspille pas un café typé rare sur un symbole incolore', () => {
    // `SSE` doit payer le symbole `SSE` ; QVT, disponible, couvre l'incolore.
    expect(satisfiesCafeCost(['QVT', 'SSE'], ['SSE', 'INCOLORE'])).toBe(true);
    // Le seul café est typé : il paie le symbole typé, il ne reste rien pour l'incolore.
    expect(satisfiesCafeCost(['SSE'], ['SSE', 'INCOLORE'])).toBe(false);
  });
});
