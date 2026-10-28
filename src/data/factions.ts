import type { Faction, Vivier } from './types';

/**
 * L'identité d'une faction, déclarée **une seule fois** (`docs/JEU.md` §3.2).
 *
 * Ce module vit **au-dessus** des fichiers de faction : les dix fichiers
 * `src/data/<faction>.ts` construisent leurs cartes au chargement du module, donc
 * ils lisent ce tableau **pendant** l'évaluation de `./index`. Le porter ici plutôt
 * que dans `./index` évite un cycle `index → faction → index` qui lirait la constante
 * avant son initialisation.
 */
export interface FactionMeta {
  name: string;
  short: string;
  /** La **seule** couleur de la faction : le dégradé en est dérivé (`./planque`). */
  color: string;
  glyph: string;
  vivier: Vivier;
  /**
   * Vulnérabilité (+20, `docs/JEU.md` §3.2) : **unique** source de ce champ. Une carte
   * Planqué ne le déclare pas, elle l'hérite de sa faction. `null` = aucune, comme
   * l'Intérim.
   */
  weakness: Faction | null;
}

/**
 * Une faction = un service ou un collectif (D-024), et **un vivier** — les trois zones du
 * site : l'Atelier, l'Étage, les Bureaux (D-026). Le vivier est porté par la **faction** et
 * non par la carte : dix valeurs au lieu d'une par carte, et une carte ne peut pas se
 * retrouver dans deux zones à la fois.
 */
export const FACTION_META: Record<Faction, FactionMeta> = {
  SSE: { name: 'SSE', short: 'SSE', color: '#1f8a68', glyph: '✚', vivier: 'BUREAUX', weakness: 'MANAGEMENT' },
  MANAGEMENT: {
    name: 'Management',
    short: 'MGT',
    color: '#d4622a',
    glyph: '▲',
    vivier: 'ATELIER',
    weakness: 'QVT'
  },
  QVT: { name: 'QVT', short: 'QVT', color: '#2f8fb3', glyph: '☺', vivier: 'BUREAUX', weakness: 'AMELIORATION' },
  AMELIORATION: {
    name: 'Amélioration continue',
    short: 'AC',
    color: '#c9a227',
    glyph: '↻',
    vivier: 'ETAGE',
    weakness: 'ATELIER'
  },
  RH: { name: 'RH', short: 'RH', color: '#8b5fb0', glyph: '◉', vivier: 'BUREAUX', weakness: 'DIRECTION' },
  ATELIER: { name: 'Atelier', short: 'ATL', color: '#a56a3a', glyph: '⚒', vivier: 'ATELIER', weakness: 'RH' },
  DIRECTION: { name: 'Direction', short: 'DIR', color: '#5b6472', glyph: '◆', vivier: 'ETAGE', weakness: 'ATELIER' },
  SYNDICAT: { name: 'Syndicat', short: 'SYN', color: '#b34a4a', glyph: '✊', vivier: 'ATELIER', weakness: 'MANAGEMENT' },
  INTERIM: { name: 'Intérim', short: 'INT', color: '#6f7fd1', glyph: '✧', vivier: 'BUREAUX', weakness: null },
  SUPPORT: { name: 'Support', short: 'SUP', color: '#4f9d9d', glyph: '⌘', vivier: 'ETAGE', weakness: 'ATELIER' }
};
