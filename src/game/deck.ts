import { ALL_CARDS, FACTION_META, getCard, isBasic, isPlanque } from '@/data';
import type { Card, CafeType, Faction, Stage } from '@/data/types';

/** Règles du Deck (docs/JEU.md §4). Source unique : le moteur et l'UI s'y réfèrent. */
export const DECK_SIZE = 20;
export const MAX_COPIES_PER_NAME = 2;

/**
 * Plafond de types de café d'un Deck (**1 à 3**, D-034/D-037 (4)) : la Machine ne
 * tire un café que dans ces types.
 */
export const MAX_DECK_CAFE_TYPES = 3;

/**
 * Les factions qui peuvent être un **type de café** (D-034) : toutes sauf `SUPPORT`
 * (Incolore) et `INTERIM` (Dragon), que la Machine ne produit jamais. Source unique de
 * ce qu'un Deck peut **proposer ou accepter** (#91) : `FACTION_META` tient
 * l'identité des dix factions, ce tableau n'en retire que les deux non produites.
 */
export const CAFE_FACTIONS: readonly CafeType[] = (Object.keys(FACTION_META) as Faction[]).filter(
  (faction) => faction !== 'SUPPORT' && faction !== 'INTERIM'
) as CafeType[];

/** Vrai pour une faction qui peut être un type de café (`CAFE_FACTIONS`). */
export function isCafeType(type: unknown): type is CafeType {
  return typeof type === 'string' && (CAFE_FACTIONS as readonly string[]).includes(type);
}

/**
 * **Normalise un choix de types de café** (#91, D-037 (4)) : ne garde que les factions
 * productrices, dédoublonne, plafonne à `MAX_DECK_CAFE_TYPES`. `SUPPORT` et `INTERIM`
 * sont écartés **même s'ils viennent d'un état trafiqué** — la Machine ne les produit
 * jamais (D-034). Une liste vide signifie « proposition automatique ».
 */
export function normalizeCafeTypes(types: unknown): CafeType[] {
  // `Array.isArray` et **non** `types ?? []` : un `localStorage` modifié à la main peut
  // porter un nombre ou un objet, qu'une boucle `for…of` refuse en levant une
  // `TypeError` — **pendant la migration**, donc au chargement de l'application
  // (relecture lourde de #91, Sonnet 5.5). On rend `[]` : la proposition automatique.
  if (!Array.isArray(types)) return [];
  const kept: CafeType[] = [];
  for (const type of types) {
    if (!isCafeType(type) || kept.includes(type)) continue;
    kept.push(type);
    if (kept.length >= MAX_DECK_CAFE_TYPES) break;
  }
  return kept;
}

/**
 * Les **types de café qu'un Deck peut produire** (D-037 (4)), dérivés des factions
 * de ses Planqués : l'union des factions présentes, **plafonnée à 3**, dans l'ordre du
 * Deck. `SUPPORT` (Incolore) et `INTERIM` (Dragon) n'en sont **jamais** : la Machine
 * ne produit pas ces types (D-034).
 *
 * C'est la **proposition automatique** : le joueur peut la remplacer par un choix
 * manuel de 1 à 3 types (`resolveCafeTypes`), persisté avec son Deck (#91).
 */
export function deckCafeTypes(deck: readonly string[]): CafeType[] {
  const types: CafeType[] = [];
  for (const card of deckCards(deck)) {
    if (!isPlanque(card)) continue;
    if (!isCafeType(card.faction)) continue;
    if (!types.includes(card.faction)) types.push(card.faction);
    if (types.length >= MAX_DECK_CAFE_TYPES) break;
  }
  return types;
}

/**
 * Les types **effectifs** d'un Deck : le choix validé s'il existe, sinon la
 * proposition automatique. C'est le seul chemin par lequel le moteur et l'écran
 * lisent la liste (#91) — un état trafiqué ne peut donc pas faire produire `SUPPORT`
 * ni `INTERIM` à la Machine, ni dépasser 3 types.
 */
export function resolveCafeTypes(deck: readonly string[], chosen?: readonly unknown[] | null): CafeType[] {
  const choice = normalizeCafeTypes(chosen);
  return choice.length > 0 ? choice : deckCafeTypes(deck);
}

/** Nombre d'exemplaires par **identifiant** de carte (affichage). */
export function deckCounts(deck: string[]): Record<string, number> {
  return deck.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Nombre d'exemplaires par **nom** : §4 dit « max 2 exemplaires du même nom », et
 * une variante (`-star`, `-star2`) partage le nom de sa carte de base. Compter par
 * identifiant laissait passer 2 exemplaires + 2 variantes du même Planqué.
 */
export function deckCountsByName(deck: string[]): Record<string, number> {
  return deck.reduce<Record<string, number>>((acc, id) => {
    const name = getCard(id)?.name ?? id;
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
}

/** Cartes réelles du Deck ; les identifiants inconnus sont écartés. */
export function deckCards(deck: readonly string[]): Card[] {
  return deck.map((id) => getCard(id)).filter(Boolean) as Card[];
}

/** Peut-on encore ajouter cette carte ? (taille, carte connue, plafond par nom). */
export function deckCanAdd(deck: string[], cardId: string): boolean {
  if (deck.length >= DECK_SIZE) return false;
  const card = getCard(cardId);
  if (!card) return false;
  return (deckCountsByName(deck)[card.name] ?? 0) < MAX_COPIES_PER_NAME;
}

export function deckLegal(deck: string[]): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (deck.length !== DECK_SIZE) {
    reasons.push(`Le Deck doit contenir ${DECK_SIZE} cartes (${deck.length}/${DECK_SIZE}).`);
  }
  const counts = deckCountsByName(deck);
  if (Object.values(counts).some((count) => count > MAX_COPIES_PER_NAME)) {
    reasons.push(`Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`);
  }
  const hasBasic = deckCards(deck).some(isBasic);
  if (!hasBasic) reasons.push('Il faut au moins un Planqué Entrant.');
  return { ok: reasons.length === 0, reasons };
}

export interface AutoDeck {
  deck: string[];
  /** Cartes manquantes pour atteindre 20 (0 quand le compte y est). */
  missing: number;
}

/**
 * Remplissage rapide : un deck **légal** de 20 cartes pris dans ce qu'on possède.
 *
 * Ordre volontaire, pour que le résultat soit jouable et pas juste légal :
 * 1. les bases (N+1), une par Planqué possédé ;
 * 2. les évolutions dont la base est déjà au Deck, N+1 puis N+2 ;
 * 3. des seconds exemplaires, bases d'abord, pour compléter.
 *
 * Ne remplace pas les règles : le plafond de 2 par nom est respecté via
 * `deckCanAdd`, et le Deck est tronqué à 20 si on possède plus de bases que ça.
 */
export function autoDeck(owned: Record<string, number>): AutoDeck {
  const ownedCards = ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0);
  const byStage = (stage: Stage) =>
    ownedCards
      .filter(isPlanque)
      .filter((card) => card.stage === stage)
      .sort((a, b) => a.name.localeCompare(b.name));

  const deck: string[] = [];
  /** On ne met pas plus d'exemplaires qu'on en possède, ni plus de 2 par nom. */
  const canAdd = (id: string) => deckCanAdd(deck, id) && (deckCounts(deck)[id] ?? 0) < (owned[id] ?? 0);

  // 1. les entrantes, 2. les évolutions dont la base est déjà au Deck, 3. les seconds exemplaires
  for (const card of byStage('ENTRANT')) deck.push(card.id);
  for (const stage of ['N+1', 'N+2'] as Stage[]) {
    for (const card of byStage(stage)) {
      if (card.evolvesFrom && deck.includes(card.evolvesFrom)) deck.push(card.id);
    }
  }
  for (const card of [...byStage('ENTRANT'), ...byStage('N+1'), ...byStage('N+2')]) {
    if (deck.length >= DECK_SIZE) break;
    if (canAdd(card.id)) deck.push(card.id);
  }

  const trimmed = deck.slice(0, DECK_SIZE);
  return { deck: trimmed, missing: DECK_SIZE - trimmed.length };
}
