import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_CARDS, getCard } from '@/data';
import type { Card, Rarity } from '@/data/types';

/** Clé de persistance. Source unique : `Settings.tsx` l'affiche, `persist` l'écrit. */
export const STORAGE_KEY = 'bureau-des-planques-v1';

const STARTER_RARITIES: Rarity[] = ['1D', '2D'];

function starterOwned(): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    if (STARTER_RARITIES.includes(card.rarity)) owned[card.id] = 1;
  }
  return owned;
}

function pick(pool: Card[]): Card {
  return pool[Math.floor(Math.random() * pool.length)] ?? ALL_CARDS[0];
}

function openPackCards(): Card[] {
  const commons = ALL_CARDS.filter((card) => card.rarity === '1D' || card.rarity === '2D');
  const uncommons = ALL_CARDS.filter((card) => card.rarity === '3D');
  const rares = ALL_CARDS.filter((card) => card.rarity === '1S' || card.rarity === '2S' || card.rarity === '4D');
  return [pick(commons), pick(commons), pick(commons), pick(uncommons), pick(rares)];
}

export interface AppState {
  name: string;
  owned: Record<string, number>;
  deck: string[];
  packsOpened: number;
  reducedMotion: boolean;
  openPack: () => Card[];
  addCard: (cardId: string, amount?: number) => void;
  toggleDeck: (cardId: string) => void;
  clearDeck: () => void;
  reset: () => void;
  setName: (name: string) => void;
  setReducedMotion: (value: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      name: 'Employé 404',
      owned: starterOwned(),
      deck: [],
      packsOpened: 0,
      reducedMotion: false,
      openPack: () => {
        const cards = openPackCards();
        set((state) => {
          const owned = { ...state.owned };
          for (const card of cards) owned[card.id] = (owned[card.id] ?? 0) + 1;
          return { owned, packsOpened: state.packsOpened + 1 };
        });
        return cards;
      },
      addCard: (cardId, amount = 1) => {
        set((state) => ({
          owned: { ...state.owned, [cardId]: (state.owned[cardId] ?? 0) + amount }
        }));
      },
      toggleDeck: (cardId) => {
        const state = get();
        const count = state.deck.filter((id) => id === cardId).length;
        if (count >= 2) {
          set({ deck: state.deck.filter((id) => id !== cardId) });
          return;
        }
        if (state.deck.length >= 20) return;
        set({ deck: [...state.deck, cardId] });
      },
      clearDeck: () => set({ deck: [] }),
      reset: () => set({ owned: starterOwned(), deck: [], packsOpened: 0, name: 'Employé 404' }),
      setName: (name) => set({ name }),
      setReducedMotion: (value) => set({ reducedMotion: value })
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        name: state.name,
        owned: state.owned,
        deck: state.deck,
        packsOpened: state.packsOpened,
        reducedMotion: state.reducedMotion
      })
    }
  )
);

export function deckCounts(deck: string[]): Record<string, number> {
  return deck.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
}

export function deckCards(deck: string[]): Card[] {
  return deck.map((id) => getCard(id)).filter(Boolean) as Card[];
}

export function deckLegal(deck: string[]): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (deck.length !== 20) reasons.push(`Le classeur doit contenir 20 cartes (${deck.length}/20).`);
  const counts = deckCounts(deck);
  if (Object.values(counts).some((count) => count > 2)) reasons.push('Maximum 2 exemplaires du même nom.');
  const hasBasic = deckCards(deck).some((card) => card.stage === 'N+1');
  if (!hasBasic) reasons.push('Il faut au moins un Planqué N+1.');
  return { ok: reasons.length === 0, reasons };
}
