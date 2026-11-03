import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, getCard } from '@/data';
import { DECK_SIZE } from '@/game/deck';
import { migratePersisted, partializeState, STORAGE_VERSION, useStore } from '@/store/useStore';
import { corpsDeck, reinitialiserDeck, reponseDeck, simulerDeck } from '@/test/deckDeTest';

/** Une carte que la Collection de départ possède, et que le catalogue connaît. */
const CARTE = ALL_CARDS.find((carte) => carte.rarity === '1D')!.id;

beforeEach(() => {
  useStore.getState().reset();
  // Les cas de la file supposent l'import du Deck déjà fait (#492) : l'import a ses propres
  // tests (`import-deck.test.ts`). Sans ce drapeau, `synchroniserDeck` tenterait l'import
  // avant la file, et le premier `fetch` ne serait plus le rejeu.
  useStore.setState({ deckImporte: true });
});

afterEach(reinitialiserDeck);

describe('Le Deck écrit d’abord dans sa file (#491, D-153 (3))', () => {
  it('un geste du Deck laisse une intention, dans l’ordre', () => {
    useStore.getState().addToDeck(CARTE);
    useStore.getState().addToDeck(CARTE);
    useStore.getState().removeFromDeck(CARTE);

    const file = useStore.getState().deckOutbox;
    expect(file).toHaveLength(3);
    expect(file.map((entree) => entree.operation)).toEqual([
      { type: 'ajouter', carte: CARTE, nom: getCard(CARTE)!.name, stade: 'ENTRANT' },
      { type: 'ajouter', carte: CARTE, nom: getCard(CARTE)!.name, stade: 'ENTRANT' },
      { type: 'retirer', carte: CARTE }
    ]);
    expect(file.map((entree) => entree.ordre)).toEqual([1, 2, 3]);
  });

  it('un geste refusé n’allonge pas la file (le contrôle mord)', () => {
    useStore.setState({ deck: Array.from({ length: DECK_SIZE }, () => CARTE) });
    useStore.getState().addToDeck(CARTE);
    expect(useStore.getState().deckOutbox).toEqual([]);
  });

  it('un remplacement de Deck entier (Remplir, Vider, import) est une intention `remplacer`', () => {
    useStore.getState().setDeck([CARTE, CARTE]);
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    expect(useStore.getState().deckOutbox[0]!.operation).toMatchObject({ type: 'remplacer' });

    useStore.getState().clearDeck();
    expect(useStore.getState().deckOutbox).toHaveLength(2);
    expect(useStore.getState().deckOutbox[1]!.operation).toEqual({ type: 'remplacer', cartes: [] });
  });

  it('la file vit dans la forme persistée, et une v16 n’en a pas', () => {
    useStore.getState().addToDeck(CARTE);
    expect(partializeState(useStore.getState()).deckOutbox).toHaveLength(1);

    const migre = migratePersisted({ deck: [], cafeTypes: [] }, 16);
    expect(migre.deckOutbox).toEqual([]);
  });

  it('une file trafiquée est filtrée à la lecture', () => {
    const migre = migratePersisted({ deckOutbox: [{ id: 'x', ordre: 1, operation: { type: 'exploser' } }] }, 17);
    expect(migre.deckOutbox).toEqual([]);
  });
});

describe('La file part au retour du réseau, et rien n’est perdu (#491)', () => {
  it('une intention hors ligne survit au rechargement et part au retour du réseau', async () => {
    // 1. Hors ligne : le geste reste local, la file monte, aucun appel.
    const horsLigne = simulerDeck({ enLigne: false });
    useStore.getState().addToDeck(CARTE);
    expect(useStore.getState().deck).toEqual([CARTE]);
    expect(await useStore.getState().synchroniserDeck()).toBe('hors-ligne');
    expect(horsLigne).not.toHaveBeenCalled();
    expect(useStore.getState().deckOutbox).toHaveLength(1);

    // 2. Le rechargement : `persist` relit la forme, la migration la remet en état.
    const persistee = JSON.parse(JSON.stringify(partializeState(useStore.getState()))) as unknown;
    useStore.setState(migratePersisted(persistee, STORAGE_VERSION));
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    const id = useStore.getState().deckOutbox[0]!.id;

    // 3. Le réseau revient : le lot part, la file se vide, la clé vient de l'intention gardée.
    const enLigne = simulerDeck();
    expect(await useStore.getState().synchroniserDeck()).toBeNull();
    expect(useStore.getState().deckOutbox).toEqual([]);
    const corps = corpsDeck(enLigne);
    expect(corps.p_cle).toBe(`deck:${id}`);
    expect(corps.p_operations).toHaveLength(1);
    expect(corps.p_operations[0]).toMatchObject({ type: 'ajouter', carte: CARTE });
  });

  it('un échec réseau garde la file, et le retry rejoue la même clé', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('réseau coupé')).mockResolvedValueOnce(reponseDeck());
    simulerDeck({ fetchImpl });

    useStore.getState().addToDeck(CARTE);
    expect(await useStore.getState().synchroniserDeck()).toBe('reseau');
    expect(useStore.getState().deckOutbox).toHaveLength(1);

    expect(await useStore.getState().synchroniserDeck()).toBeNull();
    expect(useStore.getState().deckOutbox).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(corpsDeck(fetchImpl, 1).p_cle).toBe(corpsDeck(fetchImpl, 0).p_cle);
  });

  it('un refus du serveur garde la file et ne touche pas au Deck local', async () => {
    simulerDeck({ statut: 400 });
    useStore.getState().addToDeck(CARTE);
    const avant = [...useStore.getState().deck];

    expect(await useStore.getState().synchroniserDeck()).toBe('refus');
    expect(useStore.getState().deckOutbox).toHaveLength(1);
    expect(useStore.getState().deck).toEqual(avant);
    expect(useStore.getState().deckSyncRaison).toBe('refus');
  });

  it('sans session, aucun appel n’est émis et la file reste', async () => {
    const fetchImpl = simulerDeck({ jeton: null });
    useStore.getState().addToDeck(CARTE);

    expect(await useStore.getState().synchroniserDeck()).toBe('refus');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(useStore.getState().deckOutbox).toHaveLength(1);
  });

  it('hors ligne, aucun appel n’est émis et la file reste', async () => {
    const fetchImpl = simulerDeck({ enLigne: false });
    useStore.getState().addToDeck(CARTE);

    expect(await useStore.getState().synchroniserDeck()).toBe('hors-ligne');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(useStore.getState().deckOutbox).toHaveLength(1);
  });

  it('une file vide n’émet aucun appel', async () => {
    const fetchImpl = simulerDeck();
    expect(await useStore.getState().synchroniserDeck()).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deux envois simultanés partagent la même promesse — un seul lot', async () => {
    const fetchImpl = simulerDeck();
    useStore.getState().addToDeck(CARTE);

    const [premier, second] = await Promise.all([
      useStore.getState().synchroniserDeck(),
      useStore.getState().synchroniserDeck()
    ]);
    expect(premier).toBeNull();
    expect(second).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
