import { describe, expect, it } from 'vitest';
import { ALL_RH_CARDS, RH_CARDS, RH_VARIANTS } from '@/data/rh';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **RH** (code `RH`), ticket #50.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket demande explicitement — le **nombre
 * d'entrées** (`PROPOSITION.md` §4.3 : 32), le **vivier Bureaux** (D-026) et le
 * **COMEX** (D-020).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['rh-assistant-rh', 'rh-charge-recrutement', 'rh-drh'];

describe('RH — enregistrement (ticket #50)', () => {
  it('compte 33 entrées, dont 25 bases et 8 variantes (vague 1, #66 : +1 COMEX)', () => {
    // PROPOSITION.md §4.3 : 32 entrées à la cible. La vague 1 (#66) ajoute le second
    // COMEX ; les vagues suivantes complètent le set, dont le volume suit D-063
    // (« autour de 300 », sans compter) et se lit dans `npm run status`.
    expect(RH_CARDS).toHaveLength(25);
    expect(RH_VARIANTS).toHaveLength(8);
    expect(ALL_RH_CARDS).toHaveLength(33);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_RH_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'RH')).toHaveLength(
      ALL_RH_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `rh-` (AGENTS.md §5)', () => {
    for (const card of ALL_RH_CARDS) {
      expect(card.id, card.id).toMatch(/^rh-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('RH');
    }
  });

  it('range toute la faction dans le vivier Bureaux (D-026)', () => {
    expect(FACTION_META.RH.vivier).toBe('BUREAUX');
    for (const card of ALL_RH_CARDS) {
      expect(vivierOf(card), card.id).toBe('BUREAUX');
    }
  });
});

describe('RH — ligne et COMEX (D-020)', () => {
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
    const comex = ALL_RH_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex.map((card) => card.id)).toEqual(['rh-drh-ex', 'rh-directeur-talents-ex']);
    for (const card of comex) {
      // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
      expect(card.rarity, card.id).toBe('4D');
      expect(card.stage, card.id).toBe('N+2');
    }
    expect(comex.map((card) => card.evolvesFrom)).toEqual([
      'rh-charge-recrutement',
      'rh-chasseur-tetes'
    ]);
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of RH_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });

  it('fait pointer chaque COMEX vers un N+1 de la même faction', () => {
    for (const id of ['rh-drh-ex', 'rh-directeur-talents-ex']) {
      const comex = byId(id);
      const previous = comex?.evolvesFrom ? byId(comex.evolvesFrom) : undefined;
      expect(previous?.stage, id).toBe('N+1');
      expect(previous?.faction, id).toBe('RH');
    }
  });
});
