import { describe, expect, it } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { evaluatePosition, nextAiAction } from '@/game/ia';
import type { AiLevel } from '@/game/ia';
import { factionDeck, simulate } from '@/game/simulation';

/**
 * **IA de niveau 2 — la Direction qui évalue** (ticket #93).
 *
 * Ce que ces tests tiennent :
 *
 * - le niveau 2 ne propose **jamais** une action illégale : il part de `legalActions` ;
 * - il ne joue **jamais** pour le camp `player` ;
 * - il est **déterministe par graine** : même graine → même partie ;
 * - sa **mesure est consignée** telle qu'elle est : depuis #108 le niveau 2 n'est plus
 *   devant le niveau 1, et la mesure a été **refaite après #113** — les Chariots
 *   `SUPPORT` et `INTERIM` du simulateur sont désormais **armés**, donc la mesure d'avant
 *   n'était pas comparable. Le chiffre, la graine et la commande sont dans le test.
 *
 * **Protocole de mesure (#111), écrit ici pour être rejoué :**
 *
 * ```bash
 * node scripts/simulate.mjs --games 60 --seed <S> --json --player-level 1 --ai-level 2
 * node scripts/simulate.mjs --games 60 --seed <S> --json --player-level 2 --ai-level 1
 * ```
 *
 * Le camp de niveau 2 est `ai` dans la première série, `player` dans la seconde ; on
 * agrège `results[].winner` sur les deux (60 parties par siège et par graine).
 * Depuis #113, `npm run pesage` exécute ce protocole d'un coup, avec les seuils.
 *
 * - **Entraînement** (recherche de poids) : graines `1, 7, 42, 11, 23`.
 * - **Contrôle** (hors échantillon) : graines `99, 1234, 2024, 777, 31337`.
 * - **Seuil d'adoption** : ≥ **55 %** des parties **décidées** *et* ≥ **1,15 ×** les
 *   victoires du niveau 1. Un gain d'entraînement qui s'évapore au contrôle est du
 *   bruit, et n'est pas adopté.
 *
 * **Modèle corrigé par #111** (bonus de fin de tour à poids propre, menace comptée
 * une seule fois), poids par défaut, contrôle : 200 victoires du niveau 2, 257 du
 * niveau 1, 143 nulles (43,76 %, ratio 0,778). **Meilleur candidat** du re-pesage
 * (#111) : 252 / 214 / 134 au contrôle (54,08 %, ratio 1,178) et 267 / 228 / 105 à
 * l'entraînement (53,94 %, ratio 1,171). Le ratio passe, le **taux de décidées ne
 * passe pas** : aucun poids n'est adopté, les défauts restent ceux du modèle corrigé.
 * Détail des 435 candidats explorés : `docs/IA-PESAGE-111.md`.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

/**
 * Joue une partie en pilotant la Direction par `nextAiAction` (niveau demandé) et
 * l'humain par la seule fin de tour : on ne teste pas le jeu du joueur, seulement
 * celui de la Direction.
 */
function playSeed(seed: number, level: AiLevel): {
  state: BattleState;
  ai: { state: BattleState; action: BattleAction }[];
} {
  let state = createBattle(PLAYER_DECK, AI_DECK, seed);
  const ai: { state: BattleState; action: BattleAction }[] = [];

  for (let guard = 0; guard < 4000 && state.phase === 'playing'; guard += 1) {
    if (state.pendingPromotion) {
      // La politique choisit sa relève pour `ai` ; pour `player`, le test la choisit
      // à sa place (ce n'est pas le sujet).
      const action =
        nextAiAction(state, level) ?? legalActions(state).find((entry) => entry.type === 'promoteActive');
      if (!action) break;
      state = applyAction(state, action);
      continue;
    }
    if (state.current === 'ai') {
      const action = nextAiAction(state, level);
      if (!action) break;
      ai.push({ state, action });
      state = applyAction(state, action);
    } else {
      state = applyAction(state, { type: 'endTurn' });
    }
  }
  return { state, ai };
}

describe('IA de niveau 2 — la Direction qui évalue', () => {
  it('ne propose jamais une action illégale : elle part de legalActions', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const { ai } = playSeed(seed, 2);
      expect(ai.length, `graine ${seed} : l'IA n'a rien joué`).toBeGreaterThan(0);
      for (const { state, action } of ai) {
        const legal = legalActions(state);
        expect(
          legal.some((entry) => JSON.stringify(entry) === JSON.stringify(action)),
          `action illégale (graine ${seed}) : ${JSON.stringify(action)}`
        ).toBe(true);
        expect(applyAction(state, action), `action sans effet (graine ${seed})`).not.toBe(state);
      }
    }
  });

  it('ne propose jamais le forfait', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      for (const { action } of playSeed(seed, 2).ai) {
        expect(action.type, `graine ${seed} : la Direction s'est couchée`).not.toBe('forfeit');
      }
    }
  });

  it('ne joue jamais pour le camp player', () => {
    let state = createBattle(PLAYER_DECK, AI_DECK, 1);
    let guard = 0;
    while (state.current === 'ai' && state.phase === 'playing' && guard < 100) {
      state = applyAction(state, { type: 'endTurn' });
      guard += 1;
    }
    expect(state.current).toBe('player');
    expect(nextAiAction(state, 2)).toBeNull();
  });

  it('est déterministe par graine : même graine, même partie', () => {
    const first = playSeed(123, 2);
    const second = playSeed(123, 2);
    expect(first.ai.length).toBeGreaterThan(0);
    expect(second.ai.map(({ action }) => action)).toEqual(first.ai.map(({ action }) => action));
    expect(second.state).toEqual(first.state);
  });

  it('diffère du niveau 1 : le niveau 2 ne joue pas la même suite', () => {
    const un = playSeed(123, 1).ai.map(({ action }) => JSON.stringify(action));
    const deux = playSeed(123, 2).ai.map(({ action }) => JSON.stringify(action));
    expect(deux.length).toBeGreaterThan(0);
    expect(deux).not.toEqual(un);
  });

  it('évalue une position : une Intervention de plus, un score plus grand', () => {
    const state = createBattle(PLAYER_DECK, AI_DECK, 42);
    const avant = evaluatePosition(state, 'ai');
    const apres = evaluatePosition(
      { ...state, players: { ...state.players, ai: { ...state.players.ai, points: 1 } } },
      'ai'
    );
    expect(apres).toBeGreaterThan(avant);
  });

  it('évalue une position : elle est pure, et relative à un camp', () => {
    const state = createBattle(PLAYER_DECK, AI_DECK, 42);
    // Pure : mêmes état, camp et poids → même score.
    expect(evaluatePosition(state, 'ai')).toBe(evaluatePosition(state, 'ai'));
    // Relative à un camp : les deux camps ne sont pas notés de la même façon.
    expect(evaluatePosition(state, 'ai')).not.toBe(evaluatePosition(state, 'player'));
  });

  it(
    'consigne la mesure après #111 et #113 : le niveau 2 n’est toujours pas devant le niveau 1',
    () => {
      const games = 100;
      const seed = 42;
      // Deux séries miroir : le niveau 2 joue la Direction dans l'une, le joueur dans
      // l'autre. Même graine maîtresse, mêmes appariements de factions.
      const directionEnNiveau2 = simulate({ games, seed, playerLevel: 1, aiLevel: 2 });
      const joueurEnNiveau2 = simulate({ games, seed, playerLevel: 2, aiLevel: 1 });
      const niveau2 =
        directionEnNiveau2.results.filter((result) => result.winner === 'ai').length +
        joueurEnNiveau2.results.filter((result) => result.winner === 'player').length;
      const niveau1 =
        directionEnNiveau2.results.filter((result) => result.winner === 'player').length +
        joueurEnNiveau2.results.filter((result) => result.winner === 'ai').length;
      const nulles = [...directionEnNiveau2.results, ...joueurEnNiveau2.results].filter(
        (result) => result.winner === null
      ).length;

      // Mesure consignée le 21/10/2026, **après** les corrections du modèle (#111) *et* du
      // harnais (#113 : Chariots `SUPPORT` et `INTERIM` armés). Les chiffres d'avant ne
      // sont pas comparables : un match sur trois opposait un Chariot incapable d'attaquer.
      // Tant qu'un re-pesage mesuré ne fait pas passer le niveau 2 devant, il n'est pas
      // démontré meilleur, et le niveau 1 reste le défaut (écran et simulateur).
      expect({ niveau2, niveau1, nulles }).toEqual({ niveau2: 71, niveau1: 91, nulles: 38 });
    },
    60000
  );
});
