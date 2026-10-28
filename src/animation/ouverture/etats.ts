/*
 * **L'ouverture d'un Arrivage : la déchirure, sans DOM** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Trois phases, un seuil, une valeur continue. Aucun élément du DOM, aucune horloge cachée :
 * c'est ce qui rend la machine testable en jsdom, et ce qui laisse le rendu changer (pochette
 * vectorielle, particules, lumière) sans retoucher une règle.
 *
 * Un seul geste ouvre le sachet : **glisser le long des pointillés**, depuis le bord que le testeur
 * veut. L'ancien premier temps (décoller l'autocollant) doublait le geste sans rien raconter de plus ;
 * il a été retiré avec les photos, le 28/10/2026.
 *
 * La géométrie (largeur de la zone, ordonnée de la ligne) est **passée en argument** : jsdom ne
 * calcule aucune mise en page, donc une constante lue au chargement serait une valeur morte.
 */

/** Les trois phases de la déchirure. `ouvert` n'est atteignable que par `dechirure`. */
export type Phase = 'ferme' | 'dechirure' | 'ouvert';

/** Le sens de la déchirure : `1` de gauche à droite, `-1` de droite à gauche. */
export type Sens = 1 | -1;

export interface EtatOuverture {
  phase: Phase;
  /** Déchirure : 0 = intacte, 1 = ligne parcourue en entier. */
  dechirure: number;
  /** Le bord d'où part la déchirure, décidé par l'appui. */
  sens: Sens;
}

export interface Geometrie {
  /** Largeur de la zone du sachet, en pixels. */
  largeur: number;
  /** Ordonnée de la ligne de pointillés, en pixels. */
  ligne: number;
  /** Demi-bande verticale où la ligne de pointillés accepte le doigt. */
  tolerance: number;
}

/** Part de la largeur du sachet à parcourir pour une déchirure complète : 70 %, pas 100 %. */
export const COURSE_DECHIRURE = 0.7;
/** Il faut avoir parcouru la ligne de pointillés à cette hauteur pour que le sachet s'ouvre. */
export const SEUIL_DECHIRURE = 0.9;

export function creer(): EtatOuverture {
  return { phase: 'ferme', dechirure: 0, sens: 1 };
}

/**
 * L'appui en `(x, y)` prend-il la ligne de pointillés ?
 *
 * Seulement **près de la ligne** (dans la tolérance) et **tant que le sachet n'est pas ouvert** :
 * un appui sur le corps du sachet ne déchire rien, il le presse.
 */
export function surLaLigne(etat: EtatOuverture, y: number, geo: Geometrie): boolean {
  return etat.phase !== 'ouvert' && Math.abs(y - geo.ligne) <= geo.tolerance;
}

/**
 * Le doigt s'est posé sur la ligne en `x` : la déchirure commence, **depuis le bord le plus
 * proche** — un appui sur la moitié droite déchire de droite à gauche.
 */
export function demarrer(etat: EtatOuverture, x: number, geo: Geometrie): EtatOuverture {
  if (etat.phase !== 'ferme') return etat;
  return { phase: 'dechirure', dechirure: 0, sens: x <= geo.largeur / 2 ? 1 : -1 };
}

/**
 * Le doigt a bougé de `dx` **depuis l'appui**.
 *
 * La déchirure suit le doigt **dans les deux sens** : revenir en arrière la referme, c'est ce qui
 * la rend annulable. Un glissement dans le mauvais sens ne déchire rien.
 */
export function avancer(etat: EtatOuverture, dx: number, geo: Geometrie): EtatOuverture {
  if (etat.phase !== 'dechirure') return etat;
  const course = Math.max(1, geo.largeur * COURSE_DECHIRURE);
  const p = Math.min(1, Math.max(0, (dx * etat.sens) / course));
  return { ...etat, dechirure: p };
}

/**
 * Le doigt s'est levé — ou le geste a été annulé (`pointercancel`, `lostpointercapture`), ce qui
 * revient au même : un geste annulé est un geste relâché.
 */
export function relacher(etat: EtatOuverture): EtatOuverture {
  if (etat.phase !== 'dechirure') return etat;
  return etat.dechirure >= SEUIL_DECHIRURE
    ? { ...etat, phase: 'ouvert', dechirure: 1 }
    : { ...etat, phase: 'ferme', dechirure: 0 };
}

/** Les phases franchies par un geste, pour les moments à sonoriser (#378) — jamais un effet ici. */
export type Moment = 'contact' | 'ouverture';

export function moments(avant: EtatOuverture, apres: EtatOuverture): Moment[] {
  const sortie: Moment[] = [];
  if (avant.phase === 'ferme' && apres.phase === 'dechirure') sortie.push('contact');
  if (avant.phase !== 'ouvert' && apres.phase === 'ouvert') sortie.push('ouverture');
  return sortie;
}
