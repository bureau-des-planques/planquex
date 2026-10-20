import { describe, expect, it } from 'vitest';
import { getCard, isPlanque } from '@/data';
import type { BattleState, CafeSymbol, CardInstance, PlayerId } from '@/data/types';
import { createBattle } from '@/game/engine';
import { endTurnBonus, evaluatePosition } from '@/game/ia';
import type { EvaluationWeights } from '@/game/ia';
import { factionDeck } from '@/game/simulation';

/**
 * **Le modèle d'évaluation du niveau 2, corrigé avant tout re-pesage** (ticket #111).
 *
 * Deux défauts sont tenus ici :
 *
 * 1. le bonus de fin de tour a un **poids propre** (`endTurn`) : régler `hand` ne
 *    déplace plus l'arbitrage « jouer un coup de plus ou finir son tour », et le bonus
 *    est **nul** quand la main est pleine (le camp ne piochera pas) ;
 * 2. la menace adverse est comptée **une seule fois** : `safety` ne mesure que le
 *    Seuil restant au Poste, `threat` est la différence symétrique des deux menaces.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

/** Les poids par défaut, sauf les termes passés : une mesure isolée. */
function only(weights: Partial<EvaluationWeights>): EvaluationWeights {
  return {
    points: 0,
    board: 0,
    rival: 0,
    safety: 0,
    hand: 0,
    threat: 0,
    endTurn: 0,
    ...weights
  };
}

/** Un état où `who` a exactement le Planqué voulu au Poste, avec les cafés passés. */
function withTestActive(
  state: BattleState,
  who: PlayerId,
  cardId: string,
  energy: CafeSymbol[]
): BattleState {
  const card = getCard(cardId);
  if (!isPlanque(card)) throw new Error(`${cardId} n'est pas un Planqué`);
  const active: CardInstance = {
    uid: `test-${who}`,
    cardId,
    hp: card.hp,
    maxHp: card.hp,
    energy: [...energy],
    statuses: [],
    playedTurn: 0,
    evolvedTurn: null,
    damageReduction: 0
  };
  const player = { ...state.players[who], active, bench: [null, null, null] };
  return who === 'player'
    ? { ...state, players: { ...state.players, player } }
    : { ...state, players: { ...state.players, ai: player } };
}

describe('IA de niveau 2 — le modèle d’évaluation (ticket #111)', () => {
  it('le bonus de fin de tour a son propre poids, indépendant de la valeur d’une carte', () => {
    const state = createBattle(PLAYER_DECK, AI_DECK, 42);
    const player = state.players.ai;

    // Régler `hand` très haut ne doit pas gonfler le bonus de fin de tour.
    expect(endTurnBonus(player, only({ endTurn: 7, hand: 1000 }))).toBe(7);
    expect(endTurnBonus(player, only({ endTurn: 7, hand: 0 }))).toBe(7);
    // Et changer `endTurn` change bien le bonus, lui seul.
    expect(endTurnBonus(player, only({ endTurn: 11, hand: 1000 }))).toBe(11);
  });

  it('le bonus de fin de tour est nul quand la main est pleine : on ne piochera pas', () => {
    const state = createBattle(PLAYER_DECK, AI_DECK, 42);
    const player = state.players.ai;
    const first = player.hand[0];
    if (!first) throw new Error('main de départ vide');
    const pleine = { ...player, hand: Array.from({ length: 10 }, () => first) };

    expect(endTurnBonus(pleine, only({ endTurn: 4 }))).toBe(0);
    // Neuf cartes : on pioche encore, le bonus reste dû.
    const presque = { ...player, hand: Array.from({ length: 9 }, () => first) };
    expect(endTurnBonus(presque, only({ endTurn: 4 }))).toBe(4);
  });

  it('la sécurité du Poste est le Seuil restant : la menace n’est pas soustraite deux fois', () => {
    const base = createBattle(PLAYER_DECK, AI_DECK, 42);
    // Mon Poste : QVT Happiness Manager, Seuil 90, sans café — donc ma menace vaut 0.
    const moi = withTestActive(base, 'ai', 'qvt-happiness-manager', []);
    // Le Poste adverse porte une Pression à 40 (coût QVT + incolore, payé).
    const avecMenace = withTestActive(moi, 'player', 'qvt-happiness-manager', ['QVT', 'SSE']);

    // Seule la sécurité compte : le Seuil au Poste, sans la menace entrante.
    expect(evaluatePosition(avecMenace, 'ai', only({ safety: 1 }))).toBe(90);
    // Seule la menace compte : 0 − 40, une différence symétrique.
    expect(evaluatePosition(avecMenace, 'ai', only({ threat: 1 }))).toBe(-40);
    // Les deux ensemble : 90 − 40 = 50. Avec l'ancien modèle (menace soustraite
    // aussi par `safety`), on aurait lu (90 − 40) − 40 = 10.
    expect(evaluatePosition(avecMenace, 'ai', only({ safety: 1, threat: 1 }))).toBe(50);
  });
});
