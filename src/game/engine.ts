import { getCard } from '@/data';
import type {
  Attack,
  BattleState,
  Card,
  CardInstance,
  PlayerId,
  PlayerState,
  Status
} from '@/data/types';
import { deckLegal } from '@/game/deck';
import { RULES } from '@/game/rules';

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
 * Vrai quand un Poste vient d'être mis K.O. et que sa relève reste à choisir
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
  return {
    uid: newUid(),
    cardId,
    hp: card.hp,
    maxHp: card.hp,
    energy: 0,
    status: null,
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
    hasUsedPriorityShift: false
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
      state.log.push(`${who === 'player' ? 'Tu' : 'L’IA'} ne pioche pas : classeur vide.`);
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
  return player.hand.some((card) => getCard(card.cardId)?.stage === 'N+1');
}

/**
 * Pocket **n'a pas de reprise de poste** (D-022) : la main de départ contient
 * toujours au moins un N+1, sans remélange et sans pioche pour l'adversaire —
 * c'est le mulligan du TCG *physique* que §4 reprenait à tort.
 *
 * Le classeur étant garanti d'avoir au moins un N+1 (`deckLegal`), il y a
 * toujours de quoi échanger. L'échange se fait carte pour carte : la main reste
 * à 5 et le total des cartes du joueur ne bouge pas.
 */
function ensureBasicInHand(player: PlayerState) {
  if (hasBasicInHand(player)) return;
  const index = player.deck.findIndex((card) => getCard(card.cardId)?.stage === 'N+1');
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

  const basics = player.hand.filter((card) => getCard(card.cardId)?.stage === 'N+1');
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

/** Refuse un classeur non conforme : le moteur ne démarre pas une partie illégale. */
function assertDeckLegal(deck: string[], who: string) {
  const { ok, reasons } = deckLegal(deck);
  if (!ok) throw new Error(`Classeur illégal (${who}) : ${reasons.join(' ')}`);
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

  state.log.push('Le bureau ouvre. À toi de jouer.');
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
  if (!card || card.stage !== 'N+1') return state;

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
  if (!card || !card.evolvesFrom) return state;
  const target = findInPlay(player, targetUid);
  if (!target || target.cardId !== card.evolvesFrom) return state;
  if (target.playedTurn >= next.turn) return state;
  if (target.evolvedTurn === next.turn) return state;

  const damage = target.maxHp - target.hp;
  removeFromHand(player, uid);
  target.cardId = card.id;
  target.maxHp = card.hp;
  target.hp = Math.max(1, card.hp - damage);
  target.status = null;
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
  if (!card || player.active.energy < card.retreat) return state;
  player.active.energy -= card.retreat;
  const outgoing = player.active;
  player.active = { ...bench, status: null };
  player.bench[benchIndex] = outgoing;
  player.hasRetreated = true;
  next.log.push(`${next.current === 'player' ? 'Tu passes en relève' : 'L’IA passe en relève'} : ${getCard(bench.cardId)?.name}.`);
  return next;
}

export function useAbility(state: BattleState): BattleState {
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  const player = next.players[next.current];
  if (player.hasUsedAbility || !player.active) return state;
  const card = getCard(player.active.cardId);
  if (!card?.ability) return state;
  const ability = card.ability;
  if (ability.kind === 'heal') {
    player.active.hp = Math.min(player.active.maxHp, player.active.hp + (ability.amount ?? 10));
  } else if (ability.kind === 'antiStatus') {
    player.active.hp = Math.min(player.active.maxHp, player.active.hp + (ability.amount ?? 10));
    player.active.status = null;
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
  if (!attackerCard || !defenderCard) return 0;
  const weakness = defenderCard.weakness === attackerCard.faction ? 20 : 0;
  const reduction = defenderCard.ability?.kind === 'reduceDamage' ? defenderCard.ability.amount ?? 0 : 0;
  return Math.max(0, attack.damage + weakness - reduction);
}

function applyStatus(target: CardInstance, status: Status) {
  if (!target.status) target.status = status;
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
            player.active = { ...incoming, status: null };
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

function knockOut(state: BattleState, attackerId: PlayerId) {
  const defenderId: PlayerId = attackerId === 'player' ? 'ai' : 'player';
  const defender = state.players[defenderId];
  if (!defender.active || defender.active.hp > 0) return;

  const fallen = defender.active;
  const fallenCard = getCard(fallen.cardId);
  const points = fallenCard?.ex ? 2 : 1;
  state.players[attackerId].points += points;
  state.log.push(`${fallenCard?.name ?? 'Un Planqué'} est K.O. : ${points} Prime${points > 1 ? 's' : ''}.`);
  putInDiscard(defender, fallen);
  defender.active = null;

  if (state.players[attackerId].points >= 3) {
    state.phase = 'ended';
    state.winner = attackerId;
    state.log.push(`${attackerId === 'player' ? 'Tu gagnes' : 'L’IA gagne'} : 3 Primes.`);
    return;
  }

  if (defender.bench.some(Boolean)) {
    // §4 : c'est le joueur dont le Poste est K.O. qui choisit sa relève. Le
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
 * Relève après un K.O. : appelable par le joueur dont le Poste est vide, que ce
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
  player.active = { ...incoming, status: null };
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
  if (!active?.keywords?.includes('priorityShift')) return state;

  const discarded = removeFromHand(player, uid);
  if (!discarded) return state;
  putInDiscard(player, discarded);
  draw(next, next.current, 1);
  player.hasUsedPriorityShift = true;
  next.log.push(
    `${next.current === 'player' ? 'Tu archives' : 'L’IA archive'} ${getCard(discarded.cardId)?.name ?? 'une carte'} : Changement de priorité.`
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
  if (!card || !targetCard) return state;
  const attack = card.attacks[attackIndex];
  if (!attack || player.active.energy < attack.cost) return state;

  if (player.active.status === 'GELE') {
    next.log.push('Gelé : impossible d’attaquer.');
    return next;
  }
  if (player.active.status === 'BLOQUE') {
    if (Math.random() < 0.5) {
      player.active.status = null;
      next.log.push('Bloqué : réveil sur pile.');
    } else {
      next.log.push('Bloqué : toujours bloqué.');
      return next;
    }
  }
  if (player.active.status === 'DERIVE' && Math.random() < 0.5) {
    player.active.hp -= 20;
    next.log.push('Dérive : l’attaque échoue, 20 dégâts.');
    knockOut(next, next.current === 'player' ? 'ai' : 'player');
    return next;
  }

  const damage = attackDamage(player.active, opponent.active, attack);
  opponent.active.hp -= damage;
  next.log.push(`${card.name} utilise ${attack.name} : ${damage} dégâts.`);
  applyEffects(next, next.current, player.active, opponent.active, attack);
  player.hasAttacked = true;

  knockOut(next, next.current);
  // Si l'attaquant s'est K.O. lui-même (selfDamage), l'adversaire marque.
  if (player.active && player.active.hp <= 0) {
    knockOut(next, next.current === 'player' ? 'ai' : 'player');
  }
  return next;
}

function checkup(state: BattleState): BattleState {
  const player = state.players[state.current];
  if (!player.active) return state;
  const status = player.active.status;
  if (!status) return state;

  if (status === 'SURCHARGE') {
    player.active.hp -= 10;
    state.log.push('Surcharge : 10 dégâts.');
  } else if (status === 'BURNOUT') {
    player.active.hp -= 20;
    state.log.push('Burn-out : 20 dégâts.');
    if (Math.random() < 0.5) {
      player.active.status = null;
      state.log.push('Burn-out guéri sur pile.');
    }
  } else if (status === 'BLOQUE') {
    if (Math.random() < 0.5) {
      player.active.status = null;
      state.log.push('Bloqué guéri sur pile.');
    }
  } else if (status === 'GELE') {
    player.active.status = null;
    state.log.push('Gelé : le tour est passé.');
  }

  if (player.active.hp <= 0) {
    knockOut(state, state.current === 'player' ? 'ai' : 'player');
  }
  return state;
}

export function endTurn(state: BattleState): BattleState {
  if (awaitingPromotion(state)) return state;
  const next = clone(state);
  if (next.phase === 'ended') return next;
  // `checkup` mute l'état et peut le terminer (K.O. par statut) : on lit la
  // valeur retournée, pas `next`, dont le rétrécissement de type est périmé.
  const afterCheckup = checkup(next);
  if (afterCheckup.phase === 'ended') return afterCheckup;
  // Un K.O. de checkup ouvre une relève : le tour ne passe pas avant le choix.
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
  const attack = card?.attacks[attackIndex];
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
    card?.evolvesFrom === target.cardId &&
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
  if (!card) return [];
  return card.attacks.filter((attack) => player.active && player.active.energy >= attack.cost);
}
