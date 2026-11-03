// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { getCard } from '@/data';
import type { IntentionDeck } from '@/lib/deck';
import { reinitialiserDeck, simulerDeck } from '@/test/deckDeTest';

/**
 * **L'état de synchro du Deck** (#491, D-060 (3)) : l'écran dit qu'un geste n'est pas
 * parti, propose de réessayer, et **ne perd rien** quand le serveur refuse. Ce sont les
 * trois choses que ce fichier garde ; une file muette ferait croire le Deck synchronisé.
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

describe('Deck — l’état de synchro (#491, D-060 (3))', () => {
  it('dit qu’un geste n’est pas parti, et propose de réessayer', () => {
    renderWithStore(<Deck />, { deck: [CARTE], deckOutbox: [INTENTION], deckImporte: true, deckSyncRaison: 'reseau' });

    expect(screen.getByText(/Le Deck n’a pas pu être synchronisé/)).toBeInTheDocument();
    expect(screen.getByText(/il repartira au retour du réseau/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(useStore.getState().deck).toEqual([CARTE]);
  });

  it('sans échec connu, l’état dit seulement que le geste attend le réseau', () => {
    renderWithStore(<Deck />, { deck: [CARTE], deckOutbox: [INTENTION], deckImporte: true, deckSyncRaison: null });
    expect(screen.getByText(/Le Deck n’a pas pu être synchronisé/)).toBeInTheDocument();
    expect(screen.queryByText(/refusé/)).toBeNull();
  });

  it('« Réessayer » envoie le lot et fait disparaître l’état', async () => {
    const fetchImpl = simulerDeck();
    renderWithStore(<Deck />, { deck: [CARTE], deckOutbox: [INTENTION], deckImporte: true, deckSyncRaison: 'reseau' });

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(useStore.getState().deckOutbox).toEqual([]));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText(/Le Deck n’a pas pu être synchronisé/)).toBeNull());
  });

  it('un refus garde l’état, le geste et le Deck — rien n’est écrasé', async () => {
    simulerDeck({ statut: 400 });
    renderWithStore(<Deck />, { deck: [CARTE], deckOutbox: [INTENTION], deckImporte: true, deckSyncRaison: 'reseau' });

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(useStore.getState().deckSyncRaison).toBe('refus'));
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    expect(useStore.getState().deck).toEqual([CARTE]);
    expect(screen.getByText(/Le serveur a refusé ce Deck/)).toBeInTheDocument();
  });
});
