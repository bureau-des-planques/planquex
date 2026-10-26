import { describe, expect, it } from 'vitest';
import { getCard, isBasic, isPlanque } from '@/data';
import type { BattleAction, CafeSymbol, Stage } from '@/data/types';
import { DECK_SIZE, MAX_DECK_CAFE_TYPES, deckLegal, isCafeType } from '@/game/deck';
import { applyAction, createBattle, isOpeningTurn } from '@/game/engine';
import { nextAction } from '@/game/ia';
import type { AiLevel } from '@/game/ia';
import { satisfiesCafeCost } from '@/game/rules';
import {
  FACTION_ORDER,
  aggregateFactions,
  factionCafeTypes,
  factionDeck,
  factionDecks,
  formatReport,
  pairFactions,
  simulate
} from '@/game/simulation';

/**
 * Ticket #34 — le simulateur headless seedé.
 *
 * Les tests vérifient l'**outil**, pas l'équilibre : même graine → même rapport,
 * rapport complet par partie et par faction, Decks légaux. Aucun seuil de
 * winrate ici : les valeurs cibles viendront avec le contenu.
 */

const SEED = 42;

describe('simulate — reproductibilité', () => {
  it('produit un rapport strictement identique pour la même graine', () => {
    const first = simulate({ games: 4, seed: SEED });
    const second = simulate({ games: 4, seed: SEED });

    expect(first).toEqual(second);
    // Comparaison stricte : c'est la sérialisation qui sert de preuve côté CLI.
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('change de rapport quand la graine change', () => {
    const first = simulate({ games: 4, seed: SEED });
    const second = simulate({ games: 4, seed: SEED + 1 });

    expect(first.results).not.toEqual(second.results);
  });

  it('tire une graine distincte par partie, à partir de la graine maîtresse', () => {
    const report = simulate({ games: 5, seed: SEED });
    const seeds = report.results.map((result) => result.seed);

    expect(new Set(seeds).size).toBe(seeds.length);
    expect(report.seed).toBe(SEED);
  });
});

describe('simulate — contenu du rapport', () => {
  it('donne, par partie, le vainqueur et le nombre de tours', () => {
    const report = simulate({ games: 6, seed: SEED });

    expect(report.results).toHaveLength(6);
    for (const result of report.results) {
      expect(['player', 'ai', null]).toContain(result.winner);
      expect(result.turns).toBeGreaterThan(0);
      expect(result.winnerFaction === null).toBe(result.winner === null);
      expect(FACTION_ORDER).toContain(result.player);
      expect(FACTION_ORDER).toContain(result.ai);
    }
    // Au moins une partie doit trouver un vainqueur : sans quoi le test ne prouverait rien.
    expect(report.results.some((result) => result.winner !== null)).toBe(true);
  });

  it('agrège par faction : parties, victoires, défaites et nulles se recoupent', () => {
    const games = 10;
    const report = simulate({ games, seed: SEED });

    expect(report.factions.map((faction) => faction.faction)).toEqual([...FACTION_ORDER]);
    // Chaque partie compte pour ses deux camps.
    for (const faction of report.factions) {
      expect(faction.games).toBe(2 * Math.floor(games / FACTION_ORDER.length));
      expect(faction.wins + faction.losses + faction.draws).toBe(faction.games);
    }
    // Une victoire = une défaite, une nulle = une nulle dans chaque camp.
    const totalWins = report.factions.reduce((sum, faction) => sum + faction.wins, 0);
    const totalLosses = report.factions.reduce((sum, faction) => sum + faction.losses, 0);
    const totalDraws = report.factions.reduce((sum, faction) => sum + faction.draws, 0);
    expect(totalWins).toBe(totalLosses);
    expect(totalDraws % 2).toBe(0);
  });

  it('n’invente pas de critère de winrate : l’agrégat ne porte que des comptes', () => {
    const report = simulate({ games: 3, seed: SEED });
    const keys = Object.keys(report.factions[0] ?? {}).sort();

    expect(keys).toEqual(['averageTurns', 'draws', 'faction', 'games', 'losses', 'wins']);
  });

  it('arrête une partie à la limite de tours et la compte nulle', () => {
    const report = simulate({ games: 1, seed: SEED, maxTurns: 1 });

    expect(report.results[0]?.winner).toBeNull();
    expect(report.results[0]?.turns).toBe(1);
    expect(report.factions.reduce((sum, faction) => sum + faction.draws, 0)).toBe(2);
  });

  it('refuse les paramètres invalides', () => {
    expect(() => simulate({ games: 0, seed: SEED })).toThrow(/Nombre de parties/);
    expect(() => simulate({ games: 1.5, seed: SEED })).toThrow(/Nombre de parties/);
    expect(() => simulate({ games: 1, seed: Number.NaN })).toThrow(/Graine/);
    expect(() => simulate({ games: 1, seed: SEED, maxTurns: 0 })).toThrow(/Limite de tours/);
    expect(() => simulate({ games: 1, seed: SEED, factions: ['NOPE' as (typeof FACTION_ORDER)[number]] })).toThrow(
      /inconnue/
    );
    expect(() => simulate({ games: 1, seed: SEED, aiLevel: 3 as unknown as AiLevel })).toThrow(/Niveau d'IA invalide/);
  });

  it("porte les niveaux d'IA dans le rapport, et par défaut le niveau 1", () => {
    const parDefaut = simulate({ games: 2, seed: SEED });
    expect(parDefaut.playerLevel).toBe(1);
    expect(parDefaut.aiLevel).toBe(1);

    const niveaux = simulate({ games: 2, seed: SEED, playerLevel: 2, aiLevel: 1 });
    expect(niveaux.playerLevel).toBe(2);
    expect(niveaux.aiLevel).toBe(1);
  });

  it('change de rapport quand un camp change de niveau', () => {
    const niveau1 = simulate({ games: 6, seed: SEED, playerLevel: 1, aiLevel: 1 });
    const niveau2 = simulate({ games: 6, seed: SEED, playerLevel: 1, aiLevel: 2 });

    // Mêmes graines, mêmes Decks : seul le niveau de la Direction change.
    expect(niveau2.results.map((result) => result.seed)).toEqual(niveau1.results.map((result) => result.seed));
    expect(niveau2.results).not.toEqual(niveau1.results);
  });
});

describe('Decks de simulation', () => {
  it('construit un Deck légal de 20 cartes pour chacune des dix factions', () => {
    for (const faction of FACTION_ORDER) {
      const deck = factionDeck(faction);
      expect(deck, faction).toHaveLength(DECK_SIZE);
      expect(deckLegal(deck), faction).toEqual({ ok: true, reasons: [] });
      const hasBasic = deck.some((id) => isBasic(getCard(id)));
      expect(hasBasic, `${faction} : au moins un Entrant`).toBe(true);
    }
  });

  it('est déterministe et ne dépend pas de l’ordre des factions demandées', () => {
    const first = factionDecks();
    const second = factionDecks([...FACTION_ORDER].reverse());

    for (const faction of FACTION_ORDER) {
      expect(first.get(faction)).toEqual(second.get(faction));
    }
  });

  it('n’oppose jamais une faction à elle-même quand au moins deux factions jouent', () => {
    for (let index = 0; index < 30; index += 1) {
      const [player, ai] = pairFactions(FACTION_ORDER, index);
      expect(player).not.toBe(ai);
    }
  });
});

describe('types de café des Decks simulés (#113)', () => {
  /**
   * Le défaut du ticket : `createBattle` recevait la **dérivation**, qui ne donne
   * aucun type à `SUPPORT` (exclu de `CAFE_FACTIONS`, D-034) ni de type utile à
   * `INTERIM`. Ces tests **mordent** : sans la table explicite, le Deck `SUPPORT`
   * ne produit aucun café et ne lance aucune Pression, et `simulate` le montre.
   */
  it('donne un type productible à SUPPORT et une paire distincte à INTERIM', () => {
    const support = factionCafeTypes('SUPPORT');
    expect(support).toHaveLength(1);
    expect(isCafeType(support?.[0])).toBe(true);

    const interim = factionCafeTypes('INTERIM') ?? [];
    expect(interim.length).toBeGreaterThanOrEqual(2);
    expect(interim.length).toBeLessThanOrEqual(MAX_DECK_CAFE_TYPES);
    expect(new Set(interim).size).toBe(interim.length);
    for (const type of interim) expect(isCafeType(type), type).toBe(true);

    // Les autres factions n'ont pas de choix explicite : elles gardent la dérivation.
    for (const faction of FACTION_ORDER) {
      if (faction === 'SUPPORT' || faction === 'INTERIM') continue;
      expect(factionCafeTypes(faction), faction).toBeUndefined();
    }
  });

  it('un Deck SUPPORT du simulateur produit un café', () => {
    const deck = factionDeck('SUPPORT');
    let state = createBattle(deck, factionDeck('SSE'), SEED, {
      playerCafeTypes: factionCafeTypes('SUPPORT')
    });
    // Le choix est bien celui du simulateur, et non la dérivation (qui vaut `[]`).
    expect(state.players.player.cafeTypes).toEqual(['SSE']);

    // Jusqu'au premier tour du joueur qui n'est **pas** le tour d'ouverture : c'est
    // celui où la Machine produit (D-030, D-033 (6)).
    for (
      let guard = 0;
      state.phase === 'playing' && !(state.current === 'player' && !isOpeningTurn(state));
      guard += 1
    ) {
      expect(guard, 'la partie tourne sans que le joueur joue').toBeLessThan(400);
      const action = nextAction(state);
      expect(action).not.toBeNull();
      state = applyAction(state, action as BattleAction);
    }

    expect(state.players.player.energyZone).toBe('SSE');
  });

  it('un Deck SUPPORT du simulateur lance des Pressions dans chaque partie', () => {
    const report = simulate({ games: 6, seed: SEED, factions: ['SUPPORT', 'SSE'] });
    const supportGames = report.results.filter((result) => result.player === 'SUPPORT' || result.ai === 'SUPPORT');
    // Deux factions : l'appariement fait aussi des miroirs, toutes les parties ne
    // contiennent donc pas SUPPORT. Celles qui le contiennent doivent l'armer.
    expect(supportGames.length).toBeGreaterThan(0);

    const armed = supportGames.map((result) =>
      result.player === 'SUPPORT' ? result.attacks.player : result.attacks.ai
    );
    expect(
      armed.every((count) => count > 0),
      `Pressions SUPPORT : ${armed.join(', ')}`
    ).toBe(true);
  });

  it('un Deck INTERIM peut payer chaque stade de sa ligne', () => {
    const types = factionCafeTypes('INTERIM') ?? [];
    // Ce que la Machine peut produire en quelques tours : un stock de chaque type choisi.
    const payable = (cost: readonly CafeSymbol[]) =>
      satisfiesCafeCost(
        types.flatMap((type) => Array.from({ length: cost.length }, () => type)),
        cost
      );

    const own = factionDeck('INTERIM')
      .map((id) => getCard(id))
      .filter(isPlanque)
      .filter((card) => card.faction === 'INTERIM');
    expect(own.length).toBeGreaterThan(0);

    const stages = new Set<Stage>(
      own.filter((card) => card.attacks.some((attack) => payable(attack.cost))).map((card) => card.stage)
    );
    for (const stage of ['ENTRANT', 'N+1', 'N+2'] as const) {
      expect(stages.has(stage), `stade ${stage} sans Pression payable`).toBe(true);
    }
  });
});

describe('formatReport', () => {
  it('affiche chaque partie et l’agrégat par faction', () => {
    const report = simulate({ games: 2, seed: SEED });
    const text = formatReport(report);

    expect(text).toContain('Simulation — 2 partie(s), graine 42');
    for (const result of report.results) {
      expect(text).toContain(String(result.seed));
    }
    for (const faction of FACTION_ORDER) expect(text).toContain(faction);
  });
});

describe('aggregateFactions', () => {
  it('compte les tours moyens sans arrondi dépendant de la plateforme', () => {
    const [first, second] = FACTION_ORDER;
    const aggregate = aggregateFactions(
      [first, second],
      [
        {
          game: 1,
          seed: 1,
          player: first,
          ai: second,
          winner: 'player',
          winnerFaction: first,
          turns: 10,
          attacks: { player: 2, ai: 1 }
        },
        {
          game: 2,
          seed: 2,
          player: second,
          ai: first,
          winner: 'player',
          winnerFaction: second,
          turns: 20,
          attacks: { player: 3, ai: 2 }
        }
      ]
    );

    expect(aggregate).toEqual([
      { faction: first, games: 2, wins: 1, losses: 1, draws: 0, averageTurns: 15 },
      { faction: second, games: 2, wins: 1, losses: 1, draws: 0, averageTurns: 15 }
    ]);
  });
});
