import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurCollection, lireCollection, urlCollection } from '@/lib/collection';
import { reinitialiserCollection, reponseCollection, simulerCollection } from '@/test/collectionDeTest';

afterEach(reinitialiserCollection);

describe('lireCollection — le serveur fait foi, le client lit (#493, D-179 (3))', () => {
  it('lit la table du compte et rend l’état complet, sans filtre client', async () => {
    const fetchImpl = simulerCollection({
      lignes: [
        { carte_id: 'sse-infirmier-site', quantite: 2 },
        { carte_id: 'management-responsable-unite', quantite: 1 }
      ]
    });

    const owned = await lireCollection();

    expect(owned).toEqual({ 'sse-infirmier-site': 2, 'management-responsable-unite': 1 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exemple.test/rest/v1/collection?select=carte_id,quantite');
    expect(init.method).toBe('GET');
    const entetes = init.headers as Record<string, string>;
    expect(entetes.Authorization).toBe('Bearer jeton-test');
    expect(entetes.apikey).toBe('sb_publishable_test');
  });

  it('l’URL vise la table `collection` avec ses deux colonnes seulement', () => {
    expect(urlCollection({ url: 'https://exemple.test/', clePublique: 'x' })).toBe(
      'https://exemple.test/rest/v1/collection?select=carte_id,quantite'
    );
  });

  it('écarte une carte que le catalogue ne connaît pas', async () => {
    simulerCollection({
      lignes: [
        { carte_id: 'sse-infirmier-site', quantite: 1 },
        { carte_id: 'carte-disparue-du-catalogue', quantite: 9 }
      ]
    });

    expect(await lireCollection()).toEqual({ 'sse-infirmier-site': 1 });
  });

  it('hors ligne : refuse sans aucun appel (D-179 (6))', async () => {
    const fetchImpl = simulerCollection({ enLigne: false });

    await expect(lireCollection()).rejects.toMatchObject({ raison: 'hors-ligne' });
    // Le contrôle mord : un refus qui appellerait quand même ne garderait rien.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sans session, il n’y a rien à lire : `refus`, aucun appel', async () => {
    const fetchImpl = simulerCollection({ jeton: null });

    await expect(lireCollection()).rejects.toBeInstanceOf(ErreurCollection);
    await expect(lireCollection()).rejects.toMatchObject({ raison: 'refus' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sans backend configuré : `configuration`, aucun appel', async () => {
    const fetchImpl = simulerCollection({ configuration: null });

    await expect(lireCollection()).rejects.toMatchObject({ raison: 'configuration' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('un 401 du serveur est nommé `refus`', async () => {
    simulerCollection({ statut: 401 });
    await expect(lireCollection()).rejects.toMatchObject({ raison: 'refus' });
  });

  it('une panne du serveur est `reseau`', async () => {
    simulerCollection({ statut: 500 });
    await expect(lireCollection()).rejects.toMatchObject({ raison: 'reseau' });
  });

  it('une panne de transport est `reseau`', async () => {
    simulerCollection({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('réseau coupé');
      })
    });
    await expect(lireCollection()).rejects.toMatchObject({ raison: 'reseau' });
  });

  it('une réponse illisible est `reseau`', async () => {
    simulerCollection({ fetchImpl: vi.fn(async () => reponseCollection({ pas: 'une liste' })) });
    await expect(lireCollection()).rejects.toMatchObject({ raison: 'reseau' });
  });

  it('une quantité forgée (zéro, négative, décimale) est `reseau` — la base garantit ≥ 1', async () => {
    simulerCollection({ lignes: [{ carte_id: 'sse-infirmier-site', quantite: 0 }] });
    await expect(lireCollection()).rejects.toMatchObject({ raison: 'reseau' });
  });
});
