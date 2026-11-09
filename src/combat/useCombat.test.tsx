// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createBattle, legalActions } from '@/game/engine';
import { autoDeck } from '@/game/deck';
import { ALL_CARDS } from '@/data';
import { DUREE_OUVERTURE_MS } from '@/components/effets-combat';
import { partieSauvegardee } from '@/store/partie';
import { useStore } from '@/store/useStore';
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

/**
 * **L'ouverture d'un combat neuf** (#746). Le drapeau est un lifecycle du hook : il ne se lit ni
 * dans le journal, ni dans `BattleState`, et une partie reprise ne le rejoue pas.
 *
 * Le contrôle mord sur les trois cas exigés : (a) un combat neuf porte déjà une ligne de journal,
 * et il reste `neuve` ; (b) une partie rangée, reprise au montage, ne joue pas ; (c) un
 * rechargement (démontage puis remontage) ne rejoue pas, alors qu'un « Nouveau combat » rejoue.
 */
describe('useCombat — l’ouverture d’un combat neuf (#746)', () => {
  /** Un montage **sans** remise à zéro du store : le rechargement garde la partie rangée. */
  function remonter(sansMouvement = false) {
    return renderHook(() => useCombat({ tutoriel: false, sceneFin: false, sansMouvement }));
  }

  /** Une partie rangée dans le store, comme l'enregistre le hook à chaque état. */
  function rangerUnePartie() {
    const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
    const deck = autoDeck(owned).deck;
    const etat = createBattle(deck, deck, 4242);
    const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie terminée : rien à ranger');
    useStore.getState().enregistrerPartie(partie);
    return deck;
  }

  it('(a) un combat neuf est `neuve`, même si son journal n’est pas vide', () => {
    const { result } = monter({ sansMouvement: false });

    // Le contrôle mord : `state.log.length === 0` serait faux ici, un combat neuf a déjà son lancer.
    expect(result.current.state.log.length).toBeGreaterThan(0);
    expect(result.current.ouverture).toBe('neuve');
  });

  it('(b) une partie rangée, reprise au montage, n’a pas d’ouverture', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
    setupTestStore();
    rangerUnePartie();

    const { result } = remonter();

    expect(result.current.partieReprise).toBe(true);
    expect(result.current.ouverture).toBe('aucune');
  });

  it('(c) un rechargement ne rejoue pas l’ouverture, « Nouveau combat » la rejoue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
    setupTestStore();
    const premier = remonter();
    expect(premier.result.current.ouverture).toBe('neuve');
    // La partie est rangée à chaque état : le rechargement la trouve dans le store.
    premier.unmount();
    expect(useStore.getState().partie).not.toBeNull();

    const rechargement = remonter();
    expect(rechargement.result.current.partieReprise).toBe(true);
    expect(rechargement.result.current.ouverture).toBe('aucune');

    act(() => rechargement.result.current.recommencer());
    expect(rechargement.result.current.ouverture).toBe('neuve');
  });

  it('la séquence finit d’elle-même, et `passerOuverture` la passe', () => {
    const { result } = monter({ sansMouvement: false });
    expect(result.current.ouverture).toBe('neuve');

    act(() => void vi.advanceTimersByTime(DUREE_OUVERTURE_MS - 1));
    expect(result.current.ouverture).toBe('neuve');
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.ouverture).toBe('aucune');

    act(() => result.current.recommencer());
    expect(result.current.ouverture).toBe('neuve');
    act(() => result.current.passerOuverture());
    expect(result.current.ouverture).toBe('aucune');
  });
});
