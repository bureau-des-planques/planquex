import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_CARDS } from '@/data';
import { deckCanAdd } from '@/game/deck';
import { openPackCards } from '@/game/pack';
import { seedRng } from '@/game/rng';
import type { RngHolder } from '@/game/rng';
import type { Card, Rarity } from '@/data/types';

/** Clé de persistance. Source unique : `Settings.tsx` l'affiche, `persist` l'écrit. */
export const STORAGE_KEY = 'bureau-des-planques-v1';

/**
 * Version de la forme persistée. **1** : ajout de `rng`, le générateur seedé du
 * store (ticket #29). Toute nouvelle version exige une branche dans
 * `migratePersisted` (`AGENTS.md` §6).
 */
export const STORAGE_VERSION = 1;

const STARTER_RARITIES: Rarity[] = ['1D', '2D'];

function starterOwned(): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    if (STARTER_RARITIES.includes(card.rarity)) owned[card.id] = 1;
  }
  return owned;
}

export interface AppState {
  name: string;
  owned: Record<string, number>;
  deck: string[];
  packsOpened: number;
  reducedMotion: boolean;
  /**
   * État du générateur seedé des Arrivages (ticket #29). Persisté : la suite de
   * tirages continue après un rechargement, et deux Arrivages ne rejouent pas la
   * même séquence. Voir `@/game/rng`.
   */
  rng: number;
  openPack: () => Card[];
  addCard: (cardId: string, amount?: number) => void;
  addToDeck: (cardId: string) => void;
  removeFromDeck: (cardId: string) => void;
  toggleDeck: (cardId: string) => void;
  setDeck: (deck: string[]) => void;
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
      rng: seedRng(Date.now()),
      openPack: () => {
        // La composition de l'Arrivage (3 communes, 1 peu commune, 1 rare) est
        // une règle de jeu : elle vit dans `@/game/pack` (ticket #57). Ici, on ne
        // fait qu'avancer un générateur local, puis publier son état : `set`
        // reste le seul chemin d'écriture, et un Arrivage est reproductible.
        const holder: RngHolder = { rng: get().rng };
        const cards = openPackCards(holder);
        set((state) => {
          const owned = { ...state.owned };
          for (const card of cards) owned[card.id] = (owned[card.id] ?? 0) + 1;
          return { owned, packsOpened: state.packsOpened + 1, rng: holder.rng };
        });
        return cards;
      },
      addCard: (cardId, amount = 1) => {
        set((state) => ({
          owned: { ...state.owned, [cardId]: (state.owned[cardId] ?? 0) + amount }
        }));
      },
      addToDeck: (cardId) => {
        set((state) => (deckCanAdd(state.deck, cardId) ? { deck: [...state.deck, cardId] } : {}));
      },
      removeFromDeck: (cardId) => {
        set((state) => {
          const index = state.deck.findIndex((id) => id === cardId);
          if (index < 0) return {};
          const deck = [...state.deck];
          deck.splice(index, 1);
          return { deck };
        });
      },
      /** Un clic : ajoute si c'est possible, sinon retire **un** exemplaire. */
      toggleDeck: (cardId) => {
        const state = get();
        if (deckCanAdd(state.deck, cardId)) state.addToDeck(cardId);
        else state.removeFromDeck(cardId);
      },
      setDeck: (deck) => set({ deck }),
      clearDeck: () => set({ deck: [] }),
      reset: () =>
        set({
          owned: starterOwned(),
          deck: [],
          packsOpened: 0,
          name: 'Employé 404',
          // Un nouveau départ change la suite des Arrivages : sinon le premier
          // Arrivage d'après remise à zéro rejouerait le précédent.
          rng: seedRng(Date.now())
        }),
      setName: (name) => set({ name }),
      setReducedMotion: (value) => set({ reducedMotion: value })
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      migrate: (persisted) => migratePersisted(persisted) as AppState,
      partialize: (state) => ({
        name: state.name,
        owned: state.owned,
        deck: state.deck,
        packsOpened: state.packsOpened,
        reducedMotion: state.reducedMotion,
        rng: state.rng
      })
    }
  )
);

/**
 * Passage d'un état persisté plus ancien à la forme courante.
 *
 * La version 0 (avant le ticket #29) ne contient pas `rng` : sans cette
 * migration, `openPack` tirerait d'un générateur `undefined`. Le champ est créé
 * à la volée ; les autres champs sont conservés tels quels (`persist` fusionne
 * ensuite avec l'état initial, qui porte les actions).
 */
export function migratePersisted(persisted: unknown): Partial<AppState> {
  const state = (persisted ?? {}) as Partial<AppState>;
  return {
    ...state,
    rng: typeof state.rng === 'number' ? state.rng : seedRng(Date.now())
  };
}

// Les règles du Chariot (20 cartes, 2 exemplaires max, ≥ 1 N+1) vivent dans
// `@/game/deck` : ce sont des règles de jeu, pas de l'état d'application.
