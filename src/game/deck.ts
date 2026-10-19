import { ALL_CARDS, getCard } from '@/data';
import type { Card, Stage } from '@/data/types';

/** Règles du Classeur (AGENTS.md §4). Source unique : le moteur et l'UI s'y réfèrent. */
export const DECK_SIZE = 20;
export const MAX_COPIES_PER_NAME = 2;

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

/** Cartes réelles du classeur ; les identifiants inconnus sont écartés. */
export function deckCards(deck: string[]): Card[] {
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
    reasons.push(`Le classeur doit contenir ${DECK_SIZE} cartes (${deck.length}/${DECK_SIZE}).`);
  }
  const counts = deckCountsByName(deck);
  if (Object.values(counts).some((count) => count > MAX_COPIES_PER_NAME)) {
    reasons.push(`Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`);
  }
  const hasBasic = deckCards(deck).some((card) => card.stage === 'N+1');
  if (!hasBasic) reasons.push('Il faut au moins un Planqué N+1.');
  return { ok: reasons.length === 0, reasons };
}

export interface AutoDeck {
  deck: string[];
  /** Cartes manquantes pour atteindre 20 (0 quand le compte y est). */
  missing: number;
}

/**
 * Remplissage rapide : un classeur **légal** de 20 cartes pris dans ce qu'on possède.
 *
 * Ordre volontaire, pour que le résultat soit jouable et pas juste légal :
 * 1. les bases (N+1), une par Planqué possédé ;
 * 2. les évolutions dont la base est déjà au classeur, N+2 puis COMEX ;
 * 3. des seconds exemplaires, bases d'abord, pour compléter.
 *
 * Ne remplace pas les règles : le plafond de 2 par nom est respecté via
 * `deckCanAdd`, et le classeur est tronqué à 20 si on possède plus de bases que ça.
 */
export function autoDeck(owned: Record<string, number>): AutoDeck {
  const ownedCards = ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0);
  const byStage = (stage: Stage) =>
    ownedCards.filter((card) => card.stage === stage).sort((a, b) => a.name.localeCompare(b.name));

  const deck: string[] = [];
  /** On ne met pas plus d'exemplaires qu'on en possède, ni plus de 2 par nom. */
  const canAdd = (id: string) => deckCanAdd(deck, id) && (deckCounts(deck)[id] ?? 0) < (owned[id] ?? 0);

  for (const card of byStage('N+1')) deck.push(card.id);
  for (const stage of ['N+2', 'COMEX'] as Stage[]) {
    for (const card of byStage(stage)) {
      if (card.evolvesFrom && deck.includes(card.evolvesFrom)) deck.push(card.id);
    }
  }
  for (const card of [...byStage('N+1'), ...byStage('N+2'), ...byStage('COMEX')]) {
    if (deck.length >= DECK_SIZE) break;
    if (canAdd(card.id)) deck.push(card.id);
  }

  const trimmed = deck.slice(0, DECK_SIZE);
  return { deck: trimmed, missing: DECK_SIZE - trimmed.length };
}
