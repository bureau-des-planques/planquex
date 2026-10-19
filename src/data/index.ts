import type { Card, Faction, Rarity, Stage, Vivier } from './types';
import { ALL_MANAGEMENT_CARDS } from './management';
import { ALL_SSE_CARDS } from './sse';

export const ALL_CARDS: Card[] = [...ALL_SSE_CARDS, ...ALL_MANAGEMENT_CARDS];

export const CARD_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));

/**
 * Une faction = un service ou un collectif (D-024), et **un vivier** — les trois zones du
 * site : l'Atelier, l'Étage, les Bureaux (D-026). Le vivier est porté par la **faction** et
 * non par la carte : dix valeurs au lieu de 286, et une carte ne peut pas se retrouver dans
 * deux zones à la fois.
 */
export const FACTION_META: Record<
  Faction,
  { name: string; short: string; color: string; glyph: string; vivier: Vivier }
> = {
  SSE: { name: 'SSE', short: 'SSE', color: '#1f8a68', glyph: '✚', vivier: 'BUREAUX' },
  MANAGEMENT: { name: 'Management', short: 'MGT', color: '#d4622a', glyph: '▲', vivier: 'ATELIER' },
  QVT: { name: 'QVT', short: 'QVT', color: '#2f8fb3', glyph: '☺', vivier: 'BUREAUX' },
  AMELIORATION: { name: 'Amélioration continue', short: 'AC', color: '#c9a227', glyph: '↻', vivier: 'ETAGE' },
  RH: { name: 'RH', short: 'RH', color: '#8b5fb0', glyph: '◉', vivier: 'BUREAUX' },
  ATELIER: { name: 'Atelier', short: 'ATL', color: '#a56a3a', glyph: '⚒', vivier: 'ATELIER' },
  DIRECTION: { name: 'Direction', short: 'DIR', color: '#5b6472', glyph: '◆', vivier: 'ETAGE' },
  SYNDICAT: { name: 'Syndicat', short: 'SYN', color: '#b34a4a', glyph: '✊', vivier: 'ATELIER' },
  INTERIM: { name: 'Intérim', short: 'INT', color: '#6f7fd1', glyph: '✧', vivier: 'BUREAUX' },
  SUPPORT: { name: 'Support', short: 'SUP', color: '#4f9d9d', glyph: '⌘', vivier: 'ETAGE' }
};

/** Les trois zones du site (D-026). Un futur vivier sera un lieu lui aussi. */
export const VIVIER_META: Record<Vivier, { label: string; order: number }> = {
  ATELIER: { label: 'Atelier', order: 1 },
  ETAGE: { label: 'Étage', order: 2 },
  BUREAUX: { label: 'Bureaux', order: 3 }
};

/** Dans quel vivier ranger cette carte. */
export function vivierOf(card: Card): Vivier {
  return FACTION_META[card.faction].vivier;
}

/** Entrant → N+1 → N+2. Le **COMEX** n'est pas un stade : c'est le statut des ex (D-026). */
export const STAGE_META: Record<Stage, { label: string; short: string; order: number }> = {
  ENTRANT: { label: 'Entrant', short: 'ENT', order: 1 },
  'N+1': { label: 'N+1', short: 'N+1', order: 2 },
  'N+2': { label: 'N+2', short: 'N+2', order: 3 }
};

export const RARITY_META: Record<Rarity, { label: string; color: string; order: number }> = {
  '1D': { label: '◆', color: '#8fa3b8', order: 1 },
  '2D': { label: '◆◆', color: '#9fc4e8', order: 2 },
  '3D': { label: '◆◆◆', color: '#c9a227', order: 3 },
  '4D': { label: '◆◆◆◆', color: '#f0c75e', order: 4 },
  '1S': { label: '★', color: '#e8b54a', order: 5 },
  '2S': { label: '★★', color: '#f2d27a', order: 6 }
};

export const SSE_ONLY = ALL_CARDS.filter((card) => card.faction === 'SSE');

export function getCard(id: string): Card | undefined {
  return CARD_BY_ID.get(id);
}

export function isVariant(card: Card): boolean {
  return Boolean(card.variantOf);
}

export function baseCards(): Card[] {
  return ALL_CARDS.filter((card) => !card.variantOf);
}

export function variantOf(card: Card): Card | undefined {
  return card.variantOf ? CARD_BY_ID.get(card.variantOf) : undefined;
}
