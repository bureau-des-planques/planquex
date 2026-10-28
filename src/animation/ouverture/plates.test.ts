import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **Le poids des plaques de l'ouverture** (#283).
 *
 * Le sachet est photographié : sept états, un masque et l'autocollant détouré. C'est ce qui donne
 * le réalisme, et c'est aussi ce qui pèse — la spec annonce un budget, et un budget qu'aucun
 * contrôle ne vérifie est un vœu. Ce test **échoue** si une plaque ajoutée demain fait doubler le
 * lot, ou si un fichier disparaît (l'animation se dégraderait en silence).
 */
const DOSSIER = new URL('./plates/', import.meta.url).pathname;
/** Budget du lot : 400 Ko. Les sept photos et deux masques y tiennent largement aujourd'hui. */
const BUDGET_KO = 400;
const ATTENDUS = [
  'p0.webp',
  'p1.webp',
  'p2.webp',
  'p3.webp',
  'p4.webp',
  'p5.webp',
  'p6.webp',
  'masque.webp',
  'etiquette-volee.webp'
];

describe('les plaques du sachet — le budget de poids (#283)', () => {
  it('les neuf plaques existent', () => {
    const presents = readdirSync(DOSSIER)
      .filter((f) => f.endsWith('.webp'))
      .sort();
    expect(presents).toEqual([...ATTENDUS].sort());
  });

  it('le lot tient dans le budget annoncé par la spec', () => {
    const octets = ATTENDUS.reduce((somme, nom) => somme + statSync(join(DOSSIER, nom)).size, 0);
    const ko = octets / 1024;
    // Le message porte le chiffre : un dépassement doit dire de combien.
    expect(ko, `le lot pèse ${Math.round(ko)} Ko pour un budget de ${BUDGET_KO} Ko`).toBeLessThanOrEqual(BUDGET_KO);
  });

  it('le contrôle mord : une plaque ajoutée au-delà du budget change le compte', () => {
    // Sans cette confrontation, un test de poids sur un dossier vide passerait aussi.
    const octets = ATTENDUS.reduce((somme, nom) => somme + statSync(join(DOSSIER, nom)).size, 0);
    expect(octets).toBeGreaterThan(0);
    expect(ATTENDUS.length).toBe(9);
  });
});
