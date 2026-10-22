import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { PlanqueCard } from '@/data/types';
import { applyAction, choose, createBattle, createInstance, endTurn, legalActions, useAbility } from '@/game/engine';
import type { BattleState } from '@/data/types';

/**
 * Un Talent qui attache un café à un Planqué **du Rack** (#165, D-082). Le joueur choisit la
 * cible ; le Talent de Polyvalence (au Poste) reste inchangé.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function basePlanque(): PlanqueCard {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  return base;
}

/** Un Talent « Bulletin de bonheur » : 1 par tour, un café vers le Rack. */
function enregistrerTalentRack() {
  CARD_BY_ID.set('test-talent-rack', {
    ...basePlanque(),
    id: 'test-talent-rack',
    ability: {
      name: 'Bulletin de bonheur',
      text: 'Une fois par tour : attache 1 café à un Planqué du Rack.',
      kind: 'attachEnergy',
      target: 'rack',
      oncePerTurn: true
    }
  });
}

/** Un Talent de Polyvalence : 1 par tour, au Poste (comportement inchangé). */
function enregistrerTalentPoste() {
  CARD_BY_ID.set('test-talent-poste', {
    ...basePlanque(),
    id: 'test-talent-poste',
    ability: {
      name: 'Polyvalence',
      text: 'Une fois par tour : attache 1 café à ce Planqué.',
      kind: 'attachEnergy',
      oncePerTurn: true
    }
  });
}

/** Une partie où le joueur (qui ouvre) a `id` au Poste ; le Rack garde sa mise en place. */
function scene(id: string): BattleState {
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  expect(state.current).toBe('player');
  state.players.player.active = createInstance(id, 0, 'poste-talent');
  return state;
}

describe('Café vers le Rack — Talent `attachEnergy` avec `target: rack` (#165, D-082)', () => {
  it('le Talent ouvre un choix : le joueur désigne le Planqué du Rack qui reçoit le café', () => {
    enregistrerTalentRack();
    const avant = scene('test-talent-rack');
    const apres = applyAction(avant, { type: 'ability' });

    expect(apres.pendingChoice?.kind).toBe('attacher');
    const cafe = apres.pendingChoice?.kind === 'attacher' ? apres.pendingChoice.cafe : undefined;
    expect(avant.players.player.cafeTypes).toContain(cafe);
    // Seules les cartes du Rack sont offertes, jamais le Poste.
    const offertes = legalActions(apres)
      .flatMap((action) => (action.type === 'choose' ? [action.uid] : []))
      .sort();
    const rack = avant.players.player.bench.flatMap((card) => (card ? [card.uid] : [])).sort();
    expect(offertes).toEqual(rack);
    expect(offertes).not.toContain('poste-talent');
  });

  it('le café part au Planqué du Rack désigné, pas au Poste', () => {
    enregistrerTalentRack();
    const avant = scene('test-talent-rack');
    const apres = applyAction(avant, { type: 'ability' });
    const cible = avant.players.player.bench.find((card) => card !== null)?.uid ?? '';

    const fin = applyAction(apres, { type: 'choose', uid: cible });
    expect(fin.pendingChoice).toBeNull();
    const cibleApres = fin.players.player.bench.find((card) => card?.uid === cible);
    // Mord : sans la cible Rack, le café irait au Poste et la cible resterait vide.
    expect(cibleApres?.energy).toHaveLength(1);
    expect(fin.players.player.active?.energy).toHaveLength(0);
    expect(fin.players.player.hasUsedAbility).toBe(true);
  });

  it('`choose` refuse le Poste : la cible doit être au Rack', () => {
    enregistrerTalentRack();
    const apres = applyAction(scene('test-talent-rack'), { type: 'ability' });
    expect(choose(apres, 'poste-talent')).toBe(apres);
  });

  it('sans Planqué au Rack, le Talent n’est pas proposé', () => {
    enregistrerTalentRack();
    const avant = scene('test-talent-rack');
    avant.players.player.bench = [null, null, null];
    expect(legalActions(avant).some((action) => action.type === 'ability')).toBe(false);
    // Mord : la demande directe est refusée aussi.
    expect(useAbility(avant)).toBe(avant);
  });

  it('le Talent reste 1 par tour, et la fin de tour reste possible après le choix', () => {
    enregistrerTalentRack();
    const avant = scene('test-talent-rack');
    const apres = applyAction(avant, { type: 'ability' });
    const cible = avant.players.player.bench.find((card) => card !== null)?.uid ?? '';
    const fin = applyAction(apres, { type: 'choose', uid: cible });
    expect(legalActions(fin).some((action) => action.type === 'ability')).toBe(false);
    // Le choix résolu rend la main : la fin de tour est de nouveau proposée.
    expect(legalActions(fin).some((action) => action.type === 'endTurn')).toBe(true);
    expect(endTurn(fin).current).toBe('ai');
  });

  it('le Talent de Polyvalence, au Poste, reste inchangé : pas de choix', () => {
    enregistrerTalentPoste();
    const avant = scene('test-talent-poste');
    const apres = applyAction(avant, { type: 'ability' });
    expect(apres.pendingChoice).toBeNull();
    expect(apres.players.player.active?.energy).toHaveLength(1);
  });
});
