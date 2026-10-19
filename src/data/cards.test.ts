import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, FACTION_META, RARITY_META, STAGE_META, getCard } from '@/data';
import type { AttackEffectKind, Card, Faction, Stage } from '@/data/types';

/**
 * Fichier de contrôle des conventions d'écriture des cartes.
 *
 * Chaque assertion cite sa règle : `AGENTS.md` §3 (vocabulaire), §5 (écriture des
 * cartes) ou `docs/CARD-SPEC.md` §1-2. Une carte qui échoue ici est une carte à
 * rectifier — pas un test à assouplir.
 *
 * Les deux mots interdits qui partagent la même racine sont reconstruits par
 * fragments : `AGENTS.md` §8.4 exige **zéro** occurrence de ce mot dans `src/`,
 * y compris dans les tests. Le test doit donc le chercher sans l'écrire.
 */
const FORBIDDEN = ['Gal' + 'ère', 'Gal' + 'èreMon', 'Grèvomon', 'Pokémon'];

const EFFECT_KINDS: AttackEffectKind[] = [
  'healSelf',
  'healAll',
  'status',
  'draw',
  'discardEnergy',
  'selfDamage',
  'switchSelf',
  'reduceDamage'
];

const ABILITY_KINDS: NonNullable<Card['ability']>['kind'][] = [
  'heal',
  'draw',
  'attachEnergy',
  'reduceDamage',
  'antiStatus'
];

/** `AGENTS.md` §3.2 : chaque faction est vulnérable à une seule autre. */
const WEAKNESS: Record<Faction, Faction | null> = {
  SSE: 'MANAGER',
  MANAGER: 'HAPPINESS',
  HAPPINESS: 'AMELIORATION',
  AMELIORATION: 'TECHNICIEN',
  RH: 'DIRECTION',
  TECHNICIEN: 'RH',
  DIRECTION: 'TECHNICIEN',
  SYNDICAT: 'MANAGER',
  INTERIMAIRE: null,
  SUPPORT: 'TECHNICIEN'
};

const STAGE_ORDER: Stage[] = ['N+1', 'N+2', 'COMEX'];

/**
 * Dégâts par coût en café — **règle normative** (CARD-SPEC.md §2, D-021).
 * Bandes ancrées sur les cartes réelles de TCG Pocket, relevées le 19/10/2026.
 */
const DAMAGE_BY_COST: Record<number, [number, number]> = {
  0: [0, 30],
  1: [10, 30],
  2: [40, 80],
  3: [70, 120],
  4: [100, 160]
};

const texts = (card: Card): string[] => [
  card.name,
  card.flavor,
  ...card.attacks.flatMap((attack) => [attack.name, attack.text ?? '']),
  card.ability?.name ?? '',
  card.ability?.text ?? ''
];

describe('Cartes — structure (CARD-SPEC.md §1)', () => {
  it('n’a aucun identifiant en double et chaque carte est enregistrée', () => {
    const ids = ALL_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of ALL_CARDS) {
      expect(getCard(card.id)).toBe(card);
      expect(CARD_BY_ID.get(card.id)).toBe(card);
    }
  });

  it('identifie chaque carte en kebab-case préfixé par sa faction (AGENTS.md §5)', () => {
    for (const card of ALL_CARDS) {
      expect(card.id, card.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(card.id.startsWith(`${card.faction.toLowerCase()}-`), `${card.id} vs ${card.faction}`).toBe(true);
    }
  });

  it('a un stade, une rareté et des métadonnées connues', () => {
    for (const card of ALL_CARDS) {
      expect(STAGE_ORDER, card.id).toContain(card.stage);
      expect(STAGE_META[card.stage], card.id).toBeDefined();
      expect(RARITY_META[card.rarity], card.id).toBeDefined();
      expect(FACTION_META[card.faction], card.id).toBeDefined();
      expect(card.hp, card.id).toBeGreaterThan(0);
      expect(card.retreat, card.id).toBeGreaterThanOrEqual(0);
      expect(card.attacks.length, card.id).toBeGreaterThan(0);
      expect(card.palette.length, card.id).toBeGreaterThan(0);
      expect(card.glyph.length, card.id).toBeGreaterThan(0);
    }
  });

  it('n’utilise que les primitives d’effet et de talent déclarées (AGENTS.md §5)', () => {
    for (const card of ALL_CARDS) {
      for (const attack of card.attacks) {
        expect(attack.cost, `${card.id}/${attack.name}`).toBeGreaterThanOrEqual(0);
        expect(attack.damage, `${card.id}/${attack.name}`).toBeGreaterThanOrEqual(0);
        for (const effect of attack.effects ?? []) {
          expect(EFFECT_KINDS, `${card.id}/${attack.name}`).toContain(effect.kind);
          if (effect.kind === 'status') {
            expect(effect.status, `${card.id}/${attack.name}`).toBeDefined();
          }
        }
      }
      if (card.ability) {
        expect(ABILITY_KINDS, card.id).toContain(card.ability.kind);
      }
    }
  });
});

describe('Cartes — lignes d’évolution (AGENTS.md §5)', () => {
  it('fait pointer `evolvesFrom` vers la carte du stade précédent', () => {
    for (const card of ALL_CARDS.filter((entry) => !entry.variantOf)) {
      const index = STAGE_ORDER.indexOf(card.stage);
      if (card.stage === 'N+1') {
        expect(card.evolvesFrom, `${card.id} ne doit pas évoluer`).toBeUndefined();
        continue;
      }
      expect(card.evolvesFrom, `${card.id} doit évoluer`).toBeTruthy();
      const previous = card.evolvesFrom ? getCard(card.evolvesFrom) : undefined;
      expect(previous, `${card.id} → ${card.evolvesFrom}`).toBeDefined();
      expect(previous?.stage, `${card.id} → ${card.evolvesFrom}`).toBe(STAGE_ORDER[index - 1]);
    }
  });

  it('fait hériter une variante de sa carte de base', () => {
    const variants = ALL_CARDS.filter((card) => card.variantOf);
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      const source = variant.variantOf ? getCard(variant.variantOf) : undefined;
      expect(source, variant.id).toBeDefined();
      if (!source) continue;
      expect(source.variantOf, `${variant.id} : une variante de variante`).toBeUndefined();
      expect(variant.id, variant.id).toMatch(/-star2?$/);
      expect(variant.faction, variant.id).toBe(source.faction);
      expect(variant.stage, variant.id).toBe(source.stage);
      expect(variant.hp, variant.id).toBe(source.hp);
      expect(variant.retreat, variant.id).toBe(source.retreat);
      expect(variant.weakness, variant.id).toBe(source.weakness);
      expect(variant.attacks, variant.id).toEqual(source.attacks);
      expect(variant.ability, variant.id).toEqual(source.ability);
      expect(variant.flavor, variant.id).toBe(source.flavor);
      expect(variant.ex, variant.id).toBe(source.ex);
    }
  });
});

describe('Cartes — dégâts par café (CARD-SPEC.md §2, normatif depuis D-021)', () => {
  it('place chaque attaque dans la bande de son coût', () => {
    for (const card of ALL_CARDS) {
      for (const attack of card.attacks) {
        const band = DAMAGE_BY_COST[attack.cost];
        expect(band, `${card.id}/${attack.name} : coût ${attack.cost} café(s) non couvert`).toBeDefined();
        if (!band) continue;
        const label = `${card.id}/${attack.name} à ${attack.cost} café(s)`;
        expect(attack.damage, label).toBeGreaterThanOrEqual(band[0]);
        expect(attack.damage, label).toBeLessThanOrEqual(band[1]);
      }
    }
  });
});

describe('Cartes — Cadre et Vulnérabilité (AGENTS.md §3.2, §5)', () => {
  it('vulnérabilise chaque carte selon la table des factions', () => {
    for (const card of ALL_CARDS) {
      expect(card.weakness, card.id).toBe(WEAKNESS[card.faction]);
    }
  });

  it('réserve le Cadre aux COMEX 4 diamants et le nomme « Cadre », pas « ex »', () => {
    for (const card of ALL_CARDS) {
      if (card.ex) {
        expect(card.stage, card.id).toBe('COMEX');
        expect(card.rarity, card.id).toBe('4D');
      }
      // L'UI affiche le nom : il ne doit pas porter la marque « ex ».
      expect(card.name, card.id).not.toMatch(/(?:^|\s)ex(?:\s|$)/i);
    }
  });
});

describe('Cartes — textes (AGENTS.md §3, §5)', () => {
  it('écrit les textes en français, sans mot interdit ni « banc »', () => {
    for (const card of ALL_CARDS) {
      for (const text of texts(card)) {
        for (const word of FORBIDDEN) {
          expect(text, `${card.id} : « ${word} »`).not.toContain(word);
        }
        // §3.1 : Bench → Open-space. « banc » n'a rien à faire dans un texte de carte.
        expect(text, `${card.id} : « ${text} »`).not.toMatch(/\bbanc\b/i);
      }
    }
  });

  it('donne un texte à toute attaque portant un effet', () => {
    for (const card of ALL_CARDS) {
      for (const attack of card.attacks) {
        expect(attack.name.trim(), card.id).not.toBe('');
        if ((attack.effects ?? []).length > 0) {
          expect(attack.text?.trim(), `${card.id}/${attack.name} : effet sans texte`).toBeTruthy();
        }
      }
      if (card.ability) {
        expect(card.ability.name.trim(), card.id).not.toBe('');
        expect(card.ability.text.trim(), card.id).not.toBe('');
      }
      expect(card.flavor.trim(), card.id).not.toBe('');
    }
  });
});
