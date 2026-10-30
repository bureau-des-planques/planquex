import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID } from '@/data';
import { autoDeck } from '@/game/deck';
import { applyAction, legalActions } from './engine';
import { etatFinScriptee, estFinScriptee, SCENARIO_FIN } from './scenario-fin';

/**
 * **La fin scriptée du tutoriel** (30/10/2026) : le testeur la **joue**, et le contrat dit
 * deux choses — on y arrive en position de gagner, et la Pression y suffit.
 */
/** Deux Decks légaux : le scénario pose les Postes, il ne compose pas les Decks. */
const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 3]));
const deck = autoDeck(owned).deck;
const direction = autoDeck(owned).deck;

describe('la fin scriptée met le joueur en position de gagner', () => {
  it('pose les deux Postes, et les Interventions déjà marquées', () => {
    const state = etatFinScriptee(deck, direction);

    expect(estFinScriptee(state)).toBe(true);
    expect(state.phase).toBe('playing');
    expect(state.current).toBe('player');
    expect(state.players.player.points).toBe(2);
    expect(state.players.ai.points).toBe(1);
    // Le Poste du joueur est le Technicien système ; celui de la Direction est le fantôme.
    expect(CARD_BY_ID.get(state.players.player.active!.cardId)!.name).toBe('Technicien système');
    expect(CARD_BY_ID.get(state.players.ai.active!.cardId)!.name).toBe('Chef de projet fantôme');
    expect(state.players.ai.active!.hp).toBe(SCENARIO_FIN.hpDirection);
  });

  it('**une** Pression termine la partie, pour le joueur', () => {
    let state = etatFinScriptee(deck, direction);
    const attaque = legalActions(state).find((action) => action.type === 'attack');
    // **Le contrôle mord** : sans Pression jouable, l'étape ne serait plus « la jouer ».
    expect(attaque, 'une Pression est jouable').toBeTruthy();

    state = applyAction(state, attaque!);
    expect(state.phase).toBe('ended');
    expect(state.winner).toBe('player');
    expect(state.players.player.points).toBe(3);
    // **La troisième Intervention**, pas un plateau vidé : c'est ce que l'étape raconte.
    expect(state.endReason).toBe('interventions');
  });
});
