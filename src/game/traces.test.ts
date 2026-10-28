import { describe, expect, it } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { applyAction, createBattle } from '@/game/engine';
import { nextAction } from '@/game/ia';
import { factionCafeTypes, factionDeck } from '@/game/simulation';
import { bilanTraces, lireTrace } from '@/game/traces';
import type { TraceCombat } from '@/game/traces';

/**
 * **Les traces de combat se lisent-elles ?** (#358)
 *
 * Les parties sont **fabriquées** ici : elles sont jouées par le moteur puis mises en forme
 * comme `public.combats` les stocke (graine, deux Decks, types de café, journal). Aucun
 * réseau, aucune base : `bilanTraces` est pure.
 *
 * Ce que les contrôles gardent :
 *
 * 1. **les agrégats sont justes** sur deux parties **connues** — l'issue, les tours et les
 *    Interventions du bilan sont ceux de l'état rejoué, pas des constantes ;
 * 2. **une trace tronquée est un abandon**, pas une partie terminée (et le bilan change) ;
 * 3. **une trace illisible ne compte pas** : elle est comptée à part, jamais comme une
 *    victoire ;
 * 4. **une carte jouée n'est pas « jamais jouée »** — c'est le contrôle qui mord de la
 *    liste des cartes qui ne sortent pas.
 */
function jouer(seed: number, factionJoueur: string, factionDirection: string): BattleState {
  const playerDeck = factionDeck(factionJoueur as never);
  const aiDeck = factionDeck(factionDirection as never);
  let state = createBattle(playerDeck, aiDeck, seed, {
    playerCafeTypes: factionCafeTypes(factionJoueur as never),
    aiCafeTypes: factionCafeTypes(factionDirection as never)
  });
  for (let pas = 0; pas < 5000 && state.phase === 'playing'; pas += 1) {
    const action = nextAction(state, 1);
    if (!action) break;
    const after = applyAction(state, action);
    if (after === state) break;
    state = after;
  }
  return state;
}

/** La trace telle que la table la stocke, depuis l'état final et ses Decks. */
function traceDe(state: BattleState, playerDeck: string[], aiDeck: string[], id?: number): TraceCombat {
  return {
    id,
    mode: 'solo',
    graine: state.seed,
    decks: { playerDeck, aiDeck },
    types_cafe: {
      playerCafeTypes: state.players.player.cafeTypes,
      aiCafeTypes: state.players.ai.cafeTypes
    },
    journal: state.actionLog.map((entree) => entree.action) as BattleAction[]
  };
}

const DECKS = {
  joueur: factionDeck('ATELIER'),
  direction: factionDeck('RH')
};
const PARTIE = jouer(42, 'ATELIER', 'RH');
const TRACE = traceDe(PARTIE, DECKS.joueur, DECKS.direction, 1);

describe('lecture des traces de combat (#358)', () => {
  it('une partie terminée rend son issue, ses tours et ses Interventions', () => {
    expect(PARTIE.phase).toBe('ended');
    const partie = lireTrace(TRACE);

    expect(partie.issue).toBe(PARTIE.winner === 'player' ? 'joueur' : PARTIE.winner === 'ai' ? 'direction' : 'nulle');
    expect(partie.tours).toBe(PARTIE.turn);
    expect(partie.interventions).toEqual({
      joueur: PARTIE.players.player.points,
      direction: PARTIE.players.ai.points
    });
    expect(partie.raison).toBe(PARTIE.endReason);
    // Les cartes sorties sont des cartes des Decks, jamais des identifiants inventés.
    expect(partie.cartesJouees.length).toBeGreaterThan(0);
    for (const carte of partie.cartesJouees) {
      expect(DECKS.joueur.includes(carte) || DECKS.direction.includes(carte)).toBe(true);
    }
  });

  it('une trace tronquée est un abandon, pas une partie terminée', () => {
    const tronquee = { ...TRACE, journal: (TRACE.journal as BattleAction[]).slice(0, 4) };
    const partie = lireTrace(tronquee);
    expect(partie.issue).toBe('abandon');
    expect(partie.raison).toBe('journal-tronque');

    // Le contrôle mord : le bilan de deux traces dont une tronquée ne compte qu'une partie
    // terminée, et l'abandon est dit séparément.
    const complet = bilanTraces([TRACE, TRACE]);
    const mixte = bilanTraces([TRACE, tronquee]);
    expect(complet.terminees).toBe(2);
    expect(complet.abandons).toBe(0);
    expect(mixte.terminees).toBe(1);
    expect(mixte.abandons).toBe(1);
  });

  it('une trace illisible ne compte pas comme une partie', () => {
    const illegale = { ...TRACE, decks: { playerDeck: ['atelier-chef-atelier'], aiDeck: DECKS.direction } };
    const partie = lireTrace(illegale);
    expect(partie.issue).toBe('illisible');
    expect(partie.raison).toBe('rejeu-refuse');

    const bilan = bilanTraces([illegale, TRACE]);
    expect(bilan.parties).toBe(2);
    expect(bilan.terminees).toBe(1);
    expect(bilan.illisibles).toBe(1);
    // Une trace illisible n'entre dans aucune issue : elle ne gonfle ni les victoires ni
    // les défaites.
    expect(bilan.issues.joueur + bilan.issues.direction + bilan.issues.nulle).toBe(1);
  });

  it('les agrégats s’additionnent comme les parties, sur deux parties connues', () => {
    const seconde = jouer(77, 'ATELIER', 'RH');
    const trace2 = traceDe(seconde, DECKS.joueur, DECKS.direction, 2);
    const bilan = bilanTraces([TRACE, trace2]);

    expect(bilan.parties).toBe(2);
    expect(bilan.terminees).toBe(2);
    expect(bilan.parMode).toEqual({ solo: 2, pvp: 0 });

    const issues = [PARTIE, seconde].map((etat) =>
      etat.winner === 'player' ? 'joueur' : etat.winner === 'ai' ? 'direction' : 'nulle'
    );
    expect(bilan.issues).toEqual({
      joueur: issues.filter((i) => i === 'joueur').length,
      direction: issues.filter((i) => i === 'direction').length,
      nulle: issues.filter((i) => i === 'nulle').length
    });
    // Le taux contre la Direction ne compte que les solo **décidées**.
    const decidees = issues.filter((i) => i !== 'nulle').length;
    expect(bilan.soloDecidees).toBe(decidees);
    expect(bilan.tauxVictoireSolo).toBe(decidees === 0 ? null : issues.filter((i) => i === 'joueur').length / decidees);
    // Les tours médians sont ceux des deux parties rejouées.
    expect(bilan.tours).toEqual({
      mediane: (Math.min(PARTIE.turn, seconde.turn) + Math.max(PARTIE.turn, seconde.turn)) / 2,
      min: Math.min(PARTIE.turn, seconde.turn),
      max: Math.max(PARTIE.turn, seconde.turn)
    });
  });

  it('le contrôle mord : une carte jouée n’est jamais « jamais jouée »', () => {
    const bilan = bilanTraces([TRACE]);
    const jouee = bilan.cartesPlusJouees[0];
    expect(jouee).toBeDefined();
    expect(bilan.cartesJamaisJouees).not.toContain(jouee!.carte);
    // Les deux listes sont disjointes par construction, et « jamais jouée » ne contient que
    // des cartes qui entrent dans un Deck tracé.
    const decks = new Set([...DECKS.joueur, ...DECKS.direction]);
    for (const carte of bilan.cartesJamaisJouees) {
      expect(decks.has(carte)).toBe(true);
      expect(bilan.cartesPlusJouees.some((ligne) => ligne.carte === carte)).toBe(false);
    }
    // Le contrôle fautif : si la carte la plus jouée était déclarée « jamais jouée », la
    // garde ci-dessus tombe. On le vérifie sur une carte que le journal ne joue pas.
    expect(bilan.cartesJamaisJouees.length).toBeGreaterThan(0);
  });
});
