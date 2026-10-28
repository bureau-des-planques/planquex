import { describe, expect, it } from 'vitest';
import { ALL_SUPPORT_CARDS, SUPPORT_CARDS, SUPPORT_VARIANTS } from '@/data/support';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import { damageBand } from '@/game/curves';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Support** (code `SUP`).
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket #23 demande explicitement — le
 * **nombre d'entrées**, le **vivier Étage** (D-026) et le **COMEX** (D-020).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['support-agent-support', 'support-technicien-support', 'support-responsable-support'];

describe('Support — enregistrement (ticket #23)', () => {
  it('compte 39 entrées, dont 31 bases et 8 variantes (vague 1, #66 : +1 COMEX)', () => {
    // PROPOSITION.md §4.3 : 38 entrées à la cible. La vague 1 (#66) ajoute le second
    // COMEX ; les vagues suivantes complètent le set, dont le volume suit D-063
    // (« autour de 300 », sans compter) et se lit dans `npm run status`.
    expect(SUPPORT_CARDS).toHaveLength(31);
    expect(SUPPORT_VARIANTS).toHaveLength(8);
    expect(ALL_SUPPORT_CARDS).toHaveLength(39);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_SUPPORT_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'SUPPORT')).toHaveLength(
      ALL_SUPPORT_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `support-` (AGENTS.md §5)', () => {
    for (const card of ALL_SUPPORT_CARDS) {
      expect(card.id, card.id).toMatch(/^support-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('SUPPORT');
    }
  });

  it('range toute la faction dans le vivier Étage (D-026)', () => {
    expect(FACTION_META.SUPPORT.vivier).toBe('ETAGE');
    for (const card of ALL_SUPPORT_CARDS) {
      expect(vivierOf(card), card.id).toBe('ETAGE');
    }
  });
});

describe('Support — ligne et COMEX (D-020)', () => {
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
    const comex = ALL_SUPPORT_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex.map((card) => card.id)).toEqual([
      'support-responsable-support-ex',
      'support-ingenieur-systemes-ex'
    ]);
    for (const card of comex) {
      // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
      expect(card.rarity, card.id).toBe('4D');
      expect(card.stage, card.id).toBe('N+2');
    }
    expect(comex.map((card) => card.evolvesFrom)).toEqual([
      'support-technicien-support',
      'support-administrateur-systemes'
    ]);
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of SUPPORT_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});

/**
 * **La lecture de bande** (#412, D-021, D-134 (2)).
 *
 * Mesurée, la faction lisait le **plancher** de chaque bande : 10 dégâts à 1 café (bas de
 * 10–30), 40 à 2 cafés (bas de 40–80). Elle perdait alors **toutes** ses parties décidées
 * contre cinq archétypes (27,5 %, hors bande de D-134 (2)) — le plancher n'est pas une
 * identité de faction, c'est une carte qui n'utilise pas sa bande.
 *
 * Le contrôle porte sur un **prédicat nommé** pour qu'un test « le contrôle mord » puisse le
 * confronter aux valeurs d'avant #412 : une assertion qui ne peut pas échouer ne garde rien
 * (AGENTS.md §6).
 */
const auDessusDuPlancher = (damage: number, cout: number): boolean => {
  const band = damageBand(cout);
  if (!band) return false;
  return damage > band[0];
};

describe('Support — la lecture de bande (#412, D-021)', () => {
  const PRESSIONS = SUPPORT_CARDS.flatMap((card) =>
    card.attacks.map((attack) => ({ card, attack, cout: attack.cost.length }))
  );

  it('ne lit plus le plancher de sa bande sur aucune Pression', () => {
    for (const { card, attack, cout } of PRESSIONS) {
      expect(auDessusDuPlancher(attack.damage, cout), `${card.id}/${attack.name} à ${cout} café(s)`).toBe(true);
    }
  });

  it('le contrôle mord : les valeurs d’avant #412 sont refusées', () => {
    // 10 à 1 café et 40 à 2 cafés : exactement le bas des bandes 10–30 et 40–80.
    expect(auDessusDuPlancher(10, 1)).toBe(false);
    expect(auDessusDuPlancher(40, 2)).toBe(false);
    expect(auDessusDuPlancher(20, 1)).toBe(true);
    expect(auDessusDuPlancher(70, 2)).toBe(true);
    // Un coût que la table ne couvre pas ne passe pas par accident.
    expect(auDessusDuPlancher(100, 9)).toBe(false);
  });
});
