import { BENCH_SIZE, HAND_LIMIT, POINTS_TO_WIN, STARTING_HAND, WEAKNESS_BONUS } from '@/game/rules';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';

/**
 * **Les règles en une minute** (#270) : les lignes d'`docs/JEU.md` §4 qu'un nouvel inscrit
 * doit connaître avant de jouer, en étapes courtes — pas un manuel.
 *
 * **Aucun chiffre n'est écrit ici.** Chaque volume vient de sa source : `@/game/rules`
 * (`STARTING_HAND`, `HAND_LIMIT`, `POINTS_TO_WIN`, `BENCH_SIZE`, `WEAKNESS_BONUS`) et
 * `@/game/deck` (`DECK_SIZE`, `MAX_COPIES_PER_NAME`). Un chiffre recopié est un chiffre qui
 * dérive (#248) : `regles-etapes.test.ts` refuse tout nombre qui ne serait pas l'un d'eux,
 * et c'est ce qui oblige à écrire « un COMEX en rapporte deux » en mots tant que le
 * moteur n'a pas de constante pour ce deux-là.
 *
 * Le contenu vit **hors du composant**, comme les étapes de la Journée d'intégration
 * (`journee-etapes.ts`) : l'écran ne fait que le rendre.
 */
export interface EtapeRegle {
  readonly titre: string;
  readonly texte: string;
  /**
   * Une **capture réelle** du jeu (#415) qui remplace le texte, sans s'y ajouter : `fichier` est
   * son chemin sous `public/` (servi à la racine), `alt` dit ce qu'elle montre. Les images sont
   * dans `public/regles/` et entrent dans le précache (`globPatterns`, `vite.config.ts`).
   */
  readonly image?: { readonly fichier: string; readonly alt: string };
}

/** Le chemin servi d'une image d'étape : `/regles/…`, sans la racine `public/`. */
export function cheminImageRegle(etape: EtapeRegle): string | undefined {
  return etape.image ? `/${etape.image.fichier}` : undefined;
}

export const ETAPES_REGLES: readonly EtapeRegle[] = [
  {
    titre: 'Le Seuil et le Stress',
    texte:
      'Chaque Planqué a un Seuil. Chaque Pression fait monter son Stress, et quand le Stress atteint le Seuil, le Planqué craque : sa carte part au Rebut.',
    image: {
      fichier: 'regles/seuil-stress.webp',
      alt: 'Capture du combat : sous chaque Planqué, son Seuil en chiffre et sa barre de Stress.'
    }
  },
  {
    titre: 'Le plateau',
    texte: `Un Planqué au Poste — c’est lui qui prend les Pressions — et ${BENCH_SIZE} places de Banc pour préparer la suite. Tu commences avec ${STARTING_HAND} cartes en main, ${HAND_LIMIT} au maximum.`
  },
  {
    titre: 'Le Deck',
    texte: `Un Deck de ${DECK_SIZE} cartes, ${MAX_COPIES_PER_NAME} exemplaires du même nom au plus, et au moins un Planqué Entrant. Il se construit dans le Deck, pas dans la Collection.`,
    image: {
      fichier: 'regles/arrivage.webp',
      alt: 'Capture d’un Arrivage ouvert : cinq cartes de Planqués révélées, chacune avec son Seuil.'
    }
  },
  {
    titre: 'La Pression et le café',
    texte:
      'Une seule Pression par tour, et elle termine ton tour. Un café arrive chaque tour dans la Machine ; tu en attaches un seul, et la Pression ne le consomme pas.',
    image: {
      fichier: 'regles/combat.webp',
      alt: 'Capture du combat au tour 3 : le café attaché au Poste, et le bouton « Fin du tour » dans la barre d’action.'
    }
  },
  {
    titre: 'Les Conditions',
    texte:
      'Cinq Conditions, portées par le Planqué au Poste seulement : Surcharge, Épuisement, Sieste, Immobilisation, Dérive. On les contrôle après chaque tour.'
  },
  {
    titre: 'La fin de la partie',
    texte: `Le premier à ${POINTS_TO_WIN} Interventions gagne : un Planqué qui craque en rapporte une à l’adversaire, un COMEX en rapporte deux. Plus aucun Planqué en jeu, c’est la défaite. La Vulnérabilité ajoute ${WEAKNESS_BONUS} de Stress, au Poste seulement.`
  }
];

/**
 * Le fichier d'une image d'étape est-il absent de `racine` ? Une fonction pure : le test lui donne
 * `existsSync` et une racine réelle, et un cas fabriqué pour le contrôle qui mord.
 */
export function imageManquante(etape: EtapeRegle, existe: (chemin: string) => boolean, racine: string): boolean {
  if (!etape.image) return false;
  return !existe(`${racine}/${etape.image.fichier}`);
}

/** Les **mots** d'une étape : le titre et le texte. */
export function motsDeLEtapeRegle(etape: EtapeRegle): number {
  return `${etape.titre} ${etape.texte}`.split(/\s+/).filter(Boolean).length;
}
