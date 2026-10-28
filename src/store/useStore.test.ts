import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isPlanque } from '@/data';
import {
  autoDeck,
  DECK_SIZE,
  deckCafeTypes,
  MAX_COPIES_PER_NAME,
  MAX_DECK_CAFE_TYPES,
  resolveCafeTypes
} from '@/game/deck';
import { openPackCards } from '@/game/pack';
import { seedRng } from '@/game/rng';
import { migratePersisted, CARD_ID_RENAMES, partializeState, STORAGE_VERSION, useStore } from '@/store/useStore';
import { isSecretSuffix, secretSuffix } from '@/data/planque';

beforeEach(() => {
  useStore.getState().reset();
});

describe('Arrivage', () => {
  it('distribue 5 cartes, les ajoute à la Collection et incrémente le compteur', () => {
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
    const cards = useStore
      .getState()
      .openPack()
      .map((card) => card.id);

    expect(cards).toEqual(expected);
  });
});

describe('Deck du store', () => {
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

  it('ne dépasse jamais la taille du Deck', () => {
    const { toggleDeck } = useStore.getState();
    for (const card of ALL_CARDS.slice(0, 12)) {
      toggleDeck(card.id);
      toggleDeck(card.id);
    }
    expect(useStore.getState().deck.length).toBeLessThanOrEqual(DECK_SIZE);
  });

  it('vide le Deck sans toucher à la Collection', () => {
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
    return useStore
      .getState()
      .openPack()
      .map((card) => card.id);
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

describe('Migration — les ids suivent les noms et les raretés (#49, #67, #87)', () => {
  /**
   * Les anciens ids ne sont écrits **qu'une fois dans le dépôt**, dans
   * `CARD_ID_RENAMES` (#49) : la table est lue depuis le store, jamais recopiée ici.
   * Le contrat vérifié est celui qui compte — chaque ancien id a quitté le catalogue,
   * chaque id courant existe, et la migration ne perd ni un exemplaire de `owned` ni
   * une place de `deck`.
   */
  const ANCIENS = Object.keys(CARD_ID_RENAMES);

  /**
   * L'état persisté qui porte des ids (`owned`, `deck`) contient **tous** les anciens
   * ids, plus une carte jamais renommée, et le reste des champs à conserver.
   */
  function stateV1() {
    const rng = seedRng(4242);
    return {
      rng,
      persisted: {
        name: 'Employé 404',
        owned: { ...Object.fromEntries(ANCIENS.map((ancien) => [ancien, 2])), 'sse-psychologue': 3 },
        deck: [...ANCIENS, 'sse-psychologue'],
        packsOpened: 7,
        reducedMotion: true,
        rng
      }
    };
  }

  it('déclare la version 13', () => {
    // 11 : le reset de la beta (D-130). 12 : les deux sons et leur réglage (D-137, #378).
    // 13 : la dernière partie terminée, pour la revoir (#366).
    expect(STORAGE_VERSION).toBe(13);
  });

  it('v10 -> v11 : la progression part, le testeur reste (D-130, #347)', () => {
    const v10 = {
      name: 'Vétéran',
      owned: { 'sse-infirmier-site': 2, 'management-rpo-sans-rui-ex': 1 },
      deck: ['sse-infirmier-site', 'sse-infirmier-site'],
      cafeTypes: ['SSE' as const],
      packsOpened: 40,
      reducedMotion: true,
      combatDetaille: true,
      raccourcisCombat: false,
      tutorielVu: true,
      pasAPasCombatVu: true,
      partie: null,
      rng: 12345
    };
    const migre = migratePersisted(v10, 10);
    // Ce qui part : ce qui se rejoue.
    expect(migre.owned).not.toHaveProperty('management-rpo-sans-rui-ex');
    expect(migre.deck).toEqual([]);
    expect(migre.packsOpened).toBe(0);
    expect(migre.cafeTypes).toEqual([]);
    expect(migre.partie).toBeNull();
    // Ce qui reste : ce qui décrit le testeur, et ce qu'il a appris.
    expect(migre.name).toBe('Vétéran');
    expect(migre.reducedMotion).toBe(true);
    expect(migre.combatDetaille).toBe(true);
    expect(migre.raccourcisCombat).toBe(false);
    expect(migre.tutorielVu).toBe(true);
    expect(migre.pasAPasCombatVu).toBe(true);
    // Et la Collection repart sur les cartes de départ, celles que le jeu donne.
    expect(Object.keys(migre.owned ?? {}).length).toBeGreaterThan(0);
  });

  it('le contrôle mord : sans le palier, le COMEX du vétéran survivrait', () => {
    // La garde du test précédent est l'**absence** d'une carte hors des raretés de départ
    // (`1D`/`2D`) : un COMEX. Retirer le palier de `migratePersisted` fait réapparaître
    // cette clé, et le test tombe. C'est ce qui distingue une garde d'une description.
    const migre = migratePersisted({ owned: { 'management-rpo-sans-rui-ex': 1 } }, 10);
    expect(Object.keys(migre.owned ?? {})).not.toContain('management-rpo-sans-rui-ex');
  });

  it('déclare les cinq renommages de Management de D-029 (#67), et eux seuls', () => {
    expect(Object.values(CARD_ID_RENAMES).filter((id) => id.startsWith('management-'))).toEqual([
      'management-responsable-unite',
      'management-responsable-unite-ex',
      'management-animateur-equipe',
      'management-chef-service',
      'management-technico-commercial'
    ]);
    for (const ancien of ANCIENS) {
      // Aucun id courant ne sert d'ancien id : la migration s'applique en une passe,
      // sans chaîne à dérouler.
      expect(Object.values(CARD_ID_RENAMES), `${ancien} : chaîne de renommages`).not.toContain(ancien);
    }
  });

  it('remappe les anciens ids de `owned` et de `deck`, sans rien perdre', () => {
    const { persisted, rng } = stateV1();
    const migrated = migratePersisted(persisted, 1);

    // Deux anciens ids peuvent tomber sur le même id courant (l'Atelier, D-095 : une variante
    // en `-star3` et son ancien `-star2`) : les exemplaires s'additionnent, rien ne se perd.
    const attendus: Record<string, number> = { 'sse-psychologue': 3 };
    for (const ancien of ANCIENS) {
      const courant = CARD_ID_RENAMES[ancien];
      attendus[courant] = (attendus[courant] ?? 0) + 2;
    }
    expect(migrated.owned).toEqual(attendus);
    expect(migrated.deck).toEqual([...ANCIENS.map((ancien) => CARD_ID_RENAMES[ancien]), 'sse-psychologue']);
    // Le reste de l'état traverse la migration intact.
    expect(migrated.name).toBe('Employé 404');
    expect(migrated.packsOpened).toBe(7);
    expect(migrated.reducedMotion).toBe(true);
    expect(migrated.rng).toBe(rng);
  });

  it('ne laisse aucun ancien id, et chaque id remappé existe au catalogue', () => {
    const migrated = migratePersisted(stateV1().persisted, 1);

    for (const ancien of ANCIENS) {
      const courant = CARD_ID_RENAMES[ancien];
      expect(ancien, `${ancien} : un renommage qui ne renomme rien`).not.toBe(courant);
      expect(getCard(ancien), `${ancien} ne doit plus exister`).toBeUndefined();
      expect(getCard(courant), `${courant} absent du catalogue`).toBeDefined();
    }
    for (const id of [...Object.keys(migrated.owned ?? {}), ...(migrated.deck ?? [])]) {
      expect(getCard(id), `${id} n’est pas une carte du catalogue`).toBeDefined();
    }
  });

  it('déclare les sept variantes re-raréfiées de #87, et elles seules', () => {
    // Seules les variantes **re-raréfiées** (2S → 3S ou Couronne) ; un renommage de base
    // (D-095) entraîne aussi des variantes en `-star2` qui gardent leur rareté.
    const variantes = Object.entries(CARD_ID_RENAMES).filter(
      ([ancien, courant]) => ancien.endsWith('-star2') && /-(star3|crown)$/.test(courant)
    );
    expect(variantes).toHaveLength(7);
    for (const [ancien, courant] of variantes) {
      expect(getCard(ancien), `${ancien} ne doit plus exister`).toBeUndefined();
      const card = getCard(courant);
      expect(isPlanque(card), `${courant} doit rester un Planqué`).toBe(true);
      expect(['3S', 'COU'], `${courant} : rareté haute attendue`).toContain(card?.rarity);
      const baseAncienne = ancien.replace(/-star2$/, '');
      expect(card?.variantOf, `${courant} : base de variante`).toBe(CARD_ID_RENAMES[baseAncienne] ?? baseAncienne);
    }
  });

  it('remappe les variantes re-raréfiées d’un état déjà en v2 (#87)', () => {
    const rng = seedRng(4321);
    const ancien = 'rh-drh-star2';
    const migrated = migratePersisted({ owned: { [ancien]: 2 }, deck: [ancien], packsOpened: 1, rng }, 2);

    expect(migrated.owned).toEqual({ 'rh-drh-crown': 2 });
    expect(migrated.deck).toEqual(['rh-drh-crown']);
    expect(getCard('rh-drh-crown')?.rarity).toBe('COU');
    expect(migrated.rng).toBe(rng);
  });

  it('donne aux cinq cartes de Management leur nom de D-029 (#67)', () => {
    const attendus: Readonly<Record<string, string>> = {
      'management-responsable-unite': 'Responsable d’unité',
      'management-responsable-unite-ex': 'Responsable d’unité COMEX',
      'management-animateur-equipe': 'Animateur d’équipe',
      'management-chef-service': 'Chef de service',
      'management-technico-commercial': 'Technico-commercial'
    };
    for (const [id, nom] of Object.entries(attendus)) {
      const card = getCard(id);
      expect(card?.faction, id).toBe('MANAGEMENT');
      expect(card?.name, id).toBe(nom);
    }

    // La carte COMEX garde son statut et sa rareté (D-026) : seul le nom change.
    const comex = getCard('management-responsable-unite-ex');
    expect(isPlanque(comex) ? comex.ex : undefined, 'management-responsable-unite-ex').toBe(true);
    expect(comex?.rarity, 'management-responsable-unite-ex').toBe('4D');

    // Aucun ancien nom ne survit dans le catalogue.
    const noms = new Set(ALL_CARDS.map((card) => card.name));
    for (const ancien of [
      'Chef des ventes',
      'Chef des ventes COMEX',
      'Responsable d’équipe',
      'Manager adjoint',
      'Commercial'
    ]) {
      expect(noms.has(ancien), `« ${ancien} » ne doit plus exister`).toBe(false);
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

      // Le suffixe `-ex` vient du **statut** COMEX (`ex: true`, D-026), pas du nom : le
      // statut est affiché sur la carte, le nom est libre (D-095). On le retire avant de
      // confronter les mots de l'id à ceux du nom.
      const segments = courant.slice(prefixe.length).split('-');
      if (segments.at(-1) === 'ex') {
        expect(isPlanque(card) && card.ex, `${courant} : suffixe -ex sans statut COMEX`).toBe(true);
        segments.pop();
      }

      // Le suffixe d'une variante secrète (`-star`, `-star2`, `-star3`, `-crown`)
      // vient de sa **rareté** (#87), pas de son nom : on le retire comme `-ex`,
      // après avoir vérifié qu'il dit bien la rareté de la carte.
      const dernier = segments.at(-1);
      if (dernier && isSecretSuffix(dernier)) {
        expect(card.variantOf, `${courant} : suffixe ${dernier} sans variante`).toBeDefined();
        expect(secretSuffix(card.rarity), `${courant} : suffixe et rareté`).toBe(dernier);
        segments.pop();
      }

      const attendus = mots(card.name);
      const restants = [...attendus];
      for (const mot of segments) {
        const rang = restants.indexOf(mot);
        expect(rang, `${ancien} → ${courant} : « ${mot} » ne vient pas de « ${card.name} »`).toBeGreaterThanOrEqual(0);
        restants.splice(0, rang + 1);
      }
    }
  });

  it('laisse un état déjà en v3 tel quel', () => {
    const rng = seedRng(777);
    const persisted = { owned: { 'rh-drh-crown': 2 }, deck: ['rh-drh-crown'], rng };
    const migrated = migratePersisted(persisted, 3);
    expect(migrated.owned).toEqual(persisted.owned);
    expect(migrated.deck).toEqual(persisted.deck);
  });

  it('additionne ancien et nouveau id si les deux cohabitent — voulu, mais le total peut dépasser 2', () => {
    // #106 — cohabitation : la migration `withRenamedCardIds` additionne
    // (`owned[current] += count`) au lieu de remplacer. C'est voulu : aucun
    // exemplaire ne disparaît. Mais rien ne borne `owned`, donc le total peut
    // dépasser le plafond de 2 copies par nom imposé au Deck (`deck`).
    const ancien = 'rh-drh-star2';
    const nouveau = 'rh-drh-crown';
    const persisted = {
      owned: { [ancien]: 1, [nouveau]: 2 },
      deck: [ancien, nouveau],
      packsOpened: 0,
      rng: seedRng(106)
    };
    const migrated = migratePersisted(persisted, 2);
    // Addition voulue : 1 (ancien) + 2 (nouveau) = 3
    expect(migrated.owned).toEqual({ [nouveau]: 3 });
    expect(migrated.owned?.[nouveau]).toBe(3);
    // Le deck conserve l'ordre et remplace l'ancien par le nouveau.
    expect(migrated.deck).toEqual([nouveau, nouveau]);
    // Choix explicite : le total additionné est voulu (rien ne se perd),
    // mais il dépasse le plafond `MAX_COPIES_PER_NAME` du Deck (2).
    // Aucune borne n'existe sur `owned` : c'est un choix, pas un bug caché.
  });
});

/**
 * **Les types de café du Deck sont choisis et persistés avec lui** (#91,
 * D-037 (4)). `[]` vaut « proposition automatique » : un état v3 sans ce champ
 * continue donc de fonctionner, et la dérivation reste le défaut.
 */
describe('Types de café du Deck — store (#91)', () => {
  it('part de la proposition automatique (choix vide)', () => {
    expect(useStore.getState().cafeTypes).toEqual([]);
  });

  it('migre un état v3 sans ce champ vers « automatique », sans perdre le reste', () => {
    const rng = seedRng(91);
    const migrated = migratePersisted({ name: 'Employé 404', deck: ['sse-psychologue'], packsOpened: 3, rng }, 3);

    expect(migrated.cafeTypes).toEqual([]);
    expect(migrated.deck).toEqual(['sse-psychologue']);
    expect(migrated.packsOpened).toBe(3);
    expect(migrated.rng).toBe(rng);
  });

  it('nettoie un choix trafiqué : ni Support ni Intérim, 3 au plus', () => {
    // Une valeur forgée traverse le typage : c'est le cas d'un état persisté bricolé.
    const forged = ['SUPPORT', 'INTERIM', 'SSE', 'RH', 'QVT', 'ATELIER'];
    const migrated = migratePersisted({ deck: [], cafeTypes: forged }, 3);

    expect(migrated.cafeTypes).toEqual(['SSE', 'RH', 'QVT']);
  });

  it('garde un choix déjà valide d’un état v4', () => {
    const migrated = migratePersisted({ cafeTypes: ['ATELIER', 'DIRECTION'] }, 4);
    expect(migrated.cafeTypes).toEqual(['ATELIER', 'DIRECTION']);
  });

  it('setCafeTypes normalise à l’écriture', () => {
    const { setCafeTypes } = useStore.getState();
    setCafeTypes(['SSE', 'SSE', 'RH', 'QVT', 'ATELIER', 'SUPPORT']);
    expect(useStore.getState().cafeTypes).toEqual(['SSE', 'RH', 'QVT']);

    setCafeTypes(['SUPPORT', 'INTERIM']);
    expect(useStore.getState().cafeTypes).toEqual([]);
  });

  it('toggleCafeType ajoute, retire, plafonne à 3 et ignore les types non produits', () => {
    const { toggleCafeType } = useStore.getState();

    toggleCafeType('SUPPORT');
    toggleCafeType('INTERIM');
    expect(useStore.getState().cafeTypes).toEqual([]);

    toggleCafeType('SSE');
    toggleCafeType('RH');
    toggleCafeType('QVT');
    toggleCafeType('ATELIER');
    expect(useStore.getState().cafeTypes).toEqual(['SSE', 'RH', 'QVT']);
    expect(useStore.getState().cafeTypes).toHaveLength(MAX_DECK_CAFE_TYPES);

    toggleCafeType('RH');
    expect(useStore.getState().cafeTypes).toEqual(['SSE', 'QVT']);
  });

  it('vide le choix avec le Deck', () => {
    useStore.getState().toggleCafeType('SSE');
    expect(useStore.getState().cafeTypes).toEqual(['SSE']);

    useStore.getState().clearDeck();
    expect(useStore.getState().cafeTypes).toEqual([]);
  });

  /**
   * #117 — **le choix est un attribut du Deck, pas du joueur**. Tout remplacement
   * en bloc du contenu l'efface (`[]` = proposition automatique du **nouveau**
   * contenu) ; une édition carte par carte le garde. Avant ce correctif, `setDeck`
   * laissait sur un Deck neuf les types de l'ancien, alors que `clearDeck` les
   * effaçait : le même geste avait deux comportements.
   */
  it('efface le choix quand le Deck est remplacé en bloc (setDeck, donc « Remplir »)', () => {
    expect(getCard('atelier-responsable-process'), 'carte de test absente').toBeTruthy();
    useStore.getState().setCafeTypes(['SSE', 'RH']);
    useStore.getState().setDeck(['atelier-responsable-process']);

    expect(useStore.getState().deck).toEqual(['atelier-responsable-process']);
    expect(useStore.getState().cafeTypes).toEqual([]);
  });

  it('« Remplir » repart de la proposition automatique du Deck rempli', () => {
    const automatic = autoDeck(useStore.getState().owned);
    expect(automatic.deck.length, 'la Collection de départ doit permettre de remplir').toBeGreaterThan(0);

    // Exactement ce que fait le bouton « Remplir » de `Deck.tsx` : `setDeck(autoDeck(...).deck)`.
    useStore.getState().setCafeTypes(['SSE']);
    useStore.getState().setDeck(automatic.deck);

    const { deck, cafeTypes } = useStore.getState();
    expect(cafeTypes).toEqual([]);
    expect(resolveCafeTypes(deck, cafeTypes)).toEqual(deckCafeTypes(automatic.deck));
  });

  it('garde le choix quand on ajuste le Deck carte par carte, et le perd s’il devient vide', () => {
    expect(getCard('sse-psychologue'), 'carte de test absente').toBeTruthy();
    useStore.getState().setDeck(['sse-psychologue', 'atelier-responsable-process']);
    useStore.getState().setCafeTypes(['SSE', 'RH']);

    // Une carte retirée, il en reste : c'est le même Deck, le choix tient.
    useStore.getState().removeFromDeck('sse-psychologue');
    expect(useStore.getState().deck).toEqual(['atelier-responsable-process']);
    expect(useStore.getState().cafeTypes).toEqual(['SSE', 'RH']);

    // Dernière carte retirée : Deck vide, donc plus de types — comme `clearDeck`.
    useStore.getState().removeFromDeck('atelier-responsable-process');
    expect(useStore.getState().deck).toEqual([]);
    expect(useStore.getState().cafeTypes).toEqual([]);
  });

  it('persiste le choix avec le Deck', () => {
    useStore.getState().setCafeTypes(['SSE', 'RH']);
    const persisted = partializeState(useStore.getState());

    expect(persisted.deck).toEqual(useStore.getState().deck);
    expect(persisted.cafeTypes).toEqual(['SSE', 'RH']);
  });
});

describe('Journée d’intégration (#v5)', () => {
  it('se montre sur une partie neuve, et disparaît une fois vue', () => {
    expect(useStore.getState().tutorielVu).toBe(false);
    useStore.getState().setTutorielVu(true);
    expect(useStore.getState().tutorielVu).toBe(true);
  });

  it('se remontre après une réinitialisation de la progression', () => {
    useStore.getState().setTutorielVu(true);
    useStore.getState().reset();
    expect(useStore.getState().tutorielVu).toBe(false);
  });

  it('migre un état v4 en le considérant déjà vu — il a déjà joué', () => {
    const migre = migratePersisted({ name: 'Ancien', owned: {}, deck: [] }, 4);
    expect(migre.tutorielVu).toBe(true);
  });

  it('respecte un `tutorielVu` déjà écrit, même à `false`', () => {
    expect(migratePersisted({ tutorielVu: false }, 5).tutorielVu).toBe(false);
    expect(migratePersisted({ tutorielVu: true }, 5).tutorielVu).toBe(true);
  });

  it('persiste le drapeau', () => {
    useStore.getState().setTutorielVu(true);
    expect(partializeState(useStore.getState()).tutorielVu).toBe(true);
  });
});

describe('Pas-à-pas du premier combat (#143, forme v6)', () => {
  it('se montre sur une partie neuve, et disparaît une fois vu', () => {
    expect(useStore.getState().pasAPasCombatVu).toBe(false);
    useStore.getState().setPasAPasCombatVu(true);
    expect(useStore.getState().pasAPasCombatVu).toBe(true);
  });

  it('se remontre après une réinitialisation de la progression', () => {
    useStore.getState().setPasAPasCombatVu(true);
    useStore.getState().reset();
    expect(useStore.getState().pasAPasCombatVu).toBe(false);
  });

  it('migre un état v5 en le considérant déjà vu — il a déjà combattu', () => {
    const migre = migratePersisted({ name: 'Ancien', owned: {}, deck: [] }, 5);
    expect(migre.pasAPasCombatVu).toBe(true);
  });

  it('respecte un `pasAPasCombatVu` déjà écrit, même à `false`', () => {
    expect(migratePersisted({ pasAPasCombatVu: false }, 6).pasAPasCombatVu).toBe(false);
    expect(migratePersisted({ pasAPasCombatVu: true }, 6).pasAPasCombatVu).toBe(true);
  });

  it('persiste le drapeau', () => {
    useStore.getState().setPasAPasCombatVu(true);
    expect(partializeState(useStore.getState()).pasAPasCombatVu).toBe(true);
  });
});

describe('Sauvegarde — export et import', () => {
  it('fait l’aller-retour sans rien perdre', () => {
    useStore.getState().setName('Bastien');
    useStore.getState().setCafeTypes(['SSE', 'RH']);
    useStore.getState().setTutorielVu(true);
    const avant = partializeState(useStore.getState());

    const texte = useStore.getState().exporterSauvegarde();
    useStore.getState().reset();
    expect(useStore.getState().name).not.toBe('Bastien');

    const resultat = useStore.getState().importerSauvegarde(texte);

    expect(resultat).toEqual({ ok: true });
    expect(partializeState(useStore.getState())).toEqual(avant);
  });

  it('nomme le jeu et la version dans le texte exporté', () => {
    const fichier = JSON.parse(useStore.getState().exporterSauvegarde()) as {
      jeu: string;
      version: number;
    };
    expect(fichier.jeu).toBe('bureau-des-planques');
    expect(fichier.version).toBe(STORAGE_VERSION);
  });

  it('refuse un texte illisible, un autre jeu, une sauvegarde incomplète', () => {
    const avant = partializeState(useStore.getState());

    expect(useStore.getState().importerSauvegarde('pas du json')).toMatchObject({ ok: false });
    expect(useStore.getState().importerSauvegarde(JSON.stringify({ jeu: 'un-autre-jeu', version: 5 }))).toMatchObject({
      ok: false
    });
    expect(
      useStore.getState().importerSauvegarde(JSON.stringify({ jeu: 'bureau-des-planques', version: 5, etat: {} }))
    ).toMatchObject({ ok: false });

    // Rien n'a bougé : c'est la garantie qui compte, pas le message.
    expect(partializeState(useStore.getState())).toEqual(avant);
  });

  it('refuse une sauvegarde plus récente que ce build', () => {
    const futur = JSON.stringify({
      jeu: 'bureau-des-planques',
      version: STORAGE_VERSION + 1,
      etat: { name: 'Futur', owned: {}, deck: [] }
    });

    const resultat = useStore.getState().importerSauvegarde(futur);

    expect(resultat.ok).toBe(false);
    expect(useStore.getState().name).not.toBe('Futur');
  });

  it('accepte une sauvegarde plus ancienne, et la migre', () => {
    const ancienne = JSON.stringify({
      jeu: 'bureau-des-planques',
      version: 2,
      etat: { name: 'Vétéran', owned: { 'rh-responsable-qvt': 2 }, deck: [] }
    });

    expect(useStore.getState().importerSauvegarde(ancienne)).toEqual({ ok: true });
    // L'id renommé par #49 est remappé par la migration, pas chargé tel quel.
    expect(useStore.getState().owned['rh-charge-prevention']).toBe(2);
    expect(useStore.getState().owned['rh-responsable-qvt']).toBeUndefined();
  });
});

/** Une partie rangée minimale mais de forme valide (la forme, pas le jeu : cf. `partie.test.ts`). */
const partieRangee = {
  mode: 'solo' as const,
  camp: 'player' as const,
  seed: 77,
  playerDeck: ['rh-charge-prevention'],
  aiDeck: ['rh-charge-prevention'],
  playerCafeTypes: [],
  aiCafeTypes: [],
  actions: []
};

describe('Partie en cours — store (#126, forme v7)', () => {
  it('ne range aucune partie par défaut', () => {
    expect(useStore.getState().partie).toBeNull();
  });

  it('range la partie et la persiste avec le reste', () => {
    useStore.getState().enregistrerPartie(partieRangee);
    expect(partializeState(useStore.getState()).partie).toEqual(partieRangee);
  });

  it('migre un état v6 sans partie : rien à reprendre, sans perdre le reste', () => {
    const migre = migratePersisted({ name: 'Vétéran', tutorielVu: true, owned: {}, deck: [] }, 6);
    expect(migre.partie).toBeNull();
    expect(migre.name).toBe('Vétéran');
    expect(migre.tutorielVu).toBe(true);
  });

  it('garde une partie bien formée d’un état v7, et écarte une partie mal formée', () => {
    expect(migratePersisted({ partie: partieRangee }, 7).partie).toEqual(partieRangee);
    expect(migratePersisted({ partie: { mode: 'n’importe quoi' } }, 7).partie).toBeNull();
  });

  it('une sauvegarde importée sans partie ne touche pas à la partie en cours', () => {
    useStore.getState().enregistrerPartie(partieRangee);
    const ancienne = JSON.stringify({
      jeu: 'bureau-des-planques',
      version: 6,
      etat: { name: 'Importé', owned: {}, deck: [] }
    });

    expect(useStore.getState().importerSauvegarde(ancienne)).toEqual({ ok: true });
    expect(useStore.getState().name).toBe('Importé');
    expect(useStore.getState().partie).toEqual(partieRangee);
  });

  it('« Réinitialiser la progression » efface la partie en cours', () => {
    useStore.getState().enregistrerPartie(partieRangee);
    useStore.getState().reset();
    expect(useStore.getState().partie).toBeNull();
  });
});

/**
 * **La bascule d'infos du combat** (#189, `SPEC-COMBAT-UI` §4.3 et §5.6) est un réglage
 * d'affichage : `sobre` par défaut, mémorisé, et les raccourcis actifs par défaut. C'est la
 * forme **v8** du store.
 */
describe('Combat — densité et raccourcis (#189, forme v8)', () => {
  it('part en `sobre` et avec les raccourcis actifs', () => {
    expect(useStore.getState().combatDetaille).toBe(false);
    expect(useStore.getState().raccourcisCombat).toBe(true);
  });

  it('bascule la densité, la mémorise, et la remet à `sobre` au reset', () => {
    useStore.getState().basculerCombatDetaille();
    expect(useStore.getState().combatDetaille).toBe(true);
    expect(partializeState(useStore.getState()).combatDetaille).toBe(true);

    useStore.getState().setRaccourcisCombat(false);
    expect(partializeState(useStore.getState()).raccourcisCombat).toBe(false);

    useStore.getState().reset();
    expect(useStore.getState().combatDetaille).toBe(false);
    expect(useStore.getState().raccourcisCombat).toBe(true);
  });

  it('migre un état v7 sans ces champs vers `sobre` et « raccourcis actifs », sans perdre le reste', () => {
    const migre = migratePersisted({ name: 'Vétéran', tutorielVu: false }, 7);
    expect(migre.combatDetaille).toBe(false);
    expect(migre.raccourcisCombat).toBe(true);
    expect(migre.name).toBe('Vétéran');
    expect(migre.tutorielVu).toBe(false);
  });

  it('un état v9 sans ces champs prend les défauts sans perdre le reste', () => {
    // Le repli est **par type**, pas par numéro : un état d'avant #189 reprend les deux
    // défauts sans rien perdre. Le palier v10 -> v11 de #347 ne le touche pas (voir plus bas) :
    // un état antérieur n'arrive plus que par un **import de sauvegarde**.
    const migre = migratePersisted({ name: 'Vétéran', owned: { 'sse-infirmier-site': 1 }, deck: [] }, 9);
    expect(migre.combatDetaille).toBe(false);
    expect(migre.raccourcisCombat).toBe(true);
    expect(migre.name).toBe('Vétéran');
    expect(migre.owned).toEqual({ 'sse-infirmier-site': 1 });
    expect(migre.deck).toEqual([]);
  });

  it('respecte des valeurs déjà écrites, et écarte une valeur forgée', () => {
    expect(migratePersisted({ combatDetaille: true, raccourcisCombat: false }, 8)).toMatchObject({
      combatDetaille: true,
      raccourcisCombat: false
    });
    expect(migratePersisted({ combatDetaille: 'oui' as unknown as boolean }, 8).combatDetaille).toBe(false);
  });

  it('relit une sauvegarde v7 : les deux réglages prennent leurs défauts', () => {
    const ancienne = JSON.stringify({
      jeu: 'bureau-des-planques',
      version: 7,
      etat: { name: 'Vétéran', owned: {}, deck: [] }
    });

    expect(useStore.getState().importerSauvegarde(ancienne)).toEqual({ ok: true });
    expect(useStore.getState().combatDetaille).toBe(false);
    expect(useStore.getState().raccourcisCombat).toBe(true);
  });

  it('un état v11 gagne les sons cochés sans rien perdre (v11 → v12)', () => {
    // Le cas fautif : une migration qui repart de zéro effacerait la Collection d'un testeur qui
    // n'a rien demandé. D-137 demande **un champ de plus**, pas une remise à zéro (D-130 ne vise
    // que la v10, celle de la beta).
    const v11 = {
      name: 'Testeur',
      owned: { 'sse-psychologue': 2 },
      deck: ['sse-psychologue'],
      packsOpened: 7,
      reducedMotion: true,
      combatDetaille: true,
      raccourcisCombat: false,
      tutorielVu: true,
      pasAPasCombatVu: true,
      partie: null,
      rng: 4242
    };
    const migre = migratePersisted(v11, 11);
    expect(migre.sons).toBe(true);
    expect(migre.owned).toEqual({ 'sse-psychologue': 2 });
    expect(migre.packsOpened).toBe(7);
    expect(migre.reducedMotion).toBe(true);
    expect(migre.rng).toBe(4242);
    // Et un réglage explicite est respecté : couper le son ne se réactive pas au rechargement.
    expect(migratePersisted({ ...v11, sons: false }, 11).sons).toBe(false);
  });

  it('un état v12 n’a pas de dernière partie : null, et rien d’autre ne bouge (v12 → v13, #366)', () => {
    // Le cas fautif : une migration qui efface la Collection ou la partie en cours pour ajouter
    // une dernière partie. Un état v12 n'a que le champ absent : il prend `null`.
    const v12 = {
      name: 'Testeur',
      owned: { 'sse-psychologue': 2 },
      deck: ['sse-psychologue'],
      packsOpened: 7,
      sons: false,
      partie: null,
      rng: 4242
    };
    const migre = migratePersisted(v12, 12);
    expect(migre.derniere).toBeNull();
    expect(migre.owned).toEqual({ 'sse-psychologue': 2 });
    expect(migre.sons).toBe(false);
    expect(migre.rng).toBe(4242);
  });

  it('une dernière partie abîmée est écartée à la migration, sans toucher au reste', () => {
    const migre = migratePersisted({ name: 'Testeur', derniere: { mode: 'solo', verdict: 'oups' } }, 12);
    expect(migre.derniere).toBeNull();
    expect(migre.name).toBe('Testeur');
  });
});
