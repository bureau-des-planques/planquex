import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **Le combat suit la refonte** (D-193, qui amende D-191 (4)).
 *
 * La refonte « aéro-institutionnelle » réécrit les jetons globaux de `:root`. Le combat les
 * **hérite** : `.battle` ne réaffecte plus aucun de ces jetons (ni palette, ni rayons, ni
 * polices). Il ne garde que ses jetons de scène `--scene-*`. Un jeton réaffecté ferait repartir
 * une partie de l’écran vers l’ancienne palette sans qu’aucune autre garde le voie.
 */

const feuille = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

/** Les jetons globaux que la refonte change, et que le combat doit reprendre. */
const JETONS_DU_COMBAT = [
  'bg',
  'bg-deep',
  'bg-raised',
  'bg-haut',
  'bg-sunken',
  'line',
  'line-strong',
  'text',
  'text-muted',
  'text-dim',
  'accent',
  'accent-deep',
  'gold',
  'gold-soft',
  'gold-deep',
  'font-body',
  'font-display'
] as const;

/** Le corps de la première règle `selecteur {` qui ouvre une ligne. */
function corps(source: string, selecteur: string): string {
  const debut = source.search(new RegExp(`(^|\\n)${selecteur.replace('.', '\\.')} \\{`));
  if (debut < 0) return '';
  const ouvre = source.indexOf('{', debut);
  return source.slice(ouvre + 1, source.indexOf('\n}', ouvre));
}

/** Les jetons globaux de la liste que `.battle` réaffecte. */
function reaffectes(corpsBattle: string): string[] {
  return JETONS_DU_COMBAT.filter((jeton) => new RegExp(`(^|\\s)--${jeton}:`).test(corpsBattle));
}

describe('le combat hérite de la refonte (D-193)', () => {
  it('`.battle` ne réaffecte aucun jeton global', () => {
    expect(reaffectes(corps(feuille, '.battle'))).toEqual([]);
  });

  it('le combat a les angles droits de la refonte', () => {
    expect(corps(feuille, '.battle')).not.toMatch(/--radius/);
  });

  // Sans ce cas, la première assertion ne garderait rien.
  it('le contrôle mord : un jeton réaffecté dans `.battle` est signalé', () => {
    const fautif = '--bg: #0b1220;\n  --accent: var(--combat-accent);\n  --scene-felt: #16202c;';
    expect(reaffectes(fautif)).toEqual(['bg', 'accent']);
  });
});
