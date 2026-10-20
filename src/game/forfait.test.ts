import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BattleState } from '@/data/types';
import { applyAction, createBattle, forfeit, legalActions } from '@/game/engine';
import { factionDeck, playGame } from '@/game/simulation';

/**
 * Ticket #79 — le **forfait** (D-030).
 *
 * Source : capture `06` des Astuces du 20/10/2026 — « Si un joueur déclare forfait,
 * il perd le combat **indépendamment des cartes en jeu ou du nombre de points** que
 * chaque joueur possède. » Ce n'est donc ni un craquage, ni une lecture du score :
 * c'est le seul chemin qui termine une partie sur une décision, et l'adversaire gagne
 * sans condition.
 */

const PLAYER_DECK = factionDeck('SSE');
const AI_DECK = factionDeck('MANAGEMENT');

function freshBattle(seed = 1): BattleState {
  return createBattle(PLAYER_DECK, AI_DECK, seed);
}

describe('Forfait — une défaite quel que soit le score (D-030, #79)', () => {
  it('fait gagner l’adversaire quand le joueur abandonne', () => {
    const after = forfeit(freshBattle(), 'player');

    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('ai');
    expect(after.log.at(-1)).toBe('Tu déclares forfait : la Direction l’emporte.');
  });

  it('fait gagner le joueur quand c’est la Direction qui abandonne', () => {
    const after = forfeit(freshBattle(), 'ai');

    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('player');
    expect(after.log.at(-1)).toBe('L’IA déclare forfait : tu l’emportes.');
  });

  it('l’emporte malgré 2 Interventions du joueur contre 0', () => {
    const state = freshBattle();
    state.players.player.points = 2;
    state.players.ai.points = 0;

    const after = forfeit(state, 'player');

    // Le score ne sauve pas celui qui se couche (cité dans D-030).
    expect(after.winner).toBe('ai');
    expect(after.players.player.points).toBe(2);
  });

  it('s’applique pendant une relève en attente et fige le plateau', () => {
    const state = freshBattle();
    state.pendingPromotion = 'player';
    state.players.player.active = null;

    const after = forfeit(state, 'player');

    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('ai');
    expect(after.pendingPromotion).toBeNull();
  });

  it('ne fait rien sur une partie déjà finie (état inchangé)', () => {
    const ended = forfeit(freshBattle(), 'player');

    expect(forfeit(ended, 'player')).toBe(ended);
    expect(forfeit(ended, 'ai')).toBe(ended);
  });
});

describe('Forfait — branché au moteur (#79)', () => {
  it('applyAction exécute le forfait', () => {
    const after = applyAction(freshBattle(), { type: 'forfeit', who: 'player' });

    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('ai');
  });

  it('legalActions l’offre tant que la partie vit, relève comprise', () => {
    expect(legalActions(freshBattle())).toContainEqual({ type: 'forfeit', who: 'player' });

    const pending = freshBattle();
    pending.players.ai.active = null;
    pending.pendingPromotion = 'ai';
    expect(legalActions(pending)).toContainEqual({ type: 'forfeit', who: 'player' });
  });

  it('ne l’offre plus quand la partie est finie', () => {
    const ended = forfeit(freshBattle(), 'player');

    expect(legalActions(ended)).toEqual([]);
  });
});

describe('Simulateur — jamais de forfait (#79)', () => {
  it('ne journalise aucun forfait sur vingt parties', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = playGame(PLAYER_DECK, AI_DECK, seed);
      expect(state.log.some((line) => /forfait/i.test(line))).toBe(false);
    }
  });

  it('la politique ne construit jamais d’action de forfait', () => {
    const source = readFileSync(fileURLToPath(new URL('./simulation.ts', import.meta.url)), 'utf8');

    // La seule mention de `forfeit` est la garde explicite : la politique ne le choisit pas.
    expect(source).toMatch(/action\.type === 'forfeit'/);
    expect(source).not.toMatch(/type: 'forfeit'/);
  });
});
