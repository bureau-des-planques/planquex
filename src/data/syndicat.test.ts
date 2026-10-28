import { describe, expect, it } from 'vitest';
import { ALL_SYNDICAT_CARDS, SYNDICAT_CARDS, SYNDICAT_VARIANTS } from '@/data/syndicat';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import type { PlanqueCard } from '@/data/types';

/**
 * Contrôles propres à la faction **Syndicat** (code `SYN`), ticket #21.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier ne contrôle que ce que le ticket demande explicitement — le **nombre
 * d'entrées** (`PROPOSITION.md` §4.3 : 5), le **vivier Atelier** (D-026) et le
 * **COMEX** (D-020, D-027).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

const LINE = ['syndicat-delegue-personnel', 'syndicat-representant-cse', 'syndicat-secretaire-general'];

describe('Syndicat — enregistrement (ticket #21)', () => {
  it('compte 11 entrées, dont 10 bases et 1 variante secrète (vague 2, #86 ; vague #352)', () => {
    // La vague 2 (#86) ajoute une ligne à 3 stades (Trésorier CSE → Président CSE)
    // pour atteindre la cible de rareté `CARD-SPEC.md` §1 : 42 cartes en 3◆. La vague
    // #352 ajoute 4 bases (Délégué syndical → Permanent syndical, le Collectif d’atelier
    // et le Représentant de section) : la faction atteint **10 noms de base**, le minimum
    // pour un Deck mono-faction de 20 cartes (2 exemplaires par nom). Le quota de
    // `PROPOSITION.md` §4.3 (5 entrées) est dépassé : l'écart est signalé au ticket #63.
    expect(SYNDICAT_CARDS).toHaveLength(10);
    expect(SYNDICAT_VARIANTS).toHaveLength(1);
    expect(ALL_SYNDICAT_CARDS).toHaveLength(11);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_SYNDICAT_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'SYNDICAT')).toHaveLength(
      ALL_SYNDICAT_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `syndicat-` (docs/JEU.md §5)', () => {
    for (const card of ALL_SYNDICAT_CARDS) {
      expect(card.id, card.id).toMatch(/^syndicat-[a-z0-9-]*$/);
      expect(card.faction, card.id).toBe('SYNDICAT');
    }
  });

  it('range toute la faction dans le vivier Atelier (D-026)', () => {
    expect(FACTION_META.SYNDICAT.vivier).toBe('ATELIER');
    for (const card of ALL_SYNDICAT_CARDS) {
      expect(vivierOf(card), card.id).toBe('ATELIER');
    }
  });
});

describe('Syndicat — ligne et COMEX (D-020)', () => {
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
    const comex = ALL_SYNDICAT_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex).toHaveLength(1);
    expect(comex[0]?.id).toBe('syndicat-secretaire-general-ex');
    // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
    expect(comex[0]?.rarity).toBe('4D');
    expect(comex[0]?.stage).toBe('N+2');
    expect(comex[0]?.evolvesFrom).toBe('syndicat-representant-cse');
  });

  it('ne décline aucune variante de COMEX (le 4D est réservé au statut)', () => {
    for (const variant of SYNDICAT_VARIANTS.filter(isPlanque)) {
      expect(variant.ex, variant.id).toBeUndefined();
    }
  });
});
