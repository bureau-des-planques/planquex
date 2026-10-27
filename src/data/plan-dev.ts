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
 * **Sans lien** : ce fichier ne porte **aucune URL**. Les liens vers le dépôt qui
 * intéressent un testeur sont un autre ticket, **#343** (D-132) ;
 * `scripts/plan-dev.test.ts` vérifie qu'aucune adresse ne s'est glissée ici.
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
  {
    numero: 347,
    titre: 'Beta — la migration de store qui remet la progression à zéro, sans toucher au compte',
    etape: 'beta'
  },
  {
    numero: 346,
    titre: 'Alpha — la Médaille de la période d\'essai, sur le profil (D-130)',
    etape: 'beta'
  },
  {
    numero: 345,
    titre: 'Spec — le passage en beta : un reset qui épargne le compte, une médaille, et deux dettes de base',
    etape: 'beta'
  },
  {
    numero: 343,
    titre: 'Feuille de route — la règle « aucun lien vers le dépôt » a perdu sa prémisse',
    etape: 'beta'
  },
  {
    numero: 342,
    titre: 'Beta — le reset à l\'ouverture : traces et mur partent, les comptes restent (D-130)',
    etape: 'beta'
  },
  {
    numero: 341,
    titre: 'Infra — pg_net hors de public, et sept fonctions SECURITY DEFINER à trier',
    etape: 'beta'
  },
  {
    numero: 340,
    titre: 'Illustrations — les sept variantes hautes, avant les autres (D-126)',
    etape: 'beta'
  },
  {
    numero: 339,
    titre: 'Comité — l\'annonce porte le résumé du post-it, et ses points (migration 0014)',
    etape: 'beta'
  },
  {
    numero: 337,
    titre: 'Alpha — la sortie se mesure dans le poste de pilotage (D-123)',
    etape: 'alpha'
  },
  {
    numero: 336,
    titre: 'Spec — l\'entrée dans le jeu : le parcours se joue, l\'accueil répond, la barre se retire en combat',
    etape: 'alpha'
  },
  {
    numero: 334,
    titre: 'Journée d\'intégration — la rendre jouée plutôt que lue, et relier le combat',
    etape: 'alpha'
  },
  {
    numero: 325,
    titre: 'Première connexion — le parcours pseudo → service → intitulé',
    etape: 'beta'
  },
  {
    numero: 283,
    titre: 'Ouverture d\'un paquet : l\'animation',
    etape: 'beta'
  },
  {
    numero: 282,
    titre: 'Labels de travail : dire où en est une issue',
    etape: 'beta'
  },
  {
    numero: 281,
    titre: 'Suivi : du post-it au ticket, et l\'état des tickets',
    etape: 'beta'
  },
  {
    numero: 280,
    titre: 'Comité : compacter le post-it, rendre la page interactive',
    etape: 'beta'
  },
  {
    numero: 279,
    titre: 'Machine à café du Deck : capsules et couleurs, pas des pastilles',
    etape: 'beta'
  },
  {
    numero: 277,
    titre: 'Réglages : des catégories, pas une liste',
    etape: 'beta'
  },
  {
    numero: 276,
    titre: 'Collection et Deck : deux pages qui ne se ressemblent plus',
    etape: 'beta'
  },
  {
    numero: 275,
    titre: 'Barre du bas : la refaire, et la retirer en combat',
    etape: 'beta'
  },
  {
    numero: 274,
    titre: 'Accueil : la dernière release, et les précédentes',
    etape: 'beta'
  },
  {
    numero: 273,
    titre: 'Accueil : les paquets à ouvrir et leur compteur',
    etape: 'beta'
  },
  {
    numero: 272,
    titre: 'Tutoriel : un combat contre la Direction, guidé puis libre',
    etape: 'beta'
  },
  {
    numero: 271,
    titre: 'Appel à participer : bug, idée, développement, dessin',
    etape: 'beta'
  },
  {
    numero: 270,
    titre: 'Présentation des règles au nouvel inscrit',
    etape: 'beta'
  },
  {
    numero: 251,
    titre: 'Difficulté, Deck de la Direction et pages de présentation des Decks proposés',
    etape: 'beta'
  }
];
