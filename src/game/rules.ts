import type { CafeSymbol, Status } from '@/data/types';

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
 * Limite de partie (D-031) : **30 tours** en Échelon (PvP), puis **égalité**.
 *
 * Le solo s'arrête à **50** tours, mais il n'existe pas dans notre périmètre
 * (`AGENTS.md` §4) et le moteur ne connaît **aucune notion de mode** : 50 est donc
 * une valeur inatteignable aujourd'hui, notée ici pour le jour où un mode solo
 * arrivera. Ne pas ajouter un champ `mode` que rien ne remplit (#59).
 */
export const TURN_LIMIT = 30;

/**
 * Ordre de résolution des conditions en fin de tour (`AGENTS.md` §4) :
 * **Surcharge → Épuisement → Sieste → Immobilisation**. Un Planqué peut en subir plusieurs,
 * mais pas de toutes : voir `EXCLUSIVE_STATUSES` (D-030).
 *
 * `DERIVE` n'y figure pas : elle se résout **avant l'attaque** (§4), pas au checkup.
 */
export const STATUS_ORDER: readonly Status[] = ['SURCHARGE', 'EPUISEMENT', 'SIESTE', 'IMMOBILISATION'];

/**
 * Les conditions qui s'**excluent** mutuellement (D-030) : **Sieste, Immobilisation,
 * Dérive**. En appliquer une **remplace** les autres — « Asleep, Paralyzed, and
 * Confused cannot stack with each other. If one of these Special Conditions is
 * applied, it replaces any of the others. »
 *
 * Surcharge et Épuisement n'y sont pas : ils se cumulent **entre eux et avec tout**.
 * `DERIVE` est ici alors qu'elle n'est pas dans `STATUS_ORDER` : l'ordre de résolution
 * et l'exclusivité sont deux règles distinctes.
 */
export const EXCLUSIVE_STATUSES: readonly Status[] = ['SIESTE', 'IMMOBILISATION', 'DERIVE'];

/**
 * Le café **incolore** satisfait n'importe quel coût typé (`AGENTS.md` §4). C'est le
 * **symbole** `INCOLORE`, distinct de la faction `SUPPORT` (D-037 (1)) — la Machine
 * n'en produit jamais (D-034), mais un tel café, s'il existait, paierait tout.
 */
export const COLORLESS_CAFE: CafeSymbol = 'INCOLORE';

/** Vrai si un café de type `available` paie une exigence `required` (D-037 (2)). */
export function cafeSatisfies(available: CafeSymbol, required: CafeSymbol): boolean {
  // Un symbole incolore accepte n'importe quel café ; un café incolore paie tout coût.
  return required === COLORLESS_CAFE || available === COLORLESS_CAFE || available === required;
}

/**
 * Vrai si les cafés `available` couvrent la **liste** de symboles `cost` (D-037).
 * Chaque café ne paie qu'**une fois**.
 *
 * Les symboles **typés** sont pourvus d'abord, par un café de leur type à défaut un
 * café incolore ; les symboles **incolores** se contentent ensuite de ce qui reste.
 * Cet ordre est **optimal** : un café typé rare ne se gaspille pas sur un incolore.
 */
export function satisfiesCafeCost(available: readonly CafeSymbol[], cost: readonly CafeSymbol[]): boolean {
  const pool = [...available];
  for (const symbol of cost) {
    if (symbol === COLORLESS_CAFE) continue;
    const exact = pool.indexOf(symbol);
    const index = exact >= 0 ? exact : pool.indexOf(COLORLESS_CAFE);
    if (index < 0) return false;
    pool.splice(index, 1);
  }
  return pool.length >= cost.filter((symbol) => symbol === COLORLESS_CAFE).length;
}
