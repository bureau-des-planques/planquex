import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import {
  attack,
  attachEnergy,
  createBattle,
  endTurn,
  evolve,
  legalActions,
  legalAttacks,
  playAction,
  playBasic,
  priorityShift,
  retreat,
  useAbility
} from '@/game/engine';
import { stepRng } from '@/game/rng';
import type { BattleState, CardInstance, Status } from '@/data/types';

/**
 * D-033 §1–3 — la Pression termine le tour, et Sieste/Immobilisation/Dérive
 * suivent la capture `docs/preuves/astuces-2026-10-20/` (`05`, `07`).
 *
 * Les trois règles sont nouvelles : elles ne sont pas vérifiées ailleurs, d'où
 * ce fichier dédié (ticket #76).
 */

const SEED = 1;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map(
  (card) => card.id
);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

/** Un tour du joueur, prêt à attaquer : café, Poste et cible solides. */
function battleForAttack(): BattleState {
  const state = createBattle(DECK, DECK, SEED);
  state.turn = 3;
  state.current = 'player';
  state.pendingPromotion = null;
  const player = state.players.player;
  player.hasAttacked = false;
  player.hasRetreated = false;
  player.energyAttached = false;
  const active = player.active;
  const defender = state.players.ai.active;
  if (!active || !defender) throw new Error('Poste vide');
  active.energy = 10;
  // Seuils montés : aucune Pression du set ne craque ici, donc pas de relève.
  active.maxHp = 300;
  active.hp = 300;
  defender.maxHp = 300;
  defender.hp = 300;
  defender.statuses = [];
  return state;
}

/** La première Pression que le café du Poste couvre. */
function affordableAttack(active: CardInstance): number {
  const card = getCard(active.cardId);
  if (!isPlanque(card)) throw new Error('Carte inconnue');
  const index = card.attacks.findIndex((entry) => entry.cost <= active.energy);
  if (index < 0) throw new Error('Aucune Pression abordable');
  return index;
}

describe('D-033 §1 — une Pression termine le tour', () => {
  it('met hasAttacked, puis ne laisse que endTurn (et le forfait) dans legalActions', () => {
    const state = battleForAttack();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');

    const after = attack(state, affordableAttack(active));

    expect(after.players.player.hasAttacked).toBe(true);
    expect(after.pendingPromotion).toBeNull();
    // Seuls restent la fin du tour et le forfait, que D-030 laisse ouvert tant que la partie vit.
    expect(legalActions(after)).toEqual([{ type: 'endTurn' }, { type: 'forfeit', who: 'player' }]);
  });

  it('refuse toutes les autres actions, en renvoyant l’état tel quel', () => {
    const state = battleForAttack();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const after = attack(state, affordableAttack(active));
    const poste = after.players.player.active;
    if (!poste) throw new Error('Poste vide');

    // Chaque fonction d'action lit la même garde (`turnFinished`) : elle refuse
    // avant même de regarder ses arguments, d'où les uid factices.
    expect(playBasic(after, 'peu-importe', 0)).toBe(after);
    expect(evolve(after, 'peu-importe', 'peu-importe')).toBe(after);
    expect(attachEnergy(after, poste.uid)).toBe(after);
    expect(retreat(after, 0)).toBe(after);
    expect(useAbility(after)).toBe(after);
    expect(playAction(after, 'peu-importe')).toBe(after);
    expect(priorityShift(after, 'peu-importe')).toBe(after);
    expect(attack(after, 0)).toBe(after);
  });

  it('laisse toujours finir le tour : endTurn passe la main', () => {
    const state = battleForAttack();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const after = attack(state, affordableAttack(active));

    const next = endTurn(after);

    expect(next).not.toBe(after);
    expect(next.current).toBe('ai');
  });
});

describe('D-033 §2 — Sieste et Immobilisation interdisent la Pression', () => {
  for (const status of ['SIESTE', 'IMMOBILISATION'] as Status[]) {
    it(`aucune Pression sous ${status}, et un refus sans tirage`, () => {
      const state = battleForAttack();
      const active = state.players.player.active;
      const defender = state.players.ai.active;
      if (!active || !defender) throw new Error('Poste vide');
      active.statuses = [status];
      // `stepRng(7).value = 0.0117` : l'ancien code aurait réveillé la Sieste et
      // attaqué. Le moteur ne doit plus consommer ce tirage du tout.
      state.rng = 7;
      const index = affordableAttack(active);
      const defenderHp = defender.hp;

      expect(legalAttacks(state)).toEqual([]);
      expect(legalActions(state).some((action) => action.type === 'attack')).toBe(false);

      const after = attack(state, index);

      expect(after.rng).toBe(state.rng);
      expect(after.players.player.active?.statuses).toContain(status);
      expect(after.players.ai.active?.hp).toBe(defenderHp);
    });
  }
});

describe('D-033 §3 — Dérive : échec = tour terminé, aucun Stress', () => {
  it('sur pile, la Pression n’est pas lancée et le tour est consommé', () => {
    const state = battleForAttack();
    const active = state.players.player.active;
    const defender = state.players.ai.active;
    if (!active || !defender) throw new Error('Poste vide');
    active.statuses = ['DERIVE'];
    // `stepRng(0).value = 0.266` : le lancer de Dérive échoue.
    state.rng = 0;
    const index = affordableAttack(active);
    const attackerHp = active.hp;
    const defenderHp = defender.hp;

    const after = attack(state, index);

    // Aucun Stress : ni sur l'attaquant (les 20 inventés), ni sur le défenseur.
    expect(after.players.player.active?.hp).toBe(attackerHp);
    expect(after.players.ai.active?.hp).toBe(defenderHp);
    // Le tour est terminé, comme après une Pression réussie.
    expect(after.players.player.hasAttacked).toBe(true);
    expect(after.log.join(' ')).toContain('le tour prend fin');
    // Seuls restent la fin du tour et le forfait, que D-030 laisse ouvert tant que la partie vit.
    expect(legalActions(after)).toEqual([{ type: 'endTurn' }, { type: 'forfeit', who: 'player' }]);
  });

  it('sur face, la Pression part normalement', () => {
    const state = battleForAttack();
    const active = state.players.player.active;
    const defender = state.players.ai.active;
    if (!active || !defender) throw new Error('Poste vide');
    active.statuses = ['DERIVE'];
    // `stepRng(1).value = 0.627` : le lancer de Dérive réussit.
    state.rng = 1;
    const index = affordableAttack(active);
    const defenderHp = defender.hp;

    const after = attack(state, index);

    expect(after.players.ai.active?.hp).toBeLessThan(defenderHp);
    expect(after.players.player.hasAttacked).toBe(true);
  });
});

describe('D-033 — le lancer seedé reste lisible', () => {
  it('stepRng donne bien les valeurs des deux cas ci-dessus', () => {
    // Ces deux assertions documentent le choix de graines des tests : si `rng.ts`
    // changeait de suite, les cas Dérive ne testeraient plus les mêmes branches.
    expect(stepRng(0).value).toBeLessThan(0.5);
    expect(stepRng(1).value).toBeGreaterThanOrEqual(0.5);
  });
});
