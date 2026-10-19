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

export interface Card {
  id: string;
  name: string;
  faction: Faction;
  stage: Stage;
  rarity: Rarity;
  hp: number;
  retreat: number;
  weakness: Faction | null;
  attacks: Attack[];
  ability?: Ability;
  flavor: string;
  glyph: string;
  palette: string;
  ex?: boolean;
  variantOf?: string;
  evolvesFrom?: string;
  keywords?: Keyword[];
}

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
}

export type BattleAction =
  | { type: 'playBasic'; uid: string; slot: 'active' | number }
  | { type: 'evolve'; uid: string; targetUid: string }
  | { type: 'attachEnergy'; targetUid: string }
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number }
  | { type: 'ability' }
  | { type: 'priorityShift'; uid: string }
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
   * Joueur dont le Poste vient d'être mis K.O. et qui doit **choisir** sa relève
   * (AGENTS.md §4 : « le Rack choisit la relève »). Tant que ce champ est
   * renseigné, aucune autre action n'est acceptée : il faut d'abord trancher.
   * `null` quand rien n'est en attente, ou quand le joueur n'a plus de Rack
   * (la partie est alors terminée).
   */
  pendingPromotion: PlayerId | null;
}
