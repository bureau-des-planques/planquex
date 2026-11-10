/**
 * **La sauvegarde** — l'archive d'export et d'import de Réglages (#495, D-048 (1), D-202).
 *
 * L'archive a **son propre numéro** (`ARCHIVE_VERSION`), distinct de `STORAGE_VERSION` :
 * changer la forme du store ne change plus la forme du fichier qu'un testeur garde.
 *
 * **Ce qu'elle porte et d'où ça vient** :
 *
 * - le **Deck** : lu sur le **compte** (`lireDeck`) après avoir poussé la file des gestes en
 *   attente ; à défaut de réseau, la copie de l'appareil, et l'archive le **dit** (`source`) ;
 * - la **Collection** : lue sur le **compte** (`lireCollection`) ; à défaut, le cache de
 *   l'appareil. Elle est **consultative** : D-179 (3) fait du serveur la seule autorité, et
 *   aucune opération du compte ne crédite une carte hors de l'Arrivage — l'import ne la
 *   réécrit donc jamais ;
 * - les **réglages locaux** (nom, accessibilité, tutoriels, partie en cours…) : ils ne sont
 *   pas sur le compte, l'archive les garde et l'import les remet.
 *
 * **L'import ne fait pas `set(migre)`** : il remet les réglages, puis le Deck par le chemin du
 * compte (`setDeck` écrit une intention `remplacer`, `synchroniserDeck` la rejoue par
 * `rejouer_deck` — ou `importer_deck` au premier passage). Tout est validé **avant** la
 * première écriture : un texte refusé laisse l'état intact.
 *
 * Les sauvegardes d'**avant** (`{ jeu, version, etat }`, le format du store) se relisent : on
 * en extrait les mêmes champs, après `migratePersisted` pour les ids renommés.
 */
import { getCard } from '@/data';
import { DECK_SIZE, deckCanAdd, deckLegal } from '@/game/deck';
import { lireCollection } from '@/lib/collection';
import { lireDeck } from '@/lib/deck';
import type { RaisonDeck } from '@/lib/deck';
import { migratePersisted, STORAGE_VERSION, useStore } from '@/store/useStore';
import type { AppState } from '@/store/useStore';

/** Le nom du jeu dans le texte exporté : une sauvegarde d'un autre jeu est refusée net. */
export const SAVE_FORMAT = 'bureau-des-planques';

/** Le numéro de l'archive. À augmenter quand sa forme change, jamais avec `STORAGE_VERSION`. */
export const ARCHIVE_VERSION = 1;

/** D'où vient une donnée de l'archive : le compte (la base) ou cet appareil (copie locale). */
export type SourceArchive = 'compte' | 'appareil';

/** Les réglages locaux : ce qui n'est pas sur le compte et que l'import remet. */
export const CLES_REGLAGES = [
  'name',
  'packsOpened',
  'reducedMotion',
  'sons',
  'combatDetaille',
  'raccourcisCombat',
  'tutorielVu',
  'pasAPasCombatVu',
  'partie',
  'derniere',
  'difficulte'
] as const;
type CleReglage = (typeof CLES_REGLAGES)[number];

export interface Archive {
  jeu: typeof SAVE_FORMAT;
  archive: number;
  creeLe: string;
  deck: { source: SourceArchive; cartes: string[]; cafeTypes: unknown[] };
  collection: { source: SourceArchive; cartes: Record<string, number> };
  reglages: Partial<Record<CleReglage, unknown>>;
}

export interface Exportation {
  texte: string;
  deck: SourceArchive;
  collection: SourceArchive;
}

/**
 * Crée l'archive. **Le compte d'abord** : la file du Deck est poussée, puis le Deck et la
 * Collection sont relus sur le compte. Un échec de réseau ne bloque pas l'export : la copie
 * de l'appareil part, étiquetée `appareil`, pour que l'écran ne promette pas plus.
 */
export async function creerSauvegarde(): Promise<Exportation> {
  const etat = useStore.getState();

  let deck = etat.deck;
  let sourceDeck: SourceArchive = 'appareil';
  if ((await etat.synchroniserDeck()) === null) {
    try {
      deck = await lireDeck();
      sourceDeck = 'compte';
    } catch {
      // Le Deck du compte n'a pas pu être relu : on garde la copie de l'appareil.
    }
  }

  let collection = etat.owned;
  let sourceCollection: SourceArchive = 'appareil';
  try {
    collection = await lireCollection();
    sourceCollection = 'compte';
  } catch {
    // Même repli : le cache de l'appareil, étiqueté comme tel.
  }

  const courant = useStore.getState();
  const reglages: Record<string, unknown> = {};
  for (const cle of CLES_REGLAGES) reglages[cle] = courant[cle];

  const archive: Archive = {
    jeu: SAVE_FORMAT,
    archive: ARCHIVE_VERSION,
    creeLe: new Date().toISOString(),
    deck: { source: sourceDeck, cartes: deck, cafeTypes: courant.cafeTypes },
    collection: { source: sourceCollection, cartes: collection },
    reglages
  };
  return { texte: JSON.stringify(archive, null, 2), deck: sourceDeck, collection: sourceCollection };
}

/** Ce que l'import a fait du Deck. */
export type SortDeck = 'restaure' | 'inchange' | 'refuse';

export type ResultatRestauration =
  | {
      ok: true;
      deck: SortDeck;
      /** Les exemplaires du Deck de l'archive écartés (carte inconnue, pas dans la Collection, plafond). */
      ecartees: number;
      /** Pourquoi le Deck n'est pas parti sur le compte (réseau, refus…), ou `null`. */
      synchro: RaisonDeck | null;
    }
  | { ok: false; raison: string };

interface Lue {
  reglages: Partial<Record<CleReglage, unknown>>;
  deck: string[];
  cafeTypes: unknown[];
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null;
}

/** Les réglages de `brut`, **présents** seulement, normalisés par `migratePersisted`. */
function lireReglages(brut: Record<string, unknown>, version: number): Partial<Record<CleReglage, unknown>> {
  const migre = migratePersisted(brut, version) as Partial<AppState>;
  const sortie: Partial<Record<CleReglage, unknown>> = {};
  for (const cle of CLES_REGLAGES) if (cle in brut) sortie[cle] = migre[cle];
  return sortie;
}

/** Lit et **valide** un texte, sans rien écrire. Rend l'archive lue ou la raison du refus. */
export function lireSauvegarde(texte: string): { ok: true; lue: Lue } | { ok: false; raison: string } {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, raison: 'Ce texte n’est pas lisible : vérifie que tu as tout copié.' };
  }
  const fichier = objet(brut);
  if (!fichier) return { ok: false, raison: 'Ce texte n’est pas une sauvegarde.' };
  if (fichier.jeu !== SAVE_FORMAT) return { ok: false, raison: 'Ce texte ne vient pas de Bureau des Planqués.' };

  // L'archive numérotée (#495).
  if ('archive' in fichier) {
    if (typeof fichier.archive !== 'number' || !Number.isInteger(fichier.archive) || fichier.archive < 1) {
      return { ok: false, raison: 'Cette sauvegarde n’indique pas sa version.' };
    }
    if (fichier.archive > ARCHIVE_VERSION) {
      return {
        ok: false,
        raison: 'Cette sauvegarde vient d’une version plus récente du jeu : recharge la page, puis réessaie.'
      };
    }
    const deck = objet(fichier.deck);
    const reglages = objet(fichier.reglages);
    if (!deck || !Array.isArray(deck.cartes) || !deck.cartes.every((id) => typeof id === 'string') || !reglages) {
      return { ok: false, raison: 'Cette sauvegarde est incomplète : le Deck ou les réglages manquent.' };
    }
    return {
      ok: true,
      lue: {
        reglages: lireReglages(reglages, STORAGE_VERSION),
        deck: migratePersisted({ deck: deck.cartes }, STORAGE_VERSION).deck ?? [],
        cafeTypes: Array.isArray(deck.cafeTypes) ? deck.cafeTypes : []
      }
    };
  }

  // L'ancien format : l'instantané du store (`{ jeu, version, etat }`).
  if (typeof fichier.version !== 'number') return { ok: false, raison: 'Cette sauvegarde n’indique pas sa version.' };
  if (fichier.version > STORAGE_VERSION) {
    return {
      ok: false,
      raison: 'Cette sauvegarde vient d’une version plus récente du jeu : recharge la page, puis réessaie.'
    };
  }
  const etat = objet(fichier.etat);
  if (!etat) return { ok: false, raison: 'Cette sauvegarde est vide.' };
  if (objet(etat.owned) === null || !Array.isArray(etat.deck)) {
    return { ok: false, raison: 'Cette sauvegarde est incomplète : la Collection ou le Deck manque.' };
  }
  const migre = migratePersisted(etat, fichier.version);
  return {
    ok: true,
    lue: {
      reglages: lireReglages(etat, fichier.version),
      deck: Array.isArray(migre.deck) ? migre.deck : [],
      cafeTypes: Array.isArray(migre.cafeTypes) ? migre.cafeTypes : []
    }
  };
}

/** Le Deck de l'archive, ramené à ce que le compte accepte : connu, possédé, sous les plafonds. */
function deckAcceptable(
  cartes: readonly string[],
  possedees: Record<string, number>
): { deck: string[]; ecartees: number } {
  const deck: string[] = [];
  const pris: Record<string, number> = {};
  for (const id of cartes) {
    if (!getCard(id) || !deckCanAdd(deck, id) || (pris[id] ?? 0) >= (possedees[id] ?? 0)) continue;
    pris[id] = (pris[id] ?? 0) + 1;
    deck.push(id);
  }
  return { deck, ecartees: cartes.length - deck.length };
}

/**
 * Restaure une sauvegarde. **Valide tout avant d'écrire.** Remet les réglages locaux, puis le
 * Deck par les opérations du compte ; **ne touche jamais à la Collection** (D-179 (3)).
 */
export async function restaurerSauvegarde(texte: string): Promise<ResultatRestauration> {
  const lecture = lireSauvegarde(texte);
  if (!lecture.ok) return lecture;
  const { reglages, deck: cartes, cafeTypes } = lecture.lue;

  // La Collection de **référence** pour le Deck : celle du compte si on peut la lire.
  let possedees = useStore.getState().owned;
  try {
    possedees = await lireCollection();
  } catch {
    // Le cache de l'appareil fait foi à défaut.
  }
  const { deck, ecartees } = deckAcceptable(cartes, possedees);
  // Un Deck complet sans Planqué Entrant serait refusé par la base (garde 0021) et resterait
  // coincé dans la file : on ne le remet pas.
  const refuse = deck.length === DECK_SIZE && !deckLegal(deck).ok;

  useStore.setState(reglages as Partial<AppState>);
  if (refuse) return { ok: true, deck: 'refuse', ecartees, synchro: null };

  const avant = useStore.getState().deck;
  const change = avant.length !== deck.length || avant.some((id, index) => id !== deck[index]);
  useStore.getState().setDeck(deck);
  useStore.getState().setCafeTypes(cafeTypes as never);
  const synchro = await useStore.getState().synchroniserDeck();
  return { ok: true, deck: change ? 'restaure' : 'inchange', ecartees, synchro };
}
