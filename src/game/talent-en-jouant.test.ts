import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { AttackEffect, BattleState, PlanqueCard } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions, useAbility } from '@/game/engine';

/**
 * Les Talents « en jouant » (#163, D-081) : résolus une fois, à la mise en jeu (pose ou
 * évolution), jamais parmi les actions `ability`.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function basePlanque(): PlanqueCard {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  return base;
}

/** Un Entrant portant un Talent « en jouant » `effects`. */
function enregistrerEntrant(effects: AttackEffect[]) {
  CARD_BY_ID.set('test-entrant-en-jouant', {
    ...basePlanque(),
    id: 'test-entrant-en-jouant',
    ability: { name: 'Sourcing', text: 'En jouant : pioche 1 carte.', kind: 'effects', effects, trigger: 'onPlay' }
  });
}

/** Un N+1 qui évolue depuis l'Entrant, portant le même Talent « en jouant ». */
function enregistrerEvolution(effects: AttackEffect[]) {
  CARD_BY_ID.set('test-n1-en-jouant', {
    ...basePlanque(),
    id: 'test-n1-en-jouant',
    stage: 'N+1',
    evolvesFrom: 'test-entrant-en-jouant',
    hp: 90,
    ability: { name: 'Audit', text: 'En jouant : pioche 1 carte.', kind: 'effects', effects, trigger: 'onPlay' }
  });
}

/** Une partie au tour 3 (évolution permise), le joueur au trait, son Deck garni. */
function scene(): BattleState {
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  state.turn = 3;
  expect(state.current).toBe('player');
  return state;
}

describe('Talent « en jouant » — déclenchement à la mise en jeu (#163, D-081)', () => {
  it('poser un Entrant au Poste déclenche son Talent une fois', () => {
    enregistrerEntrant([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = null;
    avant.players.player.hand = [createInstance('test-entrant-en-jouant', 0, 'jouant-poste')];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-poste', slot: 'active' });
    // Mord : sans déclenchement, la main resterait vide après la pose (la pioche, elle, la remplit).
    expect(apres.players.player.hand).toHaveLength(1);
    expect(apres.log.at(-1)).toContain('Sourcing');
  });

  it('poser au Banc déclenche le Talent aussi', () => {
    enregistrerEntrant([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.bench[0] = null;
    avant.players.player.hand = [createInstance('test-entrant-en-jouant', 0, 'jouant-banc')];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-banc', slot: 0 });
    expect(apres.players.player.hand).toHaveLength(1);
  });

  it('une évolution déclenche le Talent du N+1 qui arrive', () => {
    enregistrerEntrant([]);
    enregistrerEvolution([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = createInstance('test-entrant-en-jouant', 0, 'base-poste');
    avant.players.player.hand = [createInstance('test-n1-en-jouant', 0, 'evolue-main')];
    const apres = applyAction(avant, { type: 'evolve', uid: 'evolue-main', targetUid: 'base-poste' });
    expect(apres.players.player.active?.cardId).toBe('test-n1-en-jouant');
    // Mord : la main ne contient que la pioche déclenchée par l'évolution.
    expect(apres.players.player.hand).toHaveLength(1);
  });

  it('un Talent « en jouant » n’apparaît jamais parmi les actions `ability`', () => {
    enregistrerEntrant([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = createInstance('test-entrant-en-jouant', 0, 'poste-seul');
    expect(legalActions(avant).some((action) => action.type === 'ability')).toBe(false);
    // Mord : l'action directe est refusée, l'état rendu tel quel.
    expect(useAbility(avant)).toBe(avant);
  });

  it('le Talent « en jouant » se déclenche avant tout autre effet de la carte : il peut ouvrir un choix', () => {
    enregistrerEntrant([{ kind: 'discardHand', target: 'self', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = null;
    avant.players.player.hand = [
      createInstance('test-entrant-en-jouant', 0, 'jouant-choix'),
      createInstance(BASICS[5] ?? BASICS[0], 0, 'autre-main')
    ];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-choix', slot: 'active' });
    // Le choix s'ouvre à la pose : les actions du joueur sont bloquées jusqu'à la défausse.
    expect(apres.pendingChoice).toEqual({ kind: 'defausse', who: 'player', restant: 1 });
    expect(legalActions(apres).some((action) => action.type === 'endTurn')).toBe(false);
  });
});
