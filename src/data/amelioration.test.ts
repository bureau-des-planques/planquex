import { describe, expect, it } from 'vitest';
import { ALL_AMELIORATION_CARDS, AMELIORATION_CARDS, AMELIORATION_VARIANTS } from '@/data/amelioration';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Amélioration continue** (code `AC`).
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket #17 demande explicitement — le
 * **nombre d'entrées**, le **vivier Étage** (D-026) et le **COMEX** (D-020).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['amelioration-charge-qualite', 'amelioration-auditeur-qualite', 'amelioration-directeur-qualite'];

describe('Amélioration continue — enregistrement (ticket #17)', () => {
  it('compte 25 entrées, dont 18 bases et 7 variantes (PROPOSITION.md §4.3)', () => {
    expect(AMELIORATION_CARDS).toHaveLength(18);
    expect(AMELIORATION_VARIANTS).toHaveLength(7);
    expect(ALL_AMELIORATION_CARDS).toHaveLength(25);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_AMELIORATION_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'AMELIORATION')).toHaveLength(
      ALL_AMELIORATION_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `amelioration-` (AGENTS.md §5)', () => {
    for (const card of ALL_AMELIORATION_CARDS) {
      expect(card.id, card.id).toMatch(/^amelioration-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('AMELIORATION');
    }
  });

  it('range toute la faction dans le vivier Étage (D-026)', () => {
    expect(FACTION_META.AMELIORATION.vivier).toBe('ETAGE');
    for (const card of ALL_AMELIORATION_CARDS) {
      expect(vivierOf(card), card.id).toBe('ETAGE');
    }
  });
});

describe('Amélioration continue — ligne et COMEX (D-020)', () => {
  it('a une ligne complète Entrant → N+1 → N+2', () => {
    const [entrant, n1, n2] = LINE.map(byId);
    expect(entrant?.stage).toBe('ENTRANT');
    expect(entrant?.evolvesFrom).toBeUndefined();
    expect(n1?.stage).toBe('N+1');
    expect(n1?.evolvesFrom).toBe(LINE[0]);
    expect(n2?.stage).toBe('N+2');
    expect(n2?.evolvesFrom).toBe(LINE[1]);
  });

  it('a exactement un COMEX, en 4 diamants, à 2 Interventions', () => {
    const comex = ALL_AMELIORATION_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('amelioration-directeur-qualite-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('amelioration-auditeur-qualite');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of AMELIORATION_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});
