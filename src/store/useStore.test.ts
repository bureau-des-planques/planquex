import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  useStore.getState().reset();
});

describe('Bac à courrier', () => {
  it('distribue 5 cartes, les ajoute au Galérodex et incrémente le compteur', () => {
    const before = useStore.getState().packsOpened;
    const cards = useStore.getState().openPack();

    expect(cards).toHaveLength(5);
    expect(useStore.getState().packsOpened).toBe(before + 1);
    for (const card of cards) {
      expect(useStore.getState().owned[card.id]).toBeGreaterThan(0);
    }
  });
});

describe('Classeur du store', () => {
  it('plafonne à 2 exemplaires du même nom, un 3e retirant les précédents', () => {
    const id = ALL_CARDS[0].id;
    const { toggleDeck } = useStore.getState();

    toggleDeck(id);
    toggleDeck(id);
    expect(useStore.getState().deck.filter((entry) => entry === id)).toHaveLength(MAX_COPIES_PER_NAME);

    toggleDeck(id);
    expect(useStore.getState().deck.filter((entry) => entry === id)).toHaveLength(0);
  });

  it('ne dépasse jamais la taille du Classeur', () => {
    const { toggleDeck } = useStore.getState();
    for (const card of ALL_CARDS.slice(0, 12)) {
      toggleDeck(card.id);
      toggleDeck(card.id);
    }
    expect(useStore.getState().deck.length).toBeLessThanOrEqual(DECK_SIZE);
  });

  it('vide le Classeur sans toucher au Galérodex', () => {
    const id = ALL_CARDS[0].id;
    const ownedBefore = useStore.getState().owned[id];
    useStore.getState().toggleDeck(id);
    useStore.getState().clearDeck();

    expect(useStore.getState().deck).toEqual([]);
    expect(useStore.getState().owned[id]).toBe(ownedBefore);
  });
});
