import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard } from '@/data';
import {
  attack,
  attackPreview,
  canEvolve,
  createBattle,
  createInstance,
  endTurn,
  evolve
} from '@/game/engine';
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

/** 20 cartes dont au moins un N+1 : suffisant pour `createBattle`. */
const DECK = [...BASICS, ...BASICS].slice(0, 20);

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

  it('promeut l’Open-space et continue la partie quand un remplaçant existe', () => {
    const state = freshBattle();
    const lethal = structuredClone(state);
    const active = lethal.players.player.active;
    if (!active) throw new Error('Aucun Planqué au Poste');
    active.hp = 5;
    active.status = 'SURCHARGE';

    const after = endTurn(lethal);

    // Comportement actuel du moteur : promotion automatique, sans choix du
    // joueur, alors qu'AGENTS.md §4 dit « l'Open-space choisit la relève ».
    expect(after.phase).toBe('playing');
    expect(after.players.player.active).not.toBeNull();
    expect(after.current).toBe('ai');
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
});
