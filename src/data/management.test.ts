import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isPlanque, vivierOf } from '@/data';

/**
 * Contrôle de la faction **Management** (`MGT`), issue #15.
 * Le nombre cible vient de `docs/PROPOSITION.md` §4.3 (28 entrées, variantes incluses) ;
 * le vivier de `AGENTS.md` §3.2 et D-026.
 */
const MANAGEMENT = ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'MANAGEMENT');

describe('Cartes — faction Management (PROPOSITION.md §4.3)', () => {
  it('compte 28 entrées : 20 bases et 8 variantes secrètes', () => {
    expect(MANAGEMENT).toHaveLength(28);
    expect(MANAGEMENT.filter((card) => !card.variantOf)).toHaveLength(20);
    expect(MANAGEMENT.filter((card) => card.variantOf)).toHaveLength(8);
  });

  it('utilise le préfixe d’identifiant `management-`', () => {
    for (const card of MANAGEMENT) {
      expect(card.id, card.id).toMatch(/^management-[a-z0-9-]+$/);
    }
  });

  it('range la faction dans le vivier Atelier (D-026)', () => {
    for (const card of MANAGEMENT) {
      expect(vivierOf(card), card.id).toBe('ATELIER');
    }
  });
});
