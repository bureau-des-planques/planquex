/**
 * **Les fonctionnalités prévues** — ce que la feuille de route annonce (D-097 (3), #214).
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par `npm run plan:dev`
 * (`scripts/plan-dev.mjs`) à partir des **issues `alpha` ouvertes** du dépôt, qui
 * restent la source de ce qui arrive. Fermer une issue la retire de cette liste à la
 * génération suivante.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : le dépôt est **privé**,
 * l'API répond `404` sans jeton, et un jeton dans le bundle se lit dans les DevTools.
 * L'écran lit donc ce fichier, embarqué au build : il marche **hors ligne**. Le pont avec
 * GitHub est le script, lancé au build de l'auteur — jamais dans la CI, qui n'a ni `gh`
 * ni réseau vers GitHub.
 *
 * **Sans lien** : un invité lit `#214` et son titre ; une adresse du dépôt ne
 * l'ouvrirait pas, le dépôt étant privé (D-097 (3)). Aucune URL n'est donc écrite ici, et
 * `scripts/plan-dev.test.ts` le vérifie.
 */

export interface FeaturePrevue {
  /** Le numéro de l'issue, affiché `#214` : c'est ce qui permet de la retrouver. */
  numero: number;
  /** Le titre de l'issue, sur une ligne. */
  titre: string;
}

/** Les issues `alpha` ouvertes, **de la plus récente à la plus ancienne**. */
export const FEATURES_PREVUES: FeaturePrevue[] = [
  {
    numero: 220,
    titre: 'Vocabulaire — l\'écran Deck affiche encore « Chariots proposés » (D-075, AGENTS.md §3)'
  },
  {
    numero: 219,
    titre: 'Prototype — la scène de comparaison ne rend rien (id renommé par D-095) : réparer ou sortir'
  },
  {
    numero: 218,
    titre: 'Combat — npm run capturer sort 1 : la barre d\'action dépasse la garde de hauteur (D-094)'
  },
  {
    numero: 215,
    titre: 'Comité — le rangement sur la base, sans l\'export du fichier (D-097)'
  },
  {
    numero: 214,
    titre: 'Feuille de route — page publique : note, critères, jalons, features prévues (D-097)'
  },
  {
    numero: 213,
    titre: 'Comité — barre à cinq onglets, Réglages dans l\'en-tête (D-097)'
  },
  {
    numero: 212,
    titre: 'Comité — compteur « choses à voir » et post-it d\'alerte (D-097)'
  },
  {
    numero: 211,
    titre: 'Comité — la page Le suivi (en cours / fait / écarté avec raison) (D-097)'
  },
  {
    numero: 208,
    titre: 'UI — 54 anti-patterns préexistants, et deux écrans que le détecteur ne lit pas'
  },
  {
    numero: 173,
    titre: 'Alpha — garder la trace des combats (pour lire comment les invités affrontent le niveau 2)'
  },
  {
    numero: 136,
    titre: 'Le comité — poster depuis le jeu, et la base remplace le fichier'
  },
  {
    numero: 94,
    titre: 'IA — niveau 3 : expectiminimax + déterminisations'
  }
];
