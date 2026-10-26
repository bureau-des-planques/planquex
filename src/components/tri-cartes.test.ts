import { describe, expect, it } from 'vitest';
import { ALL_CARDS, FACTION_META, RARITY_META, STAGE_META, isPlanque } from '@/data';
import type { Card } from '@/data/types';
import { TRIS, TRI_DEFAUT, TRI_META, trierCartes } from './tri-cartes';

/**
 * Le tri de la Collection et du Deck (#179) — le pur, sans écran.
 *
 * Chaque test confronte l'**ordre rendu** à une règle écrite ici, indépendamment du
 * comparateur : un tri qui ne trie pas (comparateur neutralisé) rend l'ordre du catalogue,
 * et chaque règle ci-dessous le refuse. « Le contrôle mord » : le test final donne à
 * chaque vérificateur un cas fautif.
 */

const ids = (cartes: readonly Card[]) => cartes.map((carte) => carte.id);

/** Le rang de stade : les Planqués par stade, les cartes Action après. */
const rangStade = (carte: Card) => (isPlanque(carte) ? STAGE_META[carte.stage].order : 99);

/** Une règle par tri : vraie si la liste est dans l'ordre que le libellé promet. */
const REGLES: Record<
  Exclude<(typeof TRIS)[number], 'defaut'>,
  (cartes: readonly Card[], owned: Record<string, number>) => boolean
> = {
  faction: (cartes) =>
    cartes.every(
      (carte, i) =>
        i === 0 || FACTION_META[cartes[i - 1].faction].name.localeCompare(FACTION_META[carte.faction].name, 'fr') <= 0
    ),
  stade: (cartes) => cartes.every((carte, i) => i === 0 || rangStade(cartes[i - 1]) <= rangStade(carte)),
  rarete: (cartes) =>
    cartes.every((carte, i) => i === 0 || RARITY_META[cartes[i - 1].rarity].order >= RARITY_META[carte.rarity].order),
  nom: (cartes) => cartes.every((carte, i) => i === 0 || cartes[i - 1].name.localeCompare(carte.name, 'fr') <= 0),
  possedees: (cartes, owned) =>
    cartes.every((carte, i) => i === 0 || (owned[cartes[i - 1].id] ?? 0) >= (owned[carte.id] ?? 0))
};

/** Quelques cartes possédées en nombre inégal, dont la **dernière** du catalogue. */
const OWNED: Record<string, number> = {
  [ALL_CARDS[ALL_CARDS.length - 1].id]: 3,
  [ALL_CARDS[Math.floor(ALL_CARDS.length / 2)].id]: 1
};

describe('tri-cartes — trierCartes', () => {
  it('« par défaut » garde l’ordre reçu, sans rien changer', () => {
    const entree = [...ALL_CARDS].reverse();
    expect(ids(trierCartes(entree, TRI_DEFAUT, OWNED))).toEqual(ids(entree));
  });

  it('chaque tri change l’ordre du catalogue et respecte sa règle', () => {
    for (const tri of TRIS.filter((t) => t !== 'defaut')) {
      const trie = trierCartes(ALL_CARDS, tri, OWNED);
      expect(ids(trie), `tri « ${tri} » : l’ordre doit changer`).not.toEqual(ids(ALL_CARDS));
      expect(REGLES[tri as keyof typeof REGLES](trie, OWNED), `tri « ${tri} » : la règle est respectée`).toBe(true);
    }
  });

  it('ne perd ni ne duplique aucune carte, et ne modifie pas l’entrée', () => {
    const entree = [...ALL_CARDS];
    const avant = ids(entree);
    for (const tri of TRIS) {
      expect(trierCartes(entree, tri, OWNED)).toHaveLength(entree.length);
      expect(new Set(ids(trierCartes(entree, tri, OWNED))).size).toBe(new Set(avant).size);
    }
    expect(ids(entree)).toEqual(avant);
  });

  it('« possédées d’abord » met la carte possédée en tête, les absentes à la fin', () => {
    const trie = trierCartes(ALL_CARDS, 'possedees', OWNED);
    expect(trie[0].id).toBe(ALL_CARDS[ALL_CARDS.length - 1].id);
    expect(OWNED[trie[0].id]).toBe(3);
    expect(OWNED[trie[trie.length - 1].id] ?? 0).toBe(0);
  });

  it('la rareté va de la plus haute à la plus basse', () => {
    const trie = trierCartes(ALL_CARDS, 'rarete', {});
    expect(trie[0].rarity).toBe('COU');
    expect(trie[trie.length - 1].rarity).toBe('1D');
  });

  it('les deux exemplaires d’un même nom restent côte à côte (un Deck en porte deux)', () => {
    const base = ALL_CARDS.find((carte) => isPlanque(carte))!;
    const deck = [ALL_CARDS[10], base, ALL_CARDS[20], base];
    const trie = trierCartes(deck, 'nom', {});
    const positions = trie.flatMap((carte, i) => (carte.id === base.id ? [i] : []));
    expect(positions[1] - positions[0]).toBe(1);
  });

  it('chaque tri a un libellé et une aide pour l’écran', () => {
    for (const tri of TRIS) {
      expect(TRI_META[tri].label.length).toBeGreaterThan(0);
      expect(TRI_META[tri].aide.length).toBeGreaterThan(0);
    }
  });

  it('le contrôle mord : chaque règle refuse l’ordre du catalogue', () => {
    // Le catalogue n'est ni par nom, ni par rareté, ni par stade, ni par faction, ni par
    // possession : si une règle l'acceptait, elle ne garderait rien.
    for (const [tri, regle] of Object.entries(REGLES)) {
      expect(regle(ALL_CARDS, OWNED), `la règle « ${tri} » doit refuser le catalogue`).toBe(false);
    }
  });
});
