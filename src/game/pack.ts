import { ALL_CARDS } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { drawRandom } from '@/game/rng';
import type { RngHolder } from '@/game/rng';

/**
 * Composition d'un **Arrivage** (`AGENTS.md` §4.2, `docs/PROPOSITION.md` §3) :
 * « 3 communes, 1 peu commune, 1 rare minimum ».
 *
 * C'est une **règle de jeu**, et elle vit donc dans `src/game/`, à côté du
 * Chariot (`deck.ts`) et des drapeaux (`rules.ts`) — pas dans le store, qui
 * persiste un Parc et n'a pas à décider ce que contient un paquet (ticket #57).
 *
 * Le générateur est **passé en paramètre**, jamais créé ici : c'est la convention
 * du moteur depuis le ticket #29 (`@/game/rng`). Un Arrivage se rejoue donc avec
 * une graine, sans monter de store.
 */

/** Nombre de cartes d'un Arrivage. */
export const PACK_SIZE = 5;

/** Une ligne de composition : `count` cartes tirées dans les raretés données. */
export interface PackSlot {
  /** Nombre de cartes de cette ligne ; la somme vaut `PACK_SIZE`. */
  count: number;
  /** Raretés où puiser, dans l'ordre de `Rarity`. */
  rarities: readonly Rarity[];
}

/**
 * Composition de l'Arrivage, du plus courant au plus rare.
 *
 * Les raretés hautes (`3S`, `COU`) ont désormais des cartes (#87) mais restent hors
 * de cette table : sa composition est une **règle de tirage**, et l'y ajouter est une
 * décision d'équilibrage, pas une conséquence du catalogue. Quand elle sera prise,
 * c'est **cette table** qu'on ajuste, et le test de composition suit.
 */
export const PACK_COMPOSITION: readonly PackSlot[] = [
  { count: 3, rarities: ['1D', '2D'] },
  { count: 1, rarities: ['3D'] },
  { count: 1, rarities: ['1S', '2S', '4D'] }
];

/** Cartes du set dont la rareté est dans `rarities`. */
function poolOf(rarities: readonly Rarity[]): Card[] {
  return ALL_CARDS.filter((card) => rarities.includes(card.rarity));
}

/** Tire une carte du vivier, en avançant le générateur du porteur. */
function pick(pool: Card[], holder: RngHolder): Card {
  return pool[Math.floor(drawRandom(holder) * pool.length)] ?? ALL_CARDS[0];
}

/**
 * Ouvre un Arrivage : les cartes tirées, dans l'ordre de `PACK_COMPOSITION`.
 *
 * Le générateur passé en paramètre est **avancé** : l'appelant publie son état
 * s'il veut que la suite des Arrivages reste reproductible.
 */
export function openPackCards(holder: RngHolder): Card[] {
  return PACK_COMPOSITION.flatMap((slot) => {
    const pool = poolOf(slot.rarities);
    return Array.from({ length: slot.count }, () => pick(pool, holder));
  });
}
