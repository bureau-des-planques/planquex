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
  {
    numero: 379,
    titre: 'Son — choisir les deux timbres, libres de droits et légers',
    etape: 'alpha'
  },
  {
    numero: 378,
    titre: 'Son — deux sons dans l\'alpha : l\'Arrivage et le verdict, avec un réglage qui les coupe',
    etape: 'alpha'
  },
  {
    numero: 366,
    titre: 'Rejeu — revoir une partie terminée, depuis le profil',
    etape: 'beta'
  },
  {
    numero: 365,
    titre: 'Collection — filtrer par rareté et par coût, et dire quand rien ne sort',
    etape: 'beta'
  },
  {
    numero: 364,
    titre: 'Deck — montrer la courbe de coût, le compte de cartes et les filtres par valeur',
    etape: 'beta'
  },
  {
    numero: 363,
    titre: 'Deck — partager et importer un Deck par code, avec les cartes manquantes visibles',
    etape: 'beta'
  },
  {
    numero: 362,
    titre: 'Spec — ce que trois références font, et ce qu\'on en garde (UI, parcours, fonctionnalités)',
    etape: 'beta'
  },
  {
    numero: 360,
    titre: 'Équilibrage — publier la table des taux de victoire par archétype',
    etape: 'beta'
  },
  {
    numero: 358,
    titre: 'Alpha — lire les traces de combat : la boucle tient-elle, et où ?',
    etape: 'alpha'
  },
  {
    numero: 357,
    titre: 'PWA — la première visite télécharge 28 Mo, et la Collection charge 300 illustrations d\'un coup',
    etape: 'alpha'
  },
  {
    numero: 355,
    titre: 'PWA — dire qu\'une nouvelle version est prête, et recharger d\'un geste',
    etape: 'alpha'
  },
  {
    numero: 354,
    titre: 'IA — mesurer la Direction contre un joueur de référence, avant les testeurs',
    etape: 'alpha'
  },
  {
    numero: 353,
    titre: 'Moteur — le Talent « en jouant » ne collecte pas ses faits (D-081)',
    etape: 'beta'
  },
  {
    numero: 352,
    titre: 'Contenu — Syndicat et Intérim ne peuvent pas faire un Deck de 20 cartes',
    etape: 'beta'
  },
  {
    numero: 351,
    titre: 'Moteur — un fuzz d\'invariants : jouer des centaines de parties au hasard légal',
    etape: 'alpha'
  },
  {
    numero: 347,
    titre: 'Beta — la migration de store qui remet la progression à zéro, sans toucher au compte',
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
    numero: 340,
    titre: 'Illustrations — les sept variantes hautes, avant les autres (D-126)',
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
