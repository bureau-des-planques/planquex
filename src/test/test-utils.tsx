import React, { ReactElement } from 'react';
import { render, RenderOptions, waitFor } from '@testing-library/react';
import { MemoryRouter, BrowserRouter } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { seedRng } from '@/game/rng';
import { ALL_CARDS } from '@/data';
import type { Faction } from '@/data/types';
import type { DernierePartie } from '@/store/derniere';
import type { PartieSauvegardee } from '@/store/partie';
import type { Difficulte } from '@/game/ia';
import { App } from '@/App';

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
  /** La densité du combat (#189) ; absente = `sobre` (`false`). */
  combatDetaille?: boolean;
  /** Les raccourcis clavier du combat (#189) ; absents = actifs (`true`). */
  raccourcisCombat?: boolean;
  rng?: number;
  tutorielVu?: boolean;
  pasAPasCombatVu?: boolean;
  /** La partie en cours à reprendre (#126) ; absente = aucune. */
  partie?: PartieSauvegardee | null;
  /** La dernière partie terminée (#366) ; absente = aucune. */
  derniere?: DernierePartie | null;
  /** Le cran de difficulté de la Direction (#251) ; absent = `normal`. */
  difficulte?: Difficulte;
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
    combatDetaille: initialState.combatDetaille ?? false,
    raccourcisCombat: initialState.raccourcisCombat ?? true,
    rng: initialState.rng ?? seedRng(12345),
    tutorielVu: initialState.tutorielVu ?? true,
    pasAPasCombatVu: initialState.pasAPasCombatVu ?? true,
    partie: initialState.partie ?? null,
    derniere: initialState.derniere ?? null,
    difficulte: initialState.difficulte ?? 'normal'
  });
}

/**
 * Wrapper de test qui fournit le BrowserRouter.
 */
export function TestWrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
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

/**
 * Options pour `rendreApplication`.
 */
export interface RendreApplicationOptions {
  /** Le chemin à visiter (ex: '/', '/collection', '/battle'). */
  chemin: string;
  /** État de store additionnel (par défaut : tutorielVu et pasAPasCombatVu à true). */
  storeState?: TestStoreState;
  /** Composants additionnels à rendre à côté de `<App />` dans le même routeur. */
  extra?: React.ReactNode;
}

/**
 * Rend l'application complète à l'adresse demandée et attend que le rendu soit stable.
 *
 * Cette fonction unique remplace le montage manuel de `<App />` dans un `MemoryRouter`
 * avec `setupTestStore` — ce que six fichiers de test faisaient chacun à leur façon.
 * L'attente d'une microtâche (`waitFor`) garantit que les écrans chargés à la demande
 * (ticket suivant) sont bien rendus avant que le test ne continue.
 *
 * @returns Le résultat de `render` (contenant `container`, `unmount`, `rerender`, etc.).
 */
export async function rendreApplication({ chemin, storeState = {}, extra }: RendreApplicationOptions) {
  const etatComplet: TestStoreState = {
    tutorielVu: true,
    pasAPasCombatVu: true,
    ...storeState
  };

  setupTestStore(etatComplet);

  const resultat = render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
      {extra}
    </MemoryRouter>
  );

  // Attendre une microtâche : les écrans paresseux (prochain ticket) auront le temps de monter.
  await waitFor(() => {});

  return resultat;
}
