import { describe, expect, it } from 'vitest';
import { getCard, isPlanque } from '@/data';
import { DECK_SIZE, deckLegal } from '@/game/deck';
import {
  FACTION_ORDER,
  aggregateFactions,
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
 * rapport complet par partie et par faction, Chariots légaux. Aucun seuil de
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
    expect(() =>
      simulate({ games: 1, seed: SEED, factions: ['NOPE' as (typeof FACTION_ORDER)[number]] })
    ).toThrow(/inconnue/);
  });
});

describe('Chariots de simulation', () => {
  it('construit un Chariot légal de 20 cartes pour chacune des dix factions', () => {
    for (const faction of FACTION_ORDER) {
      const deck = factionDeck(faction);
      expect(deck, faction).toHaveLength(DECK_SIZE);
      expect(deckLegal(deck), faction).toEqual({ ok: true, reasons: [] });
      const hasBasic = deck.some((id) => {
        const card = getCard(id);
        return isPlanque(card) && card.stage === 'ENTRANT';
      });
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
    const aggregate = aggregateFactions([first, second], [
      { game: 1, seed: 1, player: first, ai: second, winner: 'player', winnerFaction: first, turns: 10 },
      { game: 2, seed: 2, player: second, ai: first, winner: 'player', winnerFaction: second, turns: 20 }
    ]);

    expect(aggregate).toEqual([
      { faction: first, games: 2, wins: 1, losses: 1, draws: 0, averageTurns: 15 },
      { faction: second, games: 2, wins: 1, losses: 1, draws: 0, averageTurns: 15 }
    ]);
  });
});
