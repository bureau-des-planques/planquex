/**
 * Les types de `scripts/generateurs/arrivage-serveur.mjs` — la copie serveur du tirage
 * d'Arrivage (#651, D-179).
 *
 * Le script est du **JavaScript** : cette déclaration est le contrat de l'import que fait
 * `scripts/gardes/arrivage-serveur.test.ts`. Elle ne décrit **pas** le fichier engendré —
 * `supabase/functions/ouvrir-arrivage/arrivage-genere.ts` porte ses propres types.
 */

/** Une carte réduite à ce que le tirage lit. */
export interface CarteServeur {
  id: string;
  rarity: string;
}

/** Une ligne de composition. */
export interface SlotServeur {
  count: number;
  rarities: readonly string[];
}

/** Ce que le tirage lit de la source, et ce que la copie doit en porter. */
export interface SourceArrivage {
  taille: number;
  composition: readonly SlotServeur[];
  cartes: readonly CarteServeur[];
}

/** Le contenu de `arrivage-genere.ts`, tel que le générateur l'écrirait. */
export function rendreFichier(source: SourceArrivage): string;

/** Ce qui diverge entre la source et la copie ; vide quand elles s'accordent. */
export function divergences(source: SourceArrivage, copie: SourceArrivage): string[];
