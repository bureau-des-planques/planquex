import { getCard, isPlanque } from '@/data';
import type {
  Attack,
  AttackEffect,
  BattleState,
  CardInstance,
  PlayerId,
  PlayerState,
  Status
} from '@/data/types';
import { deckLegal } from '@/game/deck';
import { RULES, STATUS_ORDER } from '@/game/rules';

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
 * Vrai quand un Poste vient de craquer et que sa relève reste à choisir
 * (AGENTS.md §4). Tant que c'est vrai, aucune action n'est acceptée : il faut
 * résoudre la relève d'abord.
 */
function awaitingPromotion(state: BattleState): boolean {
  return state.pendingPromotion !== null;
}

const newUid = () => `u${++uidCounter}`;

export function createInstance(cardId: string, turn = 0): CardInstance {
  const card = getCard(cardId);
  if (!card) throw new Error(`Carte inconnue: ${cardId}`);
  // Une carte Action ne se pose jamais : son instance n'a pas de Seuil, mais elle vit
  // au Chariot et dans la main comme les autres (0 = pas de Seuil à afficher).
  const hp = isPlanque(card) ? card.hp : 0;
  return {
    uid: newUid(),
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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
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

  const isFirstPlayerFirstTurn = state.turn === 1 && state.current === 'player';
  if (!isFirstPlayerFirstTurn) {
    draw(state, state.current, 1);
  } else {
    state.log.push('Premier tour : tu ne pioches pas.');
  }

  if (player.energyZone === 0) {
    player.energyZone = 1;
    state.log.push(`${state.current === 'player' ? 'La machine à café' : 'La machine à café adverse'} produit 1 café.`);
  }
}

function hasBasicInHand(player: PlayerState): boolean {
  return player.hand.some((card) => {
    const definition = getCard(card.cardId);
    return isPlanque(definition) && definition.stage === 'ENTRANT';
  });
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
  const index = player.deck.findIndex((card) => {
    const definition = getCard(card.cardId);
    return isPlanque(definition) && definition.stage === 'ENTRANT';
  });
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

  const basics = player.hand.filter((card) => {
    const definition = getCard(card.cardId);
    return isPlanque(definition) && definition.stage === 'ENTRANT';
  });
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
  // Le seed est conservé pour les futurs tests déterministes.
  void seed;
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
    pendingPromotion: null
  };

  state.players.player.deck = shuffle(playerDeck.map((id) => createInstance(id)));
  state.players.ai.deck = shuffle(aiDeck.map((id) => createInstance(id)));

  setupPlayer(state, 'player');
  setupPlayer(state, 'ai');

  state.log.push('Le site ouvre. À toi de jouer.');
  startTurn(state);
  return state;
}

export function playBasic(state: BattleState, uid: string, slot: 'active' | number): BattleState {
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  const handCard = player.hand.find((card) => card.uid === uid);
  if (!handCard) return state;
  const card = getCard(handCard.cardId);
  if (!isPlanque(card) || card.stage !== 'ENTRANT') return state;

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
  if (awaitingPromotion(state)) return state;
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
  clearStatuses(target);
  target.evolvedTurn = next.turn;
  next.log.push(`${next.current === 'player' ? 'Tu fais évoluer' : 'L’IA fait évoluer'} ${card.name}.`);
  return next;
}

export function attachEnergy(state: BattleState, targetUid: string): BattleState {
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.energyAttached || player.energyZone <= 0) return state;
  if (next.turn === 1 && next.current === 'player') {
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
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.hasRetreated || !player.active) return state;
  const bench = player.bench[benchIndex];
  if (!bench) return state;
  const card = getCard(player.active.cardId);
  if (!isPlanque(card) || player.active.energy < card.retreat) return state;
  player.active.energy -= card.retreat;
  const outgoing = player.active;
  player.active = { ...bench, statuses: [] };
  player.bench[benchIndex] = outgoing;
  player.hasRetreated = true;
  next.log.push(`${next.current === 'player' ? 'Tu passes en rotation' : 'L’IA passe en rotation'} : ${getCard(bench.cardId)?.name}.`);
  return next;
}

export function useAbility(state: BattleState): BattleState {
  if (awaitingPromotion(state)) return state;
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

function attackDamage(attacker: CardInstance, defender: CardInstance, attack: Attack): number {
  const attackerCard = getCard(attacker.cardId);
  const defenderCard = getCard(defender.cardId);
  if (!isPlanque(attackerCard) || !isPlanque(defenderCard)) return 0;
  const weakness = defenderCard.weakness === attackerCard.faction ? 20 : 0;
  const reduction = defenderCard.ability?.kind === 'reduceDamage' ? defenderCard.ability.amount ?? 0 : 0;
  return Math.max(0, attack.damage + weakness - reduction);
}

function hasStatus(card: CardInstance, status: Status): boolean {
  return card.statuses.includes(status);
}

function clearStatus(card: CardInstance, status: Status) {
  card.statuses = card.statuses.filter((entry) => entry !== status);
}

/** Une évolution, une rotation ou un changement de Poste remettent les conditions à zéro (§4). */
function clearStatuses(card: CardInstance) {
  card.statuses = [];
}

/** Ajoute une condition si elle n'y est pas déjà (on ne cumule pas deux Surcharges). */
function applyStatus(target: CardInstance, status: Status) {
  if (!hasStatus(target, status)) target.statuses.push(status);
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
      default:
        break;
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
  if (awaitingPromotion(state)) return false;
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
 * Collègue à son premier tour — §4 ne l'en prive pas, contrairement à la pioche et au café.
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
    `${next.current === 'player' ? 'Tu joues' : 'L’IA joue'} ${card.name} (${card.kind === 'OBJET' ? 'Objet' : 'Collègue'}).`
  );
  return next;
}

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

  if (state.players[attackerId].points >= 3) {
    state.phase = 'ended';
    state.winner = attackerId;
    state.log.push(`${attackerId === 'player' ? 'Tu gagnes' : 'L’IA gagne'} : 3 Interventions.`);
    return;
  }

  if (defender.bench.some(Boolean)) {
    // §4 : c'est le joueur dont le Poste a craqué qui choisit sa relève. Le
    // moteur ne choisit pas à sa place ; il attend `promoteActive`.
    state.pendingPromotion = defenderId;
    state.log.push(
      defenderId === 'player' ? 'Tu dois choisir ta relève.' : 'La Direction doit choisir sa relève.'
    );
  } else {
    state.phase = 'ended';
    state.winner = attackerId;
    state.log.push(`${attackerId === 'player' ? 'Tu gagnes' : 'L’IA gagne'} : plus aucun Planqué.`);
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
  return next;
}

/**
 * « Changement de priorité » (D-004) : une fois par tour, au Poste, archiver
 * 1 carte du courrier puis en piocher 1. Le mot-clé est porté par la carte au
 * Poste ; `RULES.priorityShiftEnabled` coupe le mot-clé sans toucher aux cartes.
 */
export function priorityShift(state: BattleState, uid: string): BattleState {
  if (!RULES.priorityShiftEnabled || awaitingPromotion(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.hasUsedPriorityShift || !player.active) return state;
  const active = getCard(player.active.cardId);
  if (!isPlanque(active) || !active.keywords?.includes('priorityShift')) return state;

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
  if (player.hasAttacked || !player.active || !opponent.active) return state;
  const card = getCard(player.active.cardId);
  const targetCard = getCard(opponent.active.cardId);
  if (!isPlanque(card) || !isPlanque(targetCard)) return state;
  const attack = card.attacks[attackIndex];
  if (!attack || player.active.energy < attack.cost) return state;

  if (hasStatus(player.active, 'IMMOBILISATION')) {
    next.log.push('Immobilisation : impossible d’attaquer.');
    return next;
  }
  if (hasStatus(player.active, 'SIESTE')) {
    if (Math.random() < 0.5) {
      clearStatus(player.active, 'SIESTE');
      next.log.push('Sieste : réveillé sur pile.');
    } else {
      next.log.push('Sieste : toujours endormi.');
      return next;
    }
  }
  if (hasStatus(player.active, 'DERIVE') && Math.random() < 0.5) {
    player.active.hp -= 20;
    next.log.push('Dérive : l’attaque échoue, 20 de stress.');
    knockOut(next, next.current === 'player' ? 'ai' : 'player');
    return next;
  }

  const damage = attackDamage(player.active, opponent.active, attack);
  opponent.active.hp -= damage;
  next.log.push(`${card.name} utilise ${attack.name} : ${damage} de stress.`);
  applyEffects(next, next.current, player.active, opponent.active, attack);
  player.hasAttacked = true;

  knockOut(next, next.current);
  // Si l'attaquant s'est craqué lui-même (selfDamage), l'adversaire marque.
  if (player.active && player.active.hp <= 0) {
    knockOut(next, next.current === 'player' ? 'ai' : 'player');
  }
  return next;
}

function checkup(state: BattleState): BattleState {
  const player = state.players[state.current];
  if (!player.active) return state;

  // Les conditions se résolvent **dans l'ordre de §4** (Surcharge → Épuisement →
  // Sieste → Immobilisation), et un Planqué peut en subir plusieurs. Dérive n'est pas ici :
  // elle se résout avant l'attaque.
  for (const status of STATUS_ORDER) {
    if (!player.active || !hasStatus(player.active, status)) continue;
    if (status === 'SURCHARGE') {
      player.active.hp -= 10;
      state.log.push('Surcharge : 10 de stress.');
    } else if (status === 'EPUISEMENT') {
      player.active.hp -= 20;
      state.log.push('Épuisement : 20 de stress.');
      if (Math.random() < 0.5) {
        clearStatus(player.active, 'EPUISEMENT');
        state.log.push('Épuisement guéri sur pile.');
      }
    } else if (status === 'SIESTE') {
      if (Math.random() < 0.5) {
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
  startTurn(next);
  return next;
}

export function attackPreview(state: BattleState, attackIndex: number): number {
  const player = state.players[state.current];
  const opponent = state.players[state.current === 'player' ? 'ai' : 'player'];
  if (!player.active || !opponent.active) return 0;
  const card = getCard(player.active.cardId);
  const attack = isPlanque(card) ? card.attacks[attackIndex] : undefined;
  if (!attack) return 0;
  return attackDamage(player.active, opponent.active, attack);
}

export function canEvolve(state: BattleState, handUid: string, targetUid: string): boolean {
  if (awaitingPromotion(state)) return false;
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
  if (!player.active) return [];
  const card = getCard(player.active.cardId);
  if (!isPlanque(card)) return [];
  return card.attacks.filter((attack) => player.active && player.active.energy >= attack.cost);
}
