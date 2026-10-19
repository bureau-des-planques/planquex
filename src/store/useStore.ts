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
 * Version de la forme persistée. **2** : les ids de carte suivent les noms
 * (ticket #49) — `owned` et `deck` portent des ids, donc un renommage d'id exige
 * un remappage. **1** : ajout de `rng`, le générateur seedé du store (ticket #29).
 * Toute nouvelle version exige une branche dans `migratePersisted` (`AGENTS.md` §6).
 */
export const STORAGE_VERSION = 2;

/**
 * Ids de carte renommés (ticket #49). `AGENTS.md` §5 : **un id suit le nom**.
 * Quand un nom ne correspond plus à son id, l'id change au lieu de rester un
 * alias introuvable — et l'état persisté doit suivre, sinon la carte quitte
 * silencieusement le Parc et le Chariot.
 *
 * Clé : ancien id. Valeur : id courant. Une entrée ne se retire pas sans casser
 * la migration ; on ajoute, on ne réécrit pas l'histoire.
 */
export const CARD_ID_RENAMES: Readonly<Record<string, string>> = {
  'rh-responsable-qvt': 'rh-charge-prevention',
  'direction-directeur-projet': 'direction-directeur-programme'
};

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
      migrate: (persisted, version) => migratePersisted(persisted, version) as AppState,
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
 * **v0 → v1** (ticket #29) : la version 0 ne contient pas `rng`. Sans cette
 * migration, `openPack` tirerait d'un générateur `undefined`. Le champ est créé
 * à la volée.
 *
 * **v1 → v2** (ticket #49) : les ids renommés (`CARD_ID_RENAMES`) sont remappés
 * dans `owned` et `deck`, les deux champs qui portent des ids. Les autres champs
 * sont conservés tels quels (`persist` fusionne ensuite avec l'état initial, qui
 * porte les actions). `version` absent vaut 0, comme le fait `persist`.
 */
export function migratePersisted(persisted: unknown, version = 0): Partial<AppState> {
  const state = (persisted ?? {}) as Partial<AppState>;
  const migrated = version < 2 ? withRenamedCardIds(state) : state;
  return {
    ...migrated,
    rng: typeof migrated.rng === 'number' ? migrated.rng : seedRng(Date.now())
  };
}

/**
 * Remappe les anciens ids dans `owned` et `deck`. Les comptes sont **additionnés**
 * si les deux ids cohabitent (état bricolé à la main) : aucun exemplaire ne
 * disparaît. L'ordre du Chariot est conservé.
 */
function withRenamedCardIds(state: Partial<AppState>): Partial<AppState> {
  const next: Partial<AppState> = { ...state };
  if (state.owned) {
    const owned: Record<string, number> = {};
    for (const [id, count] of Object.entries(state.owned)) {
      const current = CARD_ID_RENAMES[id] ?? id;
      owned[current] = (owned[current] ?? 0) + count;
    }
    next.owned = owned;
  }
  if (state.deck) next.deck = state.deck.map((id) => CARD_ID_RENAMES[id] ?? id);
  return next;
}

// Les règles du Chariot (20 cartes, 2 exemplaires max, ≥ 1 N+1) vivent dans
// `@/game/deck` : ce sont des règles de jeu, pas de l'état d'application.
