import { ACTION_KIND_META, getCard, isBasic, isPlanque } from '@/data';
import type {
  Attack,
  AttackEffect,
  BattleAction,
  BattleState,
  CardInstance,
  PlayerId,
  PlayerState,
  Status
} from '@/data/types';
import { deckLegal } from '@/game/deck';
import { drawRandom, seedRng } from '@/game/rng';
import type { RngHolder } from '@/game/rng';
import { RULES, EXCLUSIVE_STATUSES, STATUS_ORDER, TURN_LIMIT } from '@/game/rules';

let uidCounter = 0;

/**
 * Premier tour d'un joueur : impossible d'y faire évoluer (AGENTS.md §4).
 * Le joueur ouvre toujours la partie, donc son premier tour est le tour 1 et
 * celui de la Direction le tour 2.
 */
export function isFirstTurnFor(state: BattleState, who: PlayerId): boolean {
  return state.turn <= (who === 'player' ? 1 : 2);
}

/**
 * Le **premier tour de la partie**, tenu par le joueur : aucun café ne s'y attache
 * (`AGENTS.md` §4, D-030). La Direction, elle, attache dès son premier tour (tour 2),
 * c'est pourquoi ce n'est pas `isFirstTurnFor` qui sert ici.
 *
 * Le joueur **pioche**, en revanche : la ligne « le premier joueur ne pioche pas »
 * venait du TCG **physique**, pas de Pocket (D-030). L'énergie est la seule exception.
 *
 * Une seule définition : `attachEnergy` et `legalActions` lisent celle-ci, sinon
 * l'écran et le moteur finiraient par ne plus dire la même chose (#58).
 */
function isOpeningTurn(state: BattleState): boolean {
  return state.turn === 1 && state.current === 'player';
}

/**
 * Vrai quand un Poste vient de craquer et que sa relève reste à choisir
 * (AGENTS.md §4). Tant que c'est vrai, aucune action n'est acceptée : il faut
 * résoudre la relève d'abord.
 */
function awaitingPromotion(state: BattleState): boolean {
  return state.pendingPromotion !== null;
}

/**
 * La Pression **termine le tour** (D-033 §1, capture `05` : « Une fois l'attaque
 * lancée, votre tour est terminé. »). Dès que le camp au trait a porté sa Pression,
 * il n'a plus qu'à finir le tour : toute autre action est refusée.
 *
 * Garde **unique** : chaque fonction d'action et `legalActions` la lisent, sinon
 * l'écran finirait par proposer une action que le moteur refuse (#58).
 */
function turnFinished(state: BattleState): boolean {
  return state.players[state.current].hasAttacked;
}

const newUid = () => `u${++uidCounter}`;

export function createInstance(cardId: string, turn = 0, uid = newUid()): CardInstance {
  const card = getCard(cardId);
  if (!card) throw new Error(`Carte inconnue: ${cardId}`);
  // Une carte Action ne se pose jamais : son instance n'a pas de Seuil, mais elle vit
  // au Chariot et dans la main comme les autres (0 = pas de Seuil à afficher).
  const hp = isPlanque(card) ? card.hp : 0;
  return {
    uid,
    cardId,
    hp,
    maxHp: hp,
    energy: 0,
    statuses: [],
    playedTurn: turn,
    evolvedTurn: null,
    damageReduction: 0
  };
}

/**
 * Instances d'un Chariot neuf. L'`uid` dérive de la **place dans le Chariot**
 * (`p12`, `a3`) et non d'un compteur global : deux parties de même graine
 * doivent produire des états strictement identiques (ticket #29), ce qu'un
 * compteur module rendrait impossible dès la deuxième partie.
 */
function deckInstances(deck: string[], prefix: 'p' | 'a'): CardInstance[] {
  return deck.map((id, index) => createInstance(id, 0, `${prefix}${index}`));
}

function shuffle<T>(items: T[], holder: RngHolder): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(drawRandom(holder) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function emptyPlayer(): PlayerState {
  return {
    deck: [],
    hand: [],
    discard: [],
    active: null,
    bench: [null, null, null],
    energyZone: 0,
    points: 0,
    energyAttached: false,
    hasAttacked: false,
    hasRetreated: false,
    hasUsedAbility: false,
    hasUsedPriorityShift: false,
    hasPlayedSupporter: false
  };
}

function clone(state: BattleState): BattleState {
  return structuredClone(state);
}

function findInPlay(player: PlayerState, uid: string): CardInstance | null {
  if (player.active?.uid === uid) return player.active;
  return player.bench.find((card) => card?.uid === uid) ?? null;
}

function removeFromHand(player: PlayerState, uid: string): CardInstance | null {
  const index = player.hand.findIndex((card) => card.uid === uid);
  if (index < 0) return null;
  return player.hand.splice(index, 1)[0] ?? null;
}

function putInDiscard(player: PlayerState, card: CardInstance) {
  player.discard.push(card);
}

function draw(state: BattleState, who: PlayerId, amount: number) {
  const player = state.players[who];
  for (let i = 0; i < amount; i += 1) {
    if (player.deck.length === 0) {
      state.log.push(`${who === 'player' ? 'Tu' : 'L’IA'} ne pioche pas : Chariot vide.`);
      break;
    }
    if (player.hand.length >= 10) {
      state.log.push(`${who === 'player' ? 'Ta' : 'La'} main est pleine (10).`);
      break;
    }
    const card = player.deck.shift();
    if (card) player.hand.push(card);
  }
}

function startTurn(state: BattleState) {
  const player = state.players[state.current];
  player.energyAttached = false;
  player.hasAttacked = false;
  player.hasRetreated = false;
  player.hasUsedAbility = false;
  player.hasUsedPriorityShift = false;
  player.hasPlayedSupporter = false;

  // La réduction de Stress posée par `reduceDamage` ne dure que le tour adverse :
  // elle expire au début du tour de son propriétaire.
  for (const card of [player.active, ...player.bench]) {
    if (card) card.damageReduction = 0;
  }

  // Le premier joueur pioche comme l'autre (D-030) : seule l'énergie est une
  // exception à son premier tour, et elle se joue dans `attachEnergy`.
  draw(state, state.current, 1);

  if (player.energyZone === 0) {
    player.energyZone = 1;
    state.log.push(`${state.current === 'player' ? 'La machine à café' : 'La machine à café adverse'} produit 1 café.`);
  }
}

function hasBasicInHand(player: PlayerState): boolean {
  return player.hand.some((card) => isBasic(getCard(card.cardId)));
}

/**
 * Pocket **n'a pas de reprise de poste** (D-022) : la main de départ contient
 * toujours au moins un Entrant, sans remélange et sans pioche pour l'adversaire —
 * c'est le mulligan du TCG *physique* que §4 reprenait à tort.
 *
 * Le Chariot étant garanti d'avoir au moins un Entrant (`deckLegal`), il y a
 * toujours de quoi échanger. L'échange se fait carte pour carte : la main reste
 * à 5 et le total des cartes du joueur ne bouge pas.
 */
function ensureBasicInHand(player: PlayerState) {
  if (hasBasicInHand(player)) return;
  const index = player.deck.findIndex((card) => isBasic(getCard(card.cardId)));
  if (index < 0) return;
  const [card] = player.deck.splice(index, 1);
  if (!card) return;
  const swapped = player.hand.pop();
  if (swapped) player.deck.push(swapped);
  player.hand.push(card);
}

function setupPlayer(state: BattleState, who: PlayerId) {
  const player = state.players[who];
  draw(state, who, 5);
  ensureBasicInHand(player);

  const basics = player.hand.filter((card) => isBasic(getCard(card.cardId)));
  const active = basics.shift();
  if (active) {
    removeFromHand(player, active.uid);
    player.active = { ...active, playedTurn: 0 };
  }
  for (let i = 0; i < player.bench.length && basics.length > 0; i += 1) {
    const card = basics.shift();
    if (card) {
      removeFromHand(player, card.uid);
      player.bench[i] = { ...card, playedTurn: 0 };
    }
  }
}

/** Refuse un chariot non conforme : le moteur ne démarre pas une partie illégale. */
function assertDeckLegal(deck: string[], who: string) {
  const { ok, reasons } = deckLegal(deck);
  if (!ok) throw new Error(`Chariot illégal (${who}) : ${reasons.join(' ')}`);
}

export function createBattle(playerDeck: string[], aiDeck: string[], seed = Date.now()): BattleState {
  assertDeckLegal(playerDeck, 'Toi');
  assertDeckLegal(aiDeck, 'la Direction');
  const state: BattleState = {
    turn: 1,
    current: 'player',
    phase: 'playing',
    players: {
      player: emptyPlayer(),
      ai: emptyPlayer()
    },
    log: [],
    winner: null,
    pendingPromotion: null,
    // Toute la suite de la partie tire de cet état : la graine devient la seule
    // source de hasard, et `Date.now()` n'en est que la valeur par défaut (UI).
    rng: seedRng(seed)
  };

  state.players.player.deck = shuffle(deckInstances(playerDeck, 'p'), state);
  state.players.ai.deck = shuffle(deckInstances(aiDeck, 'a'), state);

  setupPlayer(state, 'player');
  setupPlayer(state, 'ai');

  state.log.push('Le site ouvre. À toi de jouer.');
  startTurn(state);
  return state;
}

export function playBasic(state: BattleState, uid: string, slot: 'active' | number): BattleState {
  if (awaitingPromotion(state) || turnFinished(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  const handCard = player.hand.find((card) => card.uid === uid);
  if (!handCard) return state;
  const card = getCard(handCard.cardId);
  if (!isBasic(card)) return state;

  const instance: CardInstance = { ...handCard, playedTurn: next.turn };
  if (slot === 'active') {
    if (player.active) return state;
    removeFromHand(player, uid);
    player.active = instance;
  } else {
    if (slot < 0 || slot > 2 || player.bench[slot]) return state;
    removeFromHand(player, uid);
    player.bench[slot] = instance;
  }
  next.log.push(`${next.current === 'player' ? 'Tu poses' : 'L’IA pose'} ${card.name}.`);
  return next;
}

export function evolve(state: BattleState, uid: string, targetUid: string): BattleState {
  if (awaitingPromotion(state) || turnFinished(state)) return state;
  const next = clone(state);
  if (isFirstTurnFor(next, next.current)) return state;
  const player = next.players[next.current];
  const handCard = player.hand.find((card) => card.uid === uid);
  if (!handCard) return state;
  const card = getCard(handCard.cardId);
  if (!isPlanque(card) || !card.evolvesFrom) return state;
  const target = findInPlay(player, targetUid);
  if (!target || target.cardId !== card.evolvesFrom) return state;
  if (target.playedTurn >= next.turn) return state;
  if (target.evolvedTurn === next.turn) return state;

  const damage = target.maxHp - target.hp;
  removeFromHand(player, uid);
  target.cardId = card.id;
  target.maxHp = card.hp;
  target.hp = Math.max(1, card.hp - damage);
  // D-033 (4) : l'évolution purge aussi les effets d'attaque, pas seulement les statuts.
  clearAttackEffects(target);
  target.evolvedTurn = next.turn;
  next.log.push(`${next.current === 'player' ? 'Tu fais évoluer' : 'L’IA fait évoluer'} ${card.name}.`);
  return next;
}

export function attachEnergy(state: BattleState, targetUid: string): BattleState {
  if (awaitingPromotion(state) || turnFinished(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.energyAttached || player.energyZone <= 0) return state;
  if (isOpeningTurn(next)) {
    next.log.push('Premier tour : pas d’attachement de café.');
    return next;
  }
  const target = findInPlay(player, targetUid);
  if (!target) return state;
  target.energy += 1;
  player.energyZone -= 1;
  player.energyAttached = true;
  next.log.push(`${next.current === 'player' ? 'Tu attaches' : 'L’IA attache'} 1 café à ${getCard(target.cardId)?.name ?? 'un Planqué'}.`);
  return next;
}

export function retreat(state: BattleState, benchIndex: number): BattleState {
  if (awaitingPromotion(state) || turnFinished(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.hasRetreated || !player.active) return state;
  // D-033 (2) : Sieste et Immobilisation interdisent la Rotation, comme la Pression.
  if (retreatBlockedByStatus(player.active)) return state;
  const bench = player.bench[benchIndex];
  if (!bench) return state;
  const card = getCard(player.active.cardId);
  if (!isPlanque(card) || player.active.energy < card.retreat) return state;
  player.active.energy -= card.retreat;
  const outgoing = player.active;
  // Seul le Poste peut porter un statut (D-030) : le sortant les perd en rejoignant le
  // Rack, et l'entrant n'en porte aucun. D-033 (4) : il perd aussi les **effets
  // d'attaque** (ex. `damageReduction`), pas ses dégâts ni ses cafés.
  clearAttackEffects(outgoing);
  player.active = { ...bench, statuses: [] };
  player.bench[benchIndex] = outgoing;
  player.hasRetreated = true;
  next.log.push(`${next.current === 'player' ? 'Tu passes en rotation' : 'L’IA passe en rotation'} : ${getCard(bench.cardId)?.name}.`);
  return next;
}

export function useAbility(state: BattleState): BattleState {
  if (awaitingPromotion(state) || turnFinished(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.hasUsedAbility || !player.active) return state;
  const card = getCard(player.active.cardId);
  if (!isPlanque(card) || !card.ability) return state;
  const ability = card.ability;
  if (ability.kind === 'heal') {
    player.active.hp = Math.min(player.active.maxHp, player.active.hp + (ability.amount ?? 10));
  } else if (ability.kind === 'antiStatus') {
    player.active.hp = Math.min(player.active.maxHp, player.active.hp + (ability.amount ?? 10));
    clearStatuses(player.active);
  } else if (ability.kind === 'draw') {
    draw(next, next.current, ability.amount ?? 1);
  } else if (ability.kind === 'attachEnergy') {
    player.active.energy += 1;
  }
  player.hasUsedAbility = true;
  next.log.push(`${next.current === 'player' ? 'Tu utilises' : 'L’IA utilise'} ${ability.name}.`);
  return next;
}

/**
 * Stress qu'une Pression inflige à un Planqué, selon l'emplacement où il se trouve.
 *
 * L'ordre du calcul est celui de D-031 (FAQ officielle) : les dégâts de la Pression,
 * les effets qui affectent l'attaquant, la **Vulnérabilité**, puis les effets qui
 * affectent le défenseur. Un seul plancher, à la dernière étape : une réduction ne doit
 * pas être rognée à 0 avant que la Vulnérabilité ne s'ajoute.
 *
 * La **Vulnérabilité** vaut +20 **au Poste seulement** : un Planqué du Rack n'encaisse
 * jamais la Vulnérabilité, même frappé par la même Pression (D-031). `slot` est donc
 * obligatoire — un appelant qui ignore où se trouve sa cible ne compile pas.
 */
export function attackDamage(
  attacker: CardInstance,
  defender: CardInstance,
  attack: Attack,
  slot: 'poste' | 'rack'
): number {
  const attackerCard = getCard(attacker.cardId);
  const defenderCard = getCard(defender.cardId);
  if (!isPlanque(attackerCard) || !isPlanque(defenderCard)) return 0;

  // 1. Les dégâts de la Pression.
  let damage = attack.damage;

  // 2. Les effets qui affectent l'attaquant. Aucune primitive du set ne modifie les
  //    dégâts sortants aujourd'hui : c'est ici qu'un tel effet s'insérerait. La
  //    `damageReduction` de l'attaquant n'en est pas un — c'est une défense, lue à
  //    l'étape 4 quand ce Planqué est la cible.

  // 3. La Vulnérabilité : +20, **au Poste seulement** (#70).
  if (slot === 'poste' && defenderCard.weakness === attackerCard.faction) damage += 20;

  // 4. Les effets qui affectent le défenseur : son Talent `reduceDamage`, puis la
  //    réduction d'instance posée par une Pression, valable le tour adverse.
  const abilityReduction = defenderCard.ability?.kind === 'reduceDamage' ? defenderCard.ability.amount ?? 0 : 0;
  damage -= abilityReduction;
  damage -= defender.damageReduction ?? 0;

  return Math.max(0, damage);
}

function hasStatus(card: CardInstance, status: Status): boolean {
  return card.statuses.includes(status);
}

function clearStatus(card: CardInstance, status: Status) {
  card.statuses = card.statuses.filter((entry) => entry !== status);
}

/**
 * Une évolution ou une rotation purgent les conditions (D-030 : seul le Planqué au
 * **Poste** en porte ; retourner au Rack ou évoluer les efface).
 *
 * Elle ne touche **que** les conditions : le Talent `antiStatus` et le réveil de la
 * Sieste s'en servent, et ils ne doivent pas effacer une réduction de Stress.
 */
function clearStatuses(card: CardInstance) {
  card.statuses = [];
}

/**
 * Purge **statuts + effets d'attaque** d'une instance (D-033 (4)). Les effets
 * d'attaque temporaires de `CardInstance` sont la `damageReduction` posée par
 * `reduceDamage` (les autres champs — `hp`, `energy`, `playedTurn`, `evolvedTurn` —
 * ne sont pas des effets d'attaque). Capture `05` : « Lorsqu'un Pokémon évolue, tous
 * les effets d'attaques […] ou les États Spéciaux qui l'affectent disparaissent » et
 * « Quand le Pokémon Actif est envoyé sur le Banc, tous les effets d'attaques […]
 * disparaissent ».
 *
 * Le **Stress** (dégâts, `maxHp − hp`) et les **cafés** (`energy`) sont conservés :
 * la même capture dit que le Planqué « garde tous les dégâts subis ainsi que toutes
 * les Énergies ». C'est la Rotation (sur le sortant) et l'évolution qui appellent
 * celle-ci ; `startTurn` garde par ailleurs son expire de `damageReduction` au début
 * du tour de son propriétaire.
 */
function clearAttackEffects(card: CardInstance) {
  clearStatuses(card);
  card.damageReduction = 0;
}

/**
 * Sieste et Immobilisation interdisent la Rotation, comme la Pression (D-033 (2),
 * capture `07` : « Les Pokémon Endormis ne peuvent ni attaquer ni battre en
 * retraite » — même phrase pour les Paralysés). `retreat` et le bloc Rotation de
 * `legalActions` lisent cette même garde pour ne pas se contredire.
 */
function retreatBlockedByStatus(card: CardInstance): boolean {
  return hasStatus(card, 'SIESTE') || hasStatus(card, 'IMMOBILISATION');
}

/** Ajoute une condition si elle n'y est pas déjà (on ne cumule pas deux Surcharges). */
function applyStatus(target: CardInstance, status: Status) {
  // Sieste, Immobilisation et Dérive s'excluent (D-030) : en appliquer une remplace
  // les autres. Surcharge et Épuisement, eux, se cumulent avec tout.
  if (EXCLUSIVE_STATUSES.includes(status)) {
    target.statuses = target.statuses.filter((entry) => !EXCLUSIVE_STATUSES.includes(entry));
  }
  if (!hasStatus(target, status)) target.statuses.push(status);
}

/**
 * Garde d'exhaustivité (#56) : à appeler dans le `default` d'un `switch` sur une union.
 * Elle ne compile que si tous les membres de l'union ont leur `case` ; à l'exécution, un
 * `kind` hors type lève au lieu d'être avalé.
 */
function assertNever(value: never): never {
  throw new Error(`Effet non géré par le moteur : ${String(value)}`);
}

function applyEffects(
  state: BattleState,
  who: PlayerId,
  attacker: CardInstance,
  defender: CardInstance,
  attack: Attack
) {
  const player = state.players[who];
  for (const effect of attack.effects ?? []) {
    switch (effect.kind) {
      case 'healSelf':
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + (effect.amount ?? 10));
        break;
      case 'healAll': {
        const amount = effect.amount ?? 10;
        const cards = [player.active, ...player.bench].filter(Boolean) as CardInstance[];
        for (const card of cards) card.hp = Math.min(card.maxHp, card.hp + amount);
        break;
      }
      case 'status':
        if (effect.status) applyStatus(defender, effect.status);
        break;
      case 'draw':
        draw(state, who, effect.amount ?? 1);
        break;
      case 'discardEnergy':
        defender.energy = Math.max(0, defender.energy - 1);
        break;
      case 'selfDamage':
        attacker.hp -= effect.amount ?? 10;
        break;
      case 'switchSelf': {
        const index = player.bench.findIndex(Boolean);
        if (index >= 0) {
          const incoming = player.bench[index];
          if (incoming) {
            player.bench[index] = attacker;
            player.active = { ...incoming, statuses: [] };
          }
        }
        break;
      }
      case 'reduceDamage':
        attacker.damageReduction = effect.amount ?? 0;
        break;
      default:
        assertNever(effect.kind);
    }
  }
}

/**
 * Effets d'une carte Action jouée depuis la main (`AGENTS.md` §4).
 *
 * Les cartes Action se résolvent avec les mêmes primitives que les Pressions, mais sans
 * attaquant : `healAll` et `draw` visent le camp qui joue, `status` et `discardEnergy`
 * visent le Planqué au Poste d'en face. Les primitives qui supposent un attaquant ou une
 * cible (`healSelf`, `selfDamage`, `switchSelf`, `reduceDamage`) n'ont pas de sens ici et
 * sont ignorées — aucune carte du lancement ne les emploie.
 */
function applyActionEffects(state: BattleState, who: PlayerId, effects: AttackEffect[]) {
  const player = state.players[who];
  const opponent = state.players[who === 'player' ? 'ai' : 'player'];
  for (const effect of effects) {
    switch (effect.kind) {
      case 'draw':
        draw(state, who, effect.amount ?? 1);
        break;
      case 'healAll': {
        const amount = effect.amount ?? 10;
        const cards = [player.active, ...player.bench].filter(Boolean) as CardInstance[];
        for (const card of cards) card.hp = Math.min(card.maxHp, card.hp + amount);
        break;
      }
      case 'status':
        if (effect.status && opponent.active) applyStatus(opponent.active, effect.status);
        break;
      case 'discardEnergy':
        if (opponent.active) opponent.active.energy = Math.max(0, opponent.active.energy - 1);
        break;
      case 'healSelf':
      case 'selfDamage':
      case 'switchSelf':
      case 'reduceDamage':
        // Sans attaquant, ces primitives n'ont pas de sens ici : elles sont ignorées
        // **volontairement**, et le `case` explicite est ce qui le prouve (#56).
        break;
      default:
        assertNever(effect.kind);
    }
  }
}

/**
 * Une carte Action est-elle jouable maintenant ?
 *
 * Règles (`AGENTS.md` §4) : un **Objet** est **illimité** dans le tour ; un **Collègue**
 * est limité à **1 par tour**. La carte doit être en main et ne pas être un Planqué.
 */
export function canPlayAction(state: BattleState, uid: string): boolean {
  if (awaitingPromotion(state) || turnFinished(state)) return false;
  const player = state.players[state.current];
  const handCard = player.hand.find((card) => card.uid === uid);
  if (!handCard) return false;
  const card = getCard(handCard.cardId);
  if (!card || isPlanque(card)) return false;
  return card.kind === 'OBJET' || !player.hasPlayedSupporter;
}

/**
 * Jouer une carte Action depuis la main : elle part au Rebut et son effet se résout.
 * Objet illimité, Collègue 1 par tour (`AGENTS.md` §4). Le premier joueur peut jouer un
 * Collègue à son premier tour — §4 ne l'en prive pas, contrairement au café (D-030).
 */
export function playAction(state: BattleState, uid: string): BattleState {
  if (!canPlayAction(state, uid)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  const handCard = player.hand.find((card) => card.uid === uid);
  if (!handCard) return state;
  const card = getCard(handCard.cardId);
  if (!card || isPlanque(card)) return state;

  removeFromHand(player, uid);
  putInDiscard(player, handCard);
  if (card.kind === 'COLLEAGUE') player.hasPlayedSupporter = true;
  applyActionEffects(next, next.current, card.effects);
  next.log.push(
    `${next.current === 'player' ? 'Tu joues' : 'L’IA joue'} ${card.name} (${ACTION_KIND_META[card.kind].label}).`
  );
  return next;
}

/**
 * Applique **un** craquage : Interventions pour l'adversaire, carte au rebut, Poste
 * vidé. Ne décide **pas** de la fin : c'est `resolveEnd` qui tranche, **après** tous
 * les craquages de l'action (D-031).
 */
function knockOut(state: BattleState, attackerId: PlayerId) {
  const defenderId: PlayerId = attackerId === 'player' ? 'ai' : 'player';
  const defender = state.players[defenderId];
  if (!defender.active || defender.active.hp > 0) return;

  const fallen = defender.active;
  const fallenCard = getCard(fallen.cardId);
  const points = isPlanque(fallenCard) && fallenCard.ex ? 2 : 1;
  state.players[attackerId].points += points;
  state.log.push(`${fallenCard?.name ?? 'Un Planqué'} craque : ${points} Intervention${points > 1 ? 's' : ''}.`);
  putInDiscard(defender, fallen);
  defender.active = null;
}

/** Un camp a-t-il encore un Planqué en jeu ? Sans Planqué, il perd (D-022). */
function hasPlanques(player: PlayerState): boolean {
  return Boolean(player.active) || player.bench.some(Boolean);
}

/**
 * Ouvre la relève d'un camp : `pendingPromotion` la retient, le message la montre.
 * Le plateau porte la file — un Poste vide avec un Rack garni reste à pourvoir —
 * donc un seul identifiant suffit, y compris après un double craquage (D-031).
 */
function awaitPromotion(state: BattleState, who: PlayerId) {
  state.pendingPromotion = who;
  state.log.push(who === 'player' ? 'Tu dois choisir ta relève.' : 'La Direction doit choisir sa relève.');
}

/**
 * Tranche la fin de partie, dans l'ordre de **D-031** :
 *
 * 1. le **plateau vide** — ce joueur perd « quel que soit le nombre de points »,
 *    donc même s'il vient d'en marquer trois sur l'action qui vide le plateau ;
 * 2. les **3 Interventions** ;
 * 3. sinon, la relève du camp dont le Poste est vide reste à choisir.
 *
 * L'ordre compte : appelée après **tous** les craquages d'une action, cette fonction
 * ne peut pas déclarer une victoire aux points qu'un craquage simultané dément.
 */
function resolveEnd(state: BattleState) {
  const { player, ai } = state.players;
  const playerOut = !hasPlanques(player);
  const aiOut = !hasPlanques(ai);

  if (playerOut || aiOut) {
    const opponent: PlayerId = state.current === 'player' ? 'ai' : 'player';
    // Si les deux plateaux sont vides sur la même action, D-031 ne tranche pas :
    // le moteur garde son issue d'avant #72, où le dernier craquage — celui de
    // l'attaquant — faisait perdre l'attaquant.
    state.phase = 'ended';
    state.winner = playerOut ? (aiOut ? opponent : 'ai') : 'player';
    state.log.push(`${state.winner === 'player' ? 'Tu gagnes' : 'L’IA gagne'} : plus aucun Planqué.`);
    return;
  }

  // À 3 Interventions des deux côtés sur la même action, on garde l'issue d'avant
  // #72 : le dernier craquage (celui de l'attaquant) départage.
  const last: PlayerId = state.current === 'player' ? 'ai' : 'player';
  const pointsWinner =
    state.players[last].points >= 3 ? last : state.players[state.current].points >= 3 ? state.current : null;
  if (pointsWinner) {
    state.phase = 'ended';
    state.winner = pointsWinner;
    state.log.push(`${pointsWinner === 'player' ? 'Tu gagnes' : 'L’IA gagne'} : 3 Interventions.`);
    return;
  }

  // D-031 : sur un double craquage, **l'attaquant choisit en premier**, quel que
  // soit le siège. `resolveEnd` est appelée dans le tour du camp qui a agi : en
  // attaque comme en `checkup`, `state.current` est donc l'attaquant.
  const emptyActives: PlayerId[] = [];
  if (!player.active && player.bench.some(Boolean)) emptyActives.push('player');
  if (!ai.active && ai.bench.some(Boolean)) emptyActives.push('ai');
  if (emptyActives.length > 0) {
    awaitPromotion(state, emptyActives.includes(state.current) ? state.current : emptyActives[0]);
  }
}

/**
 * Relève après un craquage : appelable par le joueur dont le Poste est vide, que ce
 * soit son tour ou non. C'est la seule action acceptée tant qu'une relève
 * attend d'être choisie.
 */
export function promoteActive(state: BattleState, benchIndex: number): BattleState {
  const who = state.pendingPromotion;
  if (!who) return state;
  const next = clone(state);
  const player = next.players[who];
  const incoming = player.bench[benchIndex];
  if (!incoming) return state;

  player.bench[benchIndex] = null;
  player.active = { ...incoming, statuses: [] };
  next.pendingPromotion = null;
  next.log.push(`${who === 'player' ? 'Tu envoies' : 'L’IA envoie'} ${getCard(incoming.cardId)?.name ?? 'un Planqué'} au Poste.`);

  // Double craquage (D-031) : l'attaquant a choisi en premier, c'est au tour de
  // l'autre camp. Le plateau porte la file — un Poste vide avec un Rack garni
  // reste à pourvoir — donc aucun champ supplémentaire n'est nécessaire.
  const opponent: PlayerId = who === 'player' ? 'ai' : 'player';
  const other = next.players[opponent];
  if (!other.active && other.bench.some(Boolean)) awaitPromotion(next, opponent);
  return next;
}

/**
 * « Changement de priorité » est-il disponible maintenant (D-004) ?
 *
 * Une fois par tour, au Poste, mot-clé porté par la carte au Poste, au moins une
 * carte en main à archiver, et le drapeau global ouvert. `priorityShift` et
 * `legalActions` lisent cette même garde : l'écran ne peut pas proposer le
 * mot-clé quand le moteur le refuse.
 */
export function canPriorityShift(state: BattleState): boolean {
  if (!RULES.priorityShiftEnabled || awaitingPromotion(state) || turnFinished(state)) return false;
  const player = state.players[state.current];
  if (player.hasUsedPriorityShift || !player.active || player.hand.length === 0) return false;
  const active = getCard(player.active.cardId);
  return isPlanque(active) && Boolean(active.keywords?.includes('priorityShift'));
}

/**
 * « Changement de priorité » (D-004) : une fois par tour, au Poste, archiver
 * 1 carte du courrier puis en piocher 1.
 */
export function priorityShift(state: BattleState, uid: string): BattleState {
  if (!canPriorityShift(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  const discarded = removeFromHand(player, uid);
  if (!discarded) return state;
  putInDiscard(player, discarded);
  draw(next, next.current, 1);
  player.hasUsedPriorityShift = true;
  next.log.push(
    `${next.current === 'player' ? 'Tu mets' : 'L’IA met'} ${getCard(discarded.cardId)?.name ?? 'une carte'} au rebut : Changement de priorité.`
  );
  return next;
}

export function attack(state: BattleState, attackIndex: number): BattleState {
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  const opponent = next.players[next.current === 'player' ? 'ai' : 'player'];
  if (turnFinished(state) || !player.active || !opponent.active) return state;
  const card = getCard(player.active.cardId);
  const targetCard = getCard(opponent.active.cardId);
  if (!isPlanque(card) || !isPlanque(targetCard)) return state;
  const attack = card.attacks[attackIndex];
  if (!attack || player.active.energy < attack.cost) return state;

  // Sieste et Immobilisation interdisent la Pression (D-033 §2, capture `07` :
  // « Les Pokémon Endormis ne peuvent ni attaquer ni battre en retraite. »). Le
  // lancer de guérison de la Sieste a lieu **au Contrôle** (`checkup`), jamais ici :
  // on refuse sans tirer.
  if (hasStatus(player.active, 'IMMOBILISATION')) {
    next.log.push('Immobilisation : impossible d’attaquer.');
    return next;
  }
  if (hasStatus(player.active, 'SIESTE')) {
    next.log.push('Sieste : impossible d’attaquer.');
    return next;
  }
  // Dérive (D-033 §3, capture `07`) : « Si c'est pile, l'attaque n'est pas lancée
  // et le tour du joueur prend fin. » Aucun Stress — les 20 que le moteur infligeait
  // n'avaient aucune source. Le tour est consommé, comme après une Pression réussie.
  if (hasStatus(player.active, 'DERIVE') && drawRandom(next) < 0.5) {
    player.hasAttacked = true;
    next.log.push('Dérive : l’attaque n’est pas lancée, le tour prend fin.');
    return next;
  }

  const damage = attackDamage(player.active, opponent.active, attack, 'poste');
  opponent.active.hp -= damage;
  next.log.push(`${card.name} utilise ${attack.name} : ${damage} de stress.`);
  applyEffects(next, next.current, player.active, opponent.active, attack);
  player.hasAttacked = true;

  knockOut(next, next.current);
  // Si l'attaquant s'est craqué lui-même (selfDamage), l'adversaire marque.
  if (player.active && player.active.hp <= 0) {
    knockOut(next, next.current === 'player' ? 'ai' : 'player');
  }
  // D-031 : les deux craquages de l'action sont appliqués **avant** de trancher ;
  // un plateau vide l'emporte alors sur les Interventions gagnées dans la foulée.
  resolveEnd(next);
  return next;
}

function checkup(state: BattleState): BattleState {
  const player = state.players[state.current];
  if (!player.active) return state;

  // Les conditions se résolvent **dans l'ordre de §4** (Surcharge → Épuisement →
  // Sieste → Immobilisation). Un Planqué peut en subir plusieurs, sauf les trois
  // exclusives qui ne vont pas ensemble (D-030). Dérive n'est pas ici : elle se
  // résout avant l'attaque.
  for (const status of STATUS_ORDER) {
    if (!player.active || !hasStatus(player.active, status)) continue;
    if (status === 'SURCHARGE') {
      player.active.hp -= 10;
      state.log.push('Surcharge : 10 de stress.');
    } else if (status === 'EPUISEMENT') {
      player.active.hp -= 20;
      state.log.push('Épuisement : 20 de stress.');
      if (drawRandom(state) < 0.5) {
        clearStatus(player.active, 'EPUISEMENT');
        state.log.push('Épuisement guéri sur pile.');
      }
    } else if (status === 'SIESTE') {
      if (drawRandom(state) < 0.5) {
        clearStatus(player.active, 'SIESTE');
        state.log.push('Sieste terminée sur pile.');
      }
    } else if (status === 'IMMOBILISATION') {
      clearStatus(player.active, 'IMMOBILISATION');
      state.log.push('Immobilisation : le tour est passé.');
    }
  }

  if (player.active && player.active.hp <= 0) {
    knockOut(state, state.current === 'player' ? 'ai' : 'player');
    resolveEnd(state);
  }
  return state;
}

export function endTurn(state: BattleState): BattleState {
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  if (next.phase === 'ended') return next;
  // `checkup` mute l'état et peut le terminer (craquage par statut) : on lit la
  // valeur retournée, pas `next`, dont le rétrécissement de type est périmé.
  const afterCheckup = checkup(next);
  if (afterCheckup.phase === 'ended') return afterCheckup;
  // Un craquage de checkup ouvre une relève : le tour ne passe pas avant le choix.
  if (awaitingPromotion(afterCheckup)) return afterCheckup;

  next.current = next.current === 'player' ? 'ai' : 'player';
  next.turn += 1;
  // Limite de partie (D-031) : au-delà de `TURN_LIMIT`, égalité. La garde passe
  // **avant** `startTurn` : le tour 31 ne commence jamais.
  if (next.turn > TURN_LIMIT) {
    next.phase = 'ended';
    next.winner = null;
    next.log.push(`Limite de partie : ${TURN_LIMIT} tours, égalité.`);
    return next;
  }
  startTurn(next);
  return next;
}

/**
 * Exécute **une** action de `legalActions`. C'est le seul chemin d'exécution de
 * l'écran de combat (ticket #58) : la liste rendue et cette fonction parlent du
 * même type `BattleAction`, donc un bouton ne peut pas offrir autre chose que ce
 * que le moteur sait faire. Le `switch` est exhaustif : un nouveau membre de
 * l'union sans branche ici rend `tsc` rouge.
 */
export function applyAction(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'playBasic':
      return playBasic(state, action.uid, action.slot);
    case 'evolve':
      return evolve(state, action.uid, action.targetUid);
    case 'attachEnergy':
      return attachEnergy(state, action.targetUid);
    case 'retreat':
      return retreat(state, action.benchIndex);
    case 'attack':
      return attack(state, action.attackIndex);
    case 'ability':
      return useAbility(state);
    case 'priorityShift':
      return priorityShift(state, action.uid);
    case 'playAction':
      return playAction(state, action.uid);
    case 'promoteActive':
      return promoteActive(state, action.benchIndex);
    case 'endTurn':
      return endTurn(state);
    default:
      return assertNever(action);
  }
}

export function attackPreview(state: BattleState, attackIndex: number): number {
  const player = state.players[state.current];
  const opponent = state.players[state.current === 'player' ? 'ai' : 'player'];
  if (!player.active || !opponent.active) return 0;
  const card = getCard(player.active.cardId);
  const attack = isPlanque(card) ? card.attacks[attackIndex] : undefined;
  if (!attack) return 0;
  return attackDamage(player.active, opponent.active, attack, 'poste');
}

export function canEvolve(state: BattleState, handUid: string, targetUid: string): boolean {
  if (awaitingPromotion(state) || turnFinished(state)) return false;
  const player = state.players[state.current];
  const hand = player.hand.find((card) => card.uid === handUid);
  const target = findInPlay(player, targetUid);
  if (!hand || !target) return false;
  const card = getCard(hand.cardId);
  return Boolean(
    isPlanque(card) &&
      card.evolvesFrom === target.cardId &&
      target.playedTurn < state.turn &&
      target.evolvedTurn !== state.turn &&
      !isFirstTurnFor(state, state.current)
  );
}

export function legalAttacks(state: BattleState): Attack[] {
  if (awaitingPromotion(state)) return [];
  const player = state.players[state.current];
  // Une Pression termine le tour (D-033 §1) ; la Sieste et l'Immobilisation
  // l'interdisent (D-033 §2). Dans les trois cas, aucune Pression n'est légale.
  if (turnFinished(state) || !player.active) return [];
  const card = getCard(player.active.cardId);
  if (!isPlanque(card)) return [];
  if (hasStatus(player.active, 'SIESTE') || hasStatus(player.active, 'IMMOBILISATION')) return [];
  return card.attacks.filter((attack) => player.active && player.active.energy >= attack.cost);
}

/** Les Planqués du camp, Poste et Rack, dans cet ordre. */
function inPlay(player: PlayerState): CardInstance[] {
  return [player.active, ...player.bench].filter(Boolean) as CardInstance[];
}

/**
 * **Toutes** les actions que le moteur accepterait maintenant, et rien d'autre
 * (ticket #58).
 *
 * C'est l'inverse exact d'`applyAction` : l'écran de combat rend cette liste au
 * lieu de recalculer la légalité, donc il ne peut pas oublier une transition, et
 * aucun de ses boutons ne peut être refusé par le moteur. Conséquence : chaque
 * critère de jeu (premier tour, Collègue déjà joué, relève en attente…) n'a plus
 * qu'une seule écriture, celle d'ici.
 *
 * Deux cas particuliers :
 * - une **relève en attente** ne laisse que `promoteActive`, pour le camp dont le
 *   Poste a craqué — c'est `pendingPromotion` qui le dit, pas `current` ;
 * - `endTurn` est toujours offert tant que la partie vit, y compris quand il ne
 *   reste rien d'autre à faire.
 */
export function legalActions(state: BattleState): BattleAction[] {
  if (state.phase === 'ended') return [];

  const pending = state.pendingPromotion;
  if (pending) {
    const bench = state.players[pending].bench;
    return bench.flatMap((card, benchIndex) =>
      card ? [{ type: 'promoteActive', benchIndex } satisfies BattleAction] : []
    );
  }

  // D-033 §1 : une Pression lancée consomme le reste du tour. Seule la fin du
  // tour reste offerte — sauf relève en attente, traitée juste au-dessus.
  if (turnFinished(state)) return [{ type: 'endTurn' }];

  const player = state.players[state.current];
  const actions: BattleAction[] = [];

  // Main : cartes Action, évolutions, Changement de priorité (archiver une carte).
  for (const handCard of player.hand) {
    if (canPlayAction(state, handCard.uid)) actions.push({ type: 'playAction', uid: handCard.uid });
    const card = getCard(handCard.cardId);
    if (!isPlanque(card) || !card.evolvesFrom) continue;
    for (const target of inPlay(player)) {
      if (canEvolve(state, handCard.uid, target.uid)) {
        actions.push({ type: 'evolve', uid: handCard.uid, targetUid: target.uid });
      }
    }
  }
  if (canPriorityShift(state)) {
    for (const handCard of player.hand) actions.push({ type: 'priorityShift', uid: handCard.uid });
  }

  // Poser un Entrant : au Poste s'il est vide, ailleurs sur chaque place libre du Rack.
  const freeSlots: ('active' | number)[] = player.active ? [] : ['active'];
  player.bench.forEach((card, index) => {
    if (!card) freeSlots.push(index);
  });
  for (const handCard of player.hand) {
    const card = getCard(handCard.cardId);
    if (!isPlanque(card) || card.stage !== 'ENTRANT') continue;
    for (const slot of freeSlots) actions.push({ type: 'playBasic', uid: handCard.uid, slot });
  }

  // Talent du Poste, une fois par tour.
  if (!player.hasUsedAbility && player.active) {
    const card = getCard(player.active.cardId);
    if (isPlanque(card) && card.ability) actions.push({ type: 'ability' });
  }

  // Café : 1 par tour, un par Planqué en jeu — mais aucun attachement au premier tour (§4, D-030).
  if (!player.energyAttached && player.energyZone > 0 && !isOpeningTurn(state)) {
    for (const target of inPlay(player)) actions.push({ type: 'attachEnergy', targetUid: target.uid });
  }

  // Rotation : une fois par tour, vers un Rack occupé, si le Poste peut payer.
  // Sieste et Immobilisation la bloquent aussi (D-033 (2)) : la liste ne propose pas
  // ce que `retreat` refuse.
  if (!player.hasRetreated && player.active && !retreatBlockedByStatus(player.active)) {
    const activeCard = getCard(player.active.cardId);
    if (isPlanque(activeCard)) {
      player.bench.forEach((card, benchIndex) => {
        if (card && player.active && player.active.energy >= activeCard.retreat) {
          actions.push({ type: 'retreat', benchIndex });
        }
      });
    }
  }

  // Pressions : `legalAttacks` dit ce que le café couvre, le tour dit s'il est déjà porté.
  if (!player.hasAttacked && player.active) {
    const card = getCard(player.active.cardId);
    if (isPlanque(card)) {
      for (const entry of legalAttacks(state)) {
        const attackIndex = card.attacks.indexOf(entry);
        if (attackIndex >= 0) actions.push({ type: 'attack', attackIndex });
      }
    }
  }

  actions.push({ type: 'endTurn' });
  return actions;
}

