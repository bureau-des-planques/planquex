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
  it('compte 34 entrées, dont 26 bases et 8 variantes (vague 1, #66 : +1 COMEX ; vague 2, #86 : +1 carte 3◆)', () => {
    // PROPOSITION.md §4.3 : 32 entrées à la cible. La vague 1 (#66) ajoute le second
    // COMEX ; la vague 2 (#86) ajoute une carte en 3◆ (Chef d'usine) pour la cible de
    // rareté `CARD-SPEC.md` §1 ; les vagues suivantes complètent le set, dont le
    // volume suit D-063 (« autour de 300 », sans compter) et se lit dans `npm run status`.
    expect(ATELIER_CARDS).toHaveLength(26);
    expect(ATELIER_VARIANTS).toHaveLength(8);
    expect(ALL_ATELIER_CARDS).toHaveLength(34);
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

  it('a deux COMEX, en 4 diamants, à 2 Interventions, sur deux lignes distinctes', () => {
    const comex = ALL_ATELIER_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex.map((card) => card.id)).toEqual([
      'atelier-chef-atelier-ex',
      'atelier-responsable-maintenance-ex'
    ]);
    for (const card of comex) {
      // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
      expect(card.rarity, card.id).toBe('4D');
      expect(card.stage, card.id).toBe('N+2');
    }
    expect(comex.map((card) => card.evolvesFrom)).toEqual([
      'atelier-technicien-maintenance',
      'atelier-electromecanicien'
    ]);
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of ATELIER_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});
