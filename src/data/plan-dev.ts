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
    numero: 237,
    titre: 'Combat — la garde de hauteur ne fait pas tenir la marge de 20 px de D-094 (3)'
  },
  {
    numero: 228,
    titre: 'PvP — la trace des combats à deux (beta)'
  },
  {
    numero: 136,
    titre: 'Le comité — poster depuis le jeu, et la base remplace le fichier'
  }
];
