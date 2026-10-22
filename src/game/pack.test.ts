import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';
import { openPackCards, PACK_COMPOSITION, PACK_SIZE } from '@/game/pack';
import { seedRng } from '@/game/rng';
import type { RngHolder } from '@/game/rng';

/**
 * Ouvre un Arrivage depuis une graine, **sans store** : le générateur est passé en
 * paramètre, comme pour le moteur. C'est la preuve que la composition n'est plus
 * une affaire d'état d'application (#57).
 */
function packFromSeed(seed: number): string[] {
  const holder: RngHolder = { rng: seedRng(seed) };
  return openPackCards(holder).map((card) => card.id);
}

describe('Composition d’un Arrivage (§4.2)', () => {
  it('distribue 5 cartes, selon la composition déclarée', () => {
    const cards = openPackCards({ rng: seedRng(7) });

    expect(cards).toHaveLength(PACK_SIZE);
    expect(PACK_COMPOSITION.reduce((total, slot) => total + slot.count, 0)).toBe(PACK_SIZE);
  });

  it('respecte 3 communes, 1 peu commune, 1 rare', () => {
    for (const seed of [1, 7, 42, 99, 2026]) {
      const cards = openPackCards({ rng: seedRng(seed) });
      const groups = PACK_COMPOSITION.map(
        (slot) => cards.filter((card) => slot.rarities.includes(card.rarity)).length
      );
      expect(groups, `graine ${seed}`).toEqual(PACK_COMPOSITION.map((slot) => slot.count));
    }
  });

  it('même graine → même Arrivage ; graines différentes → Arrivages différents', () => {
    expect(packFromSeed(7)).toEqual(packFromSeed(7));
    expect(packFromSeed(7)).not.toEqual(packFromSeed(99));
  });

  it('avance le générateur passé en paramètre', () => {
    const holder: RngHolder = { rng: seedRng(7) };
    const start = holder.rng;
    openPackCards(holder);
    expect(holder.rng).not.toBe(start);
  });

  it('ne tire que des cartes de la Collection', () => {
    const known = new Set(ALL_CARDS.map((card) => card.id));
    for (const id of packFromSeed(7)) expect(known.has(id)).toBe(true);
  });
});
