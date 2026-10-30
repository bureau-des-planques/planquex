import { useSyncExternalStore } from 'react';

/**
 * **Les gestes de la Journée d'intégration** (30/10/2026) — ce que le testeur a vraiment fait.
 *
 * Deux gestes se lisent dans le store, parce qu'ils laissent une trace qu'on veut garder :
 * le nombre d'Arrivages ouverts (`packsOpened`) et le Deck chargé (`deck.length`). Le
 * troisième, **créer sa sauvegarde**, n'a aucune trace à garder — seulement un fait de la
 * session : « il l'a fait une fois ».
 *
 * Ce module le retient donc en mémoire, **sans le persister** : un rechargement redemande
 * le geste, ce qui est le comportement juste pour un tutoriel. Pas de champ de plus dans
 * la forme persistée, donc **aucune migration** à écrire.
 *
 * Il expose un abonnement (`useSyncExternalStore`) : le panneau se redessine quand la
 * sauvegarde est créée, quelle que soit la page où le geste a eu lieu.
 */
export type GesteJournee = 'sauvegarde';

const faits = new Set<GesteJournee>();
const abonnes = new Set<() => void>();

function prevenir() {
  for (const abonne of abonnes) abonne();
}

/** Marque le geste comme fait. Appelé par l'écran qui l'accomplit, jamais par le panneau. */
export function marquerGeste(geste: GesteJournee) {
  if (faits.has(geste)) return;
  faits.add(geste);
  prevenir();
}

/** Le geste est-il fait ? Lecture directe, hors React (tests, gardes). */
export function estGesteFait(geste: GesteJournee): boolean {
  return faits.has(geste);
}

/** Remet le module à zéro — pour les tests, et pour une réouverture complète du parcours. */
export function oublierGestes() {
  if (faits.size === 0) return;
  faits.clear();
  prevenir();
}

function abonner(rappel: () => void) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

/** Le geste, en React : le composant se redessine dès qu'il est marqué. */
export function useGesteFait(geste: GesteJournee): boolean {
  return useSyncExternalStore(
    abonner,
    () => estGesteFait(geste),
    () => false
  );
}
