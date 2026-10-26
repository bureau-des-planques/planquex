import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { ActionCard, AttackEffect, BattleState } from '@/data/types';
import { applyAction, choose, createBattle, createInstance, legalActions } from '@/game/engine';

/**
 * Chercher une carte dans le Deck et l'ajouter à la main (#161, D-080). Le joueur choisit,
 * la carte passe en main, et le Deck est mélangé par le générateur seedé.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];
const ATTAQUE = { type: 'attack', attackIndex: 0 } as const;
const COLLEGUE_ID = 'test-collegue-cherche';

function enregistrerPression(id: string, effects: AttackEffect[]) {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  CARD_BY_ID.set(id, { ...base, id, ability: undefined, attacks: [{ name: 'Test', cost: [], damage: 10, effects }] });
}

function enregistrerCollegue() {
  const collegue: ActionCard = {
    id: COLLEGUE_ID,
    name: 'Collègue cherché',
    kind: 'COLLEAGUE',
    faction: 'SUPPORT',
    rarity: '1S',
    flavor: '',
    glyph: '',
    palette: '',
    text: '',
    effects: []
  };
  CARD_BY_ID.set(COLLEGUE_ID, collegue);
}

/**
 * Une partie où le joueur a la Pression `effects` au Poste. Son Deck reçoit `colleguesDuDeck`
 * Collègues en tête, pour que le filtre ait quelque chose à départager.
 */
function scene(effects: AttackEffect[], { colleguesDuDeck = 0, mainPleine = false } = {}) {
  enregistrerCollegue();
  enregistrerPression('test-pression-cherche', effects);
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  expect(state.current).toBe('player');
  state.players.player.active = createInstance('test-pression-cherche', 0, 'poste-test');
  const colleguesEnTete = Array.from({ length: colleguesDuDeck }, (_, index) =>
    createInstance(COLLEGUE_ID, 0, `collegue-deck-${index}`)
  );
  state.players.player.deck = [...colleguesEnTete, ...state.players.player.deck.slice(colleguesDuDeck)];
  if (mainPleine) {
    state.players.player.hand = Array.from({ length: 10 }, (_, index) =>
      createInstance(BASICS[index % BASICS.length] ?? BASICS[0], 0, `main-pleine-${index}`)
    );
  }
  return state;
}

const cartesOffertes = (state: BattleState) =>
  legalActions(state)
    .flatMap((action) => (action.type === 'choose' ? [action.uid] : []))
    .sort();

describe('Chercher dans le Deck — primitive `search` (#161, D-080)', () => {
  it('chercher un Planqué ouvre un choix limité aux Planqués du Deck', () => {
    const avant = scene([{ kind: 'search', filter: 'PLANQUE' }], { colleguesDuDeck: 2 });
    const apres = applyAction(avant, ATTAQUE);

    expect(apres.pendingChoice).toEqual({ kind: 'chercher', who: 'player', filtre: 'PLANQUE' });
    const planques = apres.players.player.deck
      .filter((card) => isPlanque(getCard(card.cardId)))
      .map((card) => card.uid)
      .sort();
    // Mord : un Collègue du Deck n'est jamais offert quand le filtre demande un Planqué.
    expect(cartesOffertes(apres)).toEqual(planques);
    expect(legalActions(apres).some((action) => action.type === 'endTurn')).toBe(false);
  });

  it('chercher un Collègue ne propose que les Collègues du Deck', () => {
    const avant = scene([{ kind: 'search', filter: 'COLLEAGUE' }], { colleguesDuDeck: 2 });
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.pendingChoice).toEqual({ kind: 'chercher', who: 'player', filtre: 'COLLEAGUE' });
    expect(cartesOffertes(apres)).toEqual(
      apres.players.player.deck
        .filter((card) => card.cardId === COLLEGUE_ID)
        .map((card) => card.uid)
        .sort()
    );
  });

  it('la carte choisie passe du Deck à la main, et le journal la nomme', () => {
    const avant = scene([{ kind: 'search', filter: 'COLLEAGUE' }], { colleguesDuDeck: 2 });
    const apres = applyAction(avant, ATTAQUE);
    const choisie = cartesOffertes(apres)[0] ?? '';

    const fin = applyAction(apres, { type: 'choose', uid: choisie });
    expect(fin.pendingChoice).toBeNull();
    expect(fin.players.player.hand.map((card) => card.uid)).toContain(choisie);
    expect(fin.players.player.deck.map((card) => card.uid)).not.toContain(choisie);
    expect(fin.players.player.deck).toHaveLength(apres.players.player.deck.length - 1);
    expect(fin.log.at(-1)).toContain('Collègue cherché');
    expect(fin.actionLog.at(-1)?.action).toEqual({ type: 'choose', uid: choisie });
  });

  it('le Deck est mélangé après le choix : l’ordre change, et il est reproductible', () => {
    const avant = scene([{ kind: 'search', filter: 'PLANQUE' }]);
    const apres = applyAction(avant, ATTAQUE);
    const choisie = cartesOffertes(apres)[0] ?? '';
    const sansCarte = apres.players.player.deck.filter((card) => card.uid !== choisie).map((card) => card.uid);

    const fin = choose(apres, choisie);
    const melange = fin.players.player.deck.map((card) => card.uid);
    // Mord : sans mélange, le Deck garderait l'ordre qu'il avait sans la carte.
    expect(melange).not.toEqual(sansCarte);
    expect([...melange].sort()).toEqual([...sansCarte].sort());
    // Même graine, même mélange.
    expect(choose(applyAction(avant, ATTAQUE), choisie)).toEqual(fin);
  });

  it('sans carte à trouver, pas de choix : le Deck est mélangé tout de suite', () => {
    const avant = scene([{ kind: 'search', filter: 'COLLEAGUE' }], { colleguesDuDeck: 0 });
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.pendingChoice).toBeNull();
    expect(apres.players.player.deck.map((card) => card.uid)).not.toEqual(
      avant.players.player.deck.map((card) => card.uid)
    );
  });

  it('main pleine (10) : pas de choix, le Deck est mélangé', () => {
    const avant = scene([{ kind: 'search', filter: 'PLANQUE' }], { mainPleine: true });
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.pendingChoice).toBeNull();
    expect(apres.players.player.hand).toHaveLength(10);
  });

  it('`choose` refuse une carte qui n’est pas dans le Deck', () => {
    const avant = scene([{ kind: 'search', filter: 'PLANQUE' }]);
    const apres = applyAction(avant, ATTAQUE);
    const enMain = apres.players.player.hand[0]?.uid ?? '';
    expect(choose(apres, enMain)).toBe(apres);
    expect(choose(apres, 'carte-absente')).toBe(apres);
  });
});
