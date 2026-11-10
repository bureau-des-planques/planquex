import type { Moteur, Pt } from '../../moteur';
import type { Ctx } from '../ctx';
import type { CleD } from '../attribution';

/** Ce que reçoit un motif : le contexte de la scène et les repères que `motifD` a calculés. */
export interface CtxMotif {
  x: Ctx;
  m: Moteur;
  r: () => number;
  /** Le temps du moteur au départ du motif (`m.t`). */
  t: number;
  de: Pt;
  vers: Pt;
  /** La durée du trajet, ralentie en cinématique. */
  voyage: number;
  lent: number;
  /** L'instant du départ et celui de l'impact, sur la chorégraphie. */
  lancer: number;
  impact: number;
  cinematique: boolean;
  cle: CleD;
}

/** Un motif d'attaque : un départ (le trajet) et un impact (la gerbe), indépendants des autres. */
export interface Motif {
  /** Durée du trajet, en ms, avant ralenti de cinématique. */
  voyage: number;
  /** Durée de l'anticipation (240 ms par défaut). */
  anticipation?: number;
  lancer(c: CtxMotif): void;
  impact(c: CtxMotif): void;
}
