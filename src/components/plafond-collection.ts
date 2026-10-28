import { ALL_CARDS } from '@/data';
import type { Card } from '@/data/types';
import { PACK_COMPOSITION } from '@/game/pack';

/**
 * Les cartes qu'un Arrivage **peut** donner : celles dont la rareté figure dans une ligne
 * de `PACK_COMPOSITION`. Les raretés hautes (`3S`, `COU`) sont au catalogue mais ne sortent
 * d'aucun Arrivage (`docs/JEU.md` §5, D-044) : sept cartes que personne ne peut tirer.
 *
 * Dériver ce plafond de la **table de tirage** — et non d'un `293` écrit ici — le fait
 * suivre le jour où une ligne s'ouvre aux raretés hautes (#131, point 6).
 */
export const CARTES_TIRABLES: readonly Card[] = ALL_CARDS.filter((card) =>
  PACK_COMPOSITION.some((ligne) => ligne.rarities.includes(card.rarity))
);

/** Le maximum **atteignable** par Arrivage : ce que « 100 % » veut dire. */
export const PLAFOND_TIRABLE = CARTES_TIRABLES.length;

/** Les cartes du catalogue qu'aucun Arrivage ne donne. */
export const HORS_ARRIVAGE = ALL_CARDS.length - PLAFOND_TIRABLE;

/**
 * L'avancement de la Collection **sur ce qu'on peut obtenir** : un testeur qui a tiré tout
 * ce qui sort lit 100 %, pas 98 % — le pourcentage ne promet pas un maximum inatteignable.
 */
export function avancementTirable(owned: Readonly<Record<string, number>>): {
  possedees: number;
  plafond: number;
  pourcent: number;
} {
  const possedees = CARTES_TIRABLES.filter((card) => (owned[card.id] ?? 0) > 0).length;
  return { possedees, plafond: PLAFOND_TIRABLE, pourcent: Math.round((possedees / PLAFOND_TIRABLE) * 100) };
}
