import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import {
  createBattle,
  createInstance,
  evolve,
  legalActions,
  retreat
} from '@/game/engine';
import type { BattleState } from '@/data/types';

/**
 * D-033 (2) et (4), ticket #77 : la Rotation est bloquée par Sieste et Immobilisation
 * (capture `07` : « Les Pokémon Endormis ne peuvent ni attaquer ni battre en retraite »),
 * et Rotation comme évolution purgent les **effets d'attaque** (capture `05`).
 *
 * Le moteur est seedé : on choisit une graine explicite (comme `engine.test.ts`).
 */
const SEED = 1;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map(
  (card) => card.id
);

/** Chariot légal de 20 cartes (10 noms d'Entrants en double). */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(seed = SEED): BattleState {
  return createBattle(DECK, DECK, seed);
}

/** Le Poste du joueur, avec assez de cafés pour payer n'importe quelle Rotation. */
function readyToRetreat(state: BattleState): { state: BattleState; slot: number } {
  const next = structuredClone(state);
  const player = next.players.player;
  if (!player.active) throw new Error('Poste vide');
  const slot = player.bench.findIndex(Boolean);
  if (slot < 0) throw new Error('Rack vide');
  player.active.energy = 5;
  player.hasRetreated = false;
  return { state: next, slot };
}

function retreatActions(state: BattleState) {
  return legalActions(state).filter((action) => action.type === 'retreat');
}

describe('Rotation bloquée par Sieste et Immobilisation (D-033 (2))', () => {
  it('retreat() refuse quand le Poste dort', () => {
    const { state, slot } = readyToRetreat(freshBattle());
    state.players.player.active!.statuses = ['SIESTE'];

    // Refus : l'état reçu est rendu inchangé, aucun café dépensé.
    expect(retreat(state, slot)).toBe(state);
  });

  it('retreat() refuse quand le Poste est immobilisé', () => {
    const { state, slot } = readyToRetreat(freshBattle());
    state.players.player.active!.statuses = ['IMMOBILISATION'];

    expect(retreat(state, slot)).toBe(state);
  });

  it('legalActions n’offre pas la Rotation sous Sieste', () => {
    const { state } = readyToRetreat(freshBattle());
    // Sans statut, la Rotation est offerte : c'est le témoin.
    expect(retreatActions(state).length).toBeGreaterThan(0);

    state.players.player.active!.statuses = ['SIESTE'];
    expect(retreatActions(state)).toHaveLength(0);
  });

  it('legalActions n’offre pas la Rotation sous Immobilisation', () => {
    const { state } = readyToRetreat(freshBattle());
    state.players.player.active!.statuses = ['IMMOBILISATION'];
    expect(retreatActions(state)).toHaveLength(0);
  });

  it('accepte la Rotation sous Surcharge seule', () => {
    const { state, slot } = readyToRetreat(freshBattle());
    state.players.player.active!.statuses = ['SURCHARGE'];

    expect(retreatActions(state).length).toBeGreaterThan(0);
    expect(retreat(state, slot)).not.toBe(state);
  });

  it('accepte la Rotation sous Épuisement seul', () => {
    const { state, slot } = readyToRetreat(freshBattle());
    state.players.player.active!.statuses = ['EPUISEMENT'];

    expect(retreatActions(state).length).toBeGreaterThan(0);
    expect(retreat(state, slot)).not.toBe(state);
  });

  it('accepte la Rotation sous Dérive — elle ne bloque que l’attaque', () => {
    // D-033 : seul Sieste et Immobilisation interdisent la Rotation ; la Dérive se joue
    // avant l'attaque et ne touche pas la Rotation.
    const { state, slot } = readyToRetreat(freshBattle());
    state.players.player.active!.statuses = ['DERIVE'];

    expect(retreatActions(state).length).toBeGreaterThan(0);
    expect(retreat(state, slot)).not.toBe(state);
  });
});

describe('Rotation et évolution purgent les effets d’attaque (D-033 (4))', () => {
  it('la Rotation purge la réduction de dégâts du sortant', () => {
    const { state, slot } = readyToRetreat(freshBattle());
    const outgoing = state.players.player.active!;
    outgoing.damageReduction = 20;
    outgoing.statuses = ['SURCHARGE'];
    const outgoingUid = outgoing.uid;

    const after = retreat(state, slot);

    const benched = after.players.player.bench[slot];
    expect(benched?.uid).toBe(outgoingUid);
    // Le sortant ne garde ni statut, ni effet d'attaque.
    expect(benched?.statuses).toEqual([]);
    expect(benched?.damageReduction).toBe(0);
  });

  it('l’évolution purge la réduction de dégâts du Planqué qui évolue', () => {
    const state = structuredClone(freshBattle());
    const player = state.players.player;
    const active = player.active;
    if (!active) throw new Error('Poste vide');

    // Une évolution de test : on ne dépend d'aucune carte de données.
    const evolution = ALL_CARDS.filter(isPlanque).find(
      (card) => card.stage !== 'ENTRANT' && !card.variantOf
    );
    if (!evolution) throw new Error('Aucune évolution dans les données');
    const originalEvolution = CARD_BY_ID.get(evolution.id);
    if (!isPlanque(originalEvolution)) throw new Error('Carte inconnue');
    CARD_BY_ID.set(evolution.id, { ...originalEvolution, evolvesFrom: active.cardId });

    try {
      state.turn = 3;
      state.current = 'player';
      active.playedTurn = 0;
      active.evolvedTurn = null;
      active.statuses = ['SURCHARGE'];
      active.damageReduction = 20;
      const instance = createInstance(evolution.id, state.turn);
      player.hand.push(instance);

      const after = evolve(state, instance.uid, active.uid);

      expect(after.players.player.active?.cardId).toBe(evolution.id);
      expect(after.players.player.active?.statuses).toEqual([]);
      expect(after.players.player.active?.damageReduction).toBe(0);
    } finally {
      CARD_BY_ID.set(evolution.id, originalEvolution);
    }
  });

  it('conserve le Stress et les cafés du sortant (capture 05)', () => {
    const { state, slot } = readyToRetreat(freshBattle());
    const player = state.players.player;
    const outgoing = player.active!;
    const card = getCard(outgoing.cardId);
    if (!isPlanque(card)) throw new Error('Carte inconnue');
    const retreatCost = card.retreat;

    // 30 de dégâts (Stress) subis, et 5 cafés dont le coût de Rotation part.
    outgoing.hp = outgoing.maxHp - 30;
    outgoing.energy = retreatCost + 5;
    outgoing.damageReduction = 20;

    const after = retreat(state, slot);
    const benched = after.players.player.bench[slot];

    // Le Stress (Seuil − hp) est intact : la capture dit que le Planqué « garde tous
    // les dégâts subis ainsi que toutes les Énergies ».
    expect(benched?.hp).toBe(outgoing.maxHp - 30);
    // Les cafés restants suivent la carte sur le Rack (5 non dépensés).
    expect(benched?.energy).toBe(5);
  });
});
