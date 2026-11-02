// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { legalActions } from '@/game/engine';
import { setupTestStore } from '@/test/test-utils';
import { useCombat } from './useCombat';

/**
 * **La mécanique de tour, éprouvée sans l'écran** (#556, tranche 5.1).
 *
 * Ce que ces tests gardent, et qui peut réellement échouer :
 *
 * 1. un coup passe par `applyAction` — le seul point qui journalise — et l'écran est **prévenu**
 *    (`onCoup`), sinon la carte choisie resterait ouverte sur une main qui a bougé ;
 * 2. la Direction joue **seule**, après son délai : c'est l'effet que l'écran n'a plus ;
 * 3. en partie à deux, elle ne joue **jamais** : le camp adverse est tenu par quelqu'un ;
 * 4. un code refusé remonte sa phrase, sans que le hook la réécrive ;
 * 5. un Deck illégal replie sur le deck de test, et le hook le dit (`usedTestDeck`).
 *
 * Aucun rendu d'écran : c'est le point de la tranche — la mécanique se teste sans `Battle.tsx`.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Le hook, monté sur un store de test connu et une horloge figée (la graine vient d'elle). */
function monter(options: { sansMouvement?: boolean; onCoup?: () => void } = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
  setupTestStore();
  return renderHook(() =>
    useCombat({
      tutoriel: false,
      sceneFin: false,
      sansMouvement: options.sansMouvement ?? true,
      onCoup: options.onCoup
    })
  );
}

describe('useCombat — un coup, et l’écran prévenu', () => {
  it('applique l’action par le moteur et journalise le coup', () => {
    const onCoup = vi.fn();
    const { result } = monter({ onCoup });
    const avant = result.current.state;
    const action = legalActions(avant)[0];
    if (!action) throw new Error('aucune action légale au départ : le combat ne démarre pas');

    act(() => result.current.jouer(action));

    expect(result.current.state.actionLog).toHaveLength(avant.actionLog.length + 1);
    expect(onCoup).toHaveBeenCalledTimes(1);
  });

  it('le contrôle mord : une action que le moteur refuse ne journalise rien', () => {
    const { result } = monter();
    const avant = result.current.state.actionLog;

    // Une Relève sans relève en attente : le moteur rend l'état tel quel.
    act(() => result.current.jouer({ type: 'promoteActive', benchIndex: 9 }));

    expect(result.current.state.actionLog).toEqual(avant);
  });
});

describe('useCombat — la Direction joue seule (#131)', () => {
  it('annonce son attente, puis joue un coup après le délai', () => {
    const { result } = monter({ sansMouvement: false });
    if (!result.current.directionReflechit) {
      // Le lancer de tampon peut ouvrir la Direction : sinon, on lui passe la main.
      const fin = legalActions(result.current.state).find((action) => action.type === 'endTurn');
      if (!fin) throw new Error('la fin du tour n’est pas offerte au départ');
      act(() => result.current.jouer(fin));
    }
    expect(result.current.directionReflechit).toBe(true);
    const avant = result.current.state.actionLog.length;

    act(() => void vi.advanceTimersByTime(600));

    expect(result.current.state.actionLog.length).toBeGreaterThan(avant);
  });

  it('sous « Mouvement réduit », le délai tombe à zéro', () => {
    const { result } = monter({ sansMouvement: true });
    if (!result.current.directionReflechit) {
      const fin = legalActions(result.current.state).find((action) => action.type === 'endTurn');
      if (!fin) throw new Error('la fin du tour n’est pas offerte au départ');
      act(() => result.current.jouer(fin));
    }
    const avant = result.current.state.actionLog.length;

    act(() => void vi.advanceTimersByTime(0));

    expect(result.current.state.actionLog.length).toBeGreaterThan(avant);
  });
});

describe('useCombat — la partie à deux (#125)', () => {
  it('monte une table à deux, et la Direction n’y joue plus', () => {
    const { result } = monter({ sansMouvement: false });
    act(() => result.current.creerPartieADeux());

    expect(result.current.match).not.toBeNull();
    expect(result.current.directionReflechit).toBe(false);

    // Le témoin : aucun coup de la Direction ne part, même après un long délai.
    const avant = result.current.state.actionLog.length;
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current.state.actionLog).toHaveLength(avant);
  });

  it('refuse un code qui ne se rejoue pas, avec la phrase du codec', () => {
    const { result } = monter();

    const refus = result.current.reprendre('PLQ1.pas-un-code');

    expect(refus.ok).toBe(false);
    if (!refus.ok) {
      expect(refus.raison.length).toBeGreaterThan(0);
      // Le hook ne réécrit pas la raison : l'écran l'affiche telle quelle.
      expect(refus.raison).not.toMatch(/PLQ1/);
    }
  });
});

describe('useCombat — le Deck joué (#251)', () => {
  it('replie sur le deck de test quand le Deck du joueur est illégal, et dit pourquoi', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
    setupTestStore({ deck: [] });

    const { result } = renderHook(() => useCombat({ tutoriel: false, sceneFin: false, sansMouvement: true }));

    expect(result.current.usedTestDeck).toBe(true);
    expect(result.current.raisonsDeckDeTest.length).toBeGreaterThan(0);
    // La partie démarre quand même : un Deck de test est servi, pas un plateau vide.
    expect(result.current.state.players.player.deck.length).toBeGreaterThan(0);
  });
});
