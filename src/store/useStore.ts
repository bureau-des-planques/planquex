import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_CARDS } from '@/data';
import { deckCanAdd, normalizeCafeTypes } from '@/game/deck';
import { openPackCards } from '@/game/pack';
import { seedRng } from '@/game/rng';
import type { RngHolder } from '@/game/rng';
import type { Card, CafeType, Rarity } from '@/data/types';

/** Clé de persistance. Source unique : `Settings.tsx` l'affiche, `persist` l'écrit. */
export const STORAGE_KEY = 'bureau-des-planques-v1';

/**
 * Version de la forme persistée. **6** : le store gagne `pasAPasCombatVu` (le
 * pas-à-pas de la **première partie** se montre une fois, #143) — absent d'un état v5,
 * il vaut **`true`**, pour la même raison que `tutorielVu` : qui a déjà une partie en
 * cours a déjà joué, on ne lui remontre pas les règles du combat ; seule une partie
 * neuve le voit. **5** : le store gagne `tutorielVu` (la « Journée d'intégration » se
 * montre une fois) — absent d'un état v4, il vaut `true` : quelqu'un qui a déjà une
 * partie en cours a déjà joué, on ne lui remontre pas le tutoriel ; seule une partie
 * neuve le voit. **4** : le Chariot gagne ses **types de café
 * choisis** (`cafeTypes`, ticket #91) — absents d'un état v3, ils valent `[]`,
 * c'est-à-dire la proposition automatique. **3** : sept variantes secrètes changent
 * de suffixe d'id en passant aux raretés hautes (ticket #87) — `owned` et `deck`
 * portent des ids, donc ces re-suffixages exigent un remappage. **2** : les ids de
 * carte suivent les noms (ticket #49) — même raison. **1** : ajout de `rng`, le
 * générateur seedé du store (ticket #29). Toute nouvelle version exige une branche
 * dans `migratePersisted` (`AGENTS.md` §6).
 */
export const STORAGE_VERSION = 6;

/**
 * Ids de carte renommés ou re-suffixés (tickets #49 et #87). `AGENTS.md` §5 : **un id
 * suit le nom** — et, pour une variante, la rareté. Quand l'un des deux change, l'id
 * change au lieu de rester un alias introuvable, et l'état persisté doit suivre,
 * sinon la carte quitte silencieusement le Parc et le Chariot.
 *
 * Clé : ancien id. Valeur : id courant. Une entrée ne se retire pas sans casser
 * la migration ; on ajoute, on ne réécrit pas l'histoire.
 */
export const CARD_ID_RENAMES: Readonly<Record<string, string>> = {
  'rh-responsable-qvt': 'rh-charge-prevention',
  'direction-directeur-projet': 'direction-directeur-programme',
  // D-029 (#67) : le Management renommé, chaque nom vérifié libre dans le catalogue.
  'management-chef-des-ventes': 'management-responsable-unite',
  'management-chef-des-ventes-ex': 'management-responsable-unite-ex',
  'management-ton-chef': 'management-animateur-equipe',
  'management-manager-adjoint': 'management-chef-service',
  'management-commercial': 'management-technico-commercial',
  // #87 : quatre variantes passent en 3 étoiles, trois en Couronne. Le suffixe de
  // l'id porte la rareté (`secretVariant`), donc il change avec elle.
  'sse-medecin-travail-star2': 'sse-medecin-travail-star3',
  'qvt-chief-happiness-officer-star2': 'qvt-chief-happiness-officer-star3',
  'amelioration-directeur-qualite-star2': 'amelioration-directeur-qualite-star3',
  'atelier-chef-atelier-star2': 'atelier-chef-atelier-star3',
  'rh-drh-star2': 'rh-drh-crown',
  'direction-pdg-star2': 'direction-pdg-crown',
  'syndicat-secretaire-general-star2': 'syndicat-secretaire-general-crown'
};

const STARTER_RARITIES: Rarity[] = ['1D', '2D'];

function starterOwned(): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    if (STARTER_RARITIES.includes(card.rarity)) owned[card.id] = 1;
  }
  return owned;
}

export interface AppState {
  name: string;
  owned: Record<string, number>;
  deck: string[];
  /**
   * Les **types de café choisis** pour le Chariot (1 à 3, D-037 (4), ticket #91) :
   * `[]` = proposition automatique, dérivée des factions du Chariot. La liste est
   * normalisée à l'écriture (`normalizeCafeTypes`) **et** à la lecture
   * (`resolveCafeTypes`), donc un état trafiqué ne fait jamais produire `SUPPORT` ni
   * `INTERIM`, ni plus de 3 types (D-034).
   *
   * **Le choix est un attribut du Chariot, pas du joueur** (#117). Critère retenu :
   * *le choix décrit un contenu ; il ne survit pas au remplacement de ce contenu.*
   * Remplacer le Chariot (`setDeck`, donc « Remplir »), le vider (`clearDeck`), le
   * vider en retirant sa dernière carte (`removeFromDeck`) ou tout réinitialiser
   * (`reset`) **efface** le choix : `[]` repart en proposition automatique, dérivée
   * du **nouveau** contenu. Ajuster le Chariot carte par carte (`addToDeck`,
   * `toggleDeck`) le **garde** : c'est le même Chariot qu'on édite.
   *
   * Pourquoi « attribut du Chariot » plutôt que « du joueur » : `AGENTS.md` §4 dit
   * « Jusqu'à 3 types **par Chariot**, choisis par le joueur » et §6 parle des
   * « types de café choisis **du Chariot** » ; `resolveCafeTypes(deck, chosen)` prend
   * déjà le Chariot en premier argument. Le laisser survivre à un remplacement
   * faisait appliquer à un Chariot neuf les types d'un autre — et, à l'écran de
   * combat, à un Chariot de test (#117).
   */
  cafeTypes: CafeType[];
  packsOpened: number;
  reducedMotion: boolean;
  /**
   * État du générateur seedé des Arrivages (ticket #29). Persisté : la suite de
   * tirages continue après un rechargement, et deux Arrivages ne rejouent pas la
   * même séquence. Voir `@/game/rng`.
   */
  rng: number;
  /**
   * La « Journée d'intégration » (le tutoriel) a-t-elle été vue ? Une partie neuve la
   * montre ; un état migré d'avant sa création la considère vue (`migratePersisted`),
   * et « Réinitialiser la progression » la remontre.
   */
  tutorielVu: boolean;
  /**
   * Le **pas-à-pas de la première partie** (#143) a-t-il été vu ? Il ne se montre
   * qu'une fois : sur la première partie, et pas avant que la Journée d'intégration
   * soit finie. Un état migré d'avant sa création le considère vu
   * (`migratePersisted`), « Réinitialiser la progression » le remontre, et Réglages
   * le rouvre à la demande.
   */
  pasAPasCombatVu: boolean;
  openPack: () => Card[];
  addCard: (cardId: string, amount?: number) => void;
  addToDeck: (cardId: string) => void;
  removeFromDeck: (cardId: string) => void;
  toggleDeck: (cardId: string) => void;
  setDeck: (deck: string[]) => void;
  clearDeck: () => void;
  /** Remplace le choix de types de café ; une liste vide repasse en automatique. */
  setCafeTypes: (types: CafeType[]) => void;
  /** Coche/décoche un type de café ; plafonné à 3, `SUPPORT`/`INTERIM` ignorés. */
  toggleCafeType: (type: CafeType) => void;
  reset: () => void;
  setName: (name: string) => void;
  setReducedMotion: (value: boolean) => void;
  /** Marque la « Journée d'intégration » comme vue (`true`) ou à revoir (`false`). */
  setTutorielVu: (value: boolean) => void;
  /** Marque le **pas-à-pas du combat** comme vu (`true`) ou à revoir (`false`). */
  setPasAPasCombatVu: (value: boolean) => void;
  /** La sauvegarde locale, telle qu'un joueur peut la copier et la coller ailleurs. */
  exporterSauvegarde: () => string;
  /**
   * Remplace l'état par une sauvegarde collée. Ne lève jamais : un texte invalide, un
   * fichier d'un autre jeu ou une sauvegarde d'une version plus récente laisse l'état
   * **intact** et rend la raison, que l'écran affiche.
   */
  importerSauvegarde: (texte: string) => ImportResult;
}

/**
 * Les champs **persistés** (`AGENTS.md` §6) : l'état de jeu, jamais les actions (elles
 * sont recréées par le store) ni un `BattleState`. Exporté pour être testé sans
 * `localStorage` : le stockage de `persist` n'existe pas sous Node, donc le test lit
 * cette fonction au lieu de passer par le middleware.
 */
export type PersistedState = Pick<
  AppState,
  | 'name'
  | 'owned'
  | 'deck'
  | 'cafeTypes'
  | 'packsOpened'
  | 'reducedMotion'
  | 'rng'
  | 'tutorielVu'
  | 'pasAPasCombatVu'
>;

export function partializeState(state: AppState): PersistedState {
  return {
    name: state.name,
    owned: state.owned,
    deck: state.deck,
    cafeTypes: state.cafeTypes,
    packsOpened: state.packsOpened,
    reducedMotion: state.reducedMotion,
    rng: state.rng,
    tutorielVu: state.tutorielVu,
    pasAPasCombatVu: state.pasAPasCombatVu
  };
}

/**
 * Le format du texte exporté. Il se **nomme**, pour qu'une sauvegarde d'un autre jeu
 * collée par erreur soit refusée avec un message clair au lieu d'être chargée à moitié.
 */
export const SAVE_FORMAT = 'bureau-des-planques';

export interface SaveFile {
  jeu: string;
  version: number;
  etat: PersistedState;
}

export type ImportResult = { ok: true } | { ok: false; raison: string };

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      name: 'Employé 404',
      owned: starterOwned(),
      deck: [],
      cafeTypes: [],
      packsOpened: 0,
      reducedMotion: false,
      rng: seedRng(Date.now()),
      tutorielVu: false,
      pasAPasCombatVu: false,
      openPack: () => {
        // La composition de l'Arrivage (3 communes, 1 peu commune, 1 rare) est
        // une règle de jeu : elle vit dans `@/game/pack` (ticket #57). Ici, on ne
        // fait qu'avancer un générateur local, puis publier son état : `set`
        // reste le seul chemin d'écriture, et un Arrivage est reproductible.
        const holder: RngHolder = { rng: get().rng };
        const cards = openPackCards(holder);
        set((state) => {
          const owned = { ...state.owned };
          for (const card of cards) owned[card.id] = (owned[card.id] ?? 0) + 1;
          return { owned, packsOpened: state.packsOpened + 1, rng: holder.rng };
        });
        return cards;
      },
      addCard: (cardId, amount = 1) => {
        set((state) => ({
          owned: { ...state.owned, [cardId]: (state.owned[cardId] ?? 0) + amount }
        }));
      },
      addToDeck: (cardId) => {
        set((state) => (deckCanAdd(state.deck, cardId) ? { deck: [...state.deck, cardId] } : {}));
      },
      removeFromDeck: (cardId) => {
        set((state) => {
          const index = state.deck.findIndex((id) => id === cardId);
          if (index < 0) return {};
          const deck = [...state.deck];
          deck.splice(index, 1);
          // Vider le Chariot à la main laisse le même état que `clearDeck` : le choix
          // tombe avec le contenu qui le portait (#117). Retirer une carte d'un
          // Chariot qui en garde d'autres ne touche pas au choix.
          return deck.length === 0 ? { deck, cafeTypes: [] } : { deck };
        });
      },
      /** Un clic : ajoute si c'est possible, sinon retire **un** exemplaire. */
      toggleDeck: (cardId) => {
        const state = get();
        if (deckCanAdd(state.deck, cardId)) state.addToDeck(cardId);
        else state.removeFromDeck(cardId);
      },
      /**
       * **Remplir** (« Remplir » de l'écran Chariot : `setDeck(autoDeck(owned).deck)`)
       * **efface** le choix de types de café : il décrivait le contenu précédent, et
       * `[]` repart en proposition automatique du nouveau Chariot (#117). C'est le
       * même geste que `clearDeck`, donc le même effet sur le choix.
       */
      setDeck: (deck) => set({ deck, cafeTypes: [] }),
      /**
       * Un Chariot vide n'a plus de types de café : le choix repart en automatique
       * (#117 — même règle que `setDeck`, vue depuis un contenu vide).
       */
      clearDeck: () => set({ deck: [], cafeTypes: [] }),
      setCafeTypes: (types) => set({ cafeTypes: normalizeCafeTypes(types) }),
      toggleCafeType: (type) => {
        const current = get().cafeTypes;
        const next = current.includes(type)
          ? current.filter((entry) => entry !== type)
          : [...current, type];
        // La normalisation écarte `SUPPORT`/`INTERIM` et ignore un 4ᵉ type (#91).
        set({ cafeTypes: normalizeCafeTypes(next) });
      },
      reset: () =>
        set({
          owned: starterOwned(),
          deck: [],
          cafeTypes: [],
          packsOpened: 0,
          name: 'Employé 404',
          // Une progression remise à zéro repart d'un joueur neuf : la Journée
          // d'intégration et le pas-à-pas du combat se remontrent.
          tutorielVu: false,
          pasAPasCombatVu: false,
          // Un nouveau départ change la suite des Arrivages : sinon le premier
          // Arrivage d'après remise à zéro rejouerait le précédent.
          rng: seedRng(Date.now())
        }),
      setName: (name) => set({ name }),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      setTutorielVu: (value) => set({ tutorielVu: value }),
      setPasAPasCombatVu: (value) => set({ pasAPasCombatVu: value }),
      exporterSauvegarde: () =>
        JSON.stringify(
          { jeu: SAVE_FORMAT, version: STORAGE_VERSION, etat: partializeState(get()) },
          null,
          2
        ),
      importerSauvegarde: (texte) => {
        let brut: unknown;
        try {
          brut = JSON.parse(texte);
        } catch {
          return { ok: false, raison: 'Ce texte n’est pas lisible : vérifie que tu as tout copié.' };
        }
        if (typeof brut !== 'object' || brut === null) {
          return { ok: false, raison: 'Ce texte n’est pas une sauvegarde.' };
        }
        const fichier = brut as Partial<SaveFile>;
        if (fichier.jeu !== SAVE_FORMAT) {
          return { ok: false, raison: 'Ce texte ne vient pas de Bureau des Planqués.' };
        }
        if (typeof fichier.version !== 'number') {
          return { ok: false, raison: 'Cette sauvegarde n’indique pas sa version.' };
        }
        if (fichier.version > STORAGE_VERSION) {
          return {
            ok: false,
            raison: 'Cette sauvegarde vient d’une version plus récente du jeu : recharge la page, puis réessaie.'
          };
        }
        const etat = fichier.etat as Partial<AppState> | undefined;
        if (!etat || typeof etat !== 'object') {
          return { ok: false, raison: 'Cette sauvegarde est vide.' };
        }
        if (typeof etat.owned !== 'object' || etat.owned === null || !Array.isArray(etat.deck)) {
          return {
            ok: false,
            raison: 'Cette sauvegarde est incomplète : le Parc ou le Chariot manque.'
          };
        }
        // Les migrations font le reste : ids renommés, types de café normalisés,
        // générateur recréé s'il manque. On ne charge jamais un état brut.
        set(migratePersisted(etat, fichier.version));
        return { ok: true };
      }
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      migrate: (persisted, version) => migratePersisted(persisted, version) as AppState,
      partialize: partializeState
    }
  )
);

/**
 * Passage d'un état persisté plus ancien à la forme courante.
 *
 * **v0 → v1** (ticket #29) : la version 0 ne contient pas `rng`. Sans cette
 * migration, `openPack` tirerait d'un générateur `undefined`. Le champ est créé
 * à la volée.
 *
 * **v1 → v2** (ticket #49) : les ids renommés (`CARD_ID_RENAMES`) sont remappés
 * dans `owned` et `deck`, les deux champs qui portent des ids.
 *
 * **v2 → v3** (#87) : les variantes re-raréfiées changent de suffixe d'id ; elles
 * passent par la même table, donc un état v2 encore porteur de l'ancien suffixe est
 * remappé comme un état v1.
 *
 * **v3 → v4** (#91) : le Chariot gagne ses **types de café choisis**. Un état v3 n'en
 * a pas : `[]` vaut « proposition automatique », donc la dérivation d'avant reste le
 * défaut. Un choix trafiqué est normalisé au passage (ni `SUPPORT` ni `INTERIM`,
 * 3 types au plus). Les autres champs sont conservés tels quels (`persist` fusionne
 * ensuite avec l'état initial, qui porte les actions). `version` absent vaut 0, comme
 * le fait `persist`.
 *
 * **v5 → v6** (#143) : le store gagne `pasAPasCombatVu`, le drapeau du **pas-à-pas de
 * la première partie**. Un état v5 vient de quelqu'un qui a déjà joué : `true`, on ne
 * lui remontre pas les règles du combat. Une partie neuve n'a aucun état à migrer et
 * part de `false` (l'état initial du store).
 */
export function migratePersisted(persisted: unknown, version = 0): Partial<AppState> {
  const state = (persisted ?? {}) as Partial<AppState>;
  const migrated = version < 3 ? withRenamedCardIds(state) : state;
  return {
    ...migrated,
    cafeTypes: normalizeCafeTypes(migrated.cafeTypes),
    rng: typeof migrated.rng === 'number' ? migrated.rng : seedRng(Date.now()),
    // **v4 → v5** : un état v4 a **déjà été joué** (on ne lui remontre pas la Journée
    // d'intégration, `true` d'office) ; une partie neuve n'a aucun état à migrer et
    // part de `false`.
    tutorielVu: typeof migrated.tutorielVu === 'boolean' ? migrated.tutorielVu : version < STORAGE_VERSION,
    // **v5 → v6** : même règle pour le pas-à-pas du combat — un état d'avant sa
    // création vient d'un invité qui a déjà combattu.
    pasAPasCombatVu:
      typeof migrated.pasAPasCombatVu === 'boolean'
        ? migrated.pasAPasCombatVu
        : version < STORAGE_VERSION
  };
}

/**
 * Remappe les anciens ids dans `owned` et `deck`. Les comptes sont **additionnés**
 * si les deux ids cohabitent (état bricolé à la main) : aucun exemplaire ne
 * disparaît. L'ordre du Chariot est conservé.
 */
function withRenamedCardIds(state: Partial<AppState>): Partial<AppState> {
  const next: Partial<AppState> = { ...state };
  if (state.owned) {
    const owned: Record<string, number> = {};
    for (const [id, count] of Object.entries(state.owned)) {
      const current = CARD_ID_RENAMES[id] ?? id;
      owned[current] = (owned[current] ?? 0) + count;
    }
    next.owned = owned;
  }
  if (state.deck) next.deck = state.deck.map((id) => CARD_ID_RENAMES[id] ?? id);
  return next;
}

// Les règles du Chariot (20 cartes, 2 exemplaires max, ≥ 1 N+1) vivent dans
// `@/game/deck` : ce sont des règles de jeu, pas de l'état d'application.
