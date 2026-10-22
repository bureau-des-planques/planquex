import { describe, expect, it } from 'vitest';
import type { BattleState } from '@/data/types';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { factionDeck } from '@/game/simulation';

/**
 * Ticket #154 — le journal du moteur nomme les camps selon **qui joue**.
 *
 * En solo, le camp `ai` est la Direction : « L’IA pose » est juste et reste écrit tel
 * quel. En partie à deux, les **deux** camps sont tenus par des humains : « L’IA » est
 * faux, et « Tu » aussi (le camp `player` peut être tenu par l'adversaire). Le journal
 * nomme donc les camps (« le camp Toi », « le camp Direction »).
 *
 * Le journal vit dans l'état (`BattleState.log`), pas dans l'écran : le moteur doit donc
 * savoir qu'il tourne à deux. C'est l'option `deuxCamps` de `createBattle`.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

/**
 * Joue une partie entière, les deux camps, en prenant toujours la première action
 * légale qui n'est pas un forfait. Déterministe : même graine, même journal.
 */
function jouer(state: BattleState, maxCoups = 400): BattleState {
  let s = state;
  for (let i = 0; i < maxCoups && s.phase === 'playing'; i++) {
    const action = legalActions(s).find((a) => a.type !== 'forfeit');
    if (!action) break;
    s = applyAction(s, action);
  }
  return s;
}

/** Le mot « IA » ou un « Tu » / « tu » : ce que le journal ne doit pas dire à deux. */
const MOT_IA = /\bIA\b/;
const MOT_TU = /\b[Tt]u\b/;

describe('journal — une partie à deux ne nomme jamais l’IA (#154)', () => {
  it('aucune ligne du journal ne dit « IA » quand les deux camps sont humains', () => {
    const after = jouer(createBattle(PLAYER_DECK, AI_DECK, 7, {}, { deuxCamps: true }));

    // La partie a bien fait jouer les deux camps : sans cela, le test ne prouve rien.
    expect(after.log.some((l) => l.includes('camp Direction'))).toBe(true);
    expect(after.log.filter((l) => MOT_IA.test(l))).toEqual([]);
  });

  it('ne dit ni « Tu » ni « tu » à deux : le camp `player` n’est pas forcément toi', () => {
    const after = jouer(createBattle(PLAYER_DECK, AI_DECK, 7, {}, { deuxCamps: true }));

    expect(after.log.filter((l) => MOT_TU.test(l))).toEqual([]);
  });

  it('le solo écrit toujours « L’IA » : le drapeau ne fuit pas vers le solo', () => {
    // Garde le contraire : si le moteur nommait le camp partout, « L’IA » disparaîtrait
    // aussi en solo. Le mutant `if (false)` de `sujet` fait échouer les deux tests
    // « à deux » ci-dessus, pas celui-ci (vérifié le 22/10/2026).
    const solo = jouer(createBattle(PLAYER_DECK, AI_DECK, 7));
    expect(solo.log.some((l) => MOT_IA.test(l))).toBe(true);
    expect(solo.log.some((l) => l.includes('camp Direction'))).toBe(false);
  });
});

describe('journal — le solo reste inchangé (#154)', () => {
  it('garde « Tu » et « L’IA » en partie solo', () => {
    const after = jouer(createBattle(PLAYER_DECK, AI_DECK, 7));

    expect(after.log.some((l) => l.startsWith('Tu '))).toBe(true);
    expect(after.log.some((l) => l.startsWith('L’IA '))).toBe(true);
  });

  it('ne change pas l’état à deux hors du journal (mêmes tirages, même partie)', () => {
    const solo = jouer(createBattle(PLAYER_DECK, AI_DECK, 7));
    const duel = jouer(createBattle(PLAYER_DECK, AI_DECK, 7, {}, { deuxCamps: true }));

    // Seul le texte diffère : la partie, elle, est identique coup pour coup.
    expect(duel.turn).toBe(solo.turn);
    expect(duel.winner).toBe(solo.winner);
    expect(duel.players).toEqual(solo.players);
    expect(duel.log.length).toBe(solo.log.length);
  });
});
