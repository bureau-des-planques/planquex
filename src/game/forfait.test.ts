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

function freshBattle(seed = 5): BattleState {
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
    expect(after.log.at(-1)).toBe('La Direction déclare forfait : tu l’emportes.');
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

describe('Forfait — le camp qui a la main, et lui seul (#123)', () => {
  /**
   * Le préfacteur de la partie à deux (#122) : le forfait proposé porte le **camp qui
   * joue**, donc celui qui le déclare. La version d'avant l'écrivait en dur à `player`,
   * si bien qu'une personne tenant la Direction aurait abandonné au nom de son adversaire.
   */
  it('offre le forfait à la Direction quand c’est à elle de jouer, et le lui attribue', () => {
    const state = freshBattle();
    // Un tour de la Direction : c'est elle qui a la main.
    state.current = 'ai';

    const actions = legalActions(state);

    expect(actions).toContainEqual({ type: 'forfeit', who: 'ai' });
    expect(actions).not.toContainEqual({ type: 'forfeit', who: 'player' });

    // La défaite est celle du camp qui se couche : ici la Direction, donc `player` gagne.
    const after = applyAction(state, { type: 'forfeit', who: 'ai' });
    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('player');
    expect(after.endReason).toBe('forfait');
    expect(after.log.at(-1)).toBe('La Direction déclare forfait : tu l’emportes.');
  });

  it('le suit pendant une relève : `current` reste l’attaquant, pas `pendingPromotion`', () => {
    const state = freshBattle();
    // La Direction attaque, ton Poste a craqué : c'est à toi de relever…
    state.current = 'ai';
    state.players.player.active = null;
    state.pendingPromotion = 'player';

    const actions = legalActions(state);

    // …mais la main reste à la Direction, et c'est donc elle que le forfait nomme.
    expect(actions).toContainEqual({ type: 'forfeit', who: 'ai' });
    expect(actions).not.toContainEqual({ type: 'forfeit', who: 'player' });

    const after = applyAction(state, { type: 'forfeit', who: 'ai' });
    expect(after.winner).toBe('player');
    expect(after.endReason).toBe('forfait');
  });

  it('le suit aussi quand le tour est fini (Pression déjà lancée)', () => {
    const state = freshBattle();
    state.current = 'ai';
    state.players.ai.hasAttacked = true;

    // Le seul autre chemin de `legalActions` : la fin du tour et le forfait.
    expect(legalActions(state)).toEqual([
      { type: 'endTurn' },
      { type: 'forfeit', who: 'ai' }
    ]);
  });

  /**
   * Le contrat dont dépend le bouton « Abandonner » de `Battle.tsx` (D-030, #79) : le
   * forfait est **ouvert** tant que la partie vit — donc le moteur en propose un, quel que
   * soit le camp qui a la main — et l'action du siège de l'humain est **toujours acceptée**.
   * C'est ce qui permet à l'écran de nommer `player` sans risquer un refus.
   */
  it('garde le forfait ouvert quand c’est à la Direction de jouer', () => {
    const state = freshBattle();
    state.current = 'ai';

    // L'écran lit « le moteur propose un forfait » pour afficher son bouton…
    expect(legalActions(state).some((action) => action.type === 'forfeit')).toBe(true);
    // …et exécute le sien, qui reste accepté même si la main est à la Direction.
    const after = applyAction(state, { type: 'forfeit', who: 'player' });
    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('ai');
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
    // La politique vit dans `@/game/ia` : c'est là que la garde se lit. Elle choisit
    // dans `legalActions` et n'énumère jamais de forfait.
    const source = readFileSync(fileURLToPath(new URL('./ia.ts', import.meta.url)), 'utf8');

    expect(source).toMatch(/legalActions\(/);
    expect(source).not.toMatch(/type: 'forfeit'/);
  });
});
