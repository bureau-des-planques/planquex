import type { Card, Faction, Rarity, Stage } from './types';
import { ALL_SSE_CARDS } from './sse';

export const ALL_CARDS: Card[] = [...ALL_SSE_CARDS];

export const CARD_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));

export const FACTION_META: Record<Faction, { name: string; short: string; color: string; glyph: string }> = {
  SSE: { name: 'SSE', short: 'SSE', color: '#1f8a68', glyph: '✚' },
  MANAGER: { name: 'Manager', short: 'MGR', color: '#d4622a', glyph: '▲' },
  HAPPINESS: { name: 'Happiness Manager', short: 'HAP', color: '#2f8fb3', glyph: '☺' },
  AMELIORATION: { name: 'Amélioration continue', short: 'AC', color: '#c9a227', glyph: '↻' },
  RH: { name: 'RH', short: 'RH', color: '#8b5fb0', glyph: '◉' },
  TECHNICIEN: { name: 'Technicien', short: 'TEC', color: '#a56a3a', glyph: '⚒' },
  DIRECTION: { name: 'Direction', short: 'DIR', color: '#5b6472', glyph: '◆' },
  SYNDICAT: { name: 'Syndicat', short: 'SYN', color: '#b34a4a', glyph: '✊' },
  INTERIMAIRE: { name: 'Intérimaire', short: 'INT', color: '#6f7fd1', glyph: '✧' },
  SUPPORT: { name: 'Service Support', short: 'SUP', color: '#4f9d9d', glyph: '⌘' }
};

export const STAGE_META: Record<Stage, { label: string; short: string; order: number }> = {
  'N+1': { label: 'N+1', short: 'N+1', order: 1 },
  'N+2': { label: 'N+2', short: 'N+2', order: 2 },
  COMEX: { label: 'COMEX', short: 'COMEX', order: 3 }
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
