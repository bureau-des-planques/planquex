export type Faction =
  | 'SSE'
  | 'MANAGEMENT'
  | 'QVT'
  | 'AMELIORATION'
  | 'RH'
  | 'ATELIER'
  | 'DIRECTION'
  | 'SYNDICAT'
  | 'INTERIM'
  | 'SUPPORT';

/** Les trois zones du site (D-026). Un futur vivier sera un lieu lui aussi. */
export type Vivier = 'ATELIER' | 'ETAGE' | 'BUREAUX';

/**
 * Stades : **Entrant → N+1 → N+2**. Le **COMEX** n'est pas un stade : c'est le **statut**
 * des ex (`ex: true`, 2 Interventions), affiché *avec* le stade — un ex peut exister à
 * n'importe quel stade, comme dans le jeu de base. Voir D-024, D-026.
 */
export type Stage = 'ENTRANT' | 'N+1' | 'N+2';

export type Rarity = '1D' | '2D' | '3D' | '4D' | '1S' | '2S';

export type Status = 'SURCHARGE' | 'EPUISEMENT' | 'SIESTE' | 'IMMOBILISATION' | 'DERIVE';

export type AttackEffectKind =
  | 'healSelf'
  | 'healAll'
  | 'status'
  | 'draw'
  | 'discardEnergy'
  | 'selfDamage'
  | 'switchSelf'
  | 'reduceDamage';

export interface AttackEffect {
  kind: AttackEffectKind;
  amount?: number;
  status?: Status;
  target?: 'self' | 'opponent';
}

/**
 * Mots-clés maison portés par les cartes. C'est la **seule** exception au miroir
 * de Pocket (D-004) : aucun autre mot-clé ne doit être ajouté ici sans décision.
 */
export type Keyword = 'priorityShift';

export interface Attack {
  name: string;
  cost: number;
  damage: number;
  text?: string;
  effects?: AttackEffect[];
}

export interface Ability {
  name: string;
  text: string;
  kind: 'heal' | 'draw' | 'attachEnergy' | 'reduceDamage' | 'antiStatus';
  amount?: number;
  oncePerTurn?: boolean;
}

/**
 * Nature de la carte. Un **Planqué** se pose au Poste ou au Rack ; une **carte Action**
 * se joue depuis la main puis part au Rebut : **Objet** (illimité par tour) ou
 * **Collègue** (1 par tour) — `AGENTS.md` §4.
 */
export type CardKind = 'PLANQUE' | 'OBJET' | 'COLLEAGUE';

/** Un Objet est **NEUF** (matériel à installer) ou **MRO** (pièces et outillage), D-027. */
export type ItemKind = 'NEUF' | 'MRO';

interface CardBase {
  id: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  flavor: string;
  glyph: string;
  palette: string;
}

/** Un Planqué : la carte qui se bat. Seul type à porter un Seuil et des Pressions. */
export interface PlanqueCard extends CardBase {
  kind: 'PLANQUE';
  stage: Stage;
  hp: number;
  retreat: number;
  weakness: Faction | null;
  attacks: Attack[];
  ability?: Ability;
  ex?: boolean;
  variantOf?: string;
  evolvesFrom?: string;
  keywords?: Keyword[];
}

/**
 * Une carte Action. Les effets réutilisent les primitives d'attaque (`AttackEffect`) :
 * aucune primitive maison n'est ajoutée (`AGENTS.md` §5).
 */
export interface ActionCard extends CardBase {
  kind: 'OBJET' | 'COLLEAGUE';
  /** Texte de l'effet, affiché sur la carte. */
  text: string;
  effects: AttackEffect[];
  /** Catégorie d'Objet (D-027) ; absent sur un Collègue. */
  itemKind?: ItemKind;
  variantOf?: string;
}

export type Card = PlanqueCard | ActionCard;

export interface CardInstance {
  uid: string;
  cardId: string;
  hp: number;
  maxHp: number;
  energy: number;
  /** Conditions subies, dans l'ordre d'application de `STATUS_ORDER` (§4). */
  statuses: Status[];
  playedTurn: number;
  evolvedTurn: number | null;
  damageReduction: number;
}

export type PlayerId = 'player' | 'ai';

export interface PlayerState {
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  active: CardInstance | null;
  bench: (CardInstance | null)[];
  energyZone: number;
  points: number;
  energyAttached: boolean;
  hasAttacked: boolean;
  hasRetreated: boolean;
  hasUsedAbility: boolean;
  /** « Changement de priorité » (D-004) : une fois par tour. */
  hasUsedPriorityShift: boolean;
  /** Collègue : 1 par tour (`AGENTS.md` §4). Les Objets restent illimités. */
  hasPlayedSupporter: boolean;
}

export type BattleAction =
  | { type: 'playBasic'; uid: string; slot: 'active' | number }
  | { type: 'evolve'; uid: string; targetUid: string }
  | { type: 'attachEnergy'; targetUid: string }
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number }
  | { type: 'ability' }
  | { type: 'priorityShift'; uid: string }
  | { type: 'playAction'; uid: string }
  | { type: 'promoteActive'; benchIndex: number }
  | { type: 'endTurn' };

export interface BattleState {
  turn: number;
  current: PlayerId;
  phase: 'playing' | 'ended';
  players: Record<PlayerId, PlayerState>;
  log: string[];
  winner: PlayerId | null;
  /**
   * Joueur dont le Poste vient de craquer et qui doit **choisir** sa relève
   * (AGENTS.md §4 : « le Rack choisit la relève »). Tant que ce champ est
   * renseigné, aucune autre action n'est acceptée : il faut d'abord trancher.
   * `null` quand rien n'est en attente, ou quand le joueur n'a plus de Rack
   * (la partie est alors terminée).
   */
  pendingPromotion: PlayerId | null;
}
