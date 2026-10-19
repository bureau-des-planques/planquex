import { getCard } from '@/data';
import type { Card } from '@/data/types';

/** Règles du Classeur (AGENTS.md §4). Source unique : le moteur et l'UI s'y réfèrent. */
export const DECK_SIZE = 20;
export const MAX_COPIES_PER_NAME = 2;

export function deckCounts(deck: string[]): Record<string, number> {
  return deck.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
}

/** Cartes réelles du classeur ; les identifiants inconnus sont écartés. */
export function deckCards(deck: string[]): Card[] {
  return deck.map((id) => getCard(id)).filter(Boolean) as Card[];
}

export function deckLegal(deck: string[]): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (deck.length !== DECK_SIZE) {
    reasons.push(`Le classeur doit contenir ${DECK_SIZE} cartes (${deck.length}/${DECK_SIZE}).`);
  }
  const counts = deckCounts(deck);
  if (Object.values(counts).some((count) => count > MAX_COPIES_PER_NAME)) {
    reasons.push(`Maximum ${MAX_COPIES_PER_NAME} exemplaires du même nom.`);
  }
  const hasBasic = deckCards(deck).some((card) => card.stage === 'N+1');
  if (!hasBasic) reasons.push('Il faut au moins un Planqué N+1.');
  return { ok: reasons.length === 0, reasons };
}
