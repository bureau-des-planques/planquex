import { describe, expect, it } from 'vitest';
import { ALL_QVT_CARDS, QVT_CARDS, QVT_VARIANTS } from '@/data/qvt';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **QVT**.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que les tickets #23 (1/2) et #24 (2/2) demandent —
 * le **nombre d'entrées**, le **vivier Bureaux** (D-026) et le **COMEX** (D-020).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

describe('QVT — enregistrement (tickets #23/#24)', () => {
  it('compte 49 entrées, dont 37 bases et 12 variantes (vague 1, #66 : +1 COMEX)', () => {
    // PROPOSITION.md §4.3 : 48 entrées à la cible. La vague 1 (#66) ajoute le second
    // COMEX ; les vagues suivantes complètent le set, dont le volume suit D-063
    // (« autour de 300 », sans compter) et se lit dans `npm run status`.
    expect(QVT_CARDS).toHaveLength(37);
    expect(QVT_VARIANTS).toHaveLength(12);
    expect(ALL_QVT_CARDS).toHaveLength(49);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_QVT_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'QVT')).toHaveLength(
      ALL_QVT_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `qvt-` (docs/JEU.md §5)', () => {
    for (const card of ALL_QVT_CARDS) {
      expect(card.id, card.id).toMatch(/^qvt-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('QVT');
    }
  });

  it('range toute la faction dans le vivier Bureaux (D-026)', () => {
    expect(FACTION_META.QVT.vivier).toBe('BUREAUX');
    for (const card of ALL_QVT_CARDS) {
      expect(vivierOf(card), card.id).toBe('BUREAUX');
    }
  });
});

describe('QVT — COMEX (D-020)', () => {
  it('a deux COMEX, en 4 diamants, à 2 Interventions, sur deux lignes distinctes', () => {
    const comex = ALL_QVT_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex.map((card) => card.id)).toEqual([
      'qvt-chief-happiness-officer-ex',
      'qvt-directeur-qvt-ex'
    ]);
    for (const card of comex) {
      // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
      expect(card.rarity, card.id).toBe('4D');
      expect(card.stage, card.id).toBe('N+2');
    }
    expect(comex.map((card) => card.evolvesFrom)).toEqual([
      'qvt-responsable-engagement',
      'qvt-responsable-qvt'
    ]);
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of QVT_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });

  it('fait pointer chaque COMEX vers un N+1 de la même faction', () => {
    for (const id of ['qvt-chief-happiness-officer-ex', 'qvt-directeur-qvt-ex']) {
      const comex = byId(id);
      const previous = comex?.evolvesFrom ? byId(comex.evolvesFrom) : undefined;
      expect(previous?.stage, id).toBe('N+1');
      expect(previous?.faction, id).toBe('QVT');
    }
  });
});
