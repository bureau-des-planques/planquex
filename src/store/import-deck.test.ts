import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS } from '@/data';
import { ajouterIntention, operationDeck } from '@/lib/deck';
import { useStore } from '@/store/useStore';
import { reinitialiserDeck, reponseDeck, simulerDeck } from '@/test/deckDeTest';

/**
 * **L'import du Deck local dans le compte, une seule fois** — #492, D-153 (1), D-179 (1).
 *
 * Le faux serveur est celui de `@/test/deckDeTest` : aucun réseau. La réponse de
 * `public.importer_deck` est un objet `{ importe, deck }` (migration `0026`) ; c'est le
 * serveur qui décide si l'import a eu lieu, et le client adopte le Deck qu'il rend.
 */
const CARTE = ALL_CARDS[0].id;
const SERVEUR = ALL_CARDS[1].id;

/** Une réponse d'import telle que la RPC la rend. */
function reponseImport(importe: boolean, cartes: readonly string[]): Response {
  return reponseDeck({
    importe,
    deck: cartes.map((carte, rang) => ({ carte, quantite: 1, rang }))
  });
}

beforeEach(() => {
  useStore.getState().reset();
  useStore.setState({ deck: [], deckOutbox: [], deckImporte: false, deckSyncRaison: null });
});

afterEach(reinitialiserDeck);

describe('Le Deck local monte dans le compte, une seule fois (#492)', () => {
  it('importe le Deck local, et deux « logins » n’émettent qu’un appel', async () => {
    const fetchImpl = vi.fn(async () => reponseImport(true, [CARTE]));
    simulerDeck({ fetchImpl });
    useStore.setState({ deck: [CARTE] });

    expect(await useStore.getState().importerDeckLocal()).toBeNull();
    expect(useStore.getState().deckImporte).toBe(true);

    // Second login (rechargement, second montage) : le drapeau local court-circuite.
    expect(await useStore.getState().importerDeckLocal()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // **Le contrôle mord** : on voit l'instantané envoyé — un seul `remplacer`, pas un geste
    // par carte, puisque c'est la composition locale qui monte.
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://exemple.test/rest/v1/rpc/importer_deck');
    const corps = JSON.parse(String(init.body)) as { p_operations: Array<{ type: string }>; p_cle: string };
    expect(corps.p_operations).toHaveLength(1);
    expect(corps.p_operations[0]).toMatchObject({ type: 'remplacer' });
    expect(corps.p_cle.length).toBeGreaterThan(10);
  });

  it('un compte qui a déjà un Deck n’est pas écrasé : le Deck du serveur remplace le local', async () => {
    // La RPC répond `importe: false` (le compte avait déjà un Deck) et rend le sien. Le
    // serveur fait autorité (D-179 (1)) : la copie locale est remplacée, pas conservée à
    // côté — il n'y a pas de seconde source ni de fusion (D-179 (3)).
    simulerDeck({ fetchImpl: vi.fn(async () => reponseImport(false, [SERVEUR])) });
    useStore.setState({ deck: [CARTE] });

    expect(await useStore.getState().importerDeckLocal()).toBeNull();
    expect(useStore.getState().deck).toEqual([SERVEUR]);
    expect(useStore.getState().deckImporte).toBe(true);
  });

  it('un échec ne perd rien : Deck et file intacts, et le retry réessaie', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('réseau coupé'))
      .mockResolvedValueOnce(reponseImport(true, [CARTE]));
    simulerDeck({ fetchImpl });
    const file = ajouterIntention([], operationDeck([], [CARTE]));
    useStore.setState({ deck: [CARTE], deckOutbox: file });

    expect(await useStore.getState().importerDeckLocal()).toBe('reseau');
    // **Rien n'est perdu** : ni le Deck local, ni la file, ni le droit de réessayer.
    expect(useStore.getState().deck).toEqual([CARTE]);
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    expect(useStore.getState().deckImporte).toBe(false);

    expect(await useStore.getState().importerDeckLocal()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(useStore.getState().deckImporte).toBe(true);
    // Le succès vide la file : l'instantané importé la remplace.
    expect(useStore.getState().deckOutbox).toEqual([]);
  });

  it('hors ligne : aucun appel, Deck et file intacts', async () => {
    const fetchImpl = simulerDeck({ enLigne: false });
    const file = ajouterIntention([], operationDeck([], [CARTE]));
    useStore.setState({ deck: [CARTE], deckOutbox: file });

    expect(await useStore.getState().importerDeckLocal()).toBe('hors-ligne');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(useStore.getState().deck).toEqual([CARTE]);
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    expect(useStore.getState().deckImporte).toBe(false);
  });

  it('sans session : `refus`, aucun appel', async () => {
    const fetchImpl = simulerDeck({ jeton: null });
    useStore.setState({ deck: [CARTE] });

    expect(await useStore.getState().importerDeckLocal()).toBe('refus');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(useStore.getState().deckImporte).toBe(false);
  });

  it('un Deck bougé pendant l’import n’est pas écrasé : il repart en `remplacer`', async () => {
    // Une réponse qui attend : pendant l'appel, le testeur ajoute une carte au Deck local.
    let resoudre!: (reponse: Response) => void;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resoudre = resolve;
        })
    );
    simulerDeck({ fetchImpl });
    useStore.setState({ deck: [CARTE] });

    const promesse = useStore.getState().importerDeckLocal();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    useStore.setState({ deck: [CARTE, SERVEUR] });
    resoudre(reponseImport(true, [CARTE]));

    expect(await promesse).toBeNull();
    // **Rien n'est écrasé** : le geste du testeur reste, et il repart vers le serveur.
    expect(useStore.getState().deck).toEqual([CARTE, SERVEUR]);
    expect(useStore.getState().deckImporte).toBe(true);
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    expect(useStore.getState().deckOutbox[0]!.operation).toMatchObject({ type: 'remplacer' });
  });

  it('deux imports simultanés partagent la même promesse — un seul appel', async () => {
    const fetchImpl = vi.fn(async () => reponseImport(true, [CARTE]));
    simulerDeck({ fetchImpl });
    useStore.setState({ deck: [CARTE] });

    const [premier, second] = await Promise.all([
      useStore.getState().importerDeckLocal(),
      useStore.getState().importerDeckLocal()
    ]);
    expect(premier).toBeNull();
    expect(second).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('un drapeau déjà vrai n’émet aucun appel', async () => {
    const fetchImpl = simulerDeck();
    useStore.setState({ deck: [CARTE], deckImporte: true });

    expect(await useStore.getState().importerDeckLocal()).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('synchroniserDeck importe d’abord, puis envoie la file', async () => {
    // Un Deck local jamais importé, plus une intention en file : le premier appel est
    // l'import (qui vide la file en l'absorbant), donc aucun rejeu ne suit.
    const fetchImpl = vi.fn(async () => reponseImport(true, [CARTE]));
    simulerDeck({ fetchImpl });
    const file = ajouterIntention([], operationDeck([], [CARTE]));
    useStore.setState({ deck: [CARTE], deckOutbox: file, deckImporte: false });

    expect(await useStore.getState().synchroniserDeck()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toContain('/rest/v1/rpc/importer_deck');
    expect(useStore.getState().deckImporte).toBe(true);
    expect(useStore.getState().deckOutbox).toEqual([]);
  });
});
