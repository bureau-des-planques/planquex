import { getCard } from '@/data';
import type { BattleAction, CafeType } from '@/data/types';
import { deckLegal, isCafeType, MAX_DECK_CAFE_TYPES } from '@/game/deck';
import { rejouer } from '@/game/rejeu';

/**
 * **Codec de partie** — ticket #124 (PvP par code, D-049).
 *
 * Le PvP de la beta échange **un code** plutôt que des actions en temps réel : la partie
 * est déterministe et journalisée (#29, #83), donc « graine + deux Decks + types de
 * café + journal des actions » suffit à la reconstruire (`replayBattle`). Ce module est
 * **pur** : ni React, ni store, ni réseau — et il n'ajoute aucune couture au moteur.
 *
 * ## La forme du code
 *
 * ```text
 * PLQ1.<empreinte>.<charge utile base64url>
 *  └┬─┘ └────┬───┘ └──────────┬──────────┘
 *   │        │                └─ JSON compact, encodé en base64url (sans `=`)
 *   │        └─ 7 caractères base36 : l'empreinte FNV-1a de la charge utile **texte**
 *   └─ préfixe de format : PLQ + version du format
 * ```
 *
 * Trois points, et chacun a sa raison :
 *
 * 1. **Le préfixe rend le code lisible au début** (`PLQ1`) : un code d'une version future
 *    est **refusé** au lieu d'être mal interprété.
 * 2. **L'empreinte porte sur la charge utile texte, pas sur les octets décodés.** Une
 *    altération d'un caractère du base64 change le texte ; sans cette empreinte, elle
 *    pourrait produire un JSON **toujours valide** dont un champ a changé, et on rejouerait
 *    une autre partie en silence — la classe de faux garde-fou que #112 traque.
 * 3. **base64url sans `=`, séparateurs `.`** : le code passe tel quel par un message, un
 *    champ de formulaire ou, plus tard, un QR — aucun caractère à échapper.
 *
 * ## Les refus
 *
 * `decodeMatch` ne lève jamais : il rend `{ ok: false, kind, raison }` avec une raison
 * **en français, affichable**. Il ne touche aucun `BattleState` — un refus ne mute donc
 * rien, comme une action refusée par `applyAction`. Il valide les Decks (`deckLegal`)
 * **avant** de rejouer : un code forgé ne fait pas lever `createBattle`.
 */

/** Tout ce que `replayBattle` redemande pour reconstruire une partie (ticket #83). */
export interface MatchCode {
  /** Graine d'origine de la partie (celle de `createBattle`, pas `rng`). */
  seed: number;
  playerDeck: string[];
  aiDeck: string[];
  /** Types de café **effectifs** du Deck (`BattleState.players[who].cafeTypes`). */
  playerCafeTypes: CafeType[];
  aiCafeTypes: CafeType[];
  /** Journal des actions **appliquées** (`BattleState.actionLog`). */
  actions: BattleAction[];
}

/** Pourquoi un code a été refusé. Chaque valeur a **son** message (critère du #124). */
export type RefusalKind =
  | 'vide'
  | 'pas-un-code'
  | 'version-inconnue'
  | 'forme'
  | 'integrite'
  | 'base64'
  | 'json'
  | 'charge'
  | 'deck'
  | 'cafe'
  | 'rejeu';

export interface Refusal {
  ok: false;
  kind: RefusalKind;
  /** Phrase française, affichable telle quelle (vocabulaire d'`AGENTS.md` §3). */
  raison: string;
}

export type DecodeResult = { ok: true; match: MatchCode } | Refusal;

/** `PLQ` : le format. Toute chaîne qui ne commence pas par là n'est pas un code. */
export const CODEC_PREFIX = 'PLQ';

/** Version du **format** (pas du jeu) : elle change si la charge utile change de forme. */
export const CODEC_VERSION = '1';

/** L'empreinte fait toujours 7 caractères base36 (`padStart`), donc une place fixe. */
const CHECKSUM_LENGTH = 7;

const CHECKSUM_SHAPE = /^[0-9a-z]{7}$/;
const VERSION_SHAPE = /^[0-9A-Za-z]+$/;
const BASE64URL_SHAPE = /^[A-Za-z0-9_-]+$/;
const UID_SHAPE = /^[A-Za-z0-9_-]{1,16}$/;

/** `playBasic` sur le Poste : `-1` dans le code, `'active'` dans le moteur. */
const ACTIVE_SLOT = -1;

/** Étiquettes numériques des actions : compactes, et **exhaustives** (voir `wireAction`). */
const ACTION_TAGS = {
  playBasic: 1,
  evolve: 2,
  attachEnergy: 3,
  retreat: 4,
  attack: 5,
  ability: 6,
  priorityShift: 7,
  playAction: 8,
  promoteActive: 9,
  forfeit: 10,
  endTurn: 11,
  choose: 12
} as const;

/** Une action sur le fil : `[étiquette, …arguments]`. `string | number` seulement. */
type WireAction = Array<string | number>;

/** La charge utile, en clair. Clés d'une lettre : le code doit rester court. */
interface WireMatch {
  /** graine */
  s: number;
  /** Decks : `[Toi, la Direction]` */
  d: [string[], string[]];
  /** types de café : `[Toi, la Direction]` (vide = proposition automatique) */
  c: [string[], string[]];
  /** journal des actions */
  a: WireAction[];
}

/* ------------------------------------------------------------------ */
/* Empreinte et base64url                                              */
/* ------------------------------------------------------------------ */

/**
 * **Empreinte courte** d'une charge utile : FNV-1a 32 bits, écrite en base36 sur 7
 * caractères. Elle se calcule sur le **texte** base64url, pas sur les octets décodés :
 * c'est ce qui fait qu'une altération d'un caractère est **toujours vue**, y compris
 * quand les derniers bits de remplissage d'un base64 se recouvrent.
 *
 * Ce n'est pas une signature : elle attrape une **altération accidentelle** (copie
 * tronquée, caractère abîmé), pas un adversaire qui recalcule l'empreinte — l'anti-triche
 * est un autre sujet (D-049 le dit franchement).
 */
export function codeFingerprint(payload: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash = Math.imul(hash ^ payload.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(CHECKSUM_LENGTH, '0');
}

const texto = new TextEncoder();
const untexto = new TextDecoder('utf-8', { fatal: true });

/**
 * Le code scellé d'une charge utile **déjà encodée**. Séparé de `encodeMatch` parce que
 * c'est **la** définition du format (préfixe, empreinte, charge utile) : les tests forgent
 * ainsi des codes à empreinte **valide** pour éprouver les refus d'un autre étage.
 */
export function sealCode(payload: string): string {
  return `${CODEC_PREFIX}${CODEC_VERSION}.${codeFingerprint(payload)}.${payload}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] as number);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * `null` si le texte n'est pas du base64url **canonique** : alphabet, longueur possible,
 * et ré-encodage identique (sinon deux écritures du même octet passeraient pour deux
 * codes).
 */
function fromBase64Url(payload: string): Uint8Array | null {
  if (!BASE64URL_SHAPE.test(payload) || payload.length % 4 === 1) return null;
  const standard = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return toBase64Url(bytes) === payload ? bytes : null;
}

/* ------------------------------------------------------------------ */
/* Encodage                                                            */
/* ------------------------------------------------------------------ */

function notAnAction(value: never): never {
  throw new Error(`Action non encodable : ${String(value)}`);
}

/** Une action du moteur → sa forme de fil. Le `switch` exhaustif : une action de plus casse `tsc`. */
function wireAction(action: BattleAction): WireAction {
  switch (action.type) {
    case 'playBasic':
      return [ACTION_TAGS.playBasic, action.uid, action.slot === 'active' ? ACTIVE_SLOT : action.slot];
    case 'evolve':
      return [ACTION_TAGS.evolve, action.uid, action.targetUid];
    case 'attachEnergy':
      return [ACTION_TAGS.attachEnergy, action.targetUid];
    case 'retreat':
      return [ACTION_TAGS.retreat, action.benchIndex];
    case 'attack':
      return [ACTION_TAGS.attack, action.attackIndex];
    case 'ability':
      return [ACTION_TAGS.ability];
    case 'priorityShift':
      return [ACTION_TAGS.priorityShift, action.uid];
    case 'playAction':
      return [ACTION_TAGS.playAction, action.uid];
    case 'promoteActive':
      return [ACTION_TAGS.promoteActive, action.benchIndex];
    case 'forfeit':
      return [ACTION_TAGS.forfeit, action.who === 'player' ? 0 : 1];
    case 'choose':
      return [ACTION_TAGS.choose, action.uid];
    case 'endTurn':
      return [ACTION_TAGS.endTurn];
    default:
      return notAnAction(action);
  }
}

/**
 * Un match → un code. **Total** : il encode ce qu'on lui donne, sans juger — c'est
 * `decodeMatch` qui valide (Decks, types de café, rejeu). Les tests s'appuient sur ce
 * partage pour **forger** des codes à empreinte valide et vérifier que le refus vient du
 * bon étage.
 */
export function encodeMatch(match: MatchCode): string {
  const wire: WireMatch = {
    s: match.seed,
    d: [match.playerDeck, match.aiDeck],
    c: [match.playerCafeTypes, match.aiCafeTypes],
    a: match.actions.map(wireAction)
  };
  return sealCode(toBase64Url(texto.encode(JSON.stringify(wire))));
}

/* ------------------------------------------------------------------ */
/* Décodage                                                            */
/* ------------------------------------------------------------------ */

function refus(kind: RefusalKind, raison: string): Refusal {
  return { ok: false, kind, raison };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUid(value: unknown): string | null {
  return typeof value === 'string' && UID_SHAPE.test(value) ? value : null;
}

/** Un entier dans `[0, max]` — index de Banc, de Pression, de relève. */
function readIndex(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

/**
 * Une action de fil → l'action du moteur, ou `null` si la forme ne s'y prête pas.
 *
 * Le décodeur est **strict** sur l'arité : une action de plus dans le tableau est un
 * refus, pas un champ ignoré — un code forgé ne doit pas passer pour un code valide.
 */
function readAction(raw: unknown): BattleAction | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const [tag, ...args] = raw;
  switch (tag) {
    case ACTION_TAGS.playBasic: {
      if (args.length !== 2) return null;
      const uid = readUid(args[0]);
      if (uid === null) return null;
      if (args[1] === ACTIVE_SLOT) return { type: 'playBasic', uid, slot: 'active' };
      const bench = readIndex(args[1], 2);
      return bench === null ? null : { type: 'playBasic', uid, slot: bench };
    }
    case ACTION_TAGS.evolve: {
      if (args.length !== 2) return null;
      const uid = readUid(args[0]);
      const targetUid = readUid(args[1]);
      return uid === null || targetUid === null ? null : { type: 'evolve', uid, targetUid };
    }
    case ACTION_TAGS.attachEnergy: {
      if (args.length !== 1) return null;
      const targetUid = readUid(args[0]);
      return targetUid === null ? null : { type: 'attachEnergy', targetUid };
    }
    case ACTION_TAGS.retreat: {
      if (args.length !== 1) return null;
      const benchIndex = readIndex(args[0], 2);
      return benchIndex === null ? null : { type: 'retreat', benchIndex };
    }
    case ACTION_TAGS.attack: {
      if (args.length !== 1) return null;
      const attackIndex = readIndex(args[0], 9);
      return attackIndex === null ? null : { type: 'attack', attackIndex };
    }
    case ACTION_TAGS.ability:
      return args.length === 0 ? { type: 'ability' } : null;
    case ACTION_TAGS.priorityShift: {
      if (args.length !== 1) return null;
      const uid = readUid(args[0]);
      return uid === null ? null : { type: 'priorityShift', uid };
    }
    case ACTION_TAGS.playAction: {
      if (args.length !== 1) return null;
      const uid = readUid(args[0]);
      return uid === null ? null : { type: 'playAction', uid };
    }
    case ACTION_TAGS.promoteActive: {
      if (args.length !== 1) return null;
      const benchIndex = readIndex(args[0], 2);
      return benchIndex === null ? null : { type: 'promoteActive', benchIndex };
    }
    case ACTION_TAGS.forfeit: {
      if (args.length !== 1 || (args[0] !== 0 && args[0] !== 1)) return null;
      return { type: 'forfeit', who: args[0] === 0 ? 'player' : 'ai' };
    }
    case ACTION_TAGS.choose: {
      if (args.length !== 1) return null;
      const uid = readUid(args[0]);
      return uid === null ? null : { type: 'choose', uid };
    }
    case ACTION_TAGS.endTurn:
      return args.length === 0 ? { type: 'endTurn' } : null;
    default:
      return null;
  }
}

function readStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    list.push(item);
  }
  return list;
}

/**
 * Un `CafeType[]` **tel qu'il a été écrit** : factions productrices, sans doublon, 3 au
 * plus (D-034/D-037). Une liste vide est valide — c'est la proposition automatique du
 * Deck. On refuse plutôt que de normaliser : normaliser en silence changerait la
 * partie rejouée sans le dire.
 */
function readCafeTypes(value: unknown): CafeType[] | null {
  const list = readStringList(value);
  if (list === null) return null;
  if (list.length > MAX_DECK_CAFE_TYPES) return null;
  const types: CafeType[] = [];
  for (const type of list) {
    if (!isCafeType(type) || types.includes(type)) return null;
    types.push(type);
  }
  return types;
}

/** Le Deck doit être **légal** (D-022/§4) *et* ne contenir que des cartes connues. */
function readDeck(value: unknown, who: string): { deck: string[] } | Refusal {
  const deck = readStringList(value);
  if (deck === null) return refus('deck', `Deck illégal (${who}) : ce n’est pas une liste d’identifiants.`);
  const unknown = deck.find((id) => !getCard(id));
  if (unknown !== undefined) {
    return refus('deck', `Deck illégal (${who}) : la carte « ${unknown} » n’existe pas.`);
  }
  const { ok, reasons } = deckLegal(deck);
  if (!ok) return refus('deck', `Deck illégal (${who}) : ${reasons.join(' ')}`);
  return { deck };
}

/**
 * Un code → un match, ou un **refus motivé**. Ne lève jamais, ne mute rien.
 *
 * L'ordre des contrôles est celui des raisons : préfixe, version, forme, **empreinte**,
 * base64, JSON, charge, Decks, types de café, puis **rejeu**. L'empreinte passe avant
 * le décodage : c'est elle qui empêche une altération de produire une autre partie
 * silencieusement valide.
 */
export function decodeMatch(code: string): DecodeResult {
  if (typeof code !== 'string') return refus('pas-un-code', 'Ce texte n’est pas un code de partie.');
  // Le code voyage par message : les espaces et retours à la ligne autour ne comptent pas.
  const trimmed = code.trim();
  if (trimmed === '') return refus('vide', 'Aucun code : le champ est vide.');

  if (!trimmed.startsWith(CODEC_PREFIX)) {
    return refus('pas-un-code', 'Ce texte n’est pas un code de partie : il ne commence pas par « PLQ ».');
  }

  const firstDot = trimmed.indexOf('.');
  if (firstDot < 0) {
    return refus('forme', 'Le code est mal formé : il manque son empreinte et sa charge utile.');
  }
  const header = trimmed.slice(0, firstDot);
  const version = header.slice(CODEC_PREFIX.length);
  if (!VERSION_SHAPE.test(version)) {
    return refus('forme', 'Le code est mal formé : sa version est illisible.');
  }
  if (version !== CODEC_VERSION) {
    return refus('version-inconnue', `Code d’une version inconnue (« ${header} ») : ce jeu ne sait pas le lire.`);
  }

  const reste = trimmed.slice(firstDot + 1);
  const secondDot = reste.indexOf('.');
  if (secondDot < 0) {
    return refus('forme', 'Le code est mal formé : il manque sa charge utile.');
  }
  const checksum = reste.slice(0, secondDot);
  const payload = reste.slice(secondDot + 1);
  if (!CHECKSUM_SHAPE.test(checksum) || payload === '') {
    return refus('forme', 'Le code est mal formé : son empreinte ou sa charge utile est incomplète.');
  }

  if (codeFingerprint(payload) !== checksum) {
    return refus(
      'integrite',
      'Le code est abîmé : son empreinte ne correspond pas à sa charge utile. Il a été tronqué ou modifié en chemin.'
    );
  }

  const bytes = fromBase64Url(payload);
  if (bytes === null) {
    return refus('base64', 'La charge utile du code est illisible : son base64 est tronqué ou abîmé.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(untexto.decode(bytes));
  } catch {
    return refus('json', 'La charge utile du code n’est pas du JSON lisible.');
  }

  if (!isRecord(raw)) {
    return refus('charge', 'Ce JSON n’est pas une partie de ce jeu : les champs attendus manquent.');
  }
  const { s, d, c, a } = raw;
  if (!Number.isSafeInteger(s)) {
    return refus('charge', 'Ce JSON n’est pas une partie de ce jeu : la graine manque.');
  }
  if (!Array.isArray(d) || d.length !== 2 || !Array.isArray(c) || c.length !== 2) {
    return refus('charge', 'Ce JSON n’est pas une partie de ce jeu : les deux Decks manquent.');
  }
  if (!Array.isArray(a)) {
    return refus('charge', 'Ce JSON n’est pas une partie de ce jeu : le journal des actions manque.');
  }

  const player = readDeck(d[0], 'Toi');
  if ('ok' in player) return player;
  const ai = readDeck(d[1], 'la Direction');
  if ('ok' in ai) return ai;

  const playerCafeTypes = readCafeTypes(c[0]);
  const aiCafeTypes = readCafeTypes(c[1]);
  if (playerCafeTypes === null || aiCafeTypes === null) {
    return refus('cafe', 'Types de café illégaux : il faut au plus trois factions productrices, sans doublon (D-034).');
  }

  const actions: BattleAction[] = [];
  for (let index = 0; index < a.length; index += 1) {
    const action = readAction(a[index]);
    if (action === null) {
      return refus('charge', `Le journal du code contient une action illisible (position ${index + 1}).`);
    }
    actions.push(action);
  }

  // Les Decks sont légaux, les cartes connues : `rejouer` ne devrait plus refuser. Il le
  // fait quand même proprement — et c'est **lui** qui compare les journaux (#249), plus
  // ce module : un code partagé et une partie reprise posent la même question.
  const rejeu = rejouer({
    seed: s as number,
    playerDeck: player.deck,
    aiDeck: ai.deck,
    playerCafeTypes,
    aiCafeTypes,
    actions
  });
  if (!rejeu.ok) {
    return refus(
      'rejeu',
      rejeu.raison === 'deck-illegal'
        ? 'Le code ne rejoue pas : le moteur a refusé de reconstruire la partie.'
        : 'Le code ne rejoue pas : son journal contient une action que le moteur refuse.'
    );
  }

  return {
    ok: true,
    match: {
      seed: s as number,
      playerDeck: player.deck,
      aiDeck: ai.deck,
      playerCafeTypes,
      aiCafeTypes,
      actions
    }
  };
}
