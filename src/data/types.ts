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

/**
 * Raretés de `CARD-SPEC.md` §1 : diamants (`1D`–`4D`), étoiles (`1S`–`3S`) et
 * **Couronne** (`COU`). `COU` suit la règle d'abréviation de D-024 : trois lettres
 * tirées du nom.
 */
export type Rarity = '1D' | '2D' | '3D' | '4D' | '1S' | '2S' | '3S' | 'COU';

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

/**
 * Les membres d'`AttackEffectKind`, **une seule fois** dans le code (#56).
 *
 * Cette liste vit à côté du type, pas dans un test : `cards.test.ts` la consomme, et
 * `src/data/types.test.ts` vérifie par le type qu'elle ne diverge pas de l'union. Les
 * deux `switch` du moteur (`applyEffects`, `applyActionEffects`) finissent sur un
 * `assertNever` : ajouter un membre à l'union sans lui écrire de `case` rend `tsc` rouge.
 */
export const ATTACK_EFFECT_KINDS = [
  'healSelf',
  'healAll',
  'status',
  'draw',
  'discardEnergy',
  'selfDamage',
  'switchSelf',
  'reduceDamage'
] as const satisfies readonly AttackEffectKind[];

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

/**
 * Type d'un **café** (l'énergie du projet, `AGENTS.md` §3.1). Un type est celui de la
 * faction (§3.2) : `SSE` = Plante, `MANAGEMENT` = Feu… `SUPPORT` = **Incolore**.
 *
 * Un café **incolore** satisfait n'importe quel coût typé (§4).
 */
export type CafeType = Faction;

/**
 * Coût **typé** d'une Pression : `amount` cafés du type `type`. Un coût typé vaut
 * **au moins 1 café** — un coût typé à 0 n'aurait pas de sens.
 *
 * Étape *expand* du refactor (#30) : ce champ vit **à côté** du `cost` numérique, que le
 * moteur lit toujours. La migration (#33) remplira les deux ensemble, puis le contrat
 * supprimera l'ancien champ.
 */
export interface CafeCost {
  type: CafeType;
  amount: number;
}

export interface Attack {
  name: string;
  /**
   * Coût numérique historique, en cafés. Tant que la migration (#33) n'est pas faite,
   * c'est **lui** que lit le moteur. Ne pas le retirer ici : rien ne casse avant #34.
   */
  cost: number;
  /** Coût typé (#30). Absent : seul `cost` fait foi. */
  cafeCost?: CafeCost;
  damage: number;
  text?: string;
  effects?: AttackEffect[];
}

/**
 * Les primitives d'un **Talent**. Taxonomie **distincte** de celle des effets de
 * Pression (#56) : 6 membres, dont 4 noms communs avec `AttackEffectKind` (`draw`,
 * `reduceDamage`…) qui ne veulent pas dire la même chose. Un resolver unique serait une
 * fausse abstraction ; deux `switch`, une liste runtime par union.
 */
export type AbilityKind = 'heal' | 'draw' | 'attachEnergy' | 'reduceDamage' | 'antiStatus';

/** Les membres d'`AbilityKind`, source unique (#56) — même contrat qu'`ATTACK_EFFECT_KINDS`. */
export const ABILITY_KINDS = [
  'heal',
  'draw',
  'attachEnergy',
  'reduceDamage',
  'antiStatus'
] as const satisfies readonly AbilityKind[];

export interface Ability {
  name: string;
  text: string;
  kind: AbilityKind;
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
  /**
   * Conditions subies, dans l'ordre d'application de `STATUS_ORDER` (§4).
   * Seul le Planqué au **Poste** en porte, et la rotation comme l'évolution les
   * purgent (D-030). Sieste, Immobilisation et Dérive s'excluent entre eux ;
   * Surcharge et Épuisement se cumulent avec tout (`EXCLUSIVE_STATUSES`, `src/game/rules.ts`).
   */
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
  /**
   * **Forfait** (D-030) : abandonner est une défaite, quel que soit le score. `who`
   * est **explicite** parce que `state.current` ne l'est pas : le joueur humain peut
   * abandonner pendant le tour de la Direction ou pendant une relève en attente, donc
   * le camp qui se couche n'est pas celui au trait.
   */
  | { type: 'forfeit'; who: PlayerId }
  | { type: 'endTurn' };

export interface BattleState {
  turn: number;
  current: PlayerId;
  /**
   * Camp qui **ouvre la partie**, tiré au sort à la création (D-033 (6), capture
   * `04`) : le lancer de tampon passe par le générateur seedé (`@/game/rng`), donc
   * une même graine ouvre toujours sur le même camp. Sert à situer le **premier
   * tour de chaque joueur** — le tour 1 pour `firstPlayer`, le tour 2 pour l'autre :
   * évolution interdite et, pour `firstPlayer`, aucune génération de café (D-030).
   */
  firstPlayer: PlayerId;
  phase: 'playing' | 'ended';
  players: Record<PlayerId, PlayerState>;
  log: string[];
  winner: PlayerId | null;
  /**
   * Joueur dont le Poste vient de craquer et qui doit **choisir** sa relève
   * (AGENTS.md §4, D-031 : la relève est choisie par le camp dont le Planqué a
   * craqué, et l'attaquant choisit en premier sur un double craquage). Tant que
   * ce champ est renseigné, aucune autre action n'est acceptée : il faut d'abord
   * trancher. `null` quand rien n'est en attente, ou quand le joueur n'a plus de
   * Rack (la partie est alors terminée).
   */
  pendingPromotion: PlayerId | null;
  /**
   * État du générateur seedé de la partie (ticket #29). Un entier 32 bits, donc
   * clonable par `structuredClone` et comparable : la partie rejoue à l'identique
   * tant qu'aucune action ne l'a fait avancer. Voir `@/game/rng`.
   */
  rng: number;
}
