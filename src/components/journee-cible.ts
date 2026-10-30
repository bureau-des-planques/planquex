import { useSyncExternalStore } from 'react';

/**
 * **La cible de l'étape courante** (30/10/2026) — quel élément la Journée désigne *maintenant*.
 *
 * Avant, chaque page posait `data-journee-cible` dès que `tutorielVu` était faux : à l'étape 1,
 * sur `/deck`, le volet « Decks proposés » était cerclé d'or alors que l'étape demandait un
 * Arrivage. Un halo qui désigne le mauvais objet est pire que pas de halo (critique du
 * 30/10/2026, P2) : le doré est **la** convention « clique ici » du produit.
 *
 * La Journée publie donc sa cible ici, page par page ; les pages demandent si c'est la leur.
 * Même mécanique que `journee-gestes` : un abonnement, pas un champ persisté.
 */
export type CibleJournee = 'arrivage' | 'decks-proposes' | 'sauvegarde';

/** Le geste de l'étape → la cible qu'elle désigne. Un geste, une cible, jamais deux. */
export const CIBLE_DE_GESTE: Record<'arrivage' | 'deck' | 'sauvegarde', CibleJournee> = {
  arrivage: 'arrivage',
  deck: 'decks-proposes',
  sauvegarde: 'sauvegarde'
};

let cible: CibleJournee | null = null;
const abonnes = new Set<() => void>();

function prevenir() {
  for (const abonne of abonnes) abonne();
}

/** Posée par la Journée à chaque étape ; `null` quand elle est fermée. */
export function poserCibleJournee(nouvelle: CibleJournee | null) {
  if (cible === nouvelle) return;
  cible = nouvelle;
  prevenir();
}

/** La cible courante, hors React (tests, gardes). */
export function cibleJournee(): CibleJournee | null {
  return cible;
}

function abonner(rappel: () => void) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

/** La cible courante, en React : la page se redessine quand elle change. */
export function useCibleJournee(): CibleJournee | null {
  return useSyncExternalStore(
    abonner,
    () => cible,
    () => null
  );
}

/** Vrai quand c'est **cette** cible que la Journée désigne : la page pose alors son halo. */
export function useEstCibleJournee(cle: CibleJournee): boolean {
  return useCibleJournee() === cle;
}
