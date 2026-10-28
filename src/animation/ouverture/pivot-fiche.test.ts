import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **Le pivot de la fiche ne montre jamais le dos d'une carte** (retour du 28/10/2026 : « la première
 * carte, on la voit à l'envers avant de se retourner »). La carte est déjà face visible quand on la
 * touche ; une pirouette de 360° la faisait passer par son dos. Une face se voit de dos dès que sa
 * rotation dépasse 90° : l'animation ne doit donc jamais atteindre ce seuil.
 *
 * Le « contrôle mord » : une pirouette de 360° est refusée par le même contrôle.
 */
const CSS = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

/** Les angles `rotateY(…)` des images clés d'une animation, en degrés. */
function anglesDe(css: string, nom: string): number[] {
  const corps = css.match(new RegExp(`@keyframes ${nom} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return [...corps.matchAll(/rotateY\((-?[\d.]+)deg\)/g)].map((m) => Number(m[1]));
}

const montreSonDos = (angles: readonly number[]): boolean => angles.some((a) => Math.abs(a) >= 90);

describe('le pivot de la fiche', () => {
  it('ne fait jamais voir le dos de la carte', () => {
    const angles = anglesDe(CSS, 'ouverture-fiche-pivot');
    expect(angles).toHaveLength(2);
    expect(montreSonDos(angles)).toBe(false);
  });

  it('le contrôle mord : une pirouette de 360° est refusée', () => {
    const pirouette = [
      '@keyframes ouverture-fiche-pivot {',
      '  from {',
      '    transform: rotateY(-360deg);',
      '  }',
      '  to {',
      '    transform: rotateY(0deg);',
      '  }',
      '}'
    ].join('\n');
    expect(montreSonDos(anglesDe(pirouette, 'ouverture-fiche-pivot'))).toBe(true);
  });
});
