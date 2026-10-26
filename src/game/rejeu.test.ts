import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isBasic } from '@/data';
import { applyAction, createBattle } from '@/game/engine';
import { enveloppeDe, rejouer } from '@/game/rejeu';
import type { BattleState } from '@/data/types';

/**
 * **Le rejeu dit s'il a réussi** (#249).
 *
 * Avant, trois modules refaisaient chacun la même chose : `replayBattle`, puis une
 * comparaison de longueurs chez l'appelant (`codec.ts`, `partie.ts`) pour deviner qu'une
 * action avait été ignorée. `rejouer` rend un **verdict** — et ces tests vérifient qu'il
 * sait dire non, pas seulement oui.
 */

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

/** Une partie jouée de quelques coups, et son enveloppe. */
function partieJouee(): { state: BattleState; enveloppe: ReturnType<typeof enveloppeDe> } {
  let state = createBattle(DECK, DECK, 42);
  for (let i = 0; i < 6 && state.phase === 'playing'; i += 1) {
    state = applyAction(state, { type: 'endTurn' });
  }
  return { state, enveloppe: enveloppeDe(state, { playerDeck: DECK, aiDeck: DECK }) };
}

describe('rejouer — le verdict (#249)', () => {
  it('rejoue la même partie, à l’identique', () => {
    const { state, enveloppe } = partieJouee();
    const rejeu = rejouer(enveloppe);

    expect(rejeu.ok).toBe(true);
    if (!rejeu.ok) return;
    // Même état : plateau, générateur, journal **texte** et entrées typées (#250).
    expect(rejeu.state).toEqual(state);
  });

  it('l’enveloppe ne transporte que les actions, jamais les faits', () => {
    const { enveloppe } = partieJouee();
    // Contrôle : une entrée de journal typée n'a pas la forme d'une action.
    expect(enveloppe.actions.every((action) => typeof action === 'object' && 'type' in action)).toBe(true);
    expect(enveloppe.actions.some((action) => 'faits' in action)).toBe(false);
  });

  it('dit « deck-illegal » quand la partie n’a même pas pu commencer', () => {
    const { enveloppe } = partieJouee();
    const rejeu = rejouer({ ...enveloppe, playerDeck: [] });

    expect(rejeu.ok).toBe(false);
    if (rejeu.ok) return;
    expect(rejeu.raison).toBe('deck-illegal');
    expect(rejeu.state).toBeNull();
  });

  it('dit « journal-incoherent » quand une action du journal ne s’applique pas', () => {
    const { enveloppe } = partieJouee();
    // Le contrôle mord : le même journal **sans** l'action intruse est accepté.
    expect(rejouer(enveloppe).ok).toBe(true);

    const forgee = {
      ...enveloppe,
      actions: [...enveloppe.actions, { type: 'attachEnergy' as const, targetUid: 'inconnu' }]
    };
    const rejeu = rejouer(forgee);

    expect(rejeu.ok).toBe(false);
    if (rejeu.ok) return;
    expect(rejeu.raison).toBe('journal-incoherent');
    // La partie a bien été reconstruite : c'est le **journal** qui ne correspond pas.
    expect(rejeu.state).not.toBeNull();
  });
});
