import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { seedRng } from '@/game/rng';
import { ALL_CARDS } from '@/data';
import type { Faction } from '@/data/types';

/**
 * État de store préconfiguré pour les tests d'écran.
 * Fournit un état connu sans dépendre de localStorage ni de Date.now().
 */
export interface TestStoreState {
  name?: string;
  owned?: Record<string, number>;
  deck?: string[];
  cafeTypes?: Faction[];
  packsOpened?: number;
  reducedMotion?: boolean;
  rng?: number;
  tutorielVu?: boolean;
  pasAPasCombatVu?: boolean;
}

/**
 * Configure le store Zustand avec un état de test connu.
 * Le store est réinitialisé à chaque appel.
 */
export function setupTestStore(initialState: TestStoreState = {}) {
  const defaultOwned: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    if (['1D', '2D'].includes(card.rarity)) {
      defaultOwned[card.id] = 1;
    }
  }

  const state = useStore.getState();
  state.reset();
  state.setName(initialState.name ?? 'Testeur');
  state.setReducedMotion(initialState.reducedMotion ?? true); // tests rapides

  useStore.setState({
    owned: initialState.owned ?? defaultOwned,
    deck: initialState.deck ?? [],
    cafeTypes: initialState.cafeTypes ?? [],
    packsOpened: initialState.packsOpened ?? 0,
    rng: initialState.rng ?? seedRng(12345),
    tutorielVu: initialState.tutorielVu ?? true,
    pasAPasCombatVu: initialState.pasAPasCombatVu ?? true
  });
}

/**
 * Wrapper de test qui fournit le BrowserRouter.
 */
export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}

/**
 * Rend un composant avec le wrapper de test et un store préconfiguré.
 * Retourne le résultat de render() de testing-library.
 */
export function renderWithStore(
  ui: ReactElement,
  initialState: TestStoreState = {},
  options?: Omit<RenderOptions, 'wrapper'>
) {
  setupTestStore(initialState);
  return render(ui, { wrapper: TestWrapper, ...options });
}