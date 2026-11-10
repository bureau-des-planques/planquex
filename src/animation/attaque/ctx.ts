import type { Attack, PlanqueCard } from '@/data/types';
import type { Etape, Moteur, Pt, Rect } from '../moteur';

export interface Scene {
  m: Moteur;
  att: HTMLElement;
  cib: HTMLElement;
  /** Le Stress encaissé par la cible ; 0 pour un coup sans dégât. */
  stress: number;
  /** La Pression fait craquer la cible : la saynète de sortie joue après l'impact. */
  coupDeGrace: boolean;
}

export interface Choregraphie {
  nom: string;
  etapes: Etape[];
  duree: number;
  cinematique: boolean;
}

export interface Ctx {
  m: Moteur;
  att: HTMLElement;
  cib: HTMLElement;
  A: Rect;
  C: Rect;
  a: Pt;
  c: Pt;
  couleur: string;
  rnd: () => number;
  attaque: Attack;
  carte: PlanqueCard;
  /**
   * Le Stress **encaissé** par la cible, tel que l'effet de combat le calcule (Vulnérabilité
   * comprise). Absent quand la cible n'a rien encaissé : la scène n'affiche alors aucun chiffre.
   */
  stress: number;
  /** La cible craque sur ce coup. */
  coupDeGrace: boolean;
  /** La pose de l'attaquant pendant une cinématique (centré, agrandi) ; vide sinon. */
  base: string;
}

/** Une transformation de l'attaquant, appliquée par-dessus sa pose. */
export function pose(x: Ctx, s: string): string {
  if (!x.base) return s;
  return s === 'none' ? x.base : `${x.base} ${s}`;
}
