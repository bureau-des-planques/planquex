import { describe, expect, it } from 'vitest';
import { ALL_DIRECTION_CARDS, DIRECTION_CARDS, DIRECTION_VARIANTS } from '@/data/direction';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Direction** (code `DIR`), ticket #50.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket demande explicitement — le **nombre
 * d'entrées** (`PROPOSITION.md` §4.3 : 18), le **vivier Étage** (D-026) et le
 * **COMEX** (D-020).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['direction-chef-projet-fantome', 'direction-directeur-adjoint', 'direction-pdg'];

describe('Direction — enregistrement (ticket #50)', () => {
  it('compte 18 entrées, dont 14 bases et 4 variantes (PROPOSITION.md §4.3)', () => {
    expect(DIRECTION_CARDS).toHaveLength(14);
    expect(DIRECTION_VARIANTS).toHaveLength(4);
    expect(ALL_DIRECTION_CARDS).toHaveLength(18);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_DIRECTION_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'DIRECTION')).toHaveLength(
      ALL_DIRECTION_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `direction-` (AGENTS.md §5)', () => {
    for (const card of ALL_DIRECTION_CARDS) {
      expect(card.id, card.id).toMatch(/^direction-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('DIRECTION');
    }
  });

  it('range toute la faction dans le vivier Étage (D-026)', () => {
    expect(FACTION_META.DIRECTION.vivier).toBe('ETAGE');
    for (const card of ALL_DIRECTION_CARDS) {
      expect(vivierOf(card), card.id).toBe('ETAGE');
    }
  });
});

describe('Direction — ligne et COMEX (D-020)', () => {
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
    const comex = ALL_DIRECTION_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('direction-pdg-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('direction-directeur-adjoint');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of DIRECTION_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });

  it('fait pointer le COMEX vers un N+1 de la même faction', () => {
    const comex = byId('direction-pdg-ex');
    const previous = comex?.evolvesFrom ? byId(comex.evolvesFrom) : undefined;
    expect(previous?.stage).toBe('N+1');
    expect(previous?.faction).toBe('DIRECTION');
  });
});
