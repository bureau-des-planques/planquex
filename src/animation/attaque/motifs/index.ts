import type { Etape } from '../../moteur';
import type { CleD } from '../attribution';
import type { Ctx } from '../ctx';
import { anticipation, bas, haut } from '../generique';
import type { CtxMotif, Motif } from './types';
import { ATELIER } from './atelier';
import { BUREAU } from './bureau';
import { CHOC } from './choc';
import { PAPIER } from './papier';

/** La table des motifs d'attaque : une entrée par `CleD`, que le compilateur impose complète. */
export const MOTIFS: Record<CleD, Motif> = { ...PAPIER, ...BUREAU, ...CHOC, ...ATELIER };

/** Programme le départ puis l'impact du motif `cle` ; rend l'instant de l'impact. */
export function motifD(x: Ctx, e: Etape[], t0: number, cle: CleD, cinematique: boolean): number {
  const motif = MOTIFS[cle];
  const duree = motif.anticipation ?? 240;
  anticipation(x, e, t0, duree);
  const lancer = t0 + duree;
  const de = haut(x);
  const vers = bas(x);
  const lent = cinematique ? 1.35 : 1;
  if (cinematique) e.push({ a: lancer, faire: () => x.m.ralentir(0.5, 380) });

  const voyage = Math.round(motif.voyage * lent);
  const impact = lancer + voyage;
  const r = x.rnd;
  const m = x.m;
  const contexte = (): CtxMotif => ({ x, m, r, t: m.t, de, vers, voyage, lent, lancer, impact, cinematique, cle });

  e.push({ a: lancer, faire: () => motif.lancer(contexte()) });
  e.push({ a: impact, faire: () => motif.impact(contexte()) });
  return impact;
}
