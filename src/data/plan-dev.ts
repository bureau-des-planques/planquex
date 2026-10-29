/**
 * **Ce qui arrive** — les chantiers prévus, par étape (D-097 (3), #214, #336).
 *
 * **Fichier généré : ne pas éditer à la main.** Il est écrit par `npm run plan:dev`
 * (`scripts/plan-dev.mjs`) à partir des **issues `alpha` et `beta` ouvertes** du
 * dépôt, qui restent la source de ce qui arrive. Le label d'étape dit **à quel jalon un
 * ticket appartient**, pas quand on le travaille : un ticket `beta` se travaille pendant
 * l'alpha. Fermer une issue la retire de cette liste à la génération suivante.
 *
 * **Pourquoi un fichier embarqué plutôt qu'un appel à GitHub** : l'écran marche
 * **hors ligne**, et il n'y a **rien à configurer** — ni jeton, ni requête au chargement.
 * Le dépôt est public depuis D-118, donc un appel serait possible ; il rendrait l'écran
 * dépendant du réseau pour une liste qui bouge quand une issue s'ouvre. Le pont avec
 * GitHub est le script, lancé au build de l'auteur — jamais dans la CI, qui n'a ni `gh`
 * ni réseau vers GitHub.
 *
 * **Sans lien** : ce fichier ne porte **aucune URL**. Les seuls liens vers le dépôt que
 * D-132 ouvre — les **releases** et les **chantiers ouverts** — sont composés par la page
 * (`lienIssue`, `LIEN_RELEASES`) à partir du **numéro** ; une adresse écrite ici
 * vieillirait avec l'état du tracker, et `scripts/plan-dev.test.ts` vérifie qu'aucune
 * ne s'y glisse.
 */

/** Une étape du projet : le jalon auquel un chantier appartient (D-048). */
export type EtapeProjet = 'alpha' | 'beta';

export interface FeaturePrevue {
  /** Le numéro de l'issue, affiché `#214` : c'est ce qui permet de la retrouver. */
  numero: number;
  /** Le titre de l'issue, sur une ligne. */
  titre: string;
  /** L'étape à laquelle le chantier appartient — affichée à côté de son numéro. */
  etape: EtapeProjet;
}

/** Les issues `alpha` et `beta` ouvertes, **de la plus récente à la plus ancienne**. */
export const FEATURES_PREVUES: FeaturePrevue[] = [

];
