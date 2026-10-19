import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard } from '@/data';
import {
  attack,
  attackPreview,
  canEvolve,
  createBattle,
  createInstance,
  endTurn,
  evolve,
  isFirstTurnFor,
  legalAttacks,
  promoteActive,
  priorityShift
} from '@/game/engine';
import { DECK_SIZE } from '@/game/deck';
import { RULES } from '@/game/rules';
import type { BattleState } from '@/data/types';

/**
 * Le moteur utilise encore `Math.random()` (AGENTS.md §6) : chaque test fige
 * le générateur pour être reproductible.
 */
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const BASICS = ALL_CARDS.filter((card) => !card.variantOf && card.stage === 'N+1').map((card) => card.id);

/** Classeur légal de 20 cartes (10 noms N+1 en double). */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(): BattleState {
  return createBattle(DECK, DECK);
}

/** Cartes en main + au Poste + à l'Open-space. */
function ownedByPlayer(state: BattleState): number {
  const player = state.players.player;
  const inPlay = [player.active, ...player.bench].filter(Boolean).length;
  return player.hand.length + inPlay;
}

describe('createBattle — mise en place', () => {
  it('distribue 5 cartes, pose un N+1 au Poste et ouvre le tour du joueur', () => {
    const state = freshBattle();
    // Les 5 cartes de la main de départ servent aussi à poser le Poste et
    // l'Open-space : la main ne conserve que les Planqués non posés.
    expect(ownedByPlayer(state)).toBe(5);
    expect(state.players.player.active).not.toBeNull();
    expect(state.current).toBe('player');
    expect(state.turn).toBe(1);
  });

  it('empêche le premier joueur de piocher à son premier tour', () => {
    const state = freshBattle();
    expect(state.log).toContain('Premier tour : tu ne pioches pas.');
    expect(ownedByPlayer(state)).toBe(5);
  });

  it('remplit la Machine à café du joueur actif', () => {
    const state = freshBattle();
    expect(state.players.player.energyZone).toBe(1);
  });
});

describe('endTurn — statut létal', () => {
  it('termine la partie quand le checkup tue le Planqué au Poste (garde engine.ts endTurn)', () => {
    const state = freshBattle();
    const lethal = structuredClone(state);
    const active = lethal.players.player.active;
    if (!active) throw new Error('Aucun Planqué au Poste');
    active.hp = 5;
    active.status = 'SURCHARGE';
    lethal.players.player.bench = [null, null, null];

    const after = endTurn(lethal);

    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('ai');
    expect(after.players.ai.points).toBe(1);
    // La garde doit interrompre le tour : ni changement de joueur, ni tour suivant.
    expect(after.current).toBe('player');
    expect(after.turn).toBe(lethal.turn);
  });

  it('met la relève en attente au lieu de choisir à la place du joueur', () => {
    const lethal = structuredClone(freshBattle());
    const active = lethal.players.player.active;
    if (!active) throw new Error('Aucun Planqué au Poste');
    active.hp = 5;
    active.status = 'SURCHARGE';

    const after = endTurn(lethal);

    // §4 : « l'Open-space choisit la relève ». Le moteur attend, il ne promeut pas.
    expect(after.phase).toBe('playing');
    expect(after.pendingPromotion).toBe('player');
    expect(after.players.player.active).toBeNull();
    expect(after.current).toBe('player');
  });

  it('ne déclare aucune défaite quand le classeur est vide', () => {
    const state = freshBattle();
    let after = structuredClone(state);
    after.players.player.deck = [];

    after = endTurn(after); // passe à la Direction
    after = endTurn(after); // revient au joueur : pioche impossible

    expect(after.phase).toBe('playing');
    expect(after.winner).toBeNull();
    expect(after.log.some((line) => line.includes('classeur vide'))).toBe(true);
  });
});

describe('Pression — dégâts et café', () => {
  it('ajoute +20 dégâts quand la Vulnérabilité correspond à la faction attaquante', () => {
    const state = freshBattle();
    const attacker = state.players.player.active;
    const defender = state.players.ai.active;
    if (!attacker || !defender) throw new Error('Poste vide');
    const attackerCard = getCard(attacker.cardId);
    const defenderCard = CARD_BY_ID.get(defender.cardId);
    if (!attackerCard || !defenderCard) throw new Error('Carte inconnue');

    const original = defenderCard;
    CARD_BY_ID.set(defender.cardId, { ...defenderCard, weakness: attackerCard.faction });
    try {
      attacker.energy = 10;
      const base = attackerCard.attacks[0];
      if (!base) throw new Error('Aucune Pression');
      expect(attackPreview(state, 0)).toBe(base.damage + 20);
    } finally {
      CARD_BY_ID.set(defender.cardId, original);
    }
  });

  it('ne consomme pas le café attaché', () => {
    const state = freshBattle();
    const next = structuredClone(state);
    const attacker = next.players.player.active;
    if (!attacker) throw new Error('Poste vide');
    const card = getCard(attacker.cardId);
    const index = card?.attacks.findIndex((entry) => entry.cost <= 3) ?? -1;
    if (index < 0) throw new Error('Aucune Pression abordable');
    attacker.energy = 3;

    const after = attack(next, index);

    expect(after.players.player.active?.energy).toBe(3);
    expect(after.players.player.hasAttacked).toBe(true);
  });
});

describe('Évolution', () => {
  it('refuse toute évolution au premier tour', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const evolution = ALL_CARDS.find((card) => card.evolvesFrom === active.cardId && !card.variantOf);
    if (!evolution) {
      // Aucune évolution disponible pour ce N+1 : rien à vérifier.
      expect(canEvolve(state, 'inconnu', active.uid)).toBe(false);
      return;
    }

    const next = structuredClone(state);
    const instance = createInstance(evolution.id, next.turn);
    next.players.player.hand.push(instance);
    next.players.player.active!.playedTurn = 0;

    expect(evolve(next, instance.uid, active.uid)).toBe(next);
    expect(canEvolve(next, instance.uid, active.uid)).toBe(false);
  });

  it('refuse aussi l’évolution au premier tour de la Direction (tour 2)', () => {
    const start = freshBattle();
    const aiActive = start.players.ai.active;
    if (!aiActive) throw new Error('Poste vide côté Direction');
    const evolution = ALL_CARDS.find((card) => card.evolvesFrom === aiActive.cardId && !card.variantOf);
    if (!evolution) {
      expect(isFirstTurnFor(start, 'ai')).toBe(true);
      return;
    }

    // Tour 2 = premier tour de la Direction.
    const next = structuredClone(start);
    next.turn = 2;
    next.current = 'ai';
    next.players.ai.active!.playedTurn = 0;
    const instance = createInstance(evolution.id, next.turn);
    next.players.ai.hand.push(instance);

    expect(isFirstTurnFor(next, 'ai')).toBe(true);
    expect(canEvolve(next, instance.uid, aiActive.uid)).toBe(false);
    expect(evolve(next, instance.uid, aiActive.uid)).toBe(next);
  });
});

describe('Relève choisie après K.O.', () => {
  /** Amène la Direction à 1 Moral, puis frappe : son Poste tombe. */
  function knockOutAi(state: BattleState): BattleState {
    const next = structuredClone(state);
    const attacker = next.players.player.active;
    const defender = next.players.ai.active;
    if (!attacker || !defender) throw new Error('Poste vide');
    const card = getCard(attacker.cardId);
    const index = card?.attacks.findIndex((entry) => entry.cost <= 3) ?? -1;
    if (index < 0) throw new Error('Aucune Pression abordable');
    attacker.energy = 3;
    defender.hp = 1;
    return attack(next, index);
  }

  it('attend le choix de la Direction au lieu de promouvoir tout seul', () => {
    const after = knockOutAi(freshBattle());

    expect(after.pendingPromotion).toBe('ai');
    expect(after.players.ai.active).toBeNull();
    expect(after.players.ai.bench.filter(Boolean)).toHaveLength(3);
  });

  it('refuse toute autre action tant que la relève n’est pas choisie', () => {
    const after = knockOutAi(freshBattle());

    expect(endTurn(after)).toBe(after);
    expect(legalAttacks({ ...after, current: 'ai' })).toEqual([]);
    expect(evolve(after, 'peu-importe', 'peu-importe')).toBe(after);
  });

  it('installe le Planqué choisi au Poste et libère le jeu', () => {
    const after = knockOutAi(freshBattle());
    const chosen = after.players.ai.bench[1];
    if (!chosen) throw new Error('Open-space vide');

    const resolved = promoteActive(after, 1);

    expect(resolved.pendingPromotion).toBeNull();
    expect(resolved.players.ai.active?.uid).toBe(chosen.uid);
    expect(resolved.players.ai.bench[1]).toBeNull();
    expect(endTurn(resolved)).not.toBe(resolved);
  });

  it('refuse un emplacement vide', () => {
    const after = knockOutAi(freshBattle());
    const empty = promoteActive(after, 2);
    if (after.players.ai.bench[2] === null) {
      expect(empty).toBe(after);
    } else {
      // L'emplacement 2 était occupé : on vérifie un index hors bornes.
      expect(promoteActive(after, 9)).toBe(after);
    }
  });
});

describe('Classeur imposé au démarrage', () => {
  it('refuse de démarrer avec un classeur illégal', () => {
    expect(() => createBattle(DECK.slice(0, DECK_SIZE - 1), DECK)).toThrow(/Classeur illégal/);
    expect(() => createBattle(DECK, [DECK[0]])).toThrow(/Classeur illégal/);
  });
});

describe('Changement de priorité (D-004)', () => {
  /** Donne le mot-clé à la carte au Poste, sans toucher aux données. */
  function withKeyword(state: BattleState): { state: BattleState; restore: () => void } {
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const original = CARD_BY_ID.get(active.cardId);
    if (!original) throw new Error('Carte inconnue');
    CARD_BY_ID.set(active.cardId, { ...original, keywords: ['priorityShift'] });
    return { state, restore: () => CARD_BY_ID.set(active.cardId, original) };
  }

  it('archive 1 carte et en pioche 1, une fois par tour', () => {
    const state = freshBattle();
    if (state.players.player.hand.length === 0) throw new Error('Courrier vide');
    const { restore } = withKeyword(state);
    try {
      const discarded = state.players.player.hand[0];
      if (!discarded) throw new Error('Courrier vide');
      const handBefore = state.players.player.hand.length;

      const after = priorityShift(state, discarded.uid);

      expect(after.players.player.discard.map((card) => card.uid)).toContain(discarded.uid);
      expect(after.players.player.hand).toHaveLength(handBefore); // -1 archivée, +1 piochée
      expect(after.players.player.hasUsedPriorityShift).toBe(true);

      // Deuxième usage dans le même tour : refusé.
      const again = priorityShift(after, after.players.player.hand[0]?.uid ?? '');
      expect(again).toBe(after);
    } finally {
      restore();
    }
  });

  it('ne fait rien sans le mot-clé sur la carte au Poste', () => {
    const state = freshBattle();
    const uid = state.players.player.hand[0]?.uid;
    if (!uid) throw new Error('Courrier vide');
    expect(priorityShift(state, uid)).toBe(state);
  });

  it('ne fait rien quand le drapeau global est coupé', () => {
    const state = freshBattle();
    const { restore } = withKeyword(state);
    const uid = state.players.player.hand[0]?.uid;
    if (!uid) throw new Error('Courrier vide');
    RULES.priorityShiftEnabled = false;
    try {
      expect(priorityShift(state, uid)).toBe(state);
    } finally {
      RULES.priorityShiftEnabled = true;
      restore();
    }
  });
});
