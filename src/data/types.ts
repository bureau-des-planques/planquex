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
 * Type d'un **café** (l'énergie du projet, `AGENTS.md` §3.1) : celui d'une **faction**
 * (§3.2). `SSE` = Plante, `MANAGEMENT` = Feu… Ces types sont ceux que la Machine à café
 * peut **produire** ; `INTERIM` (Dragon) et `SUPPORT` (Incolore) n'en produisent jamais
 * (D-034).
 */
export type CafeType = Faction;

/**
 * **Symbole** d'un coût de Pression (D-037) : soit un **type de faction**, soit
 * **`INCOLORE`** — qui n'est **pas** `SUPPORT` (D-037 (1)). Un symbole typé exige un
 * café de ce type ; un symbole incolore accepte n'importe quel café.
 */
export type CafeSymbol = CafeType | 'INCOLORE';

export interface Attack {
  name: string;
  /**
   * Coût d'une Pression, en **cafés typés** (D-037) : une **liste de symboles**. Une
   * liste vide est une attaque **gratuite** ; le **nombre** de symboles = l'ancien coût
   * numérique, donc les bandes de dégâts de D-021 ne bougent pas. Un symbole `INCOLORE`
   * accepte n'importe quel café ; un symbole typé en exige un de ce type.
   */
  cost: CafeSymbol[];
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
  /**
   * Les cafés attachés à cette instance, **typés** (D-037) : un café en jeu est un
   * `CafeSymbol`. La Machine à café ne produit jamais d'`INCOLORE` ni de type non
   * produit (D-034) ; un café `INCOLORE` — jamais produit — paierait pourtant tout
   * coût typé, d'où la forme `CafeSymbol` et non `CafeType`. Le **nombre** de cafés
   * d'une Pression ne change pas (D-037 (3)) : c'est le type qui devient lisible.
   */
  energy: CafeSymbol[];
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
  /**
   * La **Machine à café** : au plus **un** café typé (D-034, capture `05` — la zone ne
   * s'accumule pas, donc un seul attachement possible par tour). `null` = rien à
   * attacher : première ouverture, slot occupé, ou Chariot sans type de café.
   */
  energyZone: CafeSymbol | null;
  /**
   * Les **types de café du Chariot** (D-034/D-037 (4), 1 à 3) : la seule liste d'où la
   * Machine tire. Dressée une fois par `createBattle` à partir de `deckCafeTypes`
   * (`@/game/deck`) ; le choix manuel du joueur viendra plus tard (#91). `SUPPORT`
   * (Incolore) et `INTERIM` (Dragon) n'y figurent jamais (D-034).
   */
  cafeTypes: CafeType[];
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

/** Les quatre façons dont une partie s'arrête (`AGENTS.md` §4, #84). */
export type EndReason = 'interventions' | 'plateauVide' | 'forfait' | 'limiteDeTours';

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
   * **Pourquoi** la partie s'est arrêtée (#84) — `null` tant qu'elle vit. Posée par le
   * moteur au moment où il la termine, pour que l'écran n'ait pas à la déduire du seul
   * vainqueur : 3 Interventions, plus aucun Planqué en jeu (D-022), forfait (D-030),
   * limite de tours (D-031).
   */
  endReason: EndReason | null;
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
  /**
   * **Graine d'origine** de la partie (ticket #83), telle que reçue par
   * `createBattle`. `rng` en est l'état **courant** après les tirages : les deux
   * diffèrent dès le premier mélange. C'est la valeur que `replayBattle` réinjecte.
   */
  seed: number;
  /**
   * **Journal des actions réellement appliquées** (ticket #83), dans l'ordre. Seul
   * `applyAction` l'alimente, et uniquement quand la transition a changé l'état :
   * une action **refusée** n'y figure pas. C'est la suite **rejouable** — même graine
   * + mêmes actions = même partie (`PROPOSITION.md` §6.2) ; `log`, lui, reste le
   * journal **texte** destiné à l'écran. Voir `replayBattle`.
   */
  actionLog: BattleAction[];
}
