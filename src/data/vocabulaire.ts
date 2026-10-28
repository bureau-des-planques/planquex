import type { CafeSymbol, PlayerId } from './types';
import { FACTION_META } from './factions';

/**
 * Le vocabulaire que le **moteur**, le **store** et l'**écran** doivent dire de la même
 * façon (#248) : les noms des camps et le libellé d'un café.
 *
 * Module **feuille** : il ne lit que `./factions` et `./types`, donc il n'entre dans
 * aucun cycle et il est importable depuis `src/game/` — que le store, lui, ne peut pas
 * importer (`store/pvp.ts` importe `game/engine.ts`, jamais l'inverse).
 *
 * Ce qui **n'est pas** ici : les libellés de **carte** (`kindLabel`, `STAGE_META`,
 * `ACTION_KIND_META`). Ils vivent dans `./index`, qui les dérive de ses propres tables ;
 * les y déplacer créerait un cycle `index → vocabulaire → index`.
 */

/**
 * Le nom d'un camp dans une partie à deux (`docs/JEU.md` §3, critère #125) : « camp Toi »,
 * « camp Direction ». Ce sont les **sièges** du moteur, pas des personnes.
 *
 * `store/pvp.ts` le ré-exporte ; `engine.ts` l'emploie pour le journal à deux camps.
 */
export const CAMP_NAME: Readonly<Record<PlayerId, string>> = {
  player: 'camp Toi',
  ai: 'camp Direction'
};

/**
 * Le camp en position de **sujet**, en solo : « Tu » et « La Direction » (D-108).
 *
 * À deux, ce sont les `CAMP_NAME` qui prennent la place, avec leur article
 * (« Le camp Toi pose ») : aucun des deux joueurs n'est une IA.
 */
export const CAMP_SUJET: Readonly<Record<PlayerId, string>> = {
  player: 'Tu',
  ai: 'La Direction'
};

/**
 * Le libellé français d'un café (tooltip, résumés du plateau, journal).
 *
 * Un café `INCOLORE` n'est jamais produit (D-034) ; le libellé reste juste s'il l'était
 * un jour. Le **sigle** (`FACTION_META[c].short`) n'est pas ce libellé : l'écran du Deck
 * s'en sert pour une liste compacte, et le nomme `cafeSigles` chez lui.
 */
export function cafeLabel(cafe: CafeSymbol): string {
  return cafe === 'INCOLORE' ? 'Incolore' : FACTION_META[cafe].name;
}
