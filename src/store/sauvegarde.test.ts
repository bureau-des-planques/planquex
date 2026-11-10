import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, isBasic } from '@/data';
import { DECK_SIZE } from '@/game/deck';
import type { OperationDeck } from '@/lib/deck';
import { ARCHIVE_VERSION, creerSauvegarde, lireSauvegarde, restaurerSauvegarde } from '@/store/sauvegarde';
import { partializeState, STORAGE_VERSION, useStore } from '@/store/useStore';
import { reinitialiserCollection, simulerCollection } from '@/test/collectionDeTest';
import { reinitialiserDeck, simulerDeck } from '@/test/deckDeTest';

/**
 * **La sauvegarde** — #495, D-202. Aucun réseau : un faux compte (Deck + Collection) répond
 * aux trois routes que la sauvegarde touche (`GET deck`, `GET collection`, les deux RPC).
 */
const NOMS = new Map<string, string>();
const UNIQUES = ALL_CARDS.filter((carte) => {
  if (NOMS.has(carte.name)) return false;
  NOMS.set(carte.name, carte.id);
  return true;
});
const ENTRANTS = UNIQUES.filter((carte) => isBasic(carte)).map((carte) => carte.id);
const AUTRES = UNIQUES.filter((carte) => !isBasic(carte)).map((carte) => carte.id);
const [A, B, C] = [ENTRANTS[0] as string, ENTRANTS[1] as string, AUTRES[0] as string];

interface Compte {
  deck: string[];
  collection: Record<string, number>;
  appels: Array<{ url: string; operations?: OperationDeck[] }>;
}

function json(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
}

/** Les lignes `{ carte, quantite, rang }` d'un Deck, comme la RPC les rend. */
function lignesDeck(deck: readonly string[]) {
  const rangs: string[] = [];
  for (const id of deck) if (!rangs.includes(id)) rangs.push(id);
  return rangs.map((carte, rang) => ({ carte, quantite: deck.filter((id) => id === carte).length, rang }));
}

/** Branche un faux compte : les deux couches réseau (Deck et Collection) parlent à la même base. */
function brancherCompte(compte: Compte, options: { enLigne?: boolean } = {}) {
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const corps = init?.body ? (JSON.parse(String(init.body)) as { p_operations?: OperationDeck[] }) : {};
    compte.appels.push({ url, operations: corps.p_operations });
    if (url.includes('/rest/v1/collection')) {
      return json(Object.entries(compte.collection).map(([carte_id, quantite]) => ({ carte_id, quantite })));
    }
    if (url.includes('/rest/v1/deck')) {
      return json(lignesDeck(compte.deck).map((l) => ({ carte_id: l.carte, quantite: l.quantite, rang: l.rang })));
    }
    // `rejouer_deck` et `importer_deck` : on applique le `remplacer` / `ajouter` / `retirer`.
    for (const operation of corps.p_operations ?? []) {
      if (operation.type === 'remplacer') compte.deck = operation.cartes.map((carte) => carte.carte);
      if (operation.type === 'ajouter') compte.deck = [...compte.deck, operation.carte];
      if (operation.type === 'retirer') {
        const index = compte.deck.indexOf(operation.carte);
        if (index >= 0) compte.deck = compte.deck.filter((_, i) => i !== index);
      }
    }
    return url.includes('importer_deck')
      ? json({ importe: true, deck: lignesDeck(compte.deck) })
      : json(lignesDeck(compte.deck));
  });
  simulerDeck({ fetchImpl, enLigne: options.enLigne });
  simulerCollection({ fetchImpl, enLigne: options.enLigne });
  return fetchImpl;
}

function nouveauCompte(partiel: Partial<Compte> = {}): Compte {
  return { deck: [], collection: { [A]: 2, [B]: 2, [C]: 2 }, appels: [], ...partiel };
}

beforeEach(() => {
  useStore.getState().reset();
  useStore.setState({ deck: [], deckOutbox: [], deckImporte: true, deckSyncRaison: null });
});

afterEach(() => {
  reinitialiserDeck();
  reinitialiserCollection();
});

describe('Export : le Deck et la Collection se lisent sur le compte (#495)', () => {
  it('l’archive porte son propre numéro, pas celui du store', async () => {
    brancherCompte(nouveauCompte());
    const { texte } = await creerSauvegarde();
    const archive = JSON.parse(texte) as Record<string, unknown>;

    expect(archive.jeu).toBe('bureau-des-planques');
    expect(archive.archive).toBe(ARCHIVE_VERSION);
    // Le contrôle mord : un export qui réutiliserait le numéro du store écrirait `version`.
    expect(archive).not.toHaveProperty('version');
    expect(archive).not.toHaveProperty('etat');
    expect(ARCHIVE_VERSION).not.toBe(STORAGE_VERSION);
  });

  it('lit le Deck et la Collection du compte, pas la copie de l’appareil', async () => {
    const compte = nouveauCompte({ deck: [A, B], collection: { [A]: 2, [B]: 2, [C]: 5 } });
    brancherCompte(compte);
    // La copie locale est **périmée** : un export du store y lirait [C].
    useStore.setState({ deck: [C], owned: { [C]: 1 }, deckImporte: true, deckOutbox: [] });
    // (Le Deck local périmé n'a aucune intention en file : le compte fait foi.)

    const { texte, deck, collection } = await creerSauvegarde();
    const archive = JSON.parse(texte) as { deck: { cartes: string[] }; collection: { cartes: Record<string, number> } };

    expect(deck).toBe('compte');
    expect(collection).toBe('compte');
    expect(archive.deck.cartes).toEqual([A, B]);
    expect(archive.collection.cartes[C]).toBe(5);
  });

  it('pousse d’abord la file du Deck : un geste en attente n’est pas perdu de l’archive', async () => {
    const compte = nouveauCompte({ deck: [A] });
    brancherCompte(compte);
    useStore.getState().setDeck([A, B]);

    const { texte } = await creerSauvegarde();

    expect((JSON.parse(texte) as { deck: { cartes: string[] } }).deck.cartes).toEqual([A, B]);
    expect(useStore.getState().deckOutbox).toEqual([]);
  });

  it('hors ligne : la copie de l’appareil part, et l’archive le dit', async () => {
    brancherCompte(nouveauCompte(), { enLigne: false });
    useStore.setState({ deck: [A], owned: { [A]: 1 }, deckOutbox: [] });

    const { texte, deck, collection } = await creerSauvegarde();

    expect(deck).toBe('appareil');
    expect(collection).toBe('appareil');
    const archive = JSON.parse(texte) as { deck: { source: string; cartes: string[] } };
    expect(archive.deck).toMatchObject({ source: 'appareil', cartes: [A] });
  });
});

describe('Import : par les opérations du compte, la Collection jamais réécrite', () => {
  it('fait l’aller-retour : réglages revenus, Deck remis sur le compte, Collection du compte', async () => {
    const compte = nouveauCompte({ deck: [A, A, B] });
    brancherCompte(compte);
    useStore.getState().setName('Bastien');
    useStore.getState().setTutorielVu(true);
    useStore.getState().setSons(false);
    useStore.setState({ deck: [A, A, B], owned: { ...compte.collection }, deckOutbox: [] });
    useStore.getState().setCafeTypes(['SSE', 'RH']);
    const { texte } = await creerSauvegarde();
    const avant = partializeState(useStore.getState());

    // Un autre appareil : réglages remis à zéro, Deck du compte vidé.
    useStore.getState().reset();
    compte.deck = [];
    useStore.setState({ deckImporte: true });
    compte.appels.length = 0;

    const resultat = await restaurerSauvegarde(texte);

    expect(resultat).toEqual({ ok: true, deck: 'restaure', ecartees: 0, synchro: null });
    const apres = partializeState(useStore.getState());
    expect(apres.name).toBe('Bastien');
    expect(apres.tutorielVu).toBe(true);
    expect(apres.sons).toBe(false);
    expect(apres.deck).toEqual([A, A, B]);
    expect(apres.cafeTypes).toEqual(avant.cafeTypes);
    // **Par les opérations du compte** : le Deck est parti par la RPC, en `remplacer`.
    expect(compte.deck).toEqual([A, A, B]);
    const rpc = compte.appels.filter((appel) => appel.operations);
    expect(rpc).toHaveLength(1);
    expect(rpc[0]?.operations?.[0]).toMatchObject({ type: 'remplacer' });
    expect(useStore.getState().deckOutbox).toEqual([]);
  });

  it('ne réécrit jamais la Collection : celle de l’archive ne crédite aucune carte', async () => {
    const compte = nouveauCompte({ collection: { [A]: 5, [B]: 5 }, deck: [A] });
    brancherCompte(compte);
    useStore.setState({ owned: { ...compte.collection }, deck: [A], deckOutbox: [] });
    const { texte } = await creerSauvegarde();

    // Le compte a changé depuis : il ne possède plus qu'un A.
    compte.collection = { [A]: 1 };
    useStore.setState({ owned: { [A]: 1 } });
    const resultat = await restaurerSauvegarde(texte);

    expect(resultat.ok).toBe(true);
    expect(useStore.getState().owned).toEqual({ [A]: 1 });
    // Aucune écriture sur la Collection : seules des lectures (GET) l'ont touchée.
    expect(compte.collection).toEqual({ [A]: 1 });
  });

  it('écarte du Deck les cartes que le compte ne possède pas', async () => {
    const compte = nouveauCompte({ collection: { [A]: 1 }, deck: [] });
    brancherCompte(compte);
    const archive = JSON.stringify({
      jeu: 'bureau-des-planques',
      archive: 1,
      deck: { source: 'compte', cartes: [A, A, B, 'carte-inconnue'], cafeTypes: [] },
      collection: { source: 'compte', cartes: { [A]: 2, [B]: 1 } },
      reglages: { name: 'Importé' }
    });

    const resultat = await restaurerSauvegarde(archive);

    expect(resultat).toMatchObject({ ok: true, deck: 'restaure', ecartees: 3 });
    expect(useStore.getState().deck).toEqual([A]);
    expect(compte.deck).toEqual([A]);
    expect(useStore.getState().name).toBe('Importé');
  });

  it('un Deck complet sans Planqué Entrant n’est pas remis (la base le refuserait)', async () => {
    const autres = AUTRES.slice(0, DECK_SIZE);
    const compte = nouveauCompte({ collection: Object.fromEntries(autres.map((id) => [id, 1])), deck: [A] });
    brancherCompte(compte);
    useStore.setState({ deck: [A], deckOutbox: [] });
    const archive = JSON.stringify({
      jeu: 'bureau-des-planques',
      archive: 1,
      deck: { source: 'compte', cartes: autres, cafeTypes: [] },
      collection: { source: 'compte', cartes: {} },
      reglages: {}
    });

    const resultat = await restaurerSauvegarde(archive);

    expect(autres).toHaveLength(DECK_SIZE);
    expect(resultat).toMatchObject({ ok: true, deck: 'refuse' });
    expect(useStore.getState().deck).toEqual([A]);
    expect(compte.deck).toEqual([A]);
  });

  it('hors ligne : le Deck restauré attend dans la file, rien n’est perdu', async () => {
    const compte = nouveauCompte();
    brancherCompte(compte, { enLigne: false });
    useStore.setState({ owned: { [A]: 2 } });
    const archive = JSON.stringify({
      jeu: 'bureau-des-planques',
      archive: 1,
      deck: { source: 'compte', cartes: [A], cafeTypes: [] },
      collection: { source: 'compte', cartes: {} },
      reglages: {}
    });

    const resultat = await restaurerSauvegarde(archive);

    expect(resultat).toMatchObject({ ok: true, deck: 'restaure', synchro: 'hors-ligne' });
    expect(useStore.getState().deck).toEqual([A]);
    expect(useStore.getState().deckOutbox).toHaveLength(1);
  });

  it('relit une sauvegarde d’avant (format du store) : ids renommés, réglages et Deck remis', async () => {
    const compte = nouveauCompte({ collection: { 'rh-charge-prevention': 2 } });
    brancherCompte(compte);
    const ancienne = JSON.stringify({
      jeu: 'bureau-des-planques',
      version: 2,
      etat: { name: 'Vétéran', owned: { 'rh-responsable-qvt': 2 }, deck: ['rh-responsable-qvt'] }
    });

    const resultat = await restaurerSauvegarde(ancienne);

    expect(resultat).toMatchObject({ ok: true, deck: 'restaure' });
    expect(useStore.getState().name).toBe('Vétéran');
    expect(useStore.getState().deck).toEqual(['rh-charge-prevention']);
  });

  it('une sauvegarde sans partie ne touche pas à la partie en cours', async () => {
    brancherCompte(nouveauCompte());
    const partie = {
      mode: 'solo' as const,
      camp: 'player' as const,
      seed: 77,
      playerDeck: [A],
      aiDeck: [A],
      playerCafeTypes: [],
      aiCafeTypes: [],
      actions: []
    };
    useStore.getState().enregistrerPartie(partie);
    const ancienne = JSON.stringify({
      jeu: 'bureau-des-planques',
      version: 6,
      etat: { name: 'Importé', owned: {}, deck: [] }
    });

    expect((await restaurerSauvegarde(ancienne)).ok).toBe(true);
    expect(useStore.getState().partie).toEqual(partie);
  });
});

describe('Cas fautifs : un texte refusé laisse l’état intact', () => {
  const fautifs: Array<[string, string]> = [
    ['illisible', 'pas du json'],
    ['un autre jeu', JSON.stringify({ jeu: 'un-autre-jeu', archive: 1 })],
    ['une archive plus récente', JSON.stringify({ jeu: 'bureau-des-planques', archive: ARCHIVE_VERSION + 1 })],
    ['un numéro d’archive absurde', JSON.stringify({ jeu: 'bureau-des-planques', archive: 'un' })],
    [
      'une archive incomplète',
      JSON.stringify({ jeu: 'bureau-des-planques', archive: 1, deck: { cartes: 'non' }, reglages: {} })
    ],
    [
      'un ancien format plus récent',
      JSON.stringify({ jeu: 'bureau-des-planques', version: STORAGE_VERSION + 1, etat: {} })
    ],
    ['un ancien format sans Deck', JSON.stringify({ jeu: 'bureau-des-planques', version: 5, etat: {} })]
  ];

  for (const [nom, texte] of fautifs) {
    it(`refuse ${nom}`, async () => {
      const fetchImpl = brancherCompte(nouveauCompte());
      const avant = partializeState(useStore.getState());

      expect(lireSauvegarde(texte).ok).toBe(false);
      expect(await restaurerSauvegarde(texte)).toMatchObject({ ok: false });
      expect(partializeState(useStore.getState())).toEqual(avant);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }
});
