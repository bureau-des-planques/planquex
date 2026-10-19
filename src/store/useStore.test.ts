import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard } from '@/data';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  useStore.getState().reset();
});

describe('Arrivage', () => {
  it('distribue 5 cartes, les ajoute au Parc et incrémente le compteur', () => {
    const before = useStore.getState().packsOpened;
    const cards = useStore.getState().openPack();

    expect(cards).toHaveLength(5);
    expect(useStore.getState().packsOpened).toBe(before + 1);
    for (const card of cards) {
      expect(useStore.getState().owned[card.id]).toBeGreaterThan(0);
    }
  });
});

describe('Chariot du store', () => {
  it('ajoute une carte par clic, puis retire un seul exemplaire au-delà du plafond', () => {
    const id = ALL_CARDS[0].id;
    const { toggleDeck } = useStore.getState();

    toggleDeck(id);
    toggleDeck(id);
    expect(useStore.getState().deck.filter((entry) => entry === id)).toHaveLength(MAX_COPIES_PER_NAME);

    toggleDeck(id);
    expect(useStore.getState().deck.filter((entry) => entry === id)).toHaveLength(MAX_COPIES_PER_NAME - 1);
  });

  it('plafonne par nom : 2 exemplaires + 2 variantes du même Planqué sont refusés', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const baseName = getCard(base)?.name;
    expect(baseName, 'carte de test absente').toBeTruthy();
    expect(getCard(variant)?.name).toBe(baseName);

    const { addToDeck } = useStore.getState();
    addToDeck(base);
    addToDeck(base);
    addToDeck(variant);

    expect(useStore.getState().deck.filter((entry) => entry === variant)).toHaveLength(0);
    expect(useStore.getState().deck).toHaveLength(MAX_COPIES_PER_NAME);
  });

  it('ne dépasse jamais la taille du Chariot', () => {
    const { toggleDeck } = useStore.getState();
    for (const card of ALL_CARDS.slice(0, 12)) {
      toggleDeck(card.id);
      toggleDeck(card.id);
    }
    expect(useStore.getState().deck.length).toBeLessThanOrEqual(DECK_SIZE);
  });

  it('vide le Chariot sans toucher au Parc', () => {
    const id = ALL_CARDS[0].id;
    const ownedBefore = useStore.getState().owned[id];
    useStore.getState().toggleDeck(id);
    useStore.getState().clearDeck();

    expect(useStore.getState().deck).toEqual([]);
    expect(useStore.getState().owned[id]).toBe(ownedBefore);
  });
});
