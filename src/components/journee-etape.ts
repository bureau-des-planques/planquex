import { useSyncExternalStore } from 'react';

/**
 * **L'étape courante de la Journée** (31/10/2026) — hors du panneau, parce que le combat la
 * fait avancer.
 *
 * Elle vivait dans un `useState` local : « Continuer » ramenait donc sur Réglages avec
 * l'étape 3 encore affichée, son bouton « Jouer mon premier combat » (qui ne mène nulle
 * part, on y est déjà) et « Passer : tu ne verras pas le combat » alors que le combat était
 * gagné — mesuré par les deux revues du 31/10. Un état partagé, c'est la seule façon pour
 * la scène de fin de dire « l'étape est faite » sans attendre un clic dans le panneau.
 *
 * Même mécanique que `journee-cible` et `journee-gestes` : un abonnement, pas un champ
 * persisté. Après un rechargement, on repart de l'étape 1 — c'est ce que fait déjà un
 * tutoriel qu'on reprend, et le geste du combat reste marqué dans la session.
 */
let etape = 0;
const abonnes = new Set<() => void>();

function prevenir() {
  for (const abonne of abonnes) abonne();
}

/** L'étape courante, hors React (le combat la lit avant de naviguer). */
export function etapeJournee(): number {
  return etape;
}

/** Va à une étape (0 = la première). */
export function allerAEtape(nouvelle: number) {
  if (nouvelle === etape) return;
  etape = nouvelle;
  prevenir();
}

/** L'étape suivante — utilisée par « Suivant » et par la fin du combat. */
export function avancerJournee() {
  allerAEtape(etape + 1);
}

/** Retour au début : la Journée terminée se remontre par sa première étape. */
export function remettreJourneeAuDebut() {
  allerAEtape(0);
}

function abonner(rappel: () => void) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

/** L'étape courante, en React : le panneau se redessine quand elle change. */
export function useEtapeJournee(): number {
  return useSyncExternalStore(
    abonner,
    () => etape,
    () => 0
  );
}
