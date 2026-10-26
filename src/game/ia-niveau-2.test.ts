import { describe, expect, it, vi } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { evaluatePosition, nextAiAction } from '@/game/ia';
import type { Politique } from '@/game/ia';
import { factionDeck, simulate, type SimulationReport } from '@/game/simulation';

/**
 * **IA de niveau 2 — la Direction qui évalue** (ticket #93).
 *
 * Ce que ces tests tiennent :
 *
 * - le niveau 2 ne propose **jamais** une action illégale : il part de `legalActions` ;
 * - il ne joue **jamais** pour le camp `player` ;
 * - il est **déterministe par graine** : même graine → même partie ;
 * - sa **mesure est consignée** telle qu'elle est : depuis #108 le niveau 2 n'est plus
 *   devant le niveau 1, et la mesure a été **refaite après #113** — les Decks
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
 * Détail des 435 candidats explorés : `docs/ia/111-pesage.md`.
 *
 * **Mesure après #114** (l'évaluation ne lit plus le flux de hasard de la partie, elle
 * porte une sous-graine dérivée — voir `ia-hasard.test.ts`) : au **contrôle**, 220 / 280 /
 * 100 (44,00 %, ratio 0,786) ; à l'entraînement, 223 / 271 / 106 (45,14 %, ratio 0,823).
 * Retirer la triche ne renverse pas le verdict : le niveau 2 reste derrière le niveau 1, et
 * c'est un fait mesuré — pas un argument pour rétablir la lecture de l'avenir.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

/**
 * Joue une partie en pilotant la Direction par `nextAiAction` (niveau demandé) et
 * l'humain par la seule fin de tour : on ne teste pas le jeu du joueur, seulement
 * celui de la Direction.
 */
function playSeed(
  seed: number,
  level: Politique
): {
  state: BattleState;
  ai: { state: BattleState; action: BattleAction }[];
} {
  let state = createBattle(PLAYER_DECK, AI_DECK, seed);
  const ai: { state: BattleState; action: BattleAction }[] = [];

  for (let guard = 0; guard < 4000 && state.phase === 'playing'; guard += 1) {
    if (state.pendingPromotion) {
      // La politique choisit sa relève pour `ai` ; pour `player`, le test la choisit
      // à sa place (ce n'est pas le sujet).
      const action = nextAiAction(state, level) ?? legalActions(state).find((entry) => entry.type === 'promoteActive');
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

/**
 * Résultat agrégé d'une confrontation miroir (deux séries, même graines).
 */
interface MirrorAggregate {
  niveau2: number;
  niveau1: number;
  nulles: number;
  decidees: number;
  taux: number;
  ratio: number;
}

/**
 * Agrège les deux séries miroir (niveau 2 comme `ai` puis comme `player`) en
 * comptant les victoires de chaque niveau. Fonction **pure** : testable sur
 * des données synthétiques.
 */
function aggregateMirror(directionEnNiveau2: SimulationReport, joueurEnNiveau2: SimulationReport): MirrorAggregate {
  const niveau2 =
    directionEnNiveau2.results.filter((r) => r.winner === 'ai').length +
    joueurEnNiveau2.results.filter((r) => r.winner === 'player').length;
  const niveau1 =
    directionEnNiveau2.results.filter((r) => r.winner === 'player').length +
    joueurEnNiveau2.results.filter((r) => r.winner === 'ai').length;
  const nulles = [...directionEnNiveau2.results, ...joueurEnNiveau2.results].filter((r) => r.winner === null).length;
  const decidees = niveau2 + niveau1;
  const taux = decidees === 0 ? 0 : niveau2 / decidees;
  const ratio = niveau1 === 0 ? Infinity : niveau2 / niveau1;
  return { niveau2, niveau1, nulles, decidees, taux, ratio };
}

describe('IA de niveau 2 — la Direction qui évalue', () => {
  it('ne propose jamais une action illégale : elle part de legalActions', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const { ai } = playSeed(seed, 'recherche');
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
      for (const { action } of playSeed(seed, 'recherche').ai) {
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
    expect(nextAiAction(state, 'recherche')).toBeNull();
  });

  it('est déterministe par graine quand l’horloge n’interrompt pas la recherche', () => {
    // **L'horloge est gelée, et c'est le sujet du test.** La recherche porte deux bornes
    // (#172) : un **compte de nœuds** (800) et une **échéance murale** (60 ms). La seconde
    // dépend de la charge de la machine : sous un `npm test` parallèle, la même graine peut
    // se replier sur le glouton dans une exécution et pas dans l'autre. Ce qui doit être
    // reproductible, c'est la recherche **à budget de nœuds égal** — c'est ce que vérifie
    // ce test, horloge gelée. L'échéance, elle, est un garde-fou de latence, pas une
    // promesse de rejeu (le rejeu, #83, journalise les **actions jouées**, pas les décisions).
    const horloge = vi.spyOn(performance, 'now').mockReturnValue(0);
    try {
      const first = playSeed(123, 'recherche');
      const second = playSeed(123, 'recherche');
      expect(first.ai.length).toBeGreaterThan(0);
      expect(second.ai.map(({ action }) => action)).toEqual(first.ai.map(({ action }) => action));
      expect(second.state).toEqual(first.state);
    } finally {
      horloge.mockRestore();
    }
  });

  it('diffère du niveau 1 : le niveau 2 ne joue pas la même suite', () => {
    const un = playSeed(123, 'scripte').ai.map(({ action }) => JSON.stringify(action));
    const deux = playSeed(123, 'recherche').ai.map(({ action }) => JSON.stringify(action));
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

  /**
   * Garde-fou « le contrôle mord » : `aggregateMirror` doit détecter un cas
   * où le niveau 2 gagne (taux ≥ 0,5). Ce test ne dépend d'aucune graine réelle.
   */
  it('aggregateMirror : détecte un niveau 2 gagnant (données synthétiques)', () => {
    // Série A : niveau 2 = ai, 3 victoires, 1 défaite, 1 nulle
    const seriesA: SimulationReport = {
      seed: 0,
      games: 5,
      maxTurns: 200,
      playerLevel: 1,
      aiLevel: 2,
      factions: [],
      results: [
        {
          game: 1,
          seed: 1,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 10,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 2,
          seed: 2,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 12,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 3,
          seed: 3,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 11,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 4,
          seed: 4,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'player',
          winnerFaction: 'SSE',
          turns: 9,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 5,
          seed: 5,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: null,
          winnerFaction: null,
          turns: 200,
          attacks: { player: 0, ai: 0 }
        }
      ]
    };
    // Série B : niveau 2 = player, miroir exact (mêmes graines, sièges inversés)
    const seriesB: SimulationReport = {
      seed: 0,
      games: 5,
      maxTurns: 200,
      playerLevel: 2,
      aiLevel: 1,
      factions: [],
      results: [
        {
          game: 1,
          seed: 1,
          player: 'MANAGEMENT',
          ai: 'SSE',
          winner: 'player',
          winnerFaction: 'MANAGEMENT',
          turns: 10,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 2,
          seed: 2,
          player: 'MANAGEMENT',
          ai: 'SSE',
          winner: 'player',
          winnerFaction: 'MANAGEMENT',
          turns: 12,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 3,
          seed: 3,
          player: 'MANAGEMENT',
          ai: 'SSE',
          winner: 'player',
          winnerFaction: 'MANAGEMENT',
          turns: 11,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 4,
          seed: 4,
          player: 'MANAGEMENT',
          ai: 'SSE',
          winner: 'ai',
          winnerFaction: 'SSE',
          turns: 9,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 5,
          seed: 5,
          player: 'MANAGEMENT',
          ai: 'SSE',
          winner: null,
          winnerFaction: null,
          turns: 200,
          attacks: { player: 0, ai: 0 }
        }
      ]
    };

    const agg = aggregateMirror(seriesA, seriesB);
    // Niveau 2 : 3 (A.ai) + 3 (B.player) = 6
    // Niveau 1 : 1 (A.player) + 1 (B.ai) = 2
    // Nulles : 1 + 1 = 2
    expect(agg.niveau2).toBe(6);
    expect(agg.niveau1).toBe(2);
    expect(agg.nulles).toBe(2);
    expect(agg.decidees).toBe(8);
    expect(agg.taux).toBe(6 / 8); // 0,75 ≥ 0,5
    expect(agg.ratio).toBe(3); // 6 / 2 = 3
  });

  /**
   * Garde-fou « le contrôle mord » (cas inverse) : `aggregateMirror` doit
   * détecter un niveau 2 perdant (taux < 0,5).
   */
  it('aggregateMirror : détecte un niveau 2 perdant (données synthétiques)', () => {
    const seriesA: SimulationReport = {
      seed: 0,
      games: 5,
      maxTurns: 200,
      playerLevel: 1,
      aiLevel: 2,
      factions: [],
      results: [
        {
          game: 1,
          seed: 1,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'player',
          winnerFaction: 'SSE',
          turns: 10,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 2,
          seed: 2,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'player',
          winnerFaction: 'SSE',
          turns: 12,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 3,
          seed: 3,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'player',
          winnerFaction: 'SSE',
          turns: 11,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 4,
          seed: 4,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 9,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 5,
          seed: 5,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: null,
          winnerFaction: null,
          turns: 200,
          attacks: { player: 0, ai: 0 }
        }
      ]
    };
    const seriesB: SimulationReport = {
      seed: 0,
      games: 5,
      maxTurns: 200,
      playerLevel: 2,
      aiLevel: 1,
      factions: [],
      results: [
        {
          game: 1,
          seed: 1,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 10,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 2,
          seed: 2,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 12,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 3,
          seed: 3,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'ai',
          winnerFaction: 'MANAGEMENT',
          turns: 11,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 4,
          seed: 4,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: 'player',
          winnerFaction: 'SSE',
          turns: 9,
          attacks: { player: 0, ai: 0 }
        },
        {
          game: 5,
          seed: 5,
          player: 'SSE',
          ai: 'MANAGEMENT',
          winner: null,
          winnerFaction: null,
          turns: 200,
          attacks: { player: 0, ai: 0 }
        }
      ]
    };

    const agg = aggregateMirror(seriesA, seriesB);
    // Série A : niveau 2 = ai -> 1 victoire (game 4), niveau 1 = player -> 3 victoires (games 1-3)
    // Série B : niveau 2 = player -> 1 victoire (game 4), niveau 1 = ai -> 3 victoires (games 1-3)
    // Total : niveau 2 = 2, niveau 1 = 6, nulles = 2
    expect(agg.niveau2).toBe(2);
    expect(agg.niveau1).toBe(6);
    expect(agg.nulles).toBe(2);
    expect(agg.decidees).toBe(8);
    expect(agg.taux).toBe(2 / 8); // 0,25 < 0,5
    expect(agg.ratio).toBe(2 / 6); // 0,333...
  });

  it('protocole miroir : invariants de comptage sur graines de CONTRÔLE', () => {
    // On utilise des graines de CONTRÔLE (99, 1234, 2024) pour lever le biais
    // d'ajustement. Le protocole complet (5 graines × 60 parties, seuils, IC 95 %)
    // est dans `npm run pesage` et `docs/ia/111-pesage.md`.
    const gamesPerSeries = 10;
    const seeds = [99, 1234, 2024]; // graines de contrôle, disjointes de l'entraînement
    let totalGames = 0;
    let totalNiveau2 = 0;
    let totalNiveau1 = 0;
    let totalNulles = 0;

    for (const seed of seeds) {
      const directionEnNiveau2 = simulate({
        games: gamesPerSeries,
        seed,
        playerLevel: 1,
        aiLevel: 2
      });
      const joueurEnNiveau2 = simulate({
        games: gamesPerSeries,
        seed,
        playerLevel: 2,
        aiLevel: 1
      });

      // Invariant 1 : chaque série a le bon nombre de parties
      expect(directionEnNiveau2.results).toHaveLength(gamesPerSeries);
      expect(joueurEnNiveau2.results).toHaveLength(gamesPerSeries);

      // Invariant 2 : même graine + même index → même appariement de factions
      // (la série miroir change le NIVEAU qui joue chaque côté, pas les FACTIONS)
      for (let i = 0; i < gamesPerSeries; i++) {
        const a = directionEnNiveau2.results[i];
        const b = joueurEnNiveau2.results[i];
        expect(a.player).toBe(b.player);
        expect(a.ai).toBe(b.ai);
        expect(a.seed).toBe(b.seed); // même graine de partie
      }

      // Invariant 3 : les Decks sont identiques (mêmes factions = mêmes decks)
      // (vérifié implicitement par le test ci-dessus : mêmes factions aux mêmes sièges)

      const agg = aggregateMirror(directionEnNiveau2, joueurEnNiveau2);
      totalNiveau2 += agg.niveau2;
      totalNiveau1 += agg.niveau1;
      totalNulles += agg.nulles;
      totalGames += directionEnNiveau2.games + joueurEnNiveau2.games;
    }

    // Invariant global : le total des parties comptées = 2 × parties/série × graines
    expect(totalNiveau2 + totalNiveau1 + totalNulles).toBe(totalGames);

    // On NE PARIE PAS sur le résultat (taux < 0,5 ou > 0,5) :
    // - l'échantillon (~60 décidées) n'a pas la puissance pour distinguer 50 % de 54 %
    // - la question de supériorité est tranchée par `npm run pesage` (seuil 55 % + ratio 1,15×)
    // Ce test garantit seulement que le protocole miroir est bien exécuté.
  }, 30000);
});
