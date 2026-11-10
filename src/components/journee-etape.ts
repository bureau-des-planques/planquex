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

/** Retour au début : la Journée terminée se remontre par sa première étape. */
export function remettreJourneeAuDebut() {
  allerAEtape(0);
}

/**
 * **La relecture voulue** (04/11/2026, #731). « Revoir la Journée d'intégration » n'est
 * pas un rechargement : elle doit remontrer la **première** étape, même si tous les gestes
 * sont faits et même si la route courante (Réglages, par exemple) est celle d'une autre
 * étape. La reprise et le réalignement sur la route restent, eux, au rechargement d'une
 * visite commencée. Ce témoin de session, lu une seule fois, fait la différence.
 */
let rejouer = false;

/** « Revoir » : la prochaine ouverture repart de l'étape 1, sans reprise. */
export function rejouerJournee() {
  rejouer = true;
  allerAEtape(0);
}

/** Le témoin de relecture est-il posé ? Lecture seule, avant que l'effet de route ne le consomme. */
export function relectureDemandee(): boolean {
  return rejouer;
}

/** Lit le témoin de relecture, et le consomme : un clic, une relecture. */
export function prendreRelecture(): boolean {
  const voulu = rejouer;
  rejouer = false;
  return voulu;
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

/**
 * **La Journée est ouverte** (D-194 (2), D-195 (1), #778) : le panneau est affiché, hors pause et
 * hors de `/battle`. Le `Layout` le lit pour **ne pas rendre** la barre de navigation — la tête
 * du Chef de cabinet prend le bas de l'écran, et les étapes s'enchaînent sans clic (D-196) : il
 * n'y a rien à cliquer dans cette barre. Elle revient à la pause, à « Passer » et à la fin
 * (D-162 (2) : cacher la barre n'enferme jamais le testeur). Posé par `JourneeIntegration`,
 * jamais persisté : c'est un fait de rendu.
 */
let ouverte = false;
const abonnesOuverture = new Set<() => void>();

/** Posé par la Journée à chaque rendu de son état ; `false` quand elle se démonte. */
export function poserJourneeOuverte(nouvelle: boolean) {
  if (ouverte === nouvelle) return;
  ouverte = nouvelle;
  for (const abonne of abonnesOuverture) abonne();
}

/** La Journée est-elle ouverte, hors React (tests, gardes). */
export function journeeOuverte(): boolean {
  return ouverte;
}

function abonnerOuverture(rappel: () => void) {
  abonnesOuverture.add(rappel);
  return () => abonnesOuverture.delete(rappel);
}

/** La Journée est-elle ouverte, en React : la coquille se redessine quand ça change. */
export function useJourneeOuverte(): boolean {
  return useSyncExternalStore(
    abonnerOuverture,
    () => ouverte,
    () => false
  );
}
