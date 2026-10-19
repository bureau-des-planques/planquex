/**
 * Générateur pseudo-aléatoire **seedé** du moteur (ticket #29).
 *
 * Le moteur n'appelle plus `Math.random()` : le hasard est un entier 32 bits
 * transporté par l'état de la partie. Même graine + mêmes actions = même partie
 * (`docs/PROPOSITION.md` §6.2), et l'état reste clonable, sérialisable et
 * comparable — un générateur à closure ne le serait pas.
 *
 * Algorithme : **mulberry32**, 32 bits, un seul mot d'état. Il suffit largement
 * à un lancer de tampon ou à un mélange de Chariot, et il est reproductible
 * entre navigateurs (pas de dépendance à un état interne du moteur JS).
 */

/** État du générateur : un entier 32 bits non signé. */
export type RngState = number;

/** Tout ce qui porte un état de générateur ; l'état d'une partie en est un. */
export interface RngHolder {
  rng: RngState;
}

/**
 * État initial pour une graine quelconque.
 *
 * Toute graine finie est acceptée : `Date.now()` dépasse 32 bits, et les tests
 * passent des petits entiers, parfois négatifs. Elle est tronquée puis répartie
 * sur 32 bits, si bien que deux graines proches ne donnent pas des suites
 * proches (c'est le rôle du `^ 0x9e3779b9`).
 */
export function seedRng(seed: number): RngState {
  const normalized = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return (normalized ^ 0x9e3779b9) >>> 0;
}

/** Tire une valeur dans `[0, 1)` et renvoie le nouvel état. Fonction pure. */
export function stepRng(state: RngState): { value: number; state: RngState } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/**
 * Consomme un tirage dans `[0, 1)`, en avançant l'état du porteur.
 * C'est le seul point d'entrée du hasard : moteur et store passent par ici.
 */
export function drawRandom(holder: RngHolder): number {
  const step = stepRng(holder.rng);
  holder.rng = step.state;
  return step.value;
}
