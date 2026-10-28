/*
 * **L'ouverture d'un Arrivage : les quatre temps, sans DOM** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Cinq phases, trois seuils, deux valeurs continues. Aucun élément du DOM, aucune horloge cachée :
 * c'est ce qui rend la machine testable en jsdom, et ce qui permettra au visuel de changer d'un
 * rendu à l'autre (shader ou repli) sans retoucher une règle.
 *
 * La géométrie (largeur de la zone, ordonnée de la ligne) est **passée en argument** : jsdom ne
 * calcule aucune mise en page, donc une constante lue au chargement serait une valeur morte.
 */

/** Les cinq phases de l'ouverture. `ouvert` n'est atteignable que par `dechirure`. */
export type Phase = 'ferme' | 'etiquette' | 'dechirure' | 'ouvert';

export interface EtatOuverture {
  phase: Phase;
  /** Levée de l'étiquette : 0 = collée, 1 = complètement détachée. */
  etiquette: number;
  /** Déchirure : 0 = intacte, 1 = ligne parcourue en entier. */
  dechirure: number;
}

/** Ce que le doigt a attrapé. Décidé par l'écran (boîtes du DOM), appliqué ici. */
export type Zone = 'etiquette' | 'dechirure';

export interface Geometrie {
  /** Largeur de la zone du sachet, en pixels. */
  largeur: number;
  /** Hauteur de la zone du sachet, en pixels (elle sert aux boîtes, pas aux seuils). */
  hauteur: number;
  /** Ordonnée de la ligne de pointillés, en pixels. */
  ligne: number;
  /** Demi-bande verticale où la ligne de pointillés accepte le doigt. */
  tolerance: number;
}

/** Course du doigt, en pixels, pour lever l'étiquette de 0 à 1 (96 était trop vif à l'essai). */
export const COURSE_ETIQUETTE = 170;
/** En deçà de cette levée, l'autocollant se recolle au relâchement. */
export const SEUIL_ETIQUETTE = 0.45;
/** Part de la largeur du sachet à parcourir pour une déchirure complète : 70 %, pas 100 %. */
export const COURSE_DECHIRURE = 0.7;
/** Il faut avoir parcouru la ligne de pointillés à cette hauteur pour que le sachet s'ouvre. */
export const SEUIL_DECHIRURE = 0.9;

export function creer(): EtatOuverture {
  return { phase: 'ferme', etiquette: 0, dechirure: 0 };
}

/**
 * La zone attrapée par un appui en `(x, y)`, ou `null` si l'appui ne prend rien.
 *
 * - l'**étiquette** se prend n'importe où sur sa boîte, et seulement tant que le sachet est fermé ;
 * - la **déchirure** se prend près de la ligne de pointillés, et seulement quand l'étiquette est
 *   déjà partie : on ne déchire pas un sachet encore scellé par son autocollant.
 */
export function zone(
  etat: EtatOuverture,
  x: number,
  y: number,
  etiquette: { x: number; y: number; w: number; h: number },
  geo: Geometrie
): Zone | null {
  const dansEtiquette =
    x >= etiquette.x && x <= etiquette.x + etiquette.w && y >= etiquette.y && y <= etiquette.y + etiquette.h;
  if (dansEtiquette && etat.phase === 'ferme') return 'etiquette';
  if (Math.abs(y - geo.ligne) <= geo.tolerance && etat.phase === 'dechirure') return 'dechirure';
  return null;
}

/** Le doigt s'est posé sur `zoneAttrapee` : la machine entre dans la phase correspondante. */
export function demarrer(etat: EtatOuverture, zoneAttrapee: Zone | null): EtatOuverture {
  if (zoneAttrapee === 'etiquette' && etat.phase === 'ferme') return { ...etat, phase: 'etiquette' };
  return etat;
}

/**
 * Le doigt a bougé de `(dx, dy)` **depuis l'appui**.
 *
 * L'étiquette ne redescend pas pendant le glissement — on ne recolle pas en revenant en arrière —
 * alors que la déchirure, elle, suit le doigt **dans les deux sens** : c'est ce qui la rend
 * annulable, et c'est la différence de comportement que le prototype a tranchée à l'usage.
 */
export function avancer(etat: EtatOuverture, dx: number, dy: number, geo: Geometrie): EtatOuverture {
  if (etat.phase === 'etiquette') {
    const levee = Math.min(1, Math.max(0, Math.hypot(dx, dy) / COURSE_ETIQUETTE));
    return { ...etat, etiquette: Math.max(etat.etiquette, levee) };
  }
  if (etat.phase === 'dechirure') {
    const course = Math.max(1, geo.largeur * COURSE_DECHIRURE);
    const p = Math.min(1, Math.max(0, dx / course));
    return { ...etat, dechirure: p };
  }
  return etat;
}

/**
 * Le doigt s'est levé — ou le geste a été annulé (`pointercancel`, `lostpointercapture`), ce qui
 * revient au même : un geste annulé est un geste relâché.
 */
export function relacher(etat: EtatOuverture): EtatOuverture {
  if (etat.phase === 'etiquette') {
    return etat.etiquette >= SEUIL_ETIQUETTE
      ? { ...etat, phase: 'dechirure', etiquette: 1 }
      : { ...etat, phase: 'ferme', etiquette: 0 };
  }
  if (etat.phase === 'dechirure') {
    return etat.dechirure >= SEUIL_DECHIRURE ? { ...etat, phase: 'ouvert', dechirure: 1 } : { ...etat, dechirure: 0 };
  }
  return etat;
}

/** Les phases franchies par un geste, pour les moments à sonoriser (#378) — jamais un effet ici. */
export type Moment = 'contact' | 'dechirure' | 'ouverture';

export function moments(avant: EtatOuverture, apres: EtatOuverture): Moment[] {
  const sortie: Moment[] = [];
  if (avant.phase === 'ferme' && apres.phase === 'etiquette') sortie.push('contact');
  if (avant.phase === 'etiquette' && apres.phase === 'dechirure') sortie.push('dechirure');
  if (avant.phase !== 'ouvert' && apres.phase === 'ouvert') sortie.push('ouverture');
  return sortie;
}
