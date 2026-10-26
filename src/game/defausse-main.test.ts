import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { ActionCard, AttackEffect, BattleState } from '@/data/types';
import {
  applyAction,
  choose,
  createBattle,
  createInstance,
  legalActions
} from '@/game/engine';

/**
 * Défausser une carte de la main (#159, D-076).
 *
 * Les cartes qui le vendent ne sont pas encore câblées dans les données (leurs Talents
 * n'existent pas dans `src/data`) : on injecte une **fixture** dans le catalogue, comme
 * le fait `engine.test.ts`. La règle, elle, est celle du moteur.
 */

const SEED = 5;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);

/** Deck légal de 20 cartes (10 noms N+1 en double), comme `engine.test.ts`. */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

/** Enregistre une Pression gratuite (coût `[]`) portant `effects`, sur un Entrant réel. */
function enregistrerPression(id: string, effects: AttackEffect[]) {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  CARD_BY_ID.set(id, {
    ...base,
    id,
    ability: undefined,
    attacks: [{ name: 'Test', cost: [], damage: 10, effects }]
  });
}

/**
 * Une partie où le joueur (qui ouvre, graine 5) a la Pression `effects` au Poste, et où
 * chaque camp a une main de cartes connues.
 */
function scene(effects: AttackEffect[], { joueur = 2, adverse = 3 } = {}): BattleState {
  enregistrerPression('test-pression-defausse', effects);
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  expect(state.current).toBe('player');
  state.players.player.active = createInstance('test-pression-defausse', 0, 'fixture-poste');
  state.players.player.hand = Array.from({ length: joueur }, (_, index) =>
    createInstance(BASICS[index + 1] ?? BASICS[0], 0, `main-joueur-${index}`)
  );
  state.players.ai.hand = Array.from({ length: adverse }, (_, index) =>
    createInstance(BASICS[index + 3] ?? BASICS[0], 0, `main-adverse-${index}`)
  );
  return state;
}

const ATTAQUE = { type: 'attack', attackIndex: 0 } as const;

describe('Défausse de la main — primitive `discardHand` (#159, D-076)', () => {
  it("une défausse imposée retire une carte de la main adverse, au hasard", () => {
    const avant = scene([{ kind: 'discardHand', target: 'opponent', amount: 1 }], { adverse: 3 });
    const apres = applyAction(avant, ATTAQUE);

    // Mord : si l'effet était ignoré, la main adverse garderait ses 3 cartes.
    expect(apres.players.ai.hand).toHaveLength(2);
    expect(apres.players.ai.discard).toHaveLength(avant.players.ai.discard.length + 1);
    const retiree = apres.players.ai.discard.at(-1);
    expect(avant.players.ai.hand.map((card) => card.uid)).toContain(retiree?.uid);
    // Imposée : aucun choix ne reste ouvert pour le joueur.
    expect(apres.pendingChoice).toBeNull();
  });

  it('le tirage au hasard est seedé : même graine, même carte défaussée', () => {
    const avant = scene([{ kind: 'discardHand', target: 'opponent', amount: 1 }], { adverse: 3 });
    const premier = applyAction(avant, ATTAQUE);
    const second = applyAction(avant, ATTAQUE);
    expect(second.players.ai.discard.at(-1)?.uid).toBe(premier.players.ai.discard.at(-1)?.uid);
    expect(second).toEqual(premier);
  });

  it("une défausse imposée sur une main vide ne fait rien et ne bloque rien", () => {
    const avant = scene([{ kind: 'discardHand', target: 'opponent', amount: 1 }], { adverse: 0 });
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.players.ai.hand).toHaveLength(0);
    expect(apres.pendingChoice).toBeNull();
  });

  it('une défausse choisie ouvre un choix : le joueur désigne la carte, et lui seul', () => {
    const avant = scene([{ kind: 'discardHand', target: 'self', amount: 1 }], { joueur: 2 });
    const apres = applyAction(avant, ATTAQUE);

    expect(apres.pendingChoice).toEqual({ kind: 'defausse', who: 'player', restant: 1 });
    // Seules les cartes de sa main sont offertes, et le tour ne peut pas finir pendant le choix.
    const offertes = legalActions(apres)
      .filter((action) => action.type === 'choose')
      .map((action) => (action.type === 'choose' ? action.uid : ''))
      .sort();
    expect(offertes).toEqual(apres.players.player.hand.map((card) => card.uid).sort());
    expect(legalActions(apres).some((action) => action.type === 'endTurn')).toBe(false);
    // Mord : `endTurn` pendant le choix est refusé, l'état rendu tel quel.
    expect(applyAction(apres, { type: 'endTurn' })).toBe(apres);

    const choisie = apres.players.player.hand[0]?.uid ?? '';
    const fin = applyAction(apres, { type: 'choose', uid: choisie });
    expect(fin.pendingChoice).toBeNull();
    expect(fin.players.player.hand.map((card) => card.uid)).not.toContain(choisie);
    expect(fin.players.player.discard.map((card) => card.uid)).toContain(choisie);
    // Le choix est journalisé comme une action réelle (#83).
    expect(fin.actionLog.at(-1)?.action).toEqual({ type: 'choose', uid: choisie });
  });

  it('une carte absente de la main est refusée par `choose`', () => {
    const avant = scene([{ kind: 'discardHand', target: 'self', amount: 1 }], { joueur: 2 });
    const apres = applyAction(avant, ATTAQUE);
    expect(choose(apres, 'carte-qui-nexiste-pas')).toBe(apres);
    // Mord : sans choix ouvert, `choose` ne touche à rien.
    expect(choose(avant, 'main-joueur-0')).toBe(avant);
  });

  it('une défausse de deux cartes se résout en deux choix successifs', () => {
    const avant = scene([{ kind: 'discardHand', target: 'self', amount: 2 }], { joueur: 3 });
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.pendingChoice).toEqual({ kind: 'defausse', who: 'player', restant: 2 });

    const premier = applyAction(apres, { type: 'choose', uid: 'main-joueur-0' });
    expect(premier.pendingChoice).toEqual({ kind: 'defausse', who: 'player', restant: 1 });
    expect(premier.players.player.hand).toHaveLength(2);

    const second = applyAction(premier, { type: 'choose', uid: 'main-joueur-1' });
    expect(second.pendingChoice).toBeNull();
    expect(second.players.player.hand).toHaveLength(1);
  });

  it('une défausse choisie sur une main vide n’ouvre aucun choix', () => {
    const avant = scene([{ kind: 'discardHand', target: 'self', amount: 1 }], { joueur: 0 });
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.pendingChoice).toBeNull();
  });

  it('une Pression qui défausse sa propre main n’est pas proposée sur une main vide (Q3 bis)', () => {
    const avant = scene([{ kind: 'discardHand', target: 'self', amount: 1 }], { joueur: 0 });
    // Mord : sans le garde, l'attaque serait proposée et jouée.
    expect(legalActions(avant).some((action) => action.type === 'attack')).toBe(false);
    expect(applyAction(avant, ATTAQUE)).toBe(avant);
  });

  it('une défausse imposée reste proposée même quand ma propre main est vide (Q3 bis)', () => {
    const avant = scene([{ kind: 'discardHand', target: 'opponent', amount: 1 }], { joueur: 0, adverse: 2 });
    expect(legalActions(avant).some((action) => action.type === 'attack')).toBe(true);
    const apres = applyAction(avant, ATTAQUE);
    expect(apres.players.ai.hand).toHaveLength(1);
  });

  it('une carte Action qui défausse une carte adverse le fait aussi (même primitive)', () => {
    const collegue: ActionCard = {
      id: 'test-collegue-defausse',
      name: 'Test',
      kind: 'COLLEAGUE',
      faction: 'SUPPORT',
      rarity: '1S',
      flavor: '',
      glyph: '',
      palette: '',
      text: '',
      effects: [{ kind: 'discardHand', target: 'opponent', amount: 1 }]
    };
    CARD_BY_ID.set(collegue.id, collegue);
    const avant = scene([], { adverse: 2 });
    avant.players.player.hand = [createInstance(collegue.id, 0, 'collegue-test')];
    const apres = applyAction(avant, { type: 'playAction', uid: 'collegue-test' });
    expect(apres.players.ai.hand).toHaveLength(1);
    expect(apres.players.ai.discard).toHaveLength(avant.players.ai.discard.length + 1);
  });
});
