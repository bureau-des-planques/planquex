import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import { applyAction, attackDamage, createBattle, createInstance } from '@/game/engine';
import type { BattleState, EntreeJournal, PlayerId } from '@/data/types';

/**
 * **Le journal d'actions porte ses faits** (#250).
 *
 * Avant, l'écran re-déduisait tout : le Stress en comparant deux états, le craquage en
 * regardant le Rebut, et la Pression refusée en cherchant « Dérive » **dans une phrase
 * française**. Ces tests prouvent que la transition dit elle-même ce qu'elle a produite, et
 * que le contrat écrit de `types.ts` — « une action refusée n'entre pas au journal » — est
 * enfin vrai.
 *
 * Chacun porte son **contrôle qui mord** : l'assertion négative qui l'accompagne échouerait
 * si le fait était inventé, recopié ou deviné.
 */

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(seed = 5): BattleState {
  return createBattle(DECK, DECK, seed);
}

/** Donne au Poste `who` de quoi payer sa première Pression (coût typé, D-037). */
function payer(state: BattleState, who: PlayerId): void {
  const active = state.players[who].active;
  if (!active) throw new Error('Poste vide');
  const card = getCard(active.cardId);
  if (!isPlanque(card)) throw new Error('Pas un Planqué');
  active.energy = [...card.attacks[0]!.cost];
  state.players[who].hasAttacked = false;
}

describe('faits — une Pression qui touche porte son Stress réel (#250)', () => {
  it('l’entrée dit le montant appliqué, et il vient du moteur', () => {
    const state = freshBattle();
    payer(state, 'player');
    const source = state.players.player.active!;
    const cible = state.players.ai.active!;
    const card = getCard(source.cardId);
    if (!isPlanque(card)) throw new Error('Pas un Planqué');
    const attendu = attackDamage(source, cible, card.attacks[0]!, 'poste');

    const after = applyAction(state, { type: 'attack', attackIndex: 0 });
    const entree = after.actionLog.at(-1);

    expect(entree?.action).toEqual({ type: 'attack', attackIndex: 0 });
    expect(entree?.faits).toContainEqual({
      type: 'stress',
      uid: cible.uid,
      montant: attendu,
      auPoste: true
    });
    // Le contrôle mord : un montant inventé ne passe pas.
    expect(entree?.faits.some((fait) => fait.type === 'stress' && fait.montant !== attendu)).toBe(false);
  });
});

describe('faits — un craquage et ses Interventions (#250)', () => {
  it('la transition dit les deux, au lieu de les faire déduire du Rebut', () => {
    const state = freshBattle();
    payer(state, 'player');
    const cible = state.players.ai.active!;
    cible.hp = 1; // la première Pression le craque
    // Un Banc garni : sans relève possible, la fin de partie prendrait le dessus.
    state.players.ai.bench[0] = createInstance(BASICS[0]!, state.turn);

    const after = applyAction(state, { type: 'attack', attackIndex: 0 });
    const faits = after.actionLog.at(-1)?.faits ?? [];

    expect(faits).toContainEqual({ type: 'craquage', uid: cible.uid, camp: 'ai' });
    expect(faits).toContainEqual({ type: 'interventions', camp: 'player', montant: 1 });
    // Contrôle : aucun autre craquage n'est annoncé, et rien n'est marqué à l'adversaire.
    expect(faits.some((fait) => fait.type === 'craquage' && fait.uid !== cible.uid)).toBe(false);
    expect(faits.some((fait) => fait.type === 'interventions' && fait.camp === 'ai')).toBe(false);
  });
});

describe('faits — une Pression refusée par une Condition (#250)', () => {
  it('Immobilisation : rien n’entre au journal, et l’état est rendu tel quel', () => {
    const state = freshBattle();
    payer(state, 'player');
    state.players.player.active!.statuses = ['IMMOBILISATION'];
    const avant = state.actionLog.length;

    const after = applyAction(state, { type: 'attack', attackIndex: 0 });

    // C'est **le** contrat de `types.ts` : une action refusée n'est pas journalisée.
    expect(after).toBe(state);
    expect(after.actionLog.length).toBe(avant);
    // Contrôle : la même action sans la Condition entre bien au journal.
    const libre = freshBattle();
    payer(libre, 'player');
    expect(applyAction(libre, { type: 'attack', attackIndex: 0 }).actionLog.length).toBe(1);
  });

  it('Dérive ratée : l’action EST journalisée, avec la cause du refus', () => {
    // Le lancer est seedé (D-033 §3) : on cherche une graine où il tombe sur « pile ».
    let trouvee: EntreeJournal | null = null;
    for (let seed = 1; seed <= 60 && trouvee === null; seed += 1) {
      const state = freshBattle(seed);
      payer(state, 'player');
      state.players.player.active!.statuses = ['DERIVE'];
      const entree = applyAction(state, { type: 'attack', attackIndex: 0 }).actionLog.at(-1);
      if (entree?.faits.some((fait) => fait.type === 'pressionRatee')) trouvee = entree;
    }

    // Sans cette graine, le test ne prouverait rien : il échoue plutôt que de passer à vide.
    expect(trouvee).not.toBeNull();
    expect(trouvee!.faits).toContainEqual({
      type: 'pressionRatee',
      uid: expect.any(String),
      cause: 'derive'
    });
    // Contrôle : une Dérive ratée ne porte **aucun** Stress — elle n'a pas frappé.
    expect(trouvee!.faits.some((fait) => fait.type === 'stress')).toBe(false);
  });
});

describe('faits — le Contrôle écrit du Stress sans aucune action « attack » (#250)', () => {
  it('la fin de tour porte le fait du Stress de Surcharge', () => {
    const state = freshBattle();
    const cible = state.players.ai.active!;
    cible.maxHp = 300;
    cible.hp = 300;
    cible.statuses = ['SURCHARGE'];

    const after = applyAction(state, { type: 'endTurn' });
    const faits = after.actionLog.at(-1)?.faits ?? [];

    expect(faits).toContainEqual({ type: 'stress', uid: cible.uid, montant: 10, auPoste: false });
    // Contrôle : la Surcharge vaut 10, pas 20 (c'est l'Épuisement qui vaut 20).
    expect(faits.some((fait) => fait.type === 'stress' && fait.montant === 20)).toBe(false);
  });
});
