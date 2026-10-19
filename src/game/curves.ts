import type { Rarity, Stage } from '@/data/types';

/**
 * Le **chiffré** de `docs/CARD-SPEC.md` §2 — son unique copie de code (ticket #55).
 *
 * Le doc reste la référence **normative** : c'est lui qu'on lit pour trancher une
 * bande. Ce module en est l'implémentation, et les tests en sont les **appelants** :
 * `src/data/cards.test.ts` y confronte les cartes réelles, `src/game/pace.test.ts`
 * y lit les bandes qu'il chiffre. Aucun test ne recopie une borne.
 *
 * Ce qui n'est **pas** ici, volontairement :
 * - la **courbe du jeu de référence** (`REAL_CURVE` de `pace.test.ts`) : c'est une
 *   mesure datée du miroir (relevée le 19/10/2026, D-023), pas une règle du jeu —
 *   déplacée ici, sa provenance disparaîtrait ;
 * - les « dégâts indicatifs » par stade de §2 : repère de lecture, pas une contrainte
 *   (D-021 : les dégâts se lisent **par café**, pas par stade ni par rareté).
 */

/** Bande fermée `[bas, haut]`, bornes incluses. */
export type Band = readonly [number, number];

/**
 * Dégâts par **coût en café** — `CARD-SPEC.md` §2, **normatif depuis D-021**.
 *
 * Le coût `0` existe (une Pression gratuite) et ne peut pas dépasser 30. Un effet
 * (statut, soin, pioche, défausse, échange) ne fait **pas** descendre sous le bas
 * de la bande de son coût ; c'est un fardeau — se blesser, défausser ses cafés —
 * qui permet d'atteindre le haut.
 */
export const DAMAGE_BY_COST: Readonly<Record<number, Band>> = {
  0: [0, 30],
  1: [10, 30],
  2: [40, 80],
  3: [70, 120],
  4: [100, 160]
};

/**
 * **Seuil** par stade et rareté — `CARD-SPEC.md` §2, courbe du miroir adoptée par
 * D-023 (resserrée de ±10 par rareté pour garder une progression lisible).
 *
 * La clé est `« STADE/RARETÉ »`. Seules les paires qui existent au set y figurent,
 * d'où le `Partial` : une paire absente n'est pas une erreur de typage, c'est une
 * carte que la spécification ne couvre pas encore (les tests le signalent, carte
 * par carte).
 */
export const HP_BAND: Readonly<Partial<Record<`${Stage}/${Rarity}`, Band>>> = {
  'ENTRANT/1D': [50, 70],
  'ENTRANT/2D': [60, 80],
  'N+1/2D': [90, 110],
  'N+1/3D': [100, 120],
  'N+2/3D': [140, 160],
  'N+2/4D': [170, 190]
};

/** Bande de dégâts d'un coût en cafés ; `undefined` si le coût n'est pas couvert. */
export function damageBand(cost: number): Band | undefined {
  return DAMAGE_BY_COST[cost];
}

/** Bande de Seuil d'un stade et d'une rareté ; `undefined` si la paire n'est pas couverte. */
export function hpBand(stage: Stage, rarity: Rarity): Band | undefined {
  return HP_BAND[`${stage}/${rarity}`];
}
