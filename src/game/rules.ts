import type { CafeCost, CafeType, Status } from '@/data/types';

/**
 * Drapeaux globaux du moteur.
 *
 * `priorityShiftEnabled` coupe le mot-clé maison « Changement de priorité »
 * (D-004) sans toucher aux cartes : désactivé, une carte qui le porte ne fait
 * rien de spécial. C'est le seul interrupteur prévu pour l'instant.
 */
export const RULES = {
  priorityShiftEnabled: true
};

/**
 * Ordre de résolution des conditions en fin de tour (`AGENTS.md` §4) :
 * **Surcharge → Épuisement → Sieste → Immobilisation**. Un Planqué peut en subir plusieurs.
 *
 * `DERIVE` n'y figure pas : elle se résout **avant l'attaque** (§4), pas au checkup.
 */
export const STATUS_ORDER: readonly Status[] = ['SURCHARGE', 'EPUISEMENT', 'SIESTE', 'IMMOBILISATION'];

/**
 * Le café **incolore** satisfait n'importe quel coût typé (`AGENTS.md` §4). C'est le type
 * de la faction `SUPPORT` (§3.2).
 */
export const COLORLESS_CAFE: CafeType = 'SUPPORT';

/** Un coût typé exige **au moins un** café, en nombre entier. */
export function isValidCafeCost(cost: CafeCost): boolean {
  return Number.isInteger(cost.amount) && cost.amount >= 1;
}

/** Vrai si un café du type `available` paie une exigence `required`. */
export function cafeSatisfies(available: CafeType, required: CafeType): boolean {
  return available === COLORLESS_CAFE || available === required;
}

/**
 * Vrai si les cafés `available` couvrent `cost`. Chaque café ne paie qu'une fois.
 *
 * Aucun plafond sur le nombre de **types** de café : la règle des « 3 types par
 * Chariot » reste une hypothèse non sourcée (D-022, O-012) et n'entre pas dans #30.
 */
export function satisfiesCafeCost(available: readonly CafeType[], cost: CafeCost): boolean {
  if (!isValidCafeCost(cost)) return false;
  return available.filter((type) => cafeSatisfies(type, cost.type)).length >= cost.amount;
}
