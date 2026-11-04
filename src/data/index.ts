import type { ActionCard, Card, ItemKind, PlanqueCard, Rarity, RaritySymbol, Stage, Vivier } from './types';
import { ALL_ACTION_CARDS } from './actions';
import { FACTION_META } from './factions';
import { ALL_SSE_CARDS } from './sse';
import { ALL_MANAGEMENT_CARDS } from './management';
import { ALL_AMELIORATION_CARDS } from './amelioration';
import { ALL_QVT_CARDS } from './qvt';
import { ALL_RH_CARDS } from './rh';
import { ALL_ATELIER_CARDS } from './atelier';
import { ALL_DIRECTION_CARDS } from './direction';
import { ALL_INTERIM_CARDS } from './interim';
import { ALL_SUPPORT_CARDS } from './support';
import { ALL_SYNDICAT_CARDS } from './syndicat';

export const ALL_CARDS: Card[] = [
  ...ALL_SSE_CARDS,
  ...ALL_MANAGEMENT_CARDS,
  ...ALL_AMELIORATION_CARDS,
  ...ALL_QVT_CARDS,
  ...ALL_RH_CARDS,
  ...ALL_ATELIER_CARDS,
  ...ALL_DIRECTION_CARDS,
  ...ALL_INTERIM_CARDS,
  ...ALL_SUPPORT_CARDS,
  ...ALL_SYNDICAT_CARDS,
  ...ALL_ACTION_CARDS
];

/** Les 8 Collègues, 3 Objets et leurs 8 variantes du lancement (D-005), isolés pour les tests et l'UI. */
export { ALL_ACTION_CARDS };

/** Vrai pour un Planqué — le seul type qui se pose au Poste ou au Banc. */
export function isPlanque(card: Card | undefined): card is PlanqueCard {
  return card?.kind === 'PLANQUE';
}

/**
 * Vrai pour un **Planqué Entrant** : le seul qu'on peut poser au Poste, et l'unique
 * exigence légale d'un Deck (`docs/JEU.md` §4). Prédicat unique — il était recopié dans
 * le moteur, le Deck, la simulation et l'UI.
 */
export function isBasic(card: Card | undefined): card is PlanqueCard {
  return isPlanque(card) && card.stage === 'ENTRANT';
}

/** Vrai pour une carte Action (Objet ou Collègue). */
export function isActionCard(card: Card | undefined): card is ActionCard {
  return card !== undefined && card.kind !== 'PLANQUE';
}

export const CARD_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));

/**
 * L'identité des factions vit dans `./factions` : les fichiers de faction la lisent au
 * chargement, avant que ce module agrégateur n'ait fini de s'évaluer. Ré-export pour que
 * les appelants continuent d'importer `FACTION_META` depuis `@/data` (`docs/JEU.md` §3.2).
 */
export { FACTION_META };

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

/** Le `viewBox` commun des symboles de rareté (D-180) : un tracé de 24 × 24. */
export const RARITY_SYMBOL_VIEWBOX = '0 0 24 24';

/**
 * Les huit raretés (D-180) : un **nom** officiel et un **objet de bureau** qui vaut
 * symbole, de forme différente à chaque palier. Le `label` reste le libellé **compact**
 * `◆`/`★`/`♛` lu par l'UI : D-180 ne change ni le code, ni le tirage, ni l'affichage.
 */
export const RARITY_META: Record<
  Rarity,
  { name: string; label: string; symbol: RaritySymbol; color: string; order: number }
> = {
  '1D': {
    name: 'À l’essai',
    label: '◆',
    symbol: {
      name: 'badge à pince',
      path: 'M7 2l5 6 5-6 M10 8h4v3h-4z M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M9 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M13 14h4 M13 17h4'
    },
    color: '#8fa3b8',
    order: 1
  },
  '2D': {
    name: 'Titularisé',
    label: '◆◆',
    symbol: {
      name: 'clé de vestiaire',
      path: 'M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M10 7h10v4h-2v-2h-2v3h-2v-3h-4'
    },
    color: '#9fc4e8',
    order: 2
  },
  '3D': {
    name: 'Confirmé',
    label: '◆◆◆',
    symbol: {
      name: 'perforatrice',
      path: 'M3 9L19 4a1.2 1.2 0 0 1 1.6.9l.6 2a1.2 1.2 0 0 1-.8 1.5L4 13.5z M6 13v3 M17 9v7 M2 16h20v5H2z M8 18.5a1.3 1.3 0 1 0 0 .1z M16 18.5a1.3 1.3 0 1 0 0 .1z'
    },
    color: '#c9a227',
    order: 3
  },
  '4D': {
    name: 'Promu',
    label: '◆◆◆◆',
    symbol: {
      name: 'fauteuil',
      path: 'M7 2h8a1 1 0 0 1 1 1v8H6V3a1 1 0 0 1 1-1z M4 13h14v2.5H4z M19 8v5 M17 8h3 M10 15.5V19 M5 19.5h12 M5 19.5v2 M17 19.5v2'
    },
    color: '#f0c75e',
    order: 4
  },
  '1S': {
    name: 'Distingué',
    label: '★',
    symbol: {
      name: 'médaille',
      path: 'M8 3h8l-2 6h-4L8 3z M12 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 12l1 2 2 .3-1.5 1.5 .4 2-1.9-1-1.9 1 .4-2L9 14.3l2-.3 1-2z'
    },
    color: '#e8b54a',
    order: 5
  },
  '2S': {
    name: 'Inamovible',
    label: '★★',
    symbol: {
      name: 'plaque',
      path: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M7 9h10 M7 12h7 M7 15h10'
    },
    color: '#f2d27a',
    order: 6
  },
  // Haut de l'échelle (CARD-SPEC.md §1) : 3 étoiles, puis la Couronne — holo violette
  // sur le fond sombre, pour la distinguer des ors des étoiles.
  '3S': {
    name: 'Émérite',
    label: '★★★',
    symbol: {
      name: 'montre',
      path: 'M9 3h6v4H9z M9 17h6v4H9z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 9v3l2 1'
    },
    color: '#ffd76e',
    order: 7
  },
  COU: {
    name: 'Légataire',
    label: '♛',
    symbol: {
      name: 'passe-partout',
      path: 'M3 5a9 2.5 0 1 0 18 0 9 2.5 0 1 0-18 0z M6 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M6 13v8 M6 17h2 M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 13v8 M12 18h2 M18 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M18 13v8 M18 16h2'
    },
    color: '#c9a2ff',
    order: 8
  }
};

/**
 * Nature d'une carte Action, pour l'affichage (Objet / Collègue). `rule` est la règle de
 * pose du tour (`docs/JEU.md` §4) : elle est dite ici une fois, pas dans chaque écran.
 */
export const ACTION_KIND_META: Record<ActionCard['kind'], { label: string; short: string; rule: string }> = {
  OBJET: { label: 'Objet', short: 'OBJ', rule: 'Utilisable autant de fois que voulu dans le tour.' },
  COLLEAGUE: { label: 'Collègue', short: 'COL', rule: '1 par tour.' }
};

/** Catégorie d'un Objet (D-027) : matériel neuf à installer, ou pièces et outillage. */
export const ITEM_KIND_META: Record<ItemKind, { label: string; description: string }> = {
  NEUF: { label: 'NEUF', description: 'Matériel à installer' },
  MRO: { label: 'MRO', description: 'Pièces et outillage de remise en état' }
};

/**
 * Ce qu'on affiche à la place du stade : « Entrant », « Objet · MRO » ou « Collègue ».
 * Un Objet annonce sa catégorie, parce que c'est la convention de D-027.
 */
export function kindLabel(card: Card): string {
  if (isPlanque(card)) return STAGE_META[card.stage].label;
  const kind = ACTION_KIND_META[card.kind].label;
  return card.itemKind ? `${kind} · ${ITEM_KIND_META[card.itemKind].label}` : kind;
}

export function getCard(id: string): Card | undefined {
  return CARD_BY_ID.get(id);
}

export function variantOf(card: Card): Card | undefined {
  return card.variantOf ? CARD_BY_ID.get(card.variantOf) : undefined;
}
