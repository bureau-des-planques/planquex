import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { AttackEffect, BattleState } from '@/data/types';
import { applyAction, createBattle, createInstance, dessusDuDeck } from '@/game/engine';

/**
 * Regarder le dessus du Deck (#162, D-079). Lecture pure : l'ordre du Deck ne change pas,
 * le journal n'en parle pas, et `dessusDuDeck` ne donne la carte qu'à qui la demande.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];
const ATTAQUE = { type: 'attack', attackIndex: 0 } as const;

function enregistrerPression(id: string, effects: AttackEffect[]) {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  CARD_BY_ID.set(id, { ...base, id, ability: undefined, attacks: [{ name: 'Test', cost: [], damage: 10, effects }] });
}

function scene(effects: AttackEffect[]): BattleState {
  enregistrerPression('test-pression-regarde', effects);
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  expect(state.current).toBe('player');
  state.players.player.active = createInstance('test-pression-regarde', 0, 'poste-test');
  return state;
}

describe('Regarder le dessus du Deck — primitive `peek` (#162, D-079)', () => {
  it('regarder le dessus ne change ni l’ordre du Deck, ni la main, ni le journal', () => {
    const avant = scene([{ kind: 'peek' }]);
    const apres = applyAction(avant, ATTAQUE);

    // Mord : une pioche au lieu d'un regard raccourcirait le Deck et grossirait la main.
    expect(apres.players.player.deck).toEqual(avant.players.player.deck);
    expect(apres.players.player.hand).toEqual(avant.players.player.hand);
    // Aucune ligne de journal ajoutée par le regard : l'adversaire ne doit rien lire.
    expect(apres.log).toHaveLength(avant.log.length + 1);
    expect(apres.log.at(-1)).toContain('utilise Test');
  });

  it('`dessusDuDeck` donne la carte du dessus, sans rien modifier', () => {
    const avant = scene([]);
    const dessus = avant.players.player.deck[0];
    const carte = dessusDuDeck(avant, 'player');
    expect(carte?.id).toBe(dessus?.cardId);
    expect(avant.players.player.deck[0]).toBe(dessus);
  });

  it('`dessusDuDeck` ne donne le dessus que du camp demandé', () => {
    const avant = scene([]);
    // Mord : sans cloisonnement par camp, le dessus adverse serait lisible du joueur.
    expect(dessusDuDeck(avant, 'ai')?.id).toBe(avant.players.ai.deck[0]?.cardId);
    expect(dessusDuDeck(avant, 'ai')?.id).not.toBeUndefined();
  });

  it('`dessusDuDeck` ne donne rien sur un Deck vide', () => {
    const avant = scene([]);
    const vide = structuredClone(avant);
    vide.players.player.deck = [];
    expect(dessusDuDeck(vide, 'player')).toBeUndefined();
  });
});
