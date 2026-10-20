import { describe, expect, it } from 'vitest';
import { ALL_INTERIM_CARDS, INTERIM_CARDS, INTERIM_VARIANTS } from '@/data/interim';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Intérim** (code `INT`), ticket #22.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket demande explicitement — le **nombre
 * d'entrées** (`PROPOSITION.md` §4.3 : 4), le **vivier Bureaux** (D-026), l'absence
 * de **vulnérabilité** et le **COMEX** (D-020, D-027).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['interim-interimaire', 'interim-interimaire-confirme', 'interim-chef-equipe-interimaire'];

describe('Intérim — enregistrement (ticket #22)', () => {
  it('compte 6 entrées, toutes des bases (vague 2, #86 : +1 ligne à 3 stades)', () => {
    // Les 4 entrées de `PROPOSITION.md` §4.3 (la ligne à 3 stades + la carte signature
    // COMEX) sont dépassées de 2 : la vague 2 (#86) ajoute une ligne à 3 stades pour
    // atteindre la cible de rareté `CARD-SPEC.md` §1 (42 cartes en 3◆). L'écart avec le
    // quota de faction est signalé au ticket #63.
    expect(INTERIM_CARDS).toHaveLength(6);
    expect(INTERIM_VARIANTS).toHaveLength(0);
    expect(ALL_INTERIM_CARDS).toHaveLength(6);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_INTERIM_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'INTERIM')).toHaveLength(
      ALL_INTERIM_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `interim-` (AGENTS.md §5)', () => {
    for (const card of ALL_INTERIM_CARDS) {
      expect(card.id, card.id).toMatch(/^interim-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('INTERIM');
    }
  });

  it('range toute la faction dans le vivier Bureaux (D-026)', () => {
    expect(FACTION_META.INTERIM.vivier).toBe('BUREAUX');
    for (const card of ALL_INTERIM_CARDS) {
      expect(vivierOf(card), card.id).toBe('BUREAUX');
    }
  });
});

describe('Intérim — Dragon sans faiblesse (AGENTS.md §3.2)', () => {
  it('ne donne aucune vulnérabilité à la faction', () => {
    for (const card of ALL_INTERIM_CARDS.filter(isPlanque)) {
      expect(card.weakness, card.id).toBeNull();
    }
  });
});

describe('Intérim — ligne et COMEX (D-020)', () => {
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
    const comex = ALL_INTERIM_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('interim-interimaire-legendaire-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('interim-interimaire-confirme');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of INTERIM_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});
