import { describe, expect, it } from 'vitest';
import { ALL_SSE_CARDS, SSE_CARDS, SSE_VARIANTS } from '@/data/sse';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, getCard, isPlanque, vivierOf } from '@/data';
import { secretSuffix } from '@/data/planque';
import type { CafeSymbol, PlanqueCard, Stage } from '@/data/types';

/**
 * Contrôles propres à la faction **SSE** (code `SSE`), ticket #99.
 *
 * Les conventions générales (identifiants, lignes d'évolution, Seuil, dégâts par
 * café, vocabulaire) sont déjà vérifiées sur `ALL_CARDS` par `cards.test.ts` : ce
 * fichier est la preuve dédiée à SSE, la seule faction qui n'en avait pas. Il porte
 * sur **toutes** ses cartes, variantes comprises, et contrôle en plus les points que
 * le ticket demande explicitement — le **coût en café typé** (D-037), les **lignes
 * d'évolution**, l'**unicité** et la **Vulnérabilité `MANAGEMENT`** (dont
 * `FACTION_META` est la seule source).
 */

const byId = (id: string): PlanqueCard | undefined => {
  const card = getCard(id);
  return isPlanque(card) ? card : undefined;
};

/**
 * Les symboles qu'une Pression SSE peut porter (D-037 (1)) : le type produit de sa
 * faction, ou `INCOLORE` — **jamais** `SUPPORT` (Incolore du jeu) ni `INTERIM`.
 */
const SSE_SYMBOLS: CafeSymbol[] = ['SSE', 'INCOLORE'];

const STAGE_ORDER: Stage[] = ['ENTRANT', 'N+1', 'N+2'];

const LINE = ['sse-infirmier-site', 'sse-infirmiere-travail', 'sse-medecin-travail'];

describe('SSE — enregistrement (ticket #99)', () => {
  it('compte 39 entrées, dont 28 bases et 11 variantes (PROPOSITION.md §4.3 : 37, +1 COMEX en vague 1, +1 en vague 2)', () => {
    // PROPOSITION.md §4.3 : 37 entrées à la cible. La vague 1 (#66) ajoute le second
    // COMEX, la vague 2 (#86) ajoute « Responsable sécurité » ; les vagues suivantes
    // complètent le set, dont le volume suit D-063 (« autour de 300 », sans compter)
    // et se lit dans `npm run status`.
    expect(SSE_CARDS).toHaveLength(28);
    expect(SSE_VARIANTS).toHaveLength(11);
    expect(ALL_SSE_CARDS).toHaveLength(39);
  });

  it('est enregistrée dans ALL_CARDS et CARD_BY_ID', () => {
    for (const card of ALL_SSE_CARDS) {
      expect(ALL_CARDS, card.id).toContain(card);
      expect(CARD_BY_ID.get(card.id), card.id).toBe(card);
    }
    // Le spread de `index.ts` : aucune carte de la faction ne doit manquer.
    expect(ALL_CARDS.filter((card) => isPlanque(card) && card.faction === 'SSE')).toHaveLength(
      ALL_SSE_CARDS.length
    );
  });

  it('identifie chaque carte par le préfixe `sse-` (docs/JEU.md §5)', () => {
    for (const card of ALL_SSE_CARDS) {
      expect(card.id, card.id).toMatch(/^sse-[a-z0-9-]+$/);
      expect(card.faction, card.id).toBe('SSE');
      expect(card.name.trim(), card.id).not.toBe('');
    }
  });

  it('range toute la faction dans le vivier Bureaux (D-026)', () => {
    expect(FACTION_META.SSE.vivier).toBe('BUREAUX');
    for (const card of ALL_SSE_CARDS) {
      expect(vivierOf(card), card.id).toBe('BUREAUX');
    }
  });
});

describe('SSE — conventions de nom (docs/JEU.md §5, D-026)', () => {
  it('suffixe chaque variante par le suffixe de sa rareté, et lui laisse le nom de sa base', () => {
    for (const variant of SSE_VARIANTS.filter(isPlanque)) {
      const source = variant.variantOf ? byId(variant.variantOf) : undefined;
      expect(source, variant.id).toBeDefined();
      if (!source) continue;
      const suffix = secretSuffix(variant.rarity);
      expect(suffix, variant.id).toBeDefined();
      expect(variant.id, variant.id).toBe(`${source.id}-${suffix}`);
      expect(variant.name, variant.id).toBe(source.name);
    }
  });

  it('suffixe chaque COMEX par `-ex` et écrit « COMEX » dans son nom (D-026)', () => {
    const comex = ALL_SSE_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex.length).toBeGreaterThan(0);
    for (const card of comex) {
      expect(card.id, card.id).toMatch(/-ex$/);
      expect(card.name, card.id).toContain('COMEX');
    }
  });
});

describe('SSE — Vulnérabilité MANAGEMENT (docs/JEU.md §3.2)', () => {
  it('déclare `MANAGEMENT` comme Vulnérabilité de la faction, dans FACTION_META seule', () => {
    expect(FACTION_META.SSE.weakness).toBe('MANAGEMENT');
  });

  it('fait hériter chaque carte de la Vulnérabilité de sa faction', () => {
    for (const card of ALL_SSE_CARDS.filter(isPlanque)) {
      expect(card.weakness, card.id).toBe(FACTION_META.SSE.weakness);
      expect(card.weakness, card.id).toBe('MANAGEMENT');
    }
  });
});

describe('SSE — coût en café typé (D-037)', () => {
  it('donne à chaque Pression une liste de `CafeSymbol` (D-037 (1))', () => {
    for (const card of ALL_SSE_CARDS.filter(isPlanque)) {
      for (const attack of card.attacks) {
        const label = `${card.id}/${attack.name}`;
        expect(Array.isArray(attack.cost), label).toBe(true);
        for (const symbol of attack.cost) {
          expect(SSE_SYMBOLS, `${label} → ${symbol}`).toContain(symbol);
        }
        // `SUPPORT` et `INTERIM` ne sont pas des symboles de coût : ce sont des
        // factions, et `INCOLORE` est leur symbole à elles (D-037 (1)).
        expect(attack.cost, label).not.toContain('SUPPORT' as never);
        expect(attack.cost, label).not.toContain('INTERIM' as never);
      }
    }
  });

  it('met ≥ 1 café `SSE` et le reste en `INCOLORE`, sans position imposée (D-037 (3), #101)', () => {
    for (const card of ALL_SSE_CARDS.filter(isPlanque)) {
      for (const attack of card.attacks) {
        const label = `${card.id}/${attack.name}`;
        // Un coût vide ne porte aucun café `SSE` : il est refusé, pas sauté.
        expect(attack.cost.length, `${label} : coût vide`).toBeGreaterThan(0);
        // La règle ne fixe aucune position : on teste l'appartenance, pas `cost[0]`.
        expect(attack.cost, label).toContain('SSE');
        expect(attack.cost.every((symbol) => symbol === 'SSE' || symbol === 'INCOLORE'), label).toBe(true);
      }
    }
  });
});

describe('SSE — lignes d’évolution (docs/JEU.md §5)', () => {
  it('a une ligne signature complète Entrant → N+1 → N+2', () => {
    const [entrant, n1, n2] = LINE.map(byId);
    expect(entrant?.stage).toBe('ENTRANT');
    expect(entrant?.evolvesFrom).toBeUndefined();
    expect(n1?.stage).toBe('N+1');
    expect(n1?.evolvesFrom).toBe(LINE[0]);
    expect(n2?.stage).toBe('N+2');
    expect(n2?.evolvesFrom).toBe(LINE[1]);
  });

  it('fait pointer chaque `evolvesFrom` vers un id existant du stade précédent, dans SSE', () => {
    for (const card of SSE_CARDS) {
      const index = STAGE_ORDER.indexOf(card.stage);
      if (card.stage === 'ENTRANT') {
        expect(card.evolvesFrom, `${card.id} ne doit pas évoluer`).toBeUndefined();
        continue;
      }
      expect(card.evolvesFrom, `${card.id} doit évoluer`).toBeTruthy();
      const previous = card.evolvesFrom ? byId(card.evolvesFrom) : undefined;
      expect(previous, `${card.id} → ${card.evolvesFrom} : id introuvable`).toBeDefined();
      expect(previous?.stage, `${card.id} → ${card.evolvesFrom}`).toBe(STAGE_ORDER[index - 1]);
      expect(previous?.faction, `${card.id} → ${card.evolvesFrom}`).toBe('SSE');
    }
  });

  it('a deux COMEX, en 4 diamants, à 2 Interventions, sur deux lignes distinctes', () => {
    const comex = ALL_SSE_CARDS.filter(isPlanque).filter((card) => card.ex);
    expect(comex.map((card) => card.id)).toEqual(['sse-medecin-chef-ex', 'sse-responsable-sse-ex']);
    for (const card of comex) {
      // D-020 : `ex: true` ⇒ 4D ⇒ 2 Interventions (engine.ts `knockOut`).
      expect(card.rarity, card.id).toBe('4D');
      expect(card.stage, card.id).toBe('N+2');
    }
    expect(comex.map((card) => card.evolvesFrom)).toEqual(['sse-sophrologue', 'sse-ergonome']);
  });

  it('fait pointer chaque COMEX vers un N+1 de la même faction', () => {
    for (const card of ALL_SSE_CARDS.filter(isPlanque).filter((entry) => entry.ex)) {
      const previous = card.evolvesFrom ? byId(card.evolvesFrom) : undefined;
      expect(previous?.stage, card.id).toBe('N+1');
      expect(previous?.faction, card.id).toBe('SSE');
    }
  });
});

describe('SSE — unicité (deck.ts compte par nom)', () => {
  it('n’a aucun id en double dans la faction', () => {
    const ids = ALL_SSE_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ne partage aucun nom entre deux bases distinctes', () => {
    // `deck.ts` limite les exemplaires **par nom** : deux bases homonymes feraient
    // sauter la limite silencieusement (même règle que `cards.test.ts`).
    const byName = new Map<string, string[]>();
    for (const card of SSE_CARDS) {
      byName.set(card.name, [...(byName.get(card.name) ?? []), card.id]);
    }
    const shared = [...byName.entries()].filter(([, ids]) => ids.length > 1);
    expect(shared.map(([name]) => name)).toEqual([]);
  });

  it('fait hériter chaque variante de sa base, sans variante de variante', () => {
    const seen = new Set<string>();
    for (const variant of SSE_VARIANTS.filter(isPlanque)) {
      const source = variant.variantOf ? byId(variant.variantOf) : undefined;
      expect(source, variant.id).toBeDefined();
      if (!source) continue;
      expect(source.variantOf, `${variant.id} : une variante de variante`).toBeUndefined();
      expect(seen.has(source.id), `${source.id} a plus d’une variante`).toBe(false);
      seen.add(source.id);
      expect(variant.faction, variant.id).toBe(source.faction);
      expect(variant.stage, variant.id).toBe(source.stage);
      expect(variant.hp, variant.id).toBe(source.hp);
      expect(variant.retreat, variant.id).toBe(source.retreat);
      expect(variant.weakness, variant.id).toBe(source.weakness);
      expect(variant.attacks, variant.id).toEqual(source.attacks);
      expect(variant.ability, variant.id).toEqual(source.ability);
      expect(variant.flavor, variant.id).toBe(source.flavor);
      expect(variant.palette, variant.id).toBe(source.palette);
      expect(variant.ex, variant.id).toBe(source.ex);
      expect(secretSuffix(variant.rarity), variant.id).toBeDefined();
    }
  });
});
