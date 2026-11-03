import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_CARDS } from '@/data';
import { deckCanAdd, normalizeCafeTypes } from '@/game/deck';
import { DIFFICULTE_PAR_DEFAUT, estDifficulte } from '@/game/ia';
import type { Difficulte } from '@/game/ia';
import { ouvrirArrivage } from '@/lib/arrivage';
import { ErreurCollection, lireCollection } from '@/lib/collection';
import type { RaisonCollection } from '@/lib/collection';
import { ajouterIntention, cleDeck, envoyerDeck, ErreurDeck, normaliserOutbox, operationDeck } from '@/lib/deck';
import type { IntentionDeck, RaisonDeck } from '@/lib/deck';
import type { Card, CafeType, Rarity } from '@/data/types';
import { lirePartie } from '@/store/partie';
import type { PartieSauvegardee } from '@/store/partie';
import { lireDerniere } from '@/store/derniere';
import type { DernierePartie } from '@/store/derniere';

/** Clé de persistance. Source unique : `Settings.tsx` l'affiche, `persist` l'écrit. */
export const STORAGE_KEY = 'bureau-des-planques-v1';

/**
 * La **clé d'idempotence** de l'ouverture d'Arrivage en cours (#651, D-179 (2)).
 *
 * Elle vit **hors de la forme persistée** : c'est une intention de réseau, pas un état de
 * jeu. Elle est créée à la première tentative et **gardée jusqu'au succès** — un échec
 * réseau suivi d'un retry rejoue la même clé, donc le serveur ne crédite qu'une fois. La
 * perdre entre deux tentatives serait le seul moyen de doubler la Collection.
 */
let cleArrivage: string | null = null;

/**
 * L'ouverture **en vol**, s'il y en a une. Un second appel pendant qu'elle attend le serveur
 * reçoit la **même** promesse : une seule demande part, et une seule série de cartes est
 * créditée. C'est la seconde moitié de la règle du double clic, côté store — l'écran, lui,
 * désactive son bouton.
 */
let ouvertureArrivage: Promise<Card[]> | null = null;

/**
 * L'envoi de Deck **en vol**, s'il y en a un. Un second appel pendant que le serveur répond
 * reçoit la **même** promesse : un seul lot part, et la file n'est vidée qu'une fois.
 */
let envoiDeck: Promise<RaisonDeck | null> | null = null;

/**
 * Version de la forme persistée. **17** : le Deck gagne sa **file d'intentions**
 * (`deckOutbox`, #491, D-153 (3), D-179 (4)) — absente d'un état v16, elle vaut `[]` :
 * rien n'attendait. **16** : la Collection devient un **cache** du serveur
 * (#493, D-179 (3)) — `collectionSynchroniseeLe` garde la date de la dernière lecture
 * réussie, `null` pour un état v15 (jamais synchronisé). **15** : `rng` quitte la forme
 * persistée — le client ne tire plus l'Arrivage, le serveur le tire (D-179 (2), #651) ;
 * une sauvegarde v14 qui le
 * porte encore se lit sans erreur, et le champ disparaît (`migratePersisted`). **14** : le
 * store gagne `difficulte` (le cran de la
 * Direction, #251 / D-145), absente d'un état v13 : elle vaut `normal`, le défaut qui ne
 * change pas l'écran (D-084). **13** : `derniere`, la dernière partie terminée (ticket
 * #366), absente d'un état v12 : elle vaut `null`. Voir `migratePersisted` pour l'historique complet
 * (v8 : la densité du combat et les raccourcis ; v9 et v10 : les renommages de D-095 et
 * D-096). Une constante qui annonce un autre chiffre que le sien est un piège : elle a dit
 * **8** jusqu'au 26/10/2026 alors qu'elle valait déjà 10 (#249).
 *
 * **8** : le store gagne la **densité du combat**
 * (`combatDetaille`, #189) et les **raccourcis clavier du combat** (`raccourcisCombat`,
 * #189) — absents d'un état v7, ils valent `false` (sobre) et `true` (raccourcis actifs),
 * les défauts que `AGENTS.md` §6 et `SPEC-COMBAT-UI` §4.2 fixent. **7** : le store gagne
 * `partie` (la partie en cours, rejouable depuis sa graine et son journal, ticket #126) —
 * absente d'un état v6, elle vaut `null` : aucune partie n'était rangée. **6** : le store
 * gagne `pasAPasCombatVu` (le pas-à-pas de la **première partie** se montre une fois, #143)
 * — absent d'un état v5,
 * il vaut **`true`**, pour la même raison que `tutorielVu` : qui a déjà une partie en
 * cours a déjà joué, on ne lui remontre pas les règles du combat ; seule une partie
 * neuve le voit. **5** : le store gagne `tutorielVu` (la « Journée d'intégration » se
 * montre une fois) — absent d'un état v4, il vaut `true` : quelqu'un qui a déjà une
 * partie en cours a déjà joué, on ne lui remontre pas le tutoriel ; seule une partie
 * neuve le voit. **4** : le Deck gagne ses **types de café
 * choisis** (`cafeTypes`, ticket #91) — absents d'un état v3, ils valent `[]`,
 * c'est-à-dire la proposition automatique. **3** : sept variantes secrètes changent
 * de suffixe d'id en passant aux raretés hautes (ticket #87) — `owned` et `deck`
 * portent des ids, donc ces re-suffixages exigent un remappage. **2** : les ids de
 * carte suivent les noms (ticket #49) — même raison. **1** : ajout de `rng`, le
 * générateur seedé du store (ticket #29) — retiré en v15. Toute nouvelle version exige une
 * branche dans `migratePersisted` (`AGENTS.md` §6).
 */
export const STORAGE_VERSION = 17;

/**
 * Ids de carte renommés ou re-suffixés (tickets #49 et #87). `docs/JEU.md` §5 : **un id
 * suit le nom** — et, pour une variante, la rareté. Quand l'un des deux change, l'id
 * change au lieu de rester un alias introuvable, et l'état persisté doit suivre,
 * sinon la carte quitte silencieusement la Collection et le Deck.
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
  'atelier-chef-atelier-star2': 'atelier-responsable-process-star3',
  // D-095 (renommage de l'Atelier, 25/10/2026) : vingt-deux cartes de base changent de nom,
  // donc d'id, et leurs variantes suivent. Les quatre cartes qui gardent leur nom gardent leur id.
  'atelier-apprenti': 'atelier-joueur-de-flute',
  'atelier-apprenti-star2': 'atelier-joueur-de-flute-star2',
  'atelier-technicien-maintenance': 'atelier-technicien-systeme',
  'atelier-technicien-maintenance-star': 'atelier-technicien-systeme-star',
  'atelier-chef-atelier': 'atelier-responsable-process',
  'atelier-chef-atelier-star3': 'atelier-responsable-process-star3',
  'atelier-electricien': 'atelier-opticien',
  'atelier-electromecanicien': 'atelier-rpo',
  'atelier-electromecanicien-star': 'atelier-rpo-star',
  'atelier-responsable-maintenance': 'atelier-rui',
  'atelier-responsable-maintenance-star2': 'atelier-rui-star2',
  'atelier-plombier': 'atelier-regleur',
  'atelier-tuyauteur': 'atelier-rpi',
  'atelier-tuyauteur-star': 'atelier-rpi-star',
  'atelier-chef-chantier': 'atelier-responsable-flux',
  'atelier-chef-chantier-star2': 'atelier-responsable-flux-star2',
  'atelier-ascensoriste': 'atelier-controleur-vibration',
  'atelier-depanneur-ascenseur': 'atelier-responsable-qualite',
  'atelier-depanneur-ascenseur-star': 'atelier-responsable-qualite-star',
  'atelier-mecanicien-outilleur': 'atelier-gestionnaire-fod',
  'atelier-soudeur': 'atelier-monteur-optique',
  'atelier-soudeur-tig': 'atelier-technicien-banc-essai',
  'atelier-chaudronnier': 'atelier-pointeur',
  'atelier-chef-fabrication': 'atelier-ordonnanceur',
  'atelier-chef-usine': 'atelier-responsable-pole',
  'atelier-cariste': 'atelier-cariste-salle-blanche',
  'atelier-chef-quai': 'atelier-planificateur-moyens-essai',
  'atelier-stagiaire-atelier': 'atelier-assistant-rpo',
  'atelier-chef-atelier-ex': 'atelier-rpo-sans-rui-ex',
  'atelier-responsable-maintenance-ex': 'atelier-rui-non-toxique-ex',
  // D-096 (dix cartes dont l'id ne suivait pas le nom, docs/JEU.md §5).
  'qvt-ambassadeur-bienveillance': 'qvt-charge-mission',
  'qvt-cueilleur-fruits': 'qvt-charge-logistique',
  'qvt-organisateur-afterwork': 'qvt-responsable-evenementiel',
  'qvt-yogiste-bureau': 'qvt-charge-ergonomie',
  'qvt-animateur-pause': 'qvt-gestionnaire-moyens-generaux',
  'qvt-decorateur-plantes': 'qvt-charge-environnement-travail',
  'qvt-masseur-assis': 'qvt-masseur-kinesitherapeute',
  'rh-recruteur-embuscade': 'rh-charge-sourcing',
  'direction-auditeur-interne': 'direction-auditeur-direction',
  'qvt-gestionnaire-flux': 'qvt-coordinateur-flux',
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
  /**
   * **La date de la dernière lecture réussie de la Collection** (#493, D-179 (3)) : un
   * horodatage en millisecondes, `null` tant que le serveur n'a jamais répondu. `owned`
   * est le **cache** ; cette date dit à quel point il peut être en retard, et l'écran
   * l'affiche hors ligne (D-060 (3)).
   */
  collectionSynchroniseeLe: number | null;
  deck: string[];
  /**
   * Les **types de café choisis** pour le Deck (1 à 3, D-037 (4), ticket #91) :
   * `[]` = proposition automatique, dérivée des factions du Deck. La liste est
   * normalisée à l'écriture (`normalizeCafeTypes`) **et** à la lecture
   * (`resolveCafeTypes`), donc un état trafiqué ne fait jamais produire `SUPPORT` ni
   * `INTERIM`, ni plus de 3 types (D-034).
   *
   * **Le choix est un attribut du Deck, pas du joueur** (#117). Critère retenu :
   * *le choix décrit un contenu ; il ne survit pas au remplacement de ce contenu.*
   * Remplacer le Deck (`setDeck`, donc « Remplir »), le vider (`clearDeck`), le
   * vider en retirant sa dernière carte (`removeFromDeck`) ou tout réinitialiser
   * (`reset`) **efface** le choix : `[]` repart en proposition automatique, dérivée
   * du **nouveau** contenu. Ajuster le Deck carte par carte (`addToDeck`,
   * `toggleDeck`) le **garde** : c'est le même Deck qu'on édite.
   *
   * Pourquoi « attribut du Deck » plutôt que « du joueur » : `docs/JEU.md` §4 dit
   * « Jusqu'à 3 types **par Deck**, choisis par le joueur » et §6 parle des
   * « types de café choisis **du Deck** » ; `resolveCafeTypes(deck, chosen)` prend
   * déjà le Deck en premier argument. Le laisser survivre à un remplacement
   * faisait appliquer à un Deck neuf les types d'un autre — et, à l'écran de
   * combat, à un Deck de test (#117).
   */
  cafeTypes: CafeType[];
  /**
   * **La file d'intentions du Deck** (#491, D-153 (3), D-179 (4)) : chaque geste du Deck y
   * laisse son intention, et elle part au serveur quand le réseau revient. Persistée (v17)
   * : elle **survit au rechargement**, c'est ce qui rend le Deck « local d'abord » sans
   * perdre un geste hors ligne. Elle se vide **seulement au succès** — un refus garde tout.
   */
  deckOutbox: IntentionDeck[];
  /**
   * Pourquoi le dernier envoi du Deck n'a pas abouti (#491) : `null` quand la file est vide
   * ou à jour. Ce n'est **pas** persisté : c'est l'état d'un essai, pas une donnée de jeu.
   */
  deckSyncRaison: RaisonDeck | null;
  packsOpened: number;
  reducedMotion: boolean;
  /**
   * **Les deux sons du jeu** (D-137, #378) : `true` par défaut. Coché, l'Arrivage et le verdict se
   * font entendre ; décoché, `@/audio/sons` ne demande **aucune** lecture — la coupure est
   * immédiate, il n'y a rien à recharger.
   */
  sons: boolean;
  /**
   * **La densité de l'écran de combat** (#189, `SPEC-COMBAT-UI` §4.3) : `false` = `sobre`
   * (le défaut, la redite coupée), `true` = `détaillé` (les annotations remises). Ce n'est
   * qu'un réglage d'affichage : il ne cache **aucune valeur qui change une décision** — le
   * Poste, le Stress, les Interventions et le tour restent visibles dans les deux modes.
   */
  combatDetaille: boolean;
  /**
   * **Les raccourcis clavier du combat** (#189, `SPEC-COMBAT-UI` §4.2) : `true` par défaut.
   * Décoché dans Réglages, `I` **et** `Ctrl`+`I` ne font plus rien — c'est la désactivation
   * qu'exige le critère WCAG sur les raccourcis à une touche.
   */
  raccourcisCombat: boolean;
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
  /**
   * La **partie en cours** (ticket #126) : de quoi la rejouer à l'identique au
   * rechargement — la graine, les Decks, les types de café et le journal. `null` = aucune
   * partie à reprendre (rien de joué, ou partie terminée). Écrite par l'écran de combat,
   * jamais recalculée ici : les règles restent dans `@/game/engine`.
   */
  partie: PartieSauvegardee | null;
  /**
   * La **dernière partie terminée** (ticket #366) : de quoi la rejouer et son verdict, pour la
   * revoir depuis Réglages. `null` tant qu'aucune partie n'est finie. Écrite en fin de combat
   * par l'écran de combat ; remise à zéro par « Réinitialiser la progression ».
   */
  derniere: DernierePartie | null;
  /**
   * **Le cran de difficulté de la Direction** (#251, D-145) : il règle ensemble la
   * **politique** de l'IA et le **Deck** qu'elle joue (`@/game/deck-direction`).
   * `normal` par défaut — la recherche à deux coups de l'écran (D-084), donc un état qui
   * n'y touche pas garde le comportement d'avant. Persisté : c'est un réglage du testeur,
   * pas une mécanique de partie, et il survit au rechargement comme le reste du poste.
   */
  difficulte: Difficulte;
  /**
   * **Ouvre un Arrivage en ligne** (#651, D-179 (2)) : demande les cartes au serveur,
   * puis les crédite. Ne tire plus rien localement — hors ligne, elle **rejette**
   * (`ErreurArrivage`, raison `hors-ligne`) sans aucun appel.
   */
  openPack: () => Promise<Card[]>;
  /**
   * **Relit la Collection du serveur et remplace le cache** (#493, D-179 (3)). Ce n'est
   * pas une fusion : `owned` reçoit exactement ce que le serveur dit, et la date de
   * lecture est retenue. En cas d'échec, **rien n'est effacé** : le cache reste tel quel,
   * la raison est rendue (`null` au succès) pour que l'écran la dise.
   */
  synchroniserCollection: () => Promise<RaisonCollection | null>;
  /**
   * **Envoie la file du Deck au serveur** (#491). Vide la file au succès ; sur un refus ou
   * une panne, la **garde intacte** et rend la raison, que l'écran Deck dit (D-060 (3)).
   * Ne fait rien quand la file est vide, et n'émet aucun appel hors ligne ou sans session.
   */
  synchroniserDeck: () => Promise<RaisonDeck | null>;
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
  setSons: (value: boolean) => void;
  /** Pose le cran de difficulté de la Direction (`facile`, `normal`, `difficile`). */
  setDifficulte: (value: Difficulte) => void;
  /** Pose la densité du combat (`true` = détaillé, `false` = sobre). */
  setCombatDetaille: (value: boolean) => void;
  /** Bascule `sobre` ↔ `détaillé` — le geste du bouton `ⓘ` et des raccourcis (#189). */
  basculerCombatDetaille: () => void;
  /** Active ou coupe les raccourcis clavier du combat (Réglages, #189). */
  setRaccourcisCombat: (value: boolean) => void;
  /** Marque la « Journée d'intégration » comme vue (`true`) ou à revoir (`false`). */
  setTutorielVu: (value: boolean) => void;
  /** Marque le **pas-à-pas du combat** comme vu (`true`) ou à revoir (`false`). */
  setPasAPasCombatVu: (value: boolean) => void;
  /** Range la partie en cours (`null` pour n'en garder aucune). */
  enregistrerPartie: (partie: PartieSauvegardee | null) => void;
  /** Range la dernière partie terminée (`null` pour l'effacer). */
  enregistrerDerniere: (derniere: DernierePartie | null) => void;
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
  | 'collectionSynchroniseeLe'
  | 'deck'
  | 'cafeTypes'
  | 'deckOutbox'
  | 'packsOpened'
  | 'reducedMotion'
  | 'sons'
  | 'combatDetaille'
  | 'raccourcisCombat'
  | 'tutorielVu'
  | 'pasAPasCombatVu'
  | 'partie'
  | 'derniere'
  | 'difficulte'
>;

export function partializeState(state: AppState): PersistedState {
  return {
    name: state.name,
    owned: state.owned,
    collectionSynchroniseeLe: state.collectionSynchroniseeLe,
    deck: state.deck,
    cafeTypes: state.cafeTypes,
    deckOutbox: state.deckOutbox,
    packsOpened: state.packsOpened,
    reducedMotion: state.reducedMotion,
    sons: state.sons,
    combatDetaille: state.combatDetaille,
    raccourcisCombat: state.raccourcisCombat,
    tutorielVu: state.tutorielVu,
    pasAPasCombatVu: state.pasAPasCombatVu,
    partie: state.partie,
    derniere: state.derniere,
    difficulte: state.difficulte
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

/**
 * Un changement du Deck, **plus son intention** : c'est le seul chemin d'écriture du Deck
 * (#491). Les actions ne poussent rien dans la file elles-mêmes — elles décrivent le Deck
 * d'après, et cette fonction compare avec l'état courant (`operationDeck`) pour en faire
 * l'intention. Un geste qui ne change rien n'allonge pas la file.
 */
function changementDeck(state: AppState, changement: { deck?: string[]; cafeTypes?: CafeType[] }): Partial<AppState> {
  const deck = changement.deck ?? state.deck;
  return {
    ...changement,
    deckOutbox: ajouterIntention(state.deckOutbox, operationDeck(state.deck, deck))
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      name: 'Employé 404',
      owned: starterOwned(),
      collectionSynchroniseeLe: null,
      deck: [],
      cafeTypes: [],
      deckOutbox: [],
      deckSyncRaison: null,
      packsOpened: 0,
      reducedMotion: false,
      sons: true,
      combatDetaille: false,
      raccourcisCombat: true,
      tutorielVu: false,
      pasAPasCombatVu: false,
      partie: null,
      derniere: null,
      difficulte: DIFFICULTE_PAR_DEFAUT,
      openPack: () => {
        // Déjà en vol : on rend la **même** promesse, donc une seule demande et un seul crédit.
        if (ouvertureArrivage) return ouvertureArrivage;

        // **La clé d'idempotence survit à l'échec** (#651, D-179 (2)) : elle est créée une
        // fois, gardée dans cette référence, et **remise à zéro seulement au succès**. Un
        // retry (ou un double clic) rejoue donc la **même** clé, et le serveur — qui crédite
        // par cette clé — ne crédite qu'une fois. Une clé neuve à chaque tentative
        // doublerait la Collection au premier réseau capricieux.
        const promesse = (async () => {
          const cle = cleArrivage ?? crypto.randomUUID();
          cleArrivage = cle;
          const cards = await ouvrirArrivage(cle);
          cleArrivage = null;
          set((state) => {
            const owned = { ...state.owned };
            for (const card of cards) owned[card.id] = (owned[card.id] ?? 0) + 1;
            return { owned, packsOpened: state.packsOpened + 1 };
          });
          // **Le cache se relit après le crédit** (#493, D-179 (3)) : le serveur vient
          // d'écrire, relire garantit que le cache dit vrai — y compris si un autre
          // appareil a ouvert entre-temps. Un échec de lecture ne défait pas l'ouverture :
          // `synchroniserCollection` ne lève pas et laisse le cache local en place.
          await get().synchroniserCollection();
          return cards;
        })();
        ouvertureArrivage = promesse;
        // Le verrou tombe au succès comme à l'échec ; la **clé**, elle, ne tombe qu'au succès.
        void promesse.then(
          () => {
            ouvertureArrivage = null;
          },
          () => {
            ouvertureArrivage = null;
          }
        );
        return promesse;
      },
      synchroniserCollection: async () => {
        try {
          const owned = await lireCollection();
          // **Remplacement, pas fusion** (D-179 (3)) : `owned` reçoit ce que le serveur dit.
          // C'est ce qui rend le cache vrai, et ce qui rend inutile tout compteur.
          set({ owned, collectionSynchroniseeLe: Date.now() });
          return null;
        } catch (erreur) {
          // **Un échec n'efface rien** : `set` n'est pas appelé, le cache reste affiché.
          return erreur instanceof ErreurCollection ? erreur.raison : 'reseau';
        }
      },
      synchroniserDeck: async () => {
        // Déjà en vol : on rend la **même** promesse — un seul lot part, la file n'est vidée
        // qu'une fois. Le lot est **figé** au départ : une intention ajoutée pendant l'appel
        // reste dans la file et partira au lot suivant.
        if (envoiDeck) return envoiDeck;

        const intentions = get().deckOutbox;
        if (intentions.length === 0) {
          if (get().deckSyncRaison !== null) set({ deckSyncRaison: null });
          return null;
        }

        const ids = new Set(intentions.map((intention) => intention.id));
        const operations = [...intentions].sort((a, b) => a.ordre - b.ordre).map((intention) => intention.operation);
        // La clé du lot : celle de sa première intention. Elle survit au rechargement, donc
        // un retry rejoue la **même** clé et le serveur n'applique le lot qu'une fois.
        const cle = cleDeck(intentions);

        const promesse = (async () => {
          try {
            await envoyerDeck(operations, cle);
            set((state) => ({
              deckOutbox: state.deckOutbox.filter((intention) => !ids.has(intention.id)),
              deckSyncRaison: null
            }));
            return null;
          } catch (erreur) {
            // **Rien n'est écrasé** : la file reste telle quelle, et la raison est rendue
            // pour que l'écran Deck la dise (D-060 (3)).
            const raison = erreur instanceof ErreurDeck ? erreur.raison : 'reseau';
            set({ deckSyncRaison: raison });
            return raison;
          }
        })();
        envoiDeck = promesse;
        void promesse.then(
          () => {
            envoiDeck = null;
          },
          () => {
            envoiDeck = null;
          }
        );
        return promesse;
      },
      addCard: (cardId, amount = 1) => {
        set((state) => ({
          owned: { ...state.owned, [cardId]: (state.owned[cardId] ?? 0) + amount }
        }));
      },
      addToDeck: (cardId) => {
        const state = get();
        if (!deckCanAdd(state.deck, cardId)) return;
        set((etat) => changementDeck(etat, { deck: [...etat.deck, cardId] }));
      },
      removeFromDeck: (cardId) => {
        set((etat) => {
          const index = etat.deck.findIndex((id) => id === cardId);
          if (index < 0) return {};
          const deck = [...etat.deck];
          deck.splice(index, 1);
          // Vider le Deck à la main laisse le même état que `clearDeck` : le choix
          // tombe avec le contenu qui le portait (#117). Retirer une carte d'un
          // Deck qui en garde d'autres ne touche pas au choix.
          return changementDeck(etat, deck.length === 0 ? { deck, cafeTypes: [] } : { deck });
        });
      },
      /** Un clic : ajoute si c'est possible, sinon retire **un** exemplaire. */
      toggleDeck: (cardId) => {
        const state = get();
        if (deckCanAdd(state.deck, cardId)) state.addToDeck(cardId);
        else state.removeFromDeck(cardId);
      },
      /**
       * **Remplir** (« Remplir » de l'écran Deck : `setDeck(autoDeck(owned).deck)`)
       * **efface** le choix de types de café : il décrivait le contenu précédent, et
       * `[]` repart en proposition automatique du nouveau Deck (#117). C'est le
       * même geste que `clearDeck`, donc le même effet sur le choix.
       */
      setDeck: (deck) => set((etat) => changementDeck(etat, { deck, cafeTypes: [] })),
      /**
       * Un Deck vide n'a plus de types de café : le choix repart en automatique
       * (#117 — même règle que `setDeck`, vue depuis un contenu vide).
       */
      clearDeck: () => set((etat) => changementDeck(etat, { deck: [], cafeTypes: [] })),
      setCafeTypes: (types) => set({ cafeTypes: normalizeCafeTypes(types) }),
      toggleCafeType: (type) => {
        const current = get().cafeTypes;
        const next = current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type];
        // La normalisation écarte `SUPPORT`/`INTERIM` et ignore un 4ᵉ type (#91).
        set({ cafeTypes: normalizeCafeTypes(next) });
      },
      reset: () => {
        // Une progression remise à zéro n'a pas d'ouverture en attente : la clé d'idempotence
        // d'un Arrivage échoué ne survit pas à « Réinitialiser la progression ».
        cleArrivage = null;
        // Le Deck repart vide localement, et sa file aussi : une intention d'avant ne doit
        // pas ressusciter l'ancien Deck à la prochaine reconnexion. Le reset local n'écrit
        // rien au serveur (D-153 (2) le fera avec le reset de beta, #494).
        envoiDeck = null;
        set({
          owned: starterOwned(),
          collectionSynchroniseeLe: null,
          deck: [],
          cafeTypes: [],
          deckOutbox: [],
          deckSyncRaison: null,
          packsOpened: 0,
          name: 'Employé 404',
          // Une progression remise à zéro repart d'un joueur neuf : la Journée
          // d'intégration et le pas-à-pas du combat se remontrent, et l'affichage du
          // combat reprend ses défauts (`sobre`, raccourcis actifs — #189).
          combatDetaille: false,
          raccourcisCombat: true,
          tutorielVu: false,
          pasAPasCombatVu: false,
          // La partie en cours fait partie de la progression remise à zéro (#126).
          partie: null,
          // La dernière partie terminée se remet à zéro avec la progression (#366).
          derniere: null,
          // La difficulté revient au défaut : la remise à zéro part d'un poste neuf
          // (#251, D-145), et `normal` est ce que l'écran jouait avant.
          difficulte: DIFFICULTE_PAR_DEFAUT
        });
      },
      setName: (name) => set({ name }),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      setSons: (value) => set({ sons: value }),
      setDifficulte: (value) => set({ difficulte: estDifficulte(value) ? value : DIFFICULTE_PAR_DEFAUT }),
      setCombatDetaille: (value) => set({ combatDetaille: value }),
      basculerCombatDetaille: () => set((state) => ({ combatDetaille: !state.combatDetaille })),
      setRaccourcisCombat: (value) => set({ raccourcisCombat: value }),
      setTutorielVu: (value) => set({ tutorielVu: value }),
      setPasAPasCombatVu: (value) => set({ pasAPasCombatVu: value }),
      enregistrerPartie: (partie) => set({ partie }),
      enregistrerDerniere: (derniere) => set({ derniere }),
      exporterSauvegarde: () =>
        JSON.stringify({ jeu: SAVE_FORMAT, version: STORAGE_VERSION, etat: partializeState(get()) }, null, 2),
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
            raison: 'Cette sauvegarde est incomplète : la Collection ou le Deck manque.'
          };
        }
        // Les migrations font le reste : ids renommés, types de café normalisés,
        // générateur recréé s'il manque. On ne charge jamais un état brut.
        const migre = migratePersisted(etat, fichier.version);
        // Une sauvegarde sans `partie` (d'avant #126) n'efface pas la partie en cours :
        // importer une progression ne touche pas au combat qu'on est en train de jouer.
        if (!('partie' in etat)) migre.partie = get().partie;
        // Idem pour la dernière partie terminée (#366) : une sauvegarde d'avant ne l'a pas.
        if (!('derniere' in etat)) migre.derniere = get().derniere;
        // **Le Deck importé est un geste du Deck** (#491) : il remplace le Deck local, donc
        // il laisse une intention. La file **en cours** est gardée : importer une progression
        // ne jette pas les gestes qui attendent le réseau, et une sauvegarde n'apporte pas
        // ceux d'un autre appareil.
        const outbox = get().deckOutbox;
        const deckImporte = Array.isArray(migre.deck) ? migre.deck : get().deck;
        set({
          ...migre,
          deckOutbox: ajouterIntention(outbox, operationDeck(get().deck, deckImporte))
        });
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
 * **v0 → v1** (ticket #29) : la version 0 ne contenait pas `rng`. Ce générateur a
 * **disparu en v15** : le client ne tire plus l'Arrivage, le serveur le tire (#651, D-179).
 *
 * **v1 → v2** (ticket #49) : les ids renommés (`CARD_ID_RENAMES`) sont remappés
 * dans `owned` et `deck`, les deux champs qui portent des ids.
 *
 * **v2 → v3** (#87) : les variantes re-raréfiées changent de suffixe d'id ; elles
 * passent par la même table, donc un état v2 encore porteur de l'ancien suffixe est
 * remappé comme un état v1.
 *
 * **v3 → v4** (#91) : le Deck gagne ses **types de café choisis**. Un état v3 n'en
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
 *
 * **v6 → v7** (#126) : le store gagne `partie`, la partie en cours. Un état v6 n'en a
 * pas : `null`, rien à reprendre. Une partie mal formée est écartée (`lirePartie`) plutôt
 * que chargée à moitié ; sa validité de jeu, c'est `reprendrePartie` qui la juge.
 *
 * **v7 → v8** (#189) : le store gagne la **densité du combat** (`combatDetaille`) et les
 * **raccourcis clavier** (`raccourcisCombat`). Un état v7 n'en a pas : `false` (le mode
 * `sobre`, défaut de `SPEC-COMBAT-UI` §4.3) et `true` (les raccourcis actifs, défaut de la
 * case des Réglages). Une valeur forgée n'est pas crue : seul un booléen passe.
 *
 * **v8 → v9** (renommage de l'Atelier) : vingt-deux cartes de l'Atelier changent de nom, donc
 * d'id. `CARD_ID_RENAMES` remappe `owned` et `deck`. Une partie **en cours** qui porte un id
 * renommé est écartée (`partie: null`) : son journal d'actions référence les anciens ids et ne
 * se rejouerait pas à l'identique.
 *
 * **v12 → v13** (#366) : le store gagne `derniere`, la dernière partie terminée (de quoi la
 * rejouer et son verdict). Un état v12 n'en a pas : `null`. Rien d'autre ne bouge.
 *
 * **v13 → v14** (#251, D-145) : le store gagne `difficulte`, le cran de la Direction.
 * Un état v13 n'en a pas : `normal`, la recherche à deux coups de D-084 — donc son écran
 * ne change pas. Une valeur d'un autre type (ou un cran inconnu) est écartée de même.
 *
 * **v14 → v15** (#651, D-179 (2)) : `rng` **quitte la forme persistée** — le client ne tire
 * plus l'Arrivage, c'est le serveur qui tire et crédite. Une sauvegarde v14 qui le porte
 * encore se lit **sans erreur** : le champ est simplement ignoré et n'est pas réécrit.
 * `packsOpened` reste un compteur local, il n'est pas une autorité.
 *
 * **v15 → v16** (#493, D-179 (3)) : le store gagne `collectionSynchroniseeLe`, la date de
 * la dernière lecture réussie de la Collection. Un état v15 n'en a pas : `null`, « jamais
 * synchronisé ». `owned` reste la forme persistée — c'est le **cache** du serveur.
 *
 * **v16 → v17** (#491, D-153 (3), D-179 (4)) : le store gagne `deckOutbox`, la **file
 * d'intentions** du Deck. Un état v16 n'en a pas : `[]`, rien n'attendait. Une file
 * trafiquée est **filtrée** (`normaliserOutbox`) plutôt que crue : une intention mal formée
 * ne part pas au serveur.
 */
export function migratePersisted(persisted: unknown, version = 0): Partial<AppState> {
  const state = (persisted ?? {}) as Partial<AppState> & { rng?: unknown };
  // **v14 → v15** : le générateur du store est retiré, quel que soit l'âge de l'état. Une
  // sauvegarde qui le porte se lit (on l'ignore), une forme persistée neuve ne l'écrit plus.
  const { rng: _ancienGenerateur, ...sansGenerateur } = state;
  const migrated = version < STORAGE_VERSION ? withRenamedCardIds(sansGenerateur) : sansGenerateur;
  const normalise: Partial<AppState> = {
    ...migrated,
    // **v15 → v16** (#493, D-179 (3)) : la date de la dernière lecture de la Collection.
    // Un état v15 n'en a pas — jamais synchronisé ; une valeur forgée (autre chose qu'un
    // nombre) est écartée de même.
    collectionSynchroniseeLe:
      typeof migrated.collectionSynchroniseeLe === 'number' ? migrated.collectionSynchroniseeLe : null,
    // **v16 → v17** (#491) : la file d'intentions du Deck. Un état v16 n'en a pas — rien
    // n'attendait — et une entrée mal formée est écartée plutôt qu'envoyée au serveur.
    deckOutbox: normaliserOutbox(migrated.deckOutbox),
    cafeTypes: normalizeCafeTypes(migrated.cafeTypes),
    partie: lirePartie(migrated.partie),
    // **v12 → v13** (#366) : la dernière partie terminée. Un état v12 n'en a pas : `null`. Une
    // forme mal faite est écartée (`lireDerniere`), comme la partie en cours.
    derniere: lireDerniere(migrated.derniere),
    // **v13 → v14** (#251, D-145) : le cran de difficulté. Un état v13 n'en a pas, et une
    // valeur forgée ne passe pas : `normal`, le défaut de D-084.
    difficulte: estDifficulte(migrated.difficulte) ? migrated.difficulte : DIFFICULTE_PAR_DEFAUT,
    // **v7 → v8** : l'affichage du combat reprend ses défauts — `sobre`, et les raccourcis
    // actifs. Une valeur d'un autre type est écartée comme une absence.
    combatDetaille: typeof migrated.combatDetaille === 'boolean' ? migrated.combatDetaille : false,
    raccourcisCombat: typeof migrated.raccourcisCombat === 'boolean' ? migrated.raccourcisCombat : true,
    // **v11 → v12** : les deux sons arrivent cochés (D-137). Un état v11 n'a pas le champ : il prend
    // le défaut, et rien d'autre de son état ne bouge.
    sons: typeof migrated.sons === 'boolean' ? migrated.sons : true,
    // **v4 → v5** : un état v4 a **déjà été joué** (on ne lui remontre pas la Journée
    // d'intégration, `true` d'office) ; une partie neuve n'a aucun état à migrer et
    // part de `false`.
    tutorielVu: typeof migrated.tutorielVu === 'boolean' ? migrated.tutorielVu : version < STORAGE_VERSION,
    // **v5 → v6** : même règle pour le pas-à-pas du combat — un état d'avant sa
    // création vient d'un testeur qui a déjà combattu.
    pasAPasCombatVu:
      typeof migrated.pasAPasCombatVu === 'boolean' ? migrated.pasAPasCombatVu : version < STORAGE_VERSION
  };
  // **v10 -> v11** : la beta efface la **progression**, jamais le compte (D-130). Le compte
  // vit dans Supabase : rien de lui n'est ici. Ce qui part est ce qui se rejoue — Collection,
  // Deck, Arrivages ouverts, partie en cours, types de café. Ce qui reste est ce qui décrit
  // le **testeur** : son nom, ses réglages d'accessibilité, et ce qu'il a déjà appris.
  // Le palier ne vise **que** la population qui existe : les testeurs en v10. Un état plus
  // ancien n'arrive plus que par un **import de sauvegarde** (Réglages), et l'effacer serait
  // un bug : celui qui importe veut retrouver sa partie, pas la perdre.
  if (version === 10) {
    return {
      ...normalise,
      owned: starterOwned(),
      deck: [],
      cafeTypes: [],
      deckOutbox: [],
      packsOpened: 0,
      partie: null
    };
  }
  return normalise;
}

/**
 * Remappe les anciens ids dans `owned` et `deck`. Les comptes sont **additionnés**
 * si les deux ids cohabitent (état bricolé à la main) : aucun exemplaire ne
 * disparaît. L'ordre du Deck est conservé.
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
  const partie = state.partie as Partial<PartieSauvegardee> | null | undefined;
  const ids = [partie?.playerDeck, partie?.aiDeck].flatMap((deck) => (Array.isArray(deck) ? deck : []));
  if (ids.some((id) => typeof id === 'string' && id in CARD_ID_RENAMES)) next.partie = null;
  return next;
}

// Les règles du Deck (20 cartes, 2 exemplaires max, ≥ 1 N+1) vivent dans
// `@/game/deck` : ce sont des règles de jeu, pas de l'état d'application.
