import { MOTS_PAR_MINUTE } from '@/components/journee-etapes';

/**
 * Les étapes du **pas-à-pas du premier combat** (#143) — le pendant de la Journée
 * d'intégration (#130), qui couvre le premier lancement ; celui-ci couvre la première
 * partie.
 *
 * Cinq choses qu'un testeur ne devine pas en jouant : le **Poste** et le **Banc**, le
 * **café**, la **Pression**, les **Conditions**, la **fin**. Chaque étape **désigne**
 * l'élément dont elle parle (`cibles`) au lieu de le décrire de loin : la valeur est le
 * `data-pas-a-pas` que `Battle.tsx` pose sur l'élément, et `styles.css` le met en
 * avant. Un test vérifie que chaque cible **existe** dans l'écran de combat et a son
 * contour : une étape qui désignerait un élément disparu échoue là-bas, pas sur une
 * capture.
 *
 * Les textes emploient le vocabulaire du jeu (`docs/JEU.md` §3) et aucun mot interdit.
 * Le plafond de lecture vient du ticket : **trente secondes par étape**.
 * `secondesDeLecture` est exporté pour que le test le **mesure** au lieu de le croire,
 * et il réutilise la vitesse de la Journée d'intégration : une seule définition de
 * « trente secondes de lecture » pour les deux tutoriels.
 */

/** Les éléments de l'écran de combat qu'une étape peut désigner. */
export type CibleCombat =
  /** Le plateau : le Poste et le Banc (les deux rangées du Planqué). */
  | 'plateau'
  /** La main du joueur, d'où partent « Poser » et « Évolution ». */
  | 'main'
  /** Le Poste du joueur — c'est lui qui prend les Pressions. */
  | 'poste'
  /** La Machine à café du Poste du joueur. */
  | 'machine'
  /** Le bloc d'actions « Au Poste » : Pression, café, Rotation, fin du tour. */
  | 'poste-actions'
  /** La section des Conditions (les statuts). */
  | 'conditions'
  /** Les Interventions marquées sur le camp du joueur (les étoiles). */
  | 'interventions';

export interface EtapeCombat {
  /** Le titre de l'étape. */
  readonly titre: string;
  /** Ce qu'on ne devine pas, en une ou deux phrases (trente secondes au plus). */
  readonly texte: string;
  /** Les éléments que l'étape **désigne** dans l'écran de combat (au moins un). */
  readonly cibles: readonly CibleCombat[];
}

export const ETAPES_COMBAT: readonly EtapeCombat[] = [
  {
    titre: 'Le Poste et le Banc',
    texte:
      'Le plateau a deux rangées : le Poste, un seul Planqué, celui qui prend les Pressions ; et le Banc, trois places pour préparer la suite. Tu poses depuis ta main : un Planqué Entrant au Poste ou au Banc, un N+1 ou un N+2 sur son prédécesseur.',
    cibles: ['plateau', 'main']
  },
  {
    titre: 'Le café',
    texte:
      'Un café arrive chaque tour dans la Machine à café. Tu en attaches un seul par tour, sur le Planqué au Poste : il paie le coût de sa Pression, et la Pression ne le consomme pas.',
    cibles: ['machine']
  },
  {
    titre: 'La Pression',
    texte:
      'Une seule Pression par tour, et elle termine ton tour. Elle fait monter le Stress du Planqué adverse : à son Seuil, il craque. Pour passer sans attaquer, c’est « Fin du tour ».',
    cibles: ['poste-actions']
  },
  {
    titre: 'Les Conditions',
    texte:
      'Les Conditions sont les états d’un Planqué : Surcharge, Épuisement, Sieste, Immobilisation, Dérive. Seul le Planqué au Poste les porte, et on les contrôle après chaque tour — le joueur qui vient de finir passe d’abord.',
    cibles: ['conditions']
  },
  {
    titre: 'La fin',
    texte:
      'Trois Interventions et la partie est gagnée : un Planqué qui craque en rapporte une à l’adversaire, un COMEX deux. Quand ton Poste craque, tu choisis ta relève dans le Banc ; sans Planqué en jeu, c’est la défaite.',
    cibles: ['interventions', 'poste']
  }
];

/**
 * La **première phrase** du texte d'une étape : ce que le panneau montre sans qu'on
 * déplie quoi que ce soit.
 *
 * **Pourquoi** (constat du 30/10/2026, capture `combat.png`) : replié, le panneau
 * n'affichait que le numéro et le titre — « 1/5 Le Poste et le Banc » —, et le testeur
 * devait ouvrir « Plus » puis « Lire le détail » pour apprendre ce que l'étape désignait.
 * Un tutoriel qui cache sa phrase n'apprend rien. La phrase d'entrée se montre donc
 * **toujours** ; le reste du texte attend « Lire le détail » (#199 tient : le panneau
 * gagne deux lignes, pas un paragraphe).
 *
 * Le découpage est celui de la langue : un point, un point d'interrogation ou un point
 * d'exclamation terminent la phrase. Le point d'abréviation (« cf. ») n'existe dans aucun
 * des cinq textes, et un texte qui n'a pas de point rend son tout.
 */
export function premierePhrase(texte: string): string {
  const phrase = texte.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  return phrase || texte.trim();
}

/** Les mots que l'étape demande de lire : son titre et son texte. */
export function motsDeLEtape(etape: EtapeCombat): number {
  return `${etape.titre} ${etape.texte}`.split(/\s+/).filter(Boolean).length;
}

/** La lecture de l'étape, en secondes, à `MOTS_PAR_MINUTE`. */
export function secondesDeLecture(etape: EtapeCombat): number {
  return (motsDeLEtape(etape) / MOTS_PAR_MINUTE) * 60;
}
