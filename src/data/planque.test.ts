import { describe, expect, it } from 'vitest';
import { ALL_CARDS, FACTION_META, isPlanque } from '.';
import { planqueBase, planquePalette, secretVariant } from './planque';
import type { Faction, PlanqueCard } from './types';

/**
 * Preuves du **socle de faction** (#54) : le constructeur, la variante secrète et le
 * dégradé dérivé de la couleur unique de `FACTION_META`.
 */

const FACTIONS = Object.keys(FACTION_META) as Faction[];
const PLANQUES = ALL_CARDS.filter(isPlanque);

/** Les trois arrêts d'un dégradé dérivé : `#rrggbb`, du clair au sombre. */
function stops(palette: string): string[] {
  return palette.match(/#[0-9a-f]{6}/gi) ?? [];
}

/** Clarté approximative d'un `#rrggbb`, pour vérifier l'ordre clair → sombre. */
function luma(hex: string): number {
  const int = Number.parseInt(hex.slice(1), 16);
  return (((int >> 16) & 0xff) + ((int >> 8) & 0xff) + (int & 0xff)) / 3;
}

describe('Socle — dégradé dérivé de la couleur unique (FACTION_META)', () => {
  it('produit trois arrêts : clair, la couleur de la faction, sombre', () => {
    for (const faction of FACTIONS) {
      const { color } = FACTION_META[faction];
      const palette = planquePalette(color);
      const [light, middle, dark] = stops(palette);
      expect(light, `${faction} : arrêt clair`).toBeDefined();
      expect(middle, `${faction} : la couleur de la faction`).toBe(color);
      expect(dark, `${faction} : arrêt sombre`).toBeDefined();
      expect(stops(palette), `${faction} : trois arrêts`).toHaveLength(3);
      expect(luma(light), `${faction} : le clair avant la couleur`).toBeLessThan(luma(color));
      expect(luma(dark), `${faction} : le sombre après la couleur`).toBeLessThan(luma(light));
    }
  });

  it('donne à chaque Planqué le dégradé de sa faction, et non un fond recopié', () => {
    for (const card of PLANQUES) {
      expect(card.palette, card.id).toBe(planquePalette(FACTION_META[card.faction].color));
    }
  });

  it('refuse une couleur qui n’est pas un `#rrggbb`', () => {
    expect(() => planquePalette('linear-gradient(#000, #fff)')).toThrow(/invalide/);
  });
});

describe('Socle — planqueBase', () => {
  it('porte la Vulnérabilité de la faction, jamais celle de la carte', () => {
    for (const card of PLANQUES) {
      expect(card.weakness, card.id).toBe(FACTION_META[card.faction].weakness);
    }
  });

  it('complète le type, la faction, le glyphe de faction et laisse surcharger le glyphe', () => {
    const input = {
      id: 'interim-socle',
      name: 'Socle',
      stage: 'ENTRANT' as const,
      rarity: '1D' as const,
      hp: 60,
      retreat: 1,
      attacks: [],
      flavor: 'Test.'
    };
    const base = planqueBase('INTERIM');
    const card = base(input);
    expect(card.kind).toBe('PLANQUE');
    expect(card.faction).toBe('INTERIM');
    expect(card.weakness).toBeNull();
    expect(card.glyph).toBe(FACTION_META.INTERIM.glyph);
    expect(base({ ...input, glyph: '✦' }).glyph).toBe('✦');
  });
});

describe('Socle — secretVariant', () => {
  const source: PlanqueCard = planqueBase('SSE')({
    id: 'sse-socle',
    name: 'Socle',
    stage: 'N+1',
    rarity: '2D',
    hp: 100,
    retreat: 2,
    attacks: [{ name: 'Pression', cost: 2, damage: 40 }],
    ability: { name: 'Talent', text: 'Test.', kind: 'draw', amount: 1 },
    flavor: 'Une scène de bureau.',
    glyph: '✚'
  });

  it('hérite de tout et ne change que l’identifiant, la rareté et le lien de variante', () => {
    for (const [suffix, rarity] of [
      ['star', '1S'],
      ['star2', '2S']
    ] as const) {
      const variant = secretVariant([source], 'sse-socle', suffix);
      expect(variant.id, suffix).toBe(`sse-socle-${suffix}`);
      expect(variant.rarity, suffix).toBe(rarity);
      expect(variant.variantOf, suffix).toBe('sse-socle');
      expect(variant.stage).toBe(source.stage);
      expect(variant.hp).toBe(source.hp);
      expect(variant.weakness).toBe(source.weakness);
      expect(variant.palette).toBe(source.palette);
      expect(variant.attacks).toEqual(source.attacks);
      expect(variant.ability).toEqual(source.ability);
      expect(variant.flavor).toBe(source.flavor);
      expect(variant.glyph).toBe(source.glyph);
    }
  });

  it('accepte un glyphe propre à la variante', () => {
    expect(secretVariant([source], 'sse-socle', 'star', '✦').glyph).toBe('✦');
  });

  it('échoue clairement si la carte de base n’existe pas', () => {
    expect(() => secretVariant([source], 'sse-absente', 'star')).toThrow(/introuvable/);
  });
});
