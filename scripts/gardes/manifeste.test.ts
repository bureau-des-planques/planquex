import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Le texte du manifeste PWA est vu par un invité qui **installe** le jeu : il parle donc la
 * langue du jeu (`docs/JEU.md` §3). Il disait « bacs à courrier » — l'ancien nom de l'Arrivage,
 * dans la liste des termes abandonnés (D-024, D-026) — sans qu'aucun test ne lise ce fichier :
 * `cards.test.ts` ne garde que les textes de cartes (#131).
 */
const config = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

/** La description du manifeste, telle qu'écrite dans `vite.config.ts`. */
function description(source: string): string {
  const trouvee = source.match(/description:\s*'((?:[^'\\]|\\.)*)'/);
  if (!trouvee) throw new Error('description du manifeste introuvable dans vite.config.ts');
  return trouvee[1];
}

/** L'orientation de l'application installée, telle qu'écrite dans le manifeste. */
function orientation(source: string): string {
  const trouvee = source.match(/orientation:\s*'([^']+)'/);
  if (!trouvee) throw new Error('orientation du manifeste introuvable dans vite.config.ts');
  return trouvee[1];
}

/** Une media query qui dessine le téléphone en paysage, contrairement au périmètre D-171. */
function dessinePaysageMobile(source: string): boolean {
  return /@media\s*\([^)]*orientation:\s*landscape/i.test(source);
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

describe('Manifeste PWA — orientation portrait sur téléphone (D-171)', () => {
  it('demande le portrait pour l’application installée', () => {
    expect(orientation(config)).toBe('portrait');
  });

  it('le contrôle mord : `any` réintroduirait le paysage mobile', () => {
    expect(orientation(config.replace("orientation: 'portrait'", "orientation: 'any'"))).toBe('any');
    expect(orientation(config.replace("orientation: 'portrait'", "orientation: 'any'"))).not.toBe('portrait');
  });

  it('aucun layout mobile ne dépend d’une media query paysage', () => {
    expect(dessinePaysageMobile(styles)).toBe(false);
  });

  it('le contrôle mord : une media query paysage est reconnue comme un layout à retirer', () => {
    expect(dessinePaysageMobile('@media (orientation: landscape) and (max-height: 600px) { .board {} }')).toBe(true);
  });
});
