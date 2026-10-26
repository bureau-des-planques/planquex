import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { AttackEffect, BattleState } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions } from '@/game/engine';

/**
 * Révéler une carte ou la main (#160, D-078). Visibilité : le journal, lu par les deux camps ;
 * aucun changement d'état hors du tirage seedé d'une révélation partielle.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];
const ATTAQUE = { type: 'attack', attackIndex: 0 } as const;

/** Enregistre une Pression gratuite portant `effects` sur un Entrant réel. */
function enregistrerPression(id: string, effects: AttackEffect[]) {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  CARD_BY_ID.set(id, { ...base, id, ability: undefined, attacks: [{ name: 'Test', cost: [], damage: 10, effects }] });
}

/** Le joueur (qui ouvre) a la Pression ; la Direction a une main de `adverse` cartes connues. */
function scene(effects: AttackEffect[], adverse: number): BattleState {
  enregistrerPression('test-pression-revele', effects);
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  expect(state.current).toBe('player');
  state.players.player.active = createInstance('test-pression-revele', 0, 'poste-test');
  state.players.ai.hand = Array.from({ length: adverse }, (_, index) =>
    createInstance(BASICS[index + 3] ?? BASICS[0], 0, `adverse-${index}`)
  );
  return state;
}

/** Le nom de chaque carte de la main adverse, dans l'ordre. */
const nomsDe = (state: BattleState) => state.players.ai.hand.map((card) => getCard(card.cardId)?.name ?? '');

describe('Révéler une carte ou la main — primitive `reveal` (#160, D-078)', () => {
  it('révéler toute la main écrit chaque carte dans le journal, sans rien changer de la main', () => {
    const avant = scene([{ kind: 'reveal' }], 3);
    const apres = applyAction(avant, ATTAQUE);

    // Mord : sans la primitive, aucun nom ne serait écrit.
    for (const nom of nomsDe(avant)) expect(apres.log.join('\n')).toContain(nom);
    // Aucun changement d'état hors du journal : main, Deck et Rebut adverses sont intacts.
    expect(apres.players.ai.hand).toEqual(avant.players.ai.hand);
    expect(apres.players.ai.deck).toEqual(avant.players.ai.deck);
    expect(apres.players.ai.discard).toEqual(avant.players.ai.discard);
    expect(apres.pendingChoice).toBeNull();
  });

  it('une révélation partielle montre une seule carte, tirée au hasard seedé', () => {
    const avant = scene([{ kind: 'reveal', amount: 1 }], 3);
    const apres = applyAction(avant, ATTAQUE);
    const montrees = nomsDe(avant).filter((nom) => apres.log.join('\n').includes(`: ${nom}.`));
    expect(montrees).toHaveLength(1);
    // La main n'est pas modifiée, et le même seed révèle la même carte.
    expect(apres.players.ai.hand).toEqual(avant.players.ai.hand);
    expect(applyAction(avant, ATTAQUE).log).toEqual(apres.log);
  });

  it('révéler une main vide ne journalise rien et ne bloque rien', () => {
    const avant = scene([{ kind: 'reveal' }], 0);
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.log.some((entry) => entry.startsWith('Révélé'))).toBe(false);
    expect(apres.pendingChoice).toBeNull();
  });

  it('la révélation ne crée aucune action pour le joueur', () => {
    const avant = scene([{ kind: 'reveal' }], 2);
    const apres = applyAction(avant, ATTAQUE);
    // Le tour de l'attaque est consommé comme d'habitude : seule la fin de tour reste.
    expect(legalActions(apres).map((action) => action.type)).toEqual(['endTurn', 'forfeit']);
  });
});
