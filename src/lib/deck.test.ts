import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleDeck,
  envoyerDeck,
  ErreurDeck,
  operationDeck,
  normaliserOutbox,
  urlRejeuDeck,
  type IntentionDeck
} from '@/lib/deck';
import { corpsDeck, reinitialiserDeck, simulerDeck } from '@/test/deckDeTest';

afterEach(reinitialiserDeck);

describe('operationDeck — le geste qui mène d’un Deck à l’autre (#491)', () => {
  it('ne rend rien quand le Deck n’a pas bougé', () => {
    expect(operationDeck(['a', 'b'], ['a', 'b'])).toBeNull();
  });

  it('un exemplaire de plus est `ajouter`, avec le nom et le stade du catalogue', () => {
    const operation = operationDeck([], ['sse-infirmier-site']);
    expect(operation).toMatchObject({ type: 'ajouter', carte: 'sse-infirmier-site' });
    expect(operation && 'nom' in operation && operation.nom.length).toBeGreaterThan(0);
    expect(operation && 'stade' in operation && operation.stade).toBeTruthy();
  });

  it('un exemplaire de moins est `retirer`, même au milieu', () => {
    expect(operationDeck(['a', 'b', 'c'], ['a', 'c'])).toEqual({ type: 'retirer', carte: 'b' });
  });

  it('un remplacement, un réordonnancement ou un échange deviennent `remplacer`', () => {
    expect(operationDeck(['a', 'b'], ['b', 'a'])).toMatchObject({ type: 'remplacer' });
    expect(operationDeck(['a', 'b'], [])).toEqual({ type: 'remplacer', cartes: [] });
    expect(operationDeck([], ['a', 'b'])).toMatchObject({ type: 'remplacer' });
  });
});

describe('cleDeck — la clé d’idempotence du lot (#491)', () => {
  it('tient à la première intention : un retry rejoue la même clé', () => {
    const file: IntentionDeck[] = [
      { id: 'un', ordre: 1, operation: { type: 'retirer', carte: 'a' } },
      { id: 'deux', ordre: 2, operation: { type: 'retirer', carte: 'b' } }
    ];
    expect(cleDeck(file)).toBe('deck:un');
    // Le lot suivant, privé de sa première intention, prend une clé neuve.
    expect(cleDeck(file.slice(1))).toBe('deck:deux');
  });
});

describe('normaliserOutbox — une file trafiquée ne part pas au serveur (#491)', () => {
  it('garde les intentions bien formées, dans l’ordre', () => {
    const file = normaliserOutbox([
      { id: 'b', ordre: 2, operation: { type: 'retirer', carte: 'x' } },
      { id: 'a', ordre: 1, operation: { type: 'ajouter', carte: 'y' } }
    ]);
    expect(file.map((intention) => intention.id)).toEqual(['a', 'b']);
  });

  it('écarte un ordre non entier, un id vide et une opération inconnue', () => {
    expect(
      normaliserOutbox([
        { id: '', ordre: 1, operation: { type: 'retirer', carte: 'x' } },
        { id: 'a', ordre: 1.5, operation: { type: 'retirer', carte: 'x' } },
        { id: 'b', ordre: 2, operation: { type: 'exploser' } },
        { id: 'c', ordre: 3, operation: { type: 'remplacer', cartes: [{ carte: '' }] } },
        { id: 'x'.repeat(101), ordre: 4, operation: { type: 'retirer', carte: 'x' } },
        'pas une intention'
      ])
    ).toEqual([]);
  });

  it('ne rend pas une valeur qui n’est pas un tableau', () => {
    expect(normaliserOutbox('hier')).toEqual([]);
  });
});

describe('envoyerDeck — les quatre raisons, aucun appel inutile (#491)', () => {
  const operations = [{ type: 'retirer', carte: 'a' } as const];

  it('vise la RPC `rejouer_deck` avec le jeton et la clé publique', async () => {
    const fetchImpl = simulerDeck();
    await envoyerDeck(operations, 'deck:cle');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exemple.test/rest/v1/rejouer_deck');
    expect(init.method).toBe('POST');
    const entetes = init.headers as Record<string, string>;
    expect(entetes.Authorization).toBe('Bearer jeton-test');
    expect(entetes.apikey).toBe('sb_publishable_test');
    expect(corpsDeck(fetchImpl)).toEqual({ p_operations: operations, p_cle: 'deck:cle' });
  });

  it('l’URL vise le chemin REST de la fonction', () => {
    expect(urlRejeuDeck({ url: 'https://exemple.test/', clePublique: 'x' })).toBe(
      'https://exemple.test/rest/v1/rejouer_deck'
    );
  });

  it('hors ligne : `hors-ligne`, aucun appel', async () => {
    const fetchImpl = simulerDeck({ enLigne: false });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'hors-ligne' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sans session : `refus`, aucun appel', async () => {
    const fetchImpl = simulerDeck({ jeton: null });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toBeInstanceOf(ErreurDeck);
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'refus' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sans backend : `configuration`, aucun appel', async () => {
    const fetchImpl = simulerDeck({ configuration: null });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'configuration' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('une panne de transport est `reseau`', async () => {
    simulerDeck({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('réseau coupé');
      })
    });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'reseau' });
  });

  it('un 5xx est `reseau`, un 4xx est `refus` (Deck illégal compris)', async () => {
    simulerDeck({ statut: 500 });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'reseau' });

    simulerDeck({ statut: 400 });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'refus' });

    simulerDeck({ statut: 401 });
    await expect(envoyerDeck(operations, 'deck:cle')).rejects.toMatchObject({ raison: 'refus' });
  });

  it('un lot vide n’émet aucun appel', async () => {
    const fetchImpl = simulerDeck();
    await envoyerDeck([], 'deck:cle');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
