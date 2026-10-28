import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT,
  MARQUE,
  RACINE,
  SEUIL_SECONDES,
  justifie,
  classement,
  lignesPubliees,
  lire,
  rendre,
  sansJustification
} from './tests-lents.mjs';

/**
 * **Un fichier de test lent dit pourquoi** (#422, D-143 (5)).
 *
 * Constaté le 28/10/2026 : trois lenteurs ont été corrigées dans la journée (#392, #403, #408)
 * et toutes ont été trouvées **par hasard**, en lisant une sortie. Au-delà de 5 s, un fichier
 * doit donc porter, en tête, la raison de sa durée : une suite qui coûte par nature (PGlite,
 * simulation, captures, écrans) reste — elle a attrapé de vrais défauts — mais elle se justifie.
 *
 * Le classement publié (`docs/TESTS-LENTS.md`) est **dérivé** : `npm run tests:lents -- --ecrire`
 * le réécrit depuis la sortie machine de vitest. Ce fichier le relit et refuse un fichier lent
 * qui ne dirait rien de sa lenteur.
 *
 * **Le contrôle mord** sur un classement **fabriqué** : un fichier au-delà du seuil et muet doit
 * être signalé, et le même fichier annoté doit passer. Sans ce bloc, la garde ne prouverait que
 * l'état d'aujourd'hui.
 */

/** Un faux dépôt : le document et les fichiers qu'il cite. */
function fauxDepot(fichiers: Record<string, string | null>, lignes: string): string {
  const racine = mkdtempSync(join(tmpdir(), 'tests-lents-'));
  for (const [nom, source] of Object.entries(fichiers)) {
    const chemin = join(racine, nom);
    mkdirSync(join(chemin, '..'), { recursive: true });
    if (source !== null) writeFileSync(chemin, source);
  }
  mkdirSync(join(racine, 'docs'), { recursive: true });
  writeFileSync(join(racine, DOCUMENT), lignes);
  return racine;
}

/** Le document publié, lu une fois : `null` est déjà un échec nommé plus bas. */
function document(): string {
  const texte = lire(RACINE, DOCUMENT);
  expect(texte, `${DOCUMENT} est introuvable — le régénérer : npm run tests:lents -- --ecrire`).not.toBeNull();
  return texte ?? '';
}

const MURMURE = '/** Un fichier de test ordinaire. */\nimport { it } from "vitest";\n';
const ANNOTE = `// ${MARQUE} (D-143 (5)) — monte une base PGlite par cas\n${MURMURE}`;

describe('la règle des 5 s — un fichier lent dit pourquoi (D-143 (5))', () => {
  it('le document publié est lu et cite des fichiers (sinon rien n’est gardé)', () => {
    const lignes = lignesPubliees(document());
    expect(lignes.length, `aucune ligne lisible dans ${DOCUMENT}`).toBeGreaterThan(5);
    expect(lignes.every((ligne) => ligne.secondes > SEUIL_SECONDES), 'le document publie un fichier sous le seuil').toBe(
      true
    );
  });

  it('tout fichier publié au-delà du seuil porte sa justification en tête', () => {
    const lignes = lignesPubliees(document());
    expect(
      sansJustification(RACINE, lignes),
      'fichier(s) de test au-delà de ' +
        `${SEUIL_SECONDES} s sans ligne « ${MARQUE} » en tête (D-143 (5)) : une suite coûteuse se justifie, ` +
        'sinon elle se corrige. Ajouter la ligne, ou corriger la lenteur.'
    ).toEqual([]);
  });

  it('le contrôle mord : un fichier lent et muet est signalé, le même annoté passe', () => {
    const lignes = ['| `lent.test.ts` | 12.0 s | 3 | **NON** |', '| `vite.test.ts` | 1.0 s | 3 | — |'].join('\n');

    const muet = fauxDepot({ 'lent.test.ts': MURMURE }, lignes);
    const signale = sansJustification(muet, lignesPubliees(lignes));
    expect(signale.map((ligne) => ligne.fichier)).toEqual(['lent.test.ts']);
    expect(signale[0].raison).toMatch(/Lenteur justifiée/);
    // Un fichier **du classement** qui n'existe plus est aussi une lenteur sans témoin.
    const absent = fauxDepot({}, lignes);
    expect(sansJustification(absent, lignesPubliees(lignes))[0].raison).toMatch(/introuvable/);

    const annote = fauxDepot({ 'lent.test.ts': ANNOTE }, lignes);
    expect(sansJustification(annote, lignesPubliees(lignes))).toEqual([]);
  });

  it('le classement se dérive de la sortie machine, pas d’une copie', () => {
    // La forme que rend `--reporter=json` : un fichier, un début, une fin, ses cas.
    const rapport = {
      testResults: [
        { name: join(RACINE, 'a.test.ts'), startTime: 0, endTime: 12_000, assertionResults: [{}, {}] },
        { name: join(RACINE, 'b.test.ts'), startTime: 0, endTime: 1_500, assertionResults: [{}] }
      ]
    };
    expect(classement(rapport)).toEqual([
      { fichier: 'a.test.ts', secondes: 12, tests: 2 },
      { fichier: 'b.test.ts', secondes: 1.5, tests: 1 }
    ]);
  });

  it('le document publié et la garde parlent du même classement (aller-retour)', () => {
    const lignes = [
      { fichier: 'a.test.ts', secondes: 42.7, tests: 53 },
      { fichier: 'b.test.ts', secondes: 5.1, tests: 2 }
    ];
    const publie = lignesPubliees(rendre(lignes, { date: '2026-10-28' }));
    expect(publie).toEqual(lignes);
  });

  it('la marque se lit en tête, pas au milieu du fichier', () => {
    expect(justifie(ANNOTE)).toBe(true);
    expect(justifie(MURMURE)).toBe(false);
    // Perdue après quarante lignes, elle n'est plus « en tête » : on ne l'ouvre pas dessus.
    expect(justifie(`${MURMURE}${'//\n'.repeat(45)}// ${MARQUE}\n`)).toBe(false);
  });
});
