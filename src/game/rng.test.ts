import { describe, expect, it } from 'vitest';
import { drawRandom, seedRng, stepRng } from '@/game/rng';

/** Suite de N tirages depuis une graine. */
function series(seed: number, count: number): number[] {
  const holder = { rng: seedRng(seed) };
  return Array.from({ length: count }, () => drawRandom(holder));
}

describe('Générateur seedé (#29)', () => {
  it('tire toujours dans [0, 1)', () => {
    for (const value of series(1, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('rejoue la même suite pour une même graine', () => {
    expect(series(42, 50)).toEqual(series(42, 50));
  });

  it('diverge dès la première valeur pour deux graines voisines', () => {
    expect(series(1, 1)[0]).not.toBe(series(2, 1)[0]);
    expect(series(1, 10)).not.toEqual(series(2, 10));
  });

  it('avance l’état du porteur à chaque tirage', () => {
    const holder = { rng: seedRng(7) };
    const start = holder.rng;
    drawRandom(holder);
    expect(holder.rng).not.toBe(start);
  });

  it('normalise les graines non entières, négatives ou invalides', () => {
    for (const seed of [Date.now(), -12, 3.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = seedRng(seed);
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(0);
      expect(state).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('reste équilibré : moyenne proche de 0,5 sur 10 000 tirages', () => {
    const values = series(123, 10_000);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
    // Un générateur bloqué ou à pas constant se verrait ici.
    expect(new Set(values).size).toBeGreaterThan(9_000);
  });

  it('stepRng est pure : même état, même résultat, état d’entrée intact', () => {
    const state = seedRng(99);
    const first = stepRng(state);
    expect(stepRng(state)).toEqual(first);
    expect(state).toBe(seedRng(99));
  });
});
