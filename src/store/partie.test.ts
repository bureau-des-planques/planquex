import { describe, expect, it, vi } from 'vitest';

// Un stockage `localStorage` **simulé**, posé avant que le store ne soit évalué. Sous
// Node, `persist` lit `window.localStorage` par défaut : sans `window`, il n'enregistre
// rien et n'expose même pas `persist`. Avec ce faux stockage, « recharger » devient réel :
// on vide l'état en mémoire, puis `persist.rehydrate()` relit ce qui a été écrit.
vi.hoisted(() => {
  const stock = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => stock.get(key) ?? null,
    setItem: (key: string, value: string) => void stock.set(key, value),
    removeItem: (key: string) => void stock.delete(key),
    clear: () => stock.clear(),
    key: () => null,
    get length() {
      return stock.size;
    }
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
});

import { ALL_CARDS } from '@/data';
import type { BattleAction, BattleState } from '@/data/types';
import { autoDeck, deckLegal } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { createMatch } from '@/store/pvp';
import { lirePartie, partieSauvegardee, reprendrePartie } from '@/store/partie';
import type { Decks } from '@/store/partie';
import { STORAGE_KEY, useStore } from '@/store/useStore';

/** Un Deck **légal** de 20 cartes, pris dans tout le catalogue (`autoDeck`). */
function deck(): string[] {
  const built = autoDeck(Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]))).deck;
  expect(deckLegal(built).ok, 'Deck de test légal').toBe(true);
  return built;
}

/** Joue `coups` actions, première légale non-forfait : deux camps, déterministe. */
function jouer(state: BattleState, coups: number): BattleState {
  let s = state;
  for (let i = 0; i < coups && s.phase === 'playing'; i += 1) {
    const action = legalActions(s).find((a) => a.type !== 'forfeit');
    if (!action) break;
    s = applyAction(s, action);
  }
  return s;
}

/** Le passage par le stockage : ce que `persist` écrit, relu comme au rechargement. */
const relu = (partie: unknown) => lirePartie(JSON.parse(JSON.stringify(partie)));

describe('partie rangée — rejouable à l’identique (#126)', () => {
  it('une partie à deux, jouée puis rangée et relue, redonne le même état et le même journal', () => {
    const { state, match } = createMatch(deck(), deck(), 4242);
    const jouee = jouer(state, 60);
    expect(jouee.actionLog.length).toBeGreaterThan(10);

    const rangee = partieSauvegardee(jouee, match, { playerDeck: [], aiDeck: [] });
    const reprise = reprendrePartie(relu(rangee));

    expect(reprise).not.toBeNull();
    expect(reprise?.state).toEqual(jouee);
    expect(reprise?.state.actionLog).toEqual(jouee.actionLog);
    expect(reprise?.match).toEqual(match);
  });

  it('un combat solo, joué puis rangé et relu, redonne le même état', () => {
    const decks: Decks = { playerDeck: deck(), aiDeck: deck() };
    const jouee = jouer(createBattle(decks.playerDeck, decks.aiDeck, 99), 40);

    const reprise = reprendrePartie(relu(partieSauvegardee(jouee, null, decks)));

    expect(reprise?.state).toEqual(jouee);
    expect(reprise?.match).toBeNull();
    expect(reprise?.decksSolo).toEqual(decks);
  });

  it('garde le camp tenu par le joueur qui a rejoint (#125)', () => {
    const { state } = createMatch(deck(), deck(), 7);
    const match = { camp: 'ai' as const, playerDeck: deck(), aiDeck: deck() };

    const reprise = reprendrePartie(relu(partieSauvegardee(state, match, { playerDeck: [], aiDeck: [] })));

    expect(reprise?.match?.camp).toBe('ai');
  });

  it('une partie terminée n’est pas rangée', () => {
    const { state, match } = createMatch(deck(), deck(), 5);
    const finie = applyAction(state, { type: 'forfeit', who: 'player' });
    expect(finie.phase).toBe('ended');

    expect(partieSauvegardee(finie, match, { playerDeck: [], aiDeck: [] })).toBeNull();
  });

  it('un journal que le moteur refuse ne reprend pas une autre partie en silence', () => {
    const decks: Decks = { playerDeck: deck(), aiDeck: deck() };
    const refusee: BattleAction[] = [{ type: 'forfeit', who: 'player' }, { type: 'endTurn' }];
    const partie = { ...partieSauvegardee(createBattle(decks.playerDeck, decks.aiDeck, 3), null, decks)!, actions: refusee };

    expect(reprendrePartie(partie)).toBeNull();
  });

  it('une forme illisible est écartée, sans lever', () => {
    expect(lirePartie(null)).toBeNull();
    expect(lirePartie({ mode: 'pas-un-mode' })).toBeNull();
    expect(lirePartie({ mode: 'solo', camp: 'player', seed: 'x' })).toBeNull();
  });
});

describe('partie rangée — le contrôle mord', () => {
  it('une partie rangée dans le store survit au rechargement de la page', async () => {
    const { state, match } = createMatch(deck(), deck(), 1234);
    const jouee = jouer(state, 50);

    useStore.getState().enregistrerPartie(partieSauvegardee(jouee, match, { playerDeck: [], aiDeck: [] }));
    const stocke = window.localStorage.getItem(STORAGE_KEY);
    expect(stocke, 'la partie est bien écrite dans le stockage').toContain('"mode":"deux"');

    // « Recharger » : l'état en mémoire disparaît, le stockage survit à la page. Le
    // `setState` ci-dessous est lui-même persisté par le store : on remet donc le
    // stockage tel qu'il était avant la page, puis on relit.
    useStore.setState({ partie: null });
    window.localStorage.setItem(STORAGE_KEY, stocke ?? '');
    await useStore.persist.rehydrate();

    const reprise = reprendrePartie(useStore.getState().partie);
    expect(reprise?.state).toEqual(jouee);
    expect(reprise?.match).toEqual(match);
  });
});
