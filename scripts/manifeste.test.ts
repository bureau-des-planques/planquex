import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Le texte du manifeste PWA est vu par un invité qui **installe** le jeu : il parle donc la
 * langue du jeu (`docs/JEU.md` §3). Il disait « bacs à courrier » — l'ancien nom de l'Arrivage,
 * dans la liste des termes abandonnés (D-024, D-026) — sans qu'aucun test ne lise ce fichier :
 * `cards.test.ts` ne garde que les textes de cartes (#131).
 */
const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

/** La description du manifeste, telle qu'écrite dans `vite.config.ts`. */
function description(source: string): string {
  const trouvee = source.match(/description:\s*'((?:[^'\\]|\\.)*)'/);
  if (!trouvee) throw new Error('description du manifeste introuvable dans vite.config.ts');
  return trouvee[1];
}

/** Les mots abandonnés qu'une description ne doit pas reprendre. */
const ABANDONNES = [/bacs? à courrier/i, /\bGal[èe]re/i, /Pok[ée]mon/i, /Open-space/i];

describe('Manifeste PWA — la langue du jeu (#131)', () => {
  it('la description nomme l’Arrivage', () => {
    expect(description(config)).toContain('Arrivage');
  });

  it('la description ne reprend aucun mot abandonné', () => {
    for (const mot of ABANDONNES) expect(description(config), String(mot)).not.toMatch(mot);
  });

  it('le contrôle mord : « bacs à courrier » est refusé', () => {
    const fautif = "description: 'Collectionne les Planqués, ouvre des bacs à courrier.'";
    expect(ABANDONNES.some((mot) => mot.test(description(fautif)))).toBe(true);
  });
});
