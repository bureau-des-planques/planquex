/**
 * **La tête du Chef de cabinet fait un tiers de l'écran** (D-195 (1), #778).
 *
 * D-187 (2) proposait 56 à 72 px : une notice. Le propriétaire veut un personnage (D-194, D-195) :
 * la tête occupe **environ un tiers de la hauteur de la fenêtre**, en bas, et cache la barre de
 * navigation pendant la Journée. Ce module est la **seule source** de la mesure : la feuille
 * (`src/styles.css`, `--journee-tete`) en est le miroir, et le test de `journee-tete.test.ts`
 * vérifie que les deux disent la même chose.
 *
 * Les bornes en pixels gardent la tête lisible aux deux extrêmes : un téléphone en paysage
 * (390 px de haut, où 33 % feraient 129 px) et un grand écran (où 33 % de 1 440 px feraient
 * 475 px et cacheraient la moitié d'une page). Mesures fixées par le ticket :
 * **297 px à 420 × 900** (33,0 %) et **264 px à 1280 × 800** (33,0 %).
 */

/** La part de la fenêtre que prend la tête : un tiers. */
export const TETE_PART = 0.33;

/** La borne basse : sous 120 px, le visage ne se lit plus. */
export const TETE_MIN_PX = 120;

/** La borne haute : au-delà de 320 px, la tête dévore la page sur un écran de bureau. */
export const TETE_MAX_PX = 320;

/**
 * La fourchette que le critère 1 de #778 accepte à 420 × 900 : 30 à 36 % de la fenêtre.
 * Hors de la fourchette, la tête est soit la notice d'avant (72 px, 8 %), soit un plein cadre.
 */
export const TETE_PART_MIN = 0.3;
export const TETE_PART_MAX = 0.36;

/**
 * La tête **discrète** (D-195 (5), décision du propriétaire du 10/11/2026) : sur `/battle`, où le
 * plateau est la table ronde de D-193, et en pause, où la barre de navigation revient, la tête
 * se range dans le coin bas gauche à 56 px — la mesure de D-187 (2), gardée pour ce seul cas.
 */
export const TETE_DISCRETE_PX = 56;

/** La largeur de la tête par rapport à sa hauteur : un portrait, pas un carré. */
export const TETE_LARGEUR_PART = 0.62;

/** La hauteur de la tête, en px, pour une fenêtre de `hauteurFenetre` px. */
export function hauteurTete(hauteurFenetre: number): number {
  return Math.min(TETE_MAX_PX, Math.max(TETE_MIN_PX, hauteurFenetre * TETE_PART));
}

/** La part de la fenêtre qu'une tête de `hauteur` px occupe. */
export function partDeLaTete(hauteur: number, hauteurFenetre: number): number {
  return hauteur / hauteurFenetre;
}

/** Vrai quand la tête mesure 30 à 36 % de la fenêtre (critère 1 de #778). */
export function teteDansLaBorne(hauteur: number, hauteurFenetre: number): boolean {
  const part = partDeLaTete(hauteur, hauteurFenetre);
  return part >= TETE_PART_MIN && part <= TETE_PART_MAX;
}

/**
 * La déclaration CSS attendue dans `src/styles.css` : `clamp()` est le `min(max())` de
 * `hauteurTete`, et `dvh` mesure la fenêtre **visible** sur téléphone (la barre d'adresse repliée
 * ne compte pas).
 */
export const DECLARATION_CSS_TETE = `--journee-tete: clamp(${TETE_MIN_PX}px, ${TETE_PART * 100}dvh, ${TETE_MAX_PX}px);`;
