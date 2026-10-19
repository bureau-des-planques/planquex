import { describe, expect, it } from 'vitest';
import { ALL_ATELIER_CARDS, ATELIER_CARDS, ATELIER_VARIANTS } from '@/data/atelier';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Atelier** (code `ATL`), ticket #19.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket demande explicitement — le **nombre
 * d'entrées** (`PROPOSITION.md` §4.3 : 32), le **vivier Atelier** (D-026) et le
 * **COMEX** (D-020, D-027).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['atelier-apprenti', 'atelier-technicien-maintenance', 'atelier-chef-atelier'];

describe('Atelier — enregistrement (ticket #19)', () => {
  it('compte 32 entrées, dont 24 bases et 8 variantes (PROPOSITION.md §4.3)', () => {
    expect(ATELIER_CARDS).toHaveLength(24);
    expect(ATELIER_VARIANTS).toHaveLength(8);
    expect(ALL_ATELIER_CARDS).toHaveLength(32);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_ATELIER_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'ATELIER')).toHaveLength(
      ALL_ATELIER_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `atelier-` (AGENTS.md §5)', () => {
    for (const card of ALL_ATELIER_CARDS) {
      expect(card.id, card.id).toMatch(/^atelier-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('ATELIER');
    }
  });

  it('range toute la faction dans le vivier Atelier (D-026)', () => {
    expect(FACTION_META.ATELIER.vivier).toBe('ATELIER');
    for (const card of ALL_ATELIER_CARDS) {
      expect(vivierOf(card), card.id).toBe('ATELIER');
    }
  });
});

describe('Atelier — ligne et COMEX (D-020)', () => {
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
    const comex = ALL_ATELIER_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('atelier-chef-atelier-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('atelier-technicien-maintenance');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of ATELIER_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});
