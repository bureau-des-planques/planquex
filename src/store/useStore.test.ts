import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard } from '@/data';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';
import { openPackCards } from '@/game/pack';
import { seedRng } from '@/game/rng';
import { migratePersisted, CARD_ID_RENAMES, STORAGE_VERSION, useStore } from '@/store/useStore';

beforeEach(() => {
  useStore.getState().reset();
});

describe('Arrivage', () => {
  it('distribue 5 cartes, les ajoute au Parc et incrémente le compteur', () => {
    const before = useStore.getState().packsOpened;
    const cards = useStore.getState().openPack();

    expect(cards).toHaveLength(5);
    expect(useStore.getState().packsOpened).toBe(before + 1);
    for (const card of cards) {
      expect(useStore.getState().owned[card.id]).toBeGreaterThan(0);
    }
  });

  it('ne décide plus de la composition : il applique `@/game/pack` (#57)', () => {
    const expected = openPackCards({ rng: seedRng(7) }).map((card) => card.id);

    useStore.setState({ rng: seedRng(7), owned: {}, packsOpened: 0 });
    const cards = useStore.getState().openPack().map((card) => card.id);

    expect(cards).toEqual(expected);
  });
});

describe('Chariot du store', () => {
  it('ajoute une carte par clic, puis retire un seul exemplaire au-delà du plafond', () => {
    const id = ALL_CARDS[0].id;
    const { toggleDeck } = useStore.getState();

    toggleDeck(id);
    toggleDeck(id);
    expect(useStore.getState().deck.filter((entry) => entry === id)).toHaveLength(MAX_COPIES_PER_NAME);

    toggleDeck(id);
    expect(useStore.getState().deck.filter((entry) => entry === id)).toHaveLength(MAX_COPIES_PER_NAME - 1);
  });

  it('plafonne par nom : 2 exemplaires + 2 variantes du même Planqué sont refusés', () => {
    const base = 'sse-psychologue';
    const variant = 'sse-psychologue-star2';
    const baseName = getCard(base)?.name;
    expect(baseName, 'carte de test absente').toBeTruthy();
    expect(getCard(variant)?.name).toBe(baseName);

    const { addToDeck } = useStore.getState();
    addToDeck(base);
    addToDeck(base);
    addToDeck(variant);

    expect(useStore.getState().deck.filter((entry) => entry === variant)).toHaveLength(0);
    expect(useStore.getState().deck).toHaveLength(MAX_COPIES_PER_NAME);
  });

  it('ne dépasse jamais la taille du Chariot', () => {
    const { toggleDeck } = useStore.getState();
    for (const card of ALL_CARDS.slice(0, 12)) {
      toggleDeck(card.id);
      toggleDeck(card.id);
    }
    expect(useStore.getState().deck.length).toBeLessThanOrEqual(DECK_SIZE);
  });

  it('vide le Chariot sans toucher au Parc', () => {
    const id = ALL_CARDS[0].id;
    const ownedBefore = useStore.getState().owned[id];
    useStore.getState().toggleDeck(id);
    useStore.getState().clearDeck();

    expect(useStore.getState().deck).toEqual([]);
    expect(useStore.getState().owned[id]).toBe(ownedBefore);
  });
});

describe('Générateur du store (#29)', () => {
  /** Ouvre un Arrivage depuis une graine connue, en repartant de la même base. */
  function packFrom(seed: number): string[] {
    useStore.setState({ rng: seedRng(seed), owned: {}, packsOpened: 0 });
    return useStore.getState().openPack().map((card) => card.id);
  }

  it('même graine → même Arrivage ; graines différentes → Arrivages différents', () => {
    expect(packFrom(7)).toEqual(packFrom(7));
    expect(packFrom(7)).not.toEqual(packFrom(99));
  });

  it('avance son générateur à chaque Arrivage', () => {
    useStore.setState({ rng: seedRng(7) });
    const before = useStore.getState().rng;
    useStore.getState().openPack();
    expect(useStore.getState().rng).not.toBe(before);
  });

  it('migre un état v0 sans générateur, sans perdre le reste', () => {
    expect(STORAGE_VERSION).toBeGreaterThan(0);
    const migrated = migratePersisted({
      name: 'Employé 404',
      owned: { [ALL_CARDS[0].id]: 3 },
      deck: [ALL_CARDS[0].id],
      packsOpened: 2,
      reducedMotion: true
    });

    expect(typeof migrated.rng).toBe('number');
    expect(migrated.packsOpened).toBe(2);
    expect(migrated.reducedMotion).toBe(true);
    expect(migrated.owned?.[ALL_CARDS[0].id]).toBe(3);
  });

  it('garde le générateur d’un état déjà migré', () => {
    const rng = seedRng(1234);
    expect(migratePersisted({ packsOpened: 0, rng }).rng).toBe(rng);
  });
});

describe('Migration v2 — les ids suivent les noms (#49)', () => {
  /** Les deux champs qui portent des ids, plus le reste à conserver. */
  function stateV1() {
    const rng = seedRng(4242);
    const [premier, second] = Object.keys(CARD_ID_RENAMES);
    return {
      rng,
      persisted: {
        name: 'Employé 404',
        owned: { [premier]: 2, [second]: 1, 'sse-psychologue': 3 },
        deck: [second, 'sse-psychologue', premier],
        packsOpened: 7,
        reducedMotion: true,
        rng
      }
    };
  }

  it('déclare la version 2', () => {
    expect(STORAGE_VERSION).toBe(2);
  });

  it('remappe les anciens ids de `owned` et de `deck`, sans rien perdre', () => {
    const { persisted, rng } = stateV1();
    const migrated = migratePersisted(persisted, 1);

    expect(migrated.owned).toEqual({
      'rh-charge-prevention': 2,
      'direction-directeur-programme': 1,
      'sse-psychologue': 3
    });
    expect(migrated.deck).toEqual([
      'direction-directeur-programme',
      'sse-psychologue',
      'rh-charge-prevention'
    ]);
    // Le reste de l'état traverse la migration intact.
    expect(migrated.name).toBe('Employé 404');
    expect(migrated.packsOpened).toBe(7);
    expect(migrated.reducedMotion).toBe(true);
    expect(migrated.rng).toBe(rng);
  });

  it('ne laisse aucun ancien id, et chaque id remappé existe au catalogue', () => {
    const [premier, second] = Object.keys(CARD_ID_RENAMES);
    const migrated = migratePersisted(stateV1().persisted, 1);

    expect(premier).not.toBe(CARD_ID_RENAMES[premier]);
    expect(getCard(premier), `${premier} ne doit plus exister`).toBeUndefined();
    expect(getCard(second), `${second} ne doit plus exister`).toBeUndefined();
    for (const id of [...Object.keys(migrated.owned ?? {}), ...(migrated.deck ?? [])]) {
      expect(getCard(id), `${id} n’est pas une carte du catalogue`).toBeDefined();
    }
  });

  it('le nouvel id suit le nom de la carte (AGENTS.md §5)', () => {
    // Convention du dépôt : le suffixe de l'id est le nom en mots, dans l'ordre,
    // sans accents ni mots-outils — `sse-infirmier-site` pour « Infirmier de site »,
    // `rh-charge-prevention` pour « Chargé de prévention ».
    const mots = (texte: string) =>
      texte
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

    for (const [ancien, courant] of Object.entries(CARD_ID_RENAMES)) {
      const card = getCard(courant);
      expect(card, `${courant} absent du catalogue`).toBeDefined();
      if (!card) continue;

      const prefixe = `${card.faction.toLowerCase()}-`;
      expect(courant.startsWith(prefixe), `${courant} : préfixe de faction`).toBe(true);

      const attendus = mots(card.name);
      const restants = [...attendus];
      for (const mot of courant.slice(prefixe.length).split('-')) {
        const rang = restants.indexOf(mot);
        expect(rang, `${ancien} → ${courant} : « ${mot} » ne vient pas de « ${card.name} »`).toBeGreaterThanOrEqual(0);
        restants.splice(0, rang + 1);
      }
    }
  });

  it('laisse un état déjà en v2 tel quel', () => {
    const { persisted } = stateV1();
    const migrated = migratePersisted(persisted, 2);
    expect(migrated.owned).toEqual(persisted.owned);
    expect(migrated.deck).toEqual(persisted.deck);
  });
});
