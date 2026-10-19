import { describe, expect, it } from 'vitest';
import { ABILITY_KINDS, ATTACK_EFFECT_KINDS } from '@/data/types';
import type { AbilityKind, AttackEffectKind } from '@/data/types';

/**
 * Garde de type (#56). `tsc -b` (donc `npm run check` et `npm run build`) échoue si une
 * liste runtime oublie un membre de son union : `Exclude<…>` rend alors le membre oublié
 * au lieu de `never`, `Exhaustive<…>` vaut `false`, et `Assert<false>` refuse `true`.
 *
 * Le sens inverse — un membre de liste absent de l'union — est déjà interdit par
 * `as const satisfies readonly <Union>[]` dans `@/data/types`.
 */
type Assert<T extends true> = T;
type Exhaustive<Union, List extends readonly Union[]> = Exclude<Union, List[number]> extends never
  ? true
  : false;

describe('Types — listes runtime et unions (#56)', () => {
  it('`ATTACK_EFFECT_KINDS` couvre tout `AttackEffectKind`', () => {
    const exhaustive: Assert<Exhaustive<AttackEffectKind, typeof ATTACK_EFFECT_KINDS>> = true;
    expect(exhaustive).toBe(true);
  });

  it('`ABILITY_KINDS` couvre tout `AbilityKind`', () => {
    const exhaustive: Assert<Exhaustive<AbilityKind, typeof ABILITY_KINDS>> = true;
    expect(exhaustive).toBe(true);
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(ATTACK_EFFECT_KINDS).size).toBe(ATTACK_EFFECT_KINDS.length);
    expect(new Set(ABILITY_KINDS).size).toBe(ABILITY_KINDS.length);
  });
});
