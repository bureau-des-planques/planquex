import { DECKS_PROPOSES } from '@/data/decks-proposes';
import type { DeckPropose } from '@/data/decks-proposes';
import { DIFFICULTE_PAR_DEFAUT, POLITIQUE_DE_DIFFICULTE } from '@/game/ia';
import type { Difficulte, Politique } from '@/game/ia';

/**
 * **Le Deck de la Direction, par difficulté** (#251, D-125 (3), D-145, D-149).
 *
 * La difficulté est un **couple** : la politique de l'IA (`POLITIQUE_DE_DIFFICULTE`,
 * D-145) et le Deck qu'elle joue. Ce module tient la seconde moitié. Le choix se fait par
 * **archétype**, pas par chiffre, avec le classement mesuré en miroir (D-149) : Facile
 * joue le Deck le **plus faible** des trois (milieu, 47,8 %), Normal celui du **milieu**
 * (contrôle, 55,6 %), Difficile le **plus solide** (agressif, 68,1 %).
 *
 * Pur : ni React ni DOM. Le branchement à l'écran (`Battle`, `Settings`) n'est pas ici.
 */

/** Le Deck que joue la Direction à chaque difficulté : un Deck proposé, par son identifiant. */
export const DECK_DE_LA_DIRECTION: Readonly<Record<Difficulte, DeckPropose['id']>> = {
  facile: 'la-bonne-humeur',
  normal: 'la-reorganisation',
  difficile: 'coup-de-marteau'
};

/** Le Deck proposé joué par la Direction à cette difficulté. Lève si la table pointe dans le vide. */
export function deckDeLaDirection(difficulte: Difficulte): DeckPropose {
  const id = DECK_DE_LA_DIRECTION[difficulte];
  const deck = DECKS_PROPOSES.find((proposed) => proposed.id === id);
  if (!deck) throw new Error(`Deck de la Direction introuvable : ${id}`);
  return deck;
}

/** Le réglage complet d'un niveau : la politique qui joue et le Deck qu'elle joue (D-125 (4)). */
export interface ReglageDirection {
  difficulte: Difficulte;
  politique: Politique;
  deck: DeckPropose;
}

/** Politique et Deck d'une difficulté, lus dans leurs tables : rien n'est recopié ici. */
export function reglageDirection(difficulte: Difficulte): ReglageDirection {
  return { difficulte, politique: POLITIQUE_DE_DIFFICULTE[difficulte], deck: deckDeLaDirection(difficulte) };
}

/** La difficulté par défaut (Normal, D-084 / D-145) : l'écran ne change pas tant qu'on ne la règle pas. */
export const REGLAGE_DIRECTION_PAR_DEFAUT: ReglageDirection = reglageDirection(DIFFICULTE_PAR_DEFAUT);
