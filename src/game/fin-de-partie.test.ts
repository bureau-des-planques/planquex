import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyAction, createBattle, endTurn } from '@/game/engine';
import { TURN_LIMIT } from '@/game/rules';
import { factionDeck, playGame } from '@/game/simulation';

/**
 * **Pourquoi la partie s'arrête** (#84). Le moteur pose la raison au moment où il
 * termine la partie ; l'écran la lit au lieu de la déduire du seul vainqueur — qui
 * faisait dire « 3 Interventions » à un forfait ou à un plateau vide.
 */

const battle = (seed = 5) => createBattle(factionDeck('SSE'), factionDeck('RH'), seed);

describe('Raison de fin de partie (#84)', () => {
  it('est vide tant que la partie vit', () => {
    expect(battle().endReason).toBeNull();
  });

  it('dit « forfait » après un abandon (D-030)', () => {
    const after = applyAction(battle(), { type: 'forfeit', who: 'player' });
    expect(after.phase).toBe('ended');
    expect(after.endReason).toBe('forfait');
  });

  it('dit « limiteDeTours » quand la limite tombe (D-031)', () => {
    const state = battle();
    state.turn = TURN_LIMIT;
    const after = endTurn(state);
    expect(after.phase).toBe('ended');
    expect(after.winner).toBeNull();
    expect(after.endReason).toBe('limiteDeTours');
  });

  it('dit « plateauVide » quand un camp n’a plus aucun Planqué (D-022)', () => {
    const state = battle();
    const ai = state.players.ai;
    const active = ai.active;
    if (!active) throw new Error('Poste vide');
    ai.bench = [null, null, null];
    active.statuses = ['SURCHARGE'];
    active.hp = 10;
    // Le Contrôle de fin de tour fait craquer le dernier Planqué de la Direction.
    const after = endTurn(state);
    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('player');
    expect(after.endReason).toBe('plateauVide');
  });

  it('pose une raison à chaque partie terminée du simulateur', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const game = playGame(factionDeck('MANAGEMENT'), factionDeck('ATELIER'), seed);
      if (game.phase !== 'ended') continue;
      expect(['interventions', 'plateauVide', 'forfait', 'limiteDeTours']).toContain(game.endReason);
      if (game.endReason === 'interventions') expect(game.winner).not.toBeNull();
    }
  });
});

describe('Bandeau de fin — il lit la raison (#84)', () => {
  const source = readFileSync(fileURLToPath(new URL('../pages/Battle.tsx', import.meta.url)), 'utf8');

  it('distingue les quatre fins au lieu de dire « 3 Interventions » à toutes', () => {
    expect(source).toContain('state.endReason');
    for (const reason of ['interventions', 'plateauVide', 'forfait', 'limiteDeTours']) {
      expect(source).toContain(`case '${reason}'`);
    }
    expect(source).toContain('forfait.');
    expect(source).toContain('plus aucun Planqué.');
  });
});
