import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isPlanque, vivierOf } from '@/data';

/**
 * Contrôle de la faction **Management** (`MGT`), issue #15.
 * Le nombre cible vient de `docs/PROPOSITION.md` §4.3 (28 entrées, variantes incluses) ;
 * le vivier de `docs/JEU.md` §3.2 et D-026.
 */
const MANAGEMENT = ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'MANAGEMENT');

describe('Cartes — faction Management (PROPOSITION.md §4.3)', () => {
  it('compte 29 entrées : 21 bases et 8 variantes secrètes (vague 2, #86 : +1 carte 3◆)', () => {
    // La vague 2 (#86) ajoute une carte en 3◆ (Directeur de service) pour la cible de
    // rareté `CARD-SPEC.md` §1.
    expect(MANAGEMENT).toHaveLength(29);
    expect(MANAGEMENT.filter((card) => !card.variantOf)).toHaveLength(21);
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
