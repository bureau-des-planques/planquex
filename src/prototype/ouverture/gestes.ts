/* PROTOTYPE JETABLE (#283) — la machine des gestes du sachet, en TypeScript pur.
 * Aucun DOM, aucune horloge cachée : c'est ce qui la rendra testable en jsdom le jour où
 * elle passera dans `src/animation/`. Cinq états, quatre gestes, trois seuils. */

export type Phase = 'ferme' | 'etiquette' | 'dechirure' | 'ouvert';

export interface Etat {
  phase: Phase;
  /** Levée de l'étiquette : 0 = collée, 1 = complètement décollée. */
  etiquette: number;
  /** Déchirure : 0 = intacte, 1 = bande détachée. */
  dechirure: number;
}

/** Course du doigt, en pixels, pour lever l'étiquette de 0 à 1. */
export const COURSE_ETIQUETTE = 96;
/** Au-delà, l'autocollant se détache ; en deçà, il se recolle. */
export const SEUIL_ETIQUETTE = 0.45;
/** La déchirure ne se détache qu'au bout ; sinon elle revient. */
export const SEUIL_DECHIRURE = 0.9;

export function creer(): Etat {
  return { phase: 'ferme', etiquette: 0, dechirure: 0 };
}

export type Zone = 'etiquette' | 'dechirure';

/** Ce que le doigt a attrapé, décidé par le composant (boîtes du DOM), appliqué ici. */
export function demarrer(etat: Etat, zone: Zone): Etat {
  if (zone === 'etiquette' && etat.phase === 'ferme') return { ...etat, phase: 'etiquette' };
  return etat;
}

/**
 * Le doigt a bougé de `(dx, dy)` **depuis l'appui**.
 * L'étiquette ne redescend pas pendant le glissement (on ne recolle pas en revenant) ; la
 * déchirure, elle, suit le doigt dans les deux sens : c'est ce qui la rend annulable.
 */
export function avancer(etat: Etat, dx: number, dy: number, largeur: number): Etat {
  if (etat.phase === 'etiquette') {
    const v = Math.min(1, Math.hypot(dx, dy) / COURSE_ETIQUETTE);
    return { ...etat, etiquette: Math.max(etat.etiquette, v) };
  }
  if (etat.phase === 'dechirure') {
    const v = Math.max(0, Math.min(1, dx / (largeur * 0.7)));
    return { ...etat, dechirure: v };
  }
  return etat;
}

export type Son = 'decollage' | 'recolle' | 'dechirure';

/** Au relâchement : soit on passe à l'état suivant, soit on revient en place. */
export function relacher(etat: Etat): { etat: Etat; son: Son | null } {
  if (etat.phase === 'etiquette') {
    if (etat.etiquette >= SEUIL_ETIQUETTE) {
      return { etat: { ...etat, phase: 'dechirure', etiquette: 1 }, son: 'decollage' };
    }
    return { etat: { ...etat, phase: 'ferme', etiquette: 0 }, son: 'recolle' };
  }
  if (etat.phase === 'dechirure') {
    if (etat.dechirure >= SEUIL_DECHIRURE) {
      return { etat: { ...etat, phase: 'ouvert', dechirure: 1 }, son: 'dechirure' };
    }
    return { etat: { ...etat, dechirure: 0 }, son: null };
  }
  return { etat, son: null };
}
