import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **La refonte ne touche pas le combat** (D-189 (4)).
 *
 * La refonte « aéro-institutionnelle » réécrit les jetons globaux de `:root` (fonds, textes,
 * accents, rayons, polices). Le combat, lui, sera repris par une série de tickets à part : il
 * doit garder **exactement** son allure d'avant. La feuille le tient ainsi — l'ancienne palette
 * vit dans `:root` sous `--combat-*`, et la règle `.battle` la réapplique jeton par jeton.
 *
 * Ce test garde le contrat : chaque jeton global que la refonte a changé est **réassigné** dans
 * `.battle` à son `--combat-*`, et chaque `--combat-*` est défini. Un jeton oublié ferait passer
 * une partie de la scène aux couleurs de la refonte sans qu'aucune autre garde le voie.
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

/** Les jetons de la liste que `.battle` ne réapplique pas depuis leur `--combat-*`. */
function oublis(corpsBattle: string): string[] {
  return JETONS_DU_COMBAT.filter((jeton) => !new RegExp(`--${jeton}:\\s*var\\(--combat-${jeton}\\)`).test(corpsBattle));
}

describe('le combat garde son allure d’avant la refonte (D-189 (4))', () => {
  it('`.battle` réapplique chaque jeton global depuis son `--combat-*`', () => {
    expect(oublis(corps(feuille, '.battle'))).toEqual([]);
  });

  it('chaque `--combat-*` est défini dans `:root`', () => {
    const racine = corps(feuille, ':root');
    const manquants = JETONS_DU_COMBAT.filter((jeton) => !new RegExp(`--combat-${jeton}:`).test(racine));
    expect(manquants).toEqual([]);
  });

  it('le combat garde ses coins arrondis', () => {
    expect(corps(feuille, '.battle')).toMatch(/--radius:\s*14px/);
  });

  // Sans ce cas, la première assertion ne garderait rien.
  it('le contrôle mord : un jeton oublié dans `.battle` est signalé', () => {
    const fautif = '--bg: var(--combat-bg);\n  --text: var(--combat-text);';
    expect(oublis(fautif)).toContain('accent');
    expect(oublis(fautif)).not.toContain('bg');
  });
});
