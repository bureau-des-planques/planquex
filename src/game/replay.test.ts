import { describe, expect, it } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { applyAction, createBattle, replayBattle } from '@/game/engine';
import { FACTION_ORDER, factionDeck, playGame } from '@/game/simulation';

/**
 * **Journal d'actions et rejeu** — ticket #83.
 *
 * La cible de `PROPOSITION.md` §6.2 : « même seed + mêmes actions = même partie ».
 * `BattleState` porte sa graine d'origine (`seed`) et le journal des actions
 * réellement appliquées (`actionLog`) ; `applyAction` est le seul point qui
 * journalise, et `replayBattle` reconstruit la partie depuis ces deux éléments.
 */

/**
 * Au moins dix graines, dont de petites et de grandes : la propriété doit tenir
 * quelle que soit la suite de tirages, pas pour une graine choisie.
 */
const SEEDS = [1, 7, 42, 99, 123, 456, 555, 789, 1000, 2026] as const;

/** Deux Decks légaux, distincts, dérivés de la graine. */
function decksFor(seed: number): [string[], string[]] {
  const player = FACTION_ORDER[seed % FACTION_ORDER.length] ?? FACTION_ORDER[0];
  const ai = FACTION_ORDER[(seed + 3) % FACTION_ORDER.length] ?? FACTION_ORDER[1];
  return [factionDeck(player), factionDeck(ai)];
}

describe('replayBattle — même graine + mêmes actions = même partie (#83)', () => {
  it.each(SEEDS)('rejoue à l’identique une partie complète (graine %i)', (seed) => {
    const [playerDeck, aiDeck] = decksFor(seed);
    const played = playGame(playerDeck, aiDeck, seed);

    // Une partie qui a réellement agi : sans journal non vide, le test ne prouverait rien.
    expect(played.actionLog.length).toBeGreaterThan(0);
    expect(played.seed).toBe(seed);

    const replayed = replayBattle(
      playerDeck,
      aiDeck,
      seed,
      played.actionLog.map((entree) => entree.action)
    );

    // Égalité **stricte** : rng, plateau, journal texte, actionLog et vainqueur.
    expect(replayed).toEqual(played);
  });

  it('part d’un journal vide et d’un état identique à un `createBattle` neuf', () => {
    const [playerDeck, aiDeck] = decksFor(42);
    const fresh = createBattle(playerDeck, aiDeck, 42);
    const replayed = replayBattle(playerDeck, aiDeck, 42, []);

    expect(fresh.actionLog).toEqual([]);
    expect(fresh.seed).toBe(42);
    expect(replayed).toEqual(fresh);
  });
});

describe('applyAction — seul point de journalisation (#83)', () => {
  it('journalise une action acceptée', () => {
    const [playerDeck, aiDeck] = decksFor(42);
    const state = createBattle(playerDeck, aiDeck, 42);

    const after = applyAction(state, { type: 'endTurn' });

    expect(after).not.toBe(state);
    expect(after.actionLog.map((entree) => entree.action)).toEqual([{ type: 'endTurn' }]);
  });

  it('n’ajoute pas une action refusée : la transition rend l’état tel quel (`===`)', () => {
    const [playerDeck, aiDeck] = decksFor(42);
    const state = createBattle(playerDeck, aiDeck, 42);

    // `evolve` est refusé au premier tour du joueur (AGENTS.md §4) : la transition
    // rend `state` lui-même, donc rien n'est journalisé et rien ne mute.
    const refused = applyAction(state, { type: 'evolve', uid: 'inconnu', targetUid: 'inconnu' });

    expect(refused).toBe(state);
    expect(refused.actionLog).toEqual([]);
    expect(state.actionLog).toEqual([]);
  });

  it('ne mute pas le journal de l’état d’entrée', () => {
    const [playerDeck, aiDeck] = decksFor(42);
    const state = createBattle(playerDeck, aiDeck, 42);

    const first = applyAction(state, { type: 'endTurn' });
    const second = applyAction(first, { type: 'endTurn' });

    // Chaque état garde son propre journal : le second n'a pas gonflé le premier.
    expect(first.actionLog.map((entree) => entree.action)).toEqual([{ type: 'endTurn' }]);
    expect(second.actionLog.map((entree) => entree.action)).toEqual([{ type: 'endTurn' }, { type: 'endTurn' }]);
    expect(state.actionLog).toEqual([]);
  });
});

describe('actionLog — ne contient que des BattleAction valides (#83)', () => {
  /** Champs obligatoires de chaque variante de l’union `BattleAction`. */
  function hasFields(action: BattleAction): boolean {
    switch (action.type) {
      case 'playBasic':
        return (
          typeof action.uid === 'string' &&
          (action.slot === 'active' || typeof action.slot === 'number')
        );
      case 'evolve':
        return typeof action.uid === 'string' && typeof action.targetUid === 'string';
      case 'attachEnergy':
        return typeof action.targetUid === 'string';
      case 'retreat':
        return typeof action.benchIndex === 'number';
      case 'attack':
        return typeof action.attackIndex === 'number';
      case 'ability':
        return true;
      case 'priorityShift':
        return typeof action.uid === 'string';
      case 'playAction':
        return typeof action.uid === 'string';
      case 'promoteActive':
        return typeof action.benchIndex === 'number';
      case 'forfeit':
        return action.who === 'player' || action.who === 'ai';
      case 'choose':
        return typeof action.uid === 'string';
      case 'endTurn':
        return true;
      default:
        return false;
    }
  }

  it.each(SEEDS)('chaque entrée du journal est valide (graine %i)', (seed) => {
    const [playerDeck, aiDeck] = decksFor(seed);
    const played = playGame(playerDeck, aiDeck, seed);

    for (const { action } of played.actionLog) {
      expect(hasFields(action), JSON.stringify(action)).toBe(true);
    }
  });
});

describe('Journal d’actions — une partie finie refuse la fin de tour (#83)', () => {
  it('rend l’état tel quel et ne journalise rien', () => {
    const state = createBattle(factionDeck('SSE'), factionDeck('RH'), 7);
    const ended: BattleState = { ...state, phase: 'ended', winner: 'player' };

    const after = applyAction(ended, { type: 'endTurn' });

    expect(after).toBe(ended);
    expect(after.actionLog).toEqual([]);
  });
});
