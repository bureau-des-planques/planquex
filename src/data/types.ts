export type Faction =
  | 'SSE'
  | 'MANAGER'
  | 'HAPPINESS'
  | 'AMELIORATION'
  | 'RH'
  | 'TECHNICIEN'
  | 'DIRECTION'
  | 'SYNDICAT'
  | 'INTERIMAIRE'
  | 'SUPPORT';

export type Stage = 'N+1' | 'N+2' | 'COMEX';

export type Rarity = '1D' | '2D' | '3D' | '4D' | '1S' | '2S';

export type Status = 'SURCHARGE' | 'BURNOUT' | 'BLOQUE' | 'GELE' | 'DERIVE';

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
}

export interface CardInstance {
  uid: string;
  cardId: string;
  hp: number;
  maxHp: number;
  energy: number;
  status: Status | null;
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
}

export type BattleAction =
  | { type: 'playBasic'; uid: string; slot: 'active' | number }
  | { type: 'evolve'; uid: string; targetUid: string }
  | { type: 'attachEnergy'; targetUid: string }
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number }
  | { type: 'ability' }
  | { type: 'endTurn' };

export interface BattleState {
  turn: number;
  current: PlayerId;
  phase: 'playing' | 'ended';
  players: Record<PlayerId, PlayerState>;
  log: string[];
  winner: PlayerId | null;
}
