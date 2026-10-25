/**
 * La logique **pure** du rafraîchissement du poste de pilotage (#184).
 *
 * La page se relit toute seule : elle est servie par `lib/app.mjs` et importée par
 * `page.html` (`import … from '/suivi.mjs'`). Ce fichier ne touche ni au DOM ni au réseau :
 * les décisions qui doivent **pouvoir être fausses** — « y a-t-il du nouveau ? », le libellé
 * du bandeau, le titre de l'onglet, l'âge de la dernière relecture — sont ici, et testées
 * par `suivi.test.ts`. Le câblage DOM (minuteur, focus, défilement) reste dans la page.
 */

/** Le titre de l'onglet quand rien n'attend. */
export const TITRE_NORMAL = 'Poste de pilotage';

/**
 * Combien d'inscriptions sont **nouvelles** entre deux relectures.
 *
 * - `avant === null` (ou `undefined`) : **premier chargement** — on ne crie jamais pour
 *   quelque chose qui attendait déjà avant l'ouverture de la page ;
 * - un nombre qui **baisse** (une approbation, un refus) n'est pas une nouveauté ;
 * - un nombre qui **monte** rend la différence (2 → 3 rend 1).
 *
 * Une valeur qui n'est pas un nombre ne crie pas non plus : un état illisible ne doit pas
 * produire un bandeau faux.
 */
export function nouveauxEnAttente(avant, apres) {
  if (avant === null || avant === undefined) return 0;
  const a = Number(avant);
  const b = Number(apres);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return b > a ? b - a : 0;
}

/** Le texte du bandeau : singulier pour 1, pluriel au-delà, vide s'il n'y a rien à dire. */
export function libelleNouveaux(nombre) {
  const n = Math.floor(Number(nombre));
  if (!Number.isFinite(n) || n <= 0) return '';
  return n === 1
    ? '1 nouvelle inscription en attente'
    : `${n} nouvelles inscriptions en attente`;
}

/** Le titre de l'onglet : le nombre en attente devant le titre normal, seulement s'il y en a. */
export function titreOnglet(enAttente, titreNormal = TITRE_NORMAL) {
  const n = Number(enAttente);
  return Number.isFinite(n) && n > 0 ? `(${n}) ${titreNormal}` : titreNormal;
}

/** « à jour il y a X s » — sous la seconde, on ne ment pas : « à l'instant ». */
export function libelleFraicheur(ageMs) {
  const secondes = Math.floor(Number(ageMs) / 1000);
  if (!Number.isFinite(secondes) || secondes < 1) return 'à jour à l’instant';
  if (secondes < 60) return `à jour il y a ${secondes} s`;
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `à jour il y a ${minutes} min`;
  return `à jour il y a ${Math.floor(minutes / 60)} h`;
}
