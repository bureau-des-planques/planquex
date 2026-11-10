import { describe, expect, it } from 'vitest';
import { MOTIFS_D, type CleD } from '../attribution';
import { MOTIFS } from '.';
import type { Motif } from './types';

/** Les clés de `cles` sans motif exploitable dans `table` (absentes, ou sans départ ni impact). */
function sansMotif(table: Partial<Record<string, Motif>>, cles: readonly string[]): string[] {
  return cles.filter((cle) => {
    const motif = table[cle];
    return !motif || !(motif.voyage > 0) || typeof motif.lancer !== 'function' || typeof motif.impact !== 'function';
  });
}

describe('la table des motifs d’attaque (#797)', () => {
  const cles = Object.keys(MOTIFS_D) as CleD[];

  it('chaque CleD a un motif, avec un trajet, un départ et un impact', () => {
    expect(cles.length).toBe(18);
    expect(sansMotif(MOTIFS, cles)).toEqual([]);
  });

  it('la table ne porte aucun motif que l’attribution ne connaît pas', () => {
    expect(Object.keys(MOTIFS).sort()).toEqual([...cles].sort());
  });

  it('le contrôle mord : une clé absente ou un motif vide est vu', () => {
    const { tampon: _retire, ...reste } = MOTIFS;
    expect(sansMotif(reste, cles)).toEqual(['tampon']);
    expect(sansMotif({ ...MOTIFS, zen: { voyage: 0, lancer() {}, impact() {} } }, cles)).toEqual(['zen']);
  });
});
