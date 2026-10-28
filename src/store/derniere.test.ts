import { describe, expect, it } from 'vitest';
import type { BattleAction, BattleState } from '@/data/types';
import { createBattle, applyAction } from '@/game/engine';
import { rejouer } from '@/game/rejeu';
import { FACTION_ORDER, factionDeck, playGame } from '@/game/simulation';
import { derniereDe, etapesDuRejeu, ecartVerdict, lireDerniere } from '@/store/derniere';
import type { DernierePartie } from '@/store/derniere';

/**
 * La dernière partie terminée (#366) : une partie finie se rejoue, son verdict est rendu
 * identique, et un code abîmé ou un verdict faux se refuse **visiblement**.
 */

const SEED = 42;
const decks = (): [string[], string[]] => [
  factionDeck(FACTION_ORDER[SEED % FACTION_ORDER.length] ?? FACTION_ORDER[0]),
  factionDeck(FACTION_ORDER[(SEED + 3) % FACTION_ORDER.length] ?? FACTION_ORDER[1])
];

/** Une partie solo **terminée**, jouée par le moteur, et la dernière partie qu'on en tire. */
function partieTerminee(): { state: BattleState; partie: DernierePartie } {
  const [playerDeck, aiDeck] = decks();
  const state = playGame(playerDeck, aiDeck, SEED);
  const partie = derniereDe(state, null, { playerDeck, aiDeck });
  if (partie === null) throw new Error('la partie de test devrait être terminée');
  return { state, partie };
}

describe('derniereDe — une partie terminée se garde, une partie en cours non', () => {
  it('ne garde rien d’une partie encore en cours', () => {
    const [playerDeck, aiDeck] = decks();
    const enCours = createBattle(playerDeck, aiDeck, SEED);
    expect(enCours.phase).toBe('playing');
    expect(derniereDe(enCours, null, { playerDeck, aiDeck })).toBeNull();
  });

  it('garde la partie et son verdict, tels que le moteur les a rendus', () => {
    const { state, partie } = partieTerminee();
    expect(state.phase).toBe('ended');
    expect(partie.mode).toBe('solo');
    expect(partie.camp).toBe('player');
    expect(partie.seed).toBe(SEED);
    expect(partie.verdict).toEqual({ vainqueur: state.winner, raison: state.endReason, tours: state.turn });
    expect(partie.actions).toHaveLength(state.actionLog.length);
  });
});

describe('rejouer — la partie gardée rend le même verdict', () => {
  it('rejoue une partie complète : même vainqueur, même fin, même nombre de tours', () => {
    const { state, partie } = partieTerminee();
    const rejeu = rejouer(partie);
    expect(rejeu.ok).toBe(true);
    if (!rejeu.ok) return;
    expect(rejeu.state.winner).toBe(state.winner);
    expect(rejeu.state.endReason).toBe(state.endReason);
    expect(rejeu.state.turn).toBe(state.turn);
    expect(ecartVerdict(rejeu.state, partie.verdict)).toBeNull();
  });

  it('le pas-à-pas finit exactement sur l’état que rend le rejeu', () => {
    const { partie } = partieTerminee();
    const rejeu = rejouer(partie);
    if (!rejeu.ok) throw new Error('le rejeu devrait réussir');
    const etapes = etapesDuRejeu(partie);
    expect(etapes).toHaveLength(partie.actions.length + 1);
    expect(etapes[0]?.phase).toBe('playing');
    expect(etapes[etapes.length - 1]).toEqual(rejeu.state);
  });

  it('le contrôle mord : un verdict faux est signalé, champ par champ', () => {
    const { state, partie } = partieTerminee();
    const faux = { ...partie.verdict, vainqueur: state.winner === 'player' ? 'ai' : 'player' } as const;
    expect(ecartVerdict(state, faux)).toMatch(/le vainqueur/);
    expect(ecartVerdict(state, { ...partie.verdict, tours: state.turn + 1 })).toMatch(/le nombre de tours/);
    expect(ecartVerdict(state, { ...partie.verdict, raison: 'forfait' })).toMatch(/la raison de la fin/);
  });

  it('refuse un Deck illégal avec sa raison, sans lever', () => {
    const { partie } = partieTerminee();
    expect(rejouer({ ...partie, playerDeck: ['sse-psychologue'] })).toEqual({
      ok: false,
      raison: 'deck-illegal',
      state: null
    });
  });

  it('refuse un journal qui ne se rejoue pas tel quel (une action ignorée en route)', () => {
    const { partie } = partieTerminee();
    const refusee: BattleAction = { type: 'attack', attackIndex: 99 };
    const rejeu = rejouer({ ...partie, actions: [refusee, ...partie.actions] });
    expect(rejeu.ok).toBe(false);
    if (rejeu.ok) return;
    expect(rejeu.raison).toBe('journal-incoherent');
  });
});

describe('lireDerniere — une forme abîmée est refusée', () => {
  it('relit une partie gardée à l’identique (aller-retour JSON)', () => {
    const { partie } = partieTerminee();
    expect(lireDerniere(JSON.parse(JSON.stringify(partie)))).toEqual(partie);
  });

  it.each([
    ['verdict absent', (p: Record<string, unknown>) => ({ ...p, verdict: undefined })],
    [
      'raison inconnue',
      (p: Record<string, unknown>) => ({ ...p, verdict: { vainqueur: 'player', raison: 'pouet', tours: 3 } })
    ],
    [
      'tours négatifs',
      (p: Record<string, unknown>) => ({ ...p, verdict: { vainqueur: 'ai', raison: null, tours: -1 } })
    ],
    ['mode inconnu', (p: Record<string, unknown>) => ({ ...p, mode: 'quatre' })],
    ['journal non tableau', (p: Record<string, unknown>) => ({ ...p, actions: 'oups' })]
  ])('refuse : %s', (_nom, abimer) => {
    const { partie } = partieTerminee();
    expect(lireDerniere(abimer(JSON.parse(JSON.stringify(partie))))).toBeNull();
  });

  it('rend null pour rien ou pour un texte', () => {
    expect(lireDerniere(null)).toBeNull();
    expect(lireDerniere(undefined)).toBeNull();
    expect(lireDerniere('PLQ1')).toBeNull();
  });
});

describe('etapesDuRejeu — une étape par action, la même partie', () => {
  it('garde l’état avant la première action et après chacune', () => {
    const [playerDeck, aiDeck] = decks();
    const { partie } = partieTerminee();
    const etapes = etapesDuRejeu(partie);
    // La première étape est la mise en place, pas une partie déjà avancée.
    expect(etapes[0]).toEqual(
      createBattle(playerDeck, aiDeck, SEED, {
        playerCafeTypes: partie.playerCafeTypes,
        aiCafeTypes: partie.aiCafeTypes
      })
    );
    // Chaque étape est l'action suivante appliquée au moteur, sans écart.
    let attendu = etapes[0] as BattleState;
    partie.actions.forEach((action, index) => {
      attendu = applyAction(attendu, action);
      expect(etapes[index + 1]).toEqual(attendu);
    });
  });
});
