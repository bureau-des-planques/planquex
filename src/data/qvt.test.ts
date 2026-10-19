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
  it('compte 48 entrées, dont 36 bases et 12 variantes (PROPOSITION.md §4.3)', () => {
    expect(QVT_CARDS).toHaveLength(36);
    expect(QVT_VARIANTS).toHaveLength(12);
    expect(ALL_QVT_CARDS).toHaveLength(48);
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

  it('identifie chaque carte par le préfixe `qvt-` (AGENTS.md §5)', () => {
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
  it('a exactement un COMEX, en 4 diamants, à 2 Interventions', () => {
    const comex = ALL_QVT_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('qvt-chief-happiness-officer-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('qvt-responsable-engagement');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of QVT_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });

  it('fait pointer le COMEX vers un N+1 de la même faction', () => {
    const comex = byId('qvt-chief-happiness-officer-ex');
    const previous = comex?.evolvesFrom ? byId(comex.evolvesFrom) : undefined;
    expect(previous?.stage).toBe('N+1');
    expect(previous?.faction).toBe('QVT');
  });
});
