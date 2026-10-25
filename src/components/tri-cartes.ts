import { FACTION_META, RARITY_META, STAGE_META, isPlanque } from '@/data';
import type { Card } from '@/data/types';

/**
 * Le tri des cartes de la Collection et du Deck (#179) — une seule règle pour les deux
 * écrans, pure : pas de React, pas de store.
 *
 * `defaut` ne trie rien : il rend la liste **telle que l'écran la compose** (l'ordre du
 * catalogue pour la Collection, l'ordre d'ajout pour « Dedans »). C'est le point de départ
 * et la cible de « Réinitialiser ».
 */
export const TRIS = ['defaut', 'faction', 'stade', 'rarete', 'nom', 'possedees'] as const;
export type Tri = (typeof TRIS)[number];

export const TRI_DEFAUT: Tri = 'defaut';

/** Le libellé de l'écran et la phrase qui dit ce que le tri fait (infobulle). */
export const TRI_META: Record<Tri, { label: string; aide: string }> = {
  defaut: { label: 'Par défaut', aide: 'L’ordre de départ de l’écran' },
  faction: { label: 'Faction', aide: 'Par faction, de A à Z, puis par stade' },
  stade: { label: 'Stade', aide: 'Entrant, N+1, N+2, puis les cartes Action' },
  rarete: { label: 'Rareté', aide: 'De la plus rare à la plus commune' },
  nom: { label: 'Nom', aide: 'De A à Z' },
  possedees: { label: 'Possédées d’abord', aide: 'Les plus nombreuses en tête, les absentes à la fin' }
};

type Possession = Record<string, number>;

const nom = (a: Card, b: Card) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id);

/** Le rang de stade : les Planqués par stade, les cartes Action **après**. */
const stade = (carte: Card) => (isPlanque(carte) ? STAGE_META[carte.stage].order : STAGE_META['N+2'].order + 1);

const faction = (a: Card, b: Card) =>
  FACTION_META[a.faction].name.localeCompare(FACTION_META[b.faction].name, 'fr');

/**
 * Range une **copie** de `cartes`. Tous les tris finissent par le nom puis l'identifiant :
 * deux exemplaires d'une même carte restent donc côte à côte, et l'ordre ne dépend pas de
 * l'ordre d'entrée.
 */
export function trierCartes<T extends Card>(cartes: readonly T[], tri: Tri, owned: Possession): T[] {
  const copie = [...cartes];
  switch (tri) {
    case 'defaut':
      return copie;
    case 'faction':
      return copie.sort((a, b) => faction(a, b) || stade(a) - stade(b) || nom(a, b));
    case 'stade':
      return copie.sort((a, b) => stade(a) - stade(b) || faction(a, b) || nom(a, b));
    case 'rarete':
      return copie.sort((a, b) => RARITY_META[b.rarity].order - RARITY_META[a.rarity].order || nom(a, b));
    case 'nom':
      return copie.sort(nom);
    case 'possedees':
      return copie.sort((a, b) => (owned[b.id] ?? 0) - (owned[a.id] ?? 0) || nom(a, b));
  }
}
