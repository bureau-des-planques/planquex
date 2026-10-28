import type { Difficulte, Politique } from '@/game/ia';

/**
 * **Les noms de la difficulté et des politiques** (#251, D-145).
 *
 * Un seul endroit dit « Facile », « Scriptee », « Expectiminimax » : Réglages compose le
 * sélecteur, l'écran du Deck nomme le Deck que la Direction joue. Le nom est celui de la
 * décision, jamais un chiffre — `nextAction(…, 2)` et `nextAiAction(…, 2)` ne jouaient
 * pas la même chose, et un sélecteur qui afficherait « niveau 2 » mentirait.
 *
 * `glouton` garde son nom pour les mesures (D-109) : il n'apparaît dans aucun cran.
 */
export const LIBELLE_DIFFICULTE: Readonly<Record<Difficulte, string>> = {
  facile: 'Facile',
  normal: 'Normal',
  difficile: 'Difficile'
};

export const LIBELLE_POLITIQUE: Readonly<Record<Politique, string>> = {
  scripte: 'Scriptee',
  glouton: 'Glouton',
  recherche: 'Recherche',
  expectiminimax: 'Expectiminimax'
};

/** Ce que la politique fait, en une phrase, pour que le nom ne soit pas un mot creux. */
export const RESUME_POLITIQUE: Readonly<Record<Politique, string>> = {
  scripte: 'elle suit un ordre fixe, sans calcul',
  glouton: 'elle évalue un coup, sans regarder la réponse adverse',
  recherche: 'elle évalue ses coups et la meilleure réponse adverse (deux coups)',
  expectiminimax: 'elle explore plusieurs réponses adverses, dans un budget borné'
};
