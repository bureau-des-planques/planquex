import { describe, expect, it } from 'vitest';
import { getCard, isPlanque } from '@/data';
import type { BattleState, CafeSymbol, CardInstance, PlayerId } from '@/data/types';
import { attackPreview, createBattle, legalAttacks } from '@/game/engine';
import { evaluatePosition } from '@/game/ia';
import type { EvaluationWeights } from '@/game/ia';
import { factionDeck } from '@/game/simulation';

/**
 * **La mesure de menace de l'IA paie les cafés typés** (ticket #108).
 *
 * L'évaluation du niveau 2 estimait les cafés **au nombre** alors que le moteur
 * exige `satisfiesCafeCost` (D-037) : un café d'un autre type ne paie pas un coût
 * typé. Ces tests relient les deux décisions : ce que `attackPreview` / `legalAttacks`
 * refusent, `evaluatePosition` ne doit pas le compter — ni comme **menace**, ni comme
 * **valeur de plateau**.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

/**
 * Un état où `who` a **exactement** le Planqué voulu au Poste, Banc vide, avec les
 * cafés passés — de quoi isoler une mesure d'évaluation sans dépendre du tirage.
 */
function withTestActive(state: BattleState, who: PlayerId, cardId: string, energy: CafeSymbol[]): BattleState {
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

/** Les poids par défaut, sauf les termes passés : une mesure isolée. */
function only(weights: Partial<EvaluationWeights>): EvaluationWeights {
  return { points: 0, board: 0, rival: 0, safety: 0, hand: 0, threat: 0, endTurn: 0, ...weights };
}

describe('IA de niveau 2 — la menace compte les cafés typés (ticket #108)', () => {
  // QVT Happiness Manager : Seuil 90, une Pression à ['QVT', 'INCOLORE'], 40 dégâts.
  it('des cafés étrangers au coût ne paient pas la Pression, même à nombre égal', () => {
    const base = createBattle(PLAYER_DECK, AI_DECK, 42);
    // Les deux Postes sont QVT : QVT n'est pas vulnérable à QVT, donc les dégâts
    // valent exactement 40, sans le +20 de Vulnérabilité.
    const defender = withTestActive(base, 'player', 'qvt-coach-sante', []);
    const etrangers = withTestActive(defender, 'ai', 'qvt-happiness-manager', ['SSE', 'RH']);
    const payes = withTestActive(defender, 'ai', 'qvt-happiness-manager', ['QVT', 'SSE']);

    // Le moteur, décision de référence : deux cafés de chaque côté, un seul coût payé.
    expect(legalAttacks({ ...etrangers, current: 'ai' })).toEqual([]);
    expect(attackPreview({ ...etrangers, current: 'ai' }, 0)).toBe(0);
    expect(attackPreview({ ...payes, current: 'ai' }, 0)).toBe(40);

    // L'évaluation : la menace du camp ai suit exactement la même décision.
    expect(evaluatePosition(etrangers, 'ai', only({ threat: 1 }))).toBe(0);
    expect(evaluatePosition(payes, 'ai', only({ threat: 1 }))).toBe(40);
  });

  it('la valeur de plateau ne compte que les cafés qui paient réellement', () => {
    const base = createBattle(PLAYER_DECK, AI_DECK, 42);
    const etrangers = withTestActive(base, 'ai', 'qvt-happiness-manager', ['SSE', 'RH']);
    const partiels = withTestActive(base, 'ai', 'qvt-happiness-manager', ['QVT']);
    const payes = withTestActive(base, 'ai', 'qvt-happiness-manager', ['QVT', 'SSE']);

    // boardValue = Seuil (90) × (1 + cafés utiles) ; le plateau adverse ne pèse pas.
    expect(evaluatePosition(etrangers, 'ai', only({ board: 1 }))).toBe(90);
    expect(evaluatePosition(partiels, 'ai', only({ board: 1 }))).toBe(90);
    expect(evaluatePosition(payes, 'ai', only({ board: 1 }))).toBe(270);
  });
});
