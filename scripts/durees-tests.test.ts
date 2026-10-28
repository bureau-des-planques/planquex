import { describe, expect, it } from 'vitest';
import { LIGNES_EN_TETE, SEUIL_SECONDES, TOP, classer, sansJustification, tableau } from './durees-tests.mjs';

/**
 * La règle de D-143 (5) : un fichier de test au-delà de 5 s dit en tête pourquoi il est lent, et
 * les dix plus lents sont publiés. Chaque règle est confrontée à un **cas fautif** fabriqué : un
 * contrôle qui ne peut pas échouer ne garde rien (AGENTS.md §6, #112).
 */

const base = '/depot';
const rapport = (fichiers: [string, number][]) => ({
  testResults: fichiers.map(([nom, s]) => ({ name: `${base}/${nom}`, startTime: 0, endTime: s * 1000 }))
});
const sansTete = 'import { it } from "vitest";\nit("x", () => {});\n';
const avecTete = `// Lent : chaque cas monte une base.\n${sansTete}`;

describe('scripts/durees-tests.mjs — les tests les plus lents (D-143 (5), #422)', () => {
  it('classe du plus lent au plus rapide, avec des chemins relatifs à la racine', () => {
    const lignes = classer(
      rapport([
        ['a.test.ts', 2],
        ['supabase/b.test.ts', 9],
        ['c.test.ts', 4]
      ]),
      base
    );
    expect(lignes.map((l) => l.fichier)).toEqual(['supabase/b.test.ts', 'c.test.ts', 'a.test.ts']);
    expect(lignes[0].duree).toBe(9);
  });

  it('le contrôle mord : un fichier au-delà de 5 s sans « Lent : » en tête est refusé', () => {
    const lignes = classer(rapport([['lourd.test.ts', 6]]), base);
    const fautifs = sansJustification(lignes, () => sansTete);
    expect(fautifs.map((l) => l.fichier)).toEqual(['lourd.test.ts']);
  });

  it('un fichier au-delà de 5 s qui se justifie en tête passe', () => {
    const lignes = classer(rapport([['lourd.test.ts', 6]]), base);
    expect(sansJustification(lignes, () => avecTete)).toEqual([]);
  });

  it('une justification écrite après la tête ne compte pas : elle doit être en tête', () => {
    const loin = `${'// rien\n'.repeat(LIGNES_EN_TETE)}// Lent : trop tard\n`;
    const lignes = classer(rapport([['lourd.test.ts', 6]]), base);
    expect(sansJustification(lignes, () => loin)).toHaveLength(1);
  });

  it('un fichier sous le seuil n’a pas besoin de justification', () => {
    const lignes = classer(rapport([['rapide.test.ts', SEUIL_SECONDES]]), base);
    expect(sansJustification(lignes, () => sansTete)).toEqual([]);
  });

  it('publie les dix premiers, en tableau markdown, durée à la virgule', () => {
    const fichiers: [string, number][] = Array.from({ length: 12 }, (_, i) => [`f${i}.test.ts`, 20 - i]);
    const table = tableau(classer(rapport(fichiers), base));
    const lignes = table.split('\n');
    expect(lignes).toHaveLength(TOP + 2);
    expect(lignes[2]).toBe('| `f0.test.ts` | 20,0 |');
  });
});
