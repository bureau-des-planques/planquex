// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, waitFor } from '@testing-library/react';
import { rendreApplication } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { getCard } from '@/data';
import type { IntentionDeck } from '@/lib/deck';
import { corpsDeck, reinitialiserDeck, simulerDeck } from '@/test/deckDeTest';

/**
 * **Le retour du réseau draine la file du Deck** (#491, D-153 (3)) : l'écouteur est monté
 * par `App`, pas par l'écran Deck, donc le geste part même si le joueur est ailleurs.
 * Une intention gardée d'avant (hors ligne, ou rechargement) doit partir sur `online`.
 */
const CARTE = 'sse-infirmier-site';

const INTENTION: IntentionDeck = {
  id: 'intention-1',
  ordre: 1,
  operation: { type: 'ajouter', carte: CARTE, nom: getCard(CARTE)!.name, stade: 'ENTRANT' }
};

afterEach(() => {
  cleanup();
  reinitialiserDeck();
});

describe('App — la file du Deck au retour du réseau (#491)', () => {
  it('une intention gardée part quand le navigateur repasse en ligne', async () => {
    const fetchImpl = simulerDeck();
    await rendreApplication({ chemin: '/deck', storeState: { deckOutbox: [INTENTION], deckImporte: true } });

    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(useStore.getState().deckOutbox).toEqual([]));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(corpsDeck(fetchImpl).p_cle).toBe('deck:intention-1');
  });

  it('hors ligne, l’événement ne fait rien partir', async () => {
    const fetchImpl = simulerDeck({ enLigne: false });
    await rendreApplication({ chemin: '/deck', storeState: { deckOutbox: [INTENTION], deckImporte: true } });

    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(useStore.getState().deckSyncRaison).toBe('hors-ligne'));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(useStore.getState().deckOutbox).toHaveLength(1);
  });
});
