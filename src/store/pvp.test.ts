import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { ALL_CARDS } from '@/data';
import type { BattleState, PlayerId } from '@/data/types';
import { autoDeck, deckLegal } from '@/game/deck';
import { applyAction, createBattle } from '@/game/engine';

/**
 * La partie à deux (#125) — et surtout **le contrôle qui mord** : la Direction ne joue
 * jamais à la place du second joueur.
 *
 * `nextAiAction` est **remplacé** dans tout ce fichier : c'est la seule façon de prouver
 * qu'il n'est *pas appelé* quand on tient le camp `ai`. Un test qui se contenterait de
 * lire le code source vieillirait mal ; celui-ci confronte le module à un cas fautif
 * (une partie à deux où c'est à la Direction de jouer) et échoue si la garde tombe
 * (`AGENTS.md` §6, #112).
 */
vi.mock('@/game/ia', () => ({ nextAiAction: vi.fn() }));

import { nextAiAction } from '@/game/ia';
import {
  aiTurnAction,
  CAMP_NAME,
  campLine,
  campToAct,
  createMatch,
  handover,
  joinMatch,
  matchCode,
  otherCamp
} from '@/store/pvp';

const mockedAi = vi.mocked(nextAiAction);

/** Un Chariot **légal** de 20 cartes, pris dans tout le catalogue (`autoDeck`). */
function testDeck(): string[] {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const built = autoDeck(owned).deck;
  expect(deckLegal(built).ok, 'Chariot de test légal').toBe(true);
  return built;
}

/**
 * Une graine dont on **sait** qui ouvre : le lancer de tampon de `createBattle` est
 * seedé (D-033), donc la recherche est déterministe — même graine, même camp.
 */
function seedFor(first: PlayerId): number {
  for (let seed = 1; seed < 500; seed += 1) {
    if (createBattle(testDeck(), testDeck(), seed).current === first) return seed;
  }
  throw new Error(`aucune graine trouvée pour ${first}`);
}

describe('pvp — ouvrir une partie à deux', () => {
  it('porte sa graine, mon Chariot, et le Chariot du camp adverse', () => {
    const mine = testDeck();
    const theirs = testDeck().slice().reverse();
    const { state, match } = createMatch(mine, theirs, 4242);

    // La graine est celle de la partie, pas une copie d'écran.
    expect(state.seed).toBe(4242);
    expect(match.playerDeck).toEqual(mine);
    expect(match.aiDeck).toEqual(theirs);
    // Je crée : je tiens le siège `player` ; l'autre joueur tiendra le camp qui reste.
    expect(match.camp).toBe('player');
    expect(state.actionLog).toEqual([]);
  });

  it('nomme les deux camps et sait passer de l’un à l’autre', () => {
    expect(otherCamp('player')).toBe('ai');
    expect(otherCamp('ai')).toBe('player');
    expect(CAMP_NAME.player).not.toBe(CAMP_NAME.ai);
  });
});

describe('pvp — à qui c’est le tour', () => {
  it('désigne la relève en attente avant le camp qui a la main', () => {
    const { state } = createMatch(testDeck(), testDeck(), seedFor('player'));
    expect(campToAct(state)).toBe('player');
    // Après une Pression qui craque le Poste adverse, `current` est l'attaquant et
    // `pendingPromotion` l'autre camp : c'est ce dernier qui joue.
    const forged: BattleState = { ...state, pendingPromotion: 'ai' };
    expect(campToAct(forged)).toBe('ai');
  });

  it('dit de quel camp je joue et à qui c’est le tour', () => {
    const { state, match } = createMatch(testDeck(), testDeck(), seedFor('player'));
    expect(campLine(state, match)).toBe('Tu joues le camp Toi · à toi de jouer');
    const afterEnd = applyAction(state, { type: 'endTurn' });
    expect(campLine(afterEnd, match)).toBe('Tu joues le camp Toi · c’est au camp Direction de jouer');
    // Un écran qui tiendrait l'autre camp le dit sans se tromper.
    expect(campLine(state, { ...match, camp: 'ai' })).toBe(
      'Tu joues le camp Direction · c’est au camp Toi de jouer'
    );
  });
});

describe('pvp — le code ne se transmet qu’à la fin de mon tour', () => {
  it('refuse tant que c’est à moi, puis accepte quand l’autre camp doit jouer', () => {
    const { state, match } = createMatch(testDeck(), testDeck(), seedFor('player'));
    const early = handover(state, match);
    expect(early.ready).toBe(false);
    if (!early.ready) expect(early.raison).toMatch(/encore à toi/);

    const afterEnd = applyAction(state, { type: 'endTurn' });
    expect(campToAct(afterEnd)).toBe('ai');
    expect(handover(afterEnd, match)).toEqual({ ready: true });
  });

  it('demande ma relève avant de transmettre, quand mon Poste a craqué', () => {
    const { state, match } = createMatch(testDeck(), testDeck(), seedFor('player'));
    const afterEnd = applyAction(state, { type: 'endTurn' });
    // Mon Poste craque au Contrôle : c'est à moi de relever, donc la main ne passe pas.
    const forged: BattleState = { ...afterEnd, current: 'ai', pendingPromotion: 'player' };
    const answer = handover(forged, match);
    expect(answer.ready).toBe(false);
    if (!answer.ready) expect(answer.raison).toMatch(/relève/);
  });

  it('n’offre plus de code sur une partie terminée', () => {
    const { state, match } = createMatch(testDeck(), testDeck(), seedFor('player'));
    const ended: BattleState = { ...state, phase: 'ended', winner: 'player' };
    const answer = handover(ended, match);
    expect(answer.ready).toBe(false);
    if (!answer.ready) expect(answer.raison).toMatch(/terminée/);
  });
});

describe('pvp — le code', () => {
  it('rejoue la partie à l’identique, et rend le camp qui doit jouer', () => {
    const mine = testDeck();
    const theirs = testDeck();
    let { state, match } = createMatch(mine, theirs, seedFor('player'));
    // Fin de mon tour : le journal n'est plus vide, et la main passe à l'autre camp —
    // c'est exactement le moment où le code se transmet (`handover`).
    state = applyAction(state, { type: 'endTurn' });
    expect(state.actionLog).toHaveLength(1);
    expect(handover(state, match)).toEqual({ ready: true });

    const code = matchCode(state, match);
    expect(code).toMatch(/^PLQ1\./);
    expect(matchCode(state, match)).toBe(code);

    const joined = joinMatch(code);
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.state).toEqual(state);
    expect(joined.state.seed).toBe(state.seed);
    // Celui qui colle prend le camp qui doit agir : le camp adverse de l'envoyeur.
    expect(joined.match.camp).toBe(campToAct(state));
    expect(joined.match.camp).not.toBe(match.camp);
  });

  it('affiche la raison du refus du codec, sans la remplacer', () => {
    const refused = joinMatch('bonjour');
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.kind).toBe('pas-un-code');
      expect(refused.raison.length).toBeGreaterThan(0);
    }

    const { state, match } = createMatch(testDeck(), testDeck(), seedFor('player'));
    const truncated = matchCode(state, match).slice(0, -4);
    const broken = joinMatch(truncated);
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.kind).toBe('integrite');
  });
});

describe('pvp — l’IA ne joue jamais à deux (#125)', () => {
  it('n’appelle pas nextAiAction quand je tiens le camp Direction', () => {
    const seed = seedFor('ai');
    const { state, match } = createMatch(testDeck(), testDeck(), seed);
    expect(campToAct(state)).toBe('ai');
    mockedAi.mockReturnValue({ type: 'endTurn' });
    mockedAi.mockClear();

    expect(aiTurnAction(state, match)).toBeNull();
    expect(mockedAi).not.toHaveBeenCalled();
  });

  it('la fait jouer en solo, sur la même position (le contrôle mord)', () => {
    const { state } = createMatch(testDeck(), testDeck(), seedFor('ai'));
    mockedAi.mockReturnValue({ type: 'endTurn' });
    mockedAi.mockClear();

    expect(aiTurnAction(state, null)).toEqual({ type: 'endTurn' });
    expect(mockedAi).toHaveBeenCalledTimes(1);
  });

  it('ne la fait pas jouer hors de son tour, même en solo', () => {
    const { state } = createMatch(testDeck(), testDeck(), seedFor('player'));
    mockedAi.mockClear();
    expect(aiTurnAction(state, null)).toBeNull();
    expect(mockedAi).not.toHaveBeenCalled();
  });
});

/**
 * Les gardes d'**écran** : ce que le composant ne doit plus faire. Même technique que
 * `pages/Battle.test.ts` (#58) — le contrat porte sur la source, donc c'est la source
 * qu'on lit. Elles échouent si la régression revient, pas si le code change de forme.
 */
const battle = readFileSync(fileURLToPath(new URL('../pages/Battle.tsx', import.meta.url)), 'utf8');

describe('pvp — gardes de l’écran de combat', () => {
  it('ne branche l’IA que par aiTurnAction, donc jamais à deux', () => {
    expect(battle).toMatch(/aiTurnAction\(state, match\)/);
    expect(battle).not.toMatch(/nextAiAction/);
  });

  it('ne montre de la main adverse que son compte', () => {
    expect(battle).toMatch(/mySide\.hand\.map\(/);
    expect(battle).toMatch(/side\.hand\.length/);
    expect(battle).not.toMatch(/side\.hand\.map\(/);
  });

  it('nomme mon camp partout où le solo nommait « player »', () => {
    expect(battle).toMatch(/who: myCamp/);
    expect(battle).not.toMatch(/who: 'player'/);
    expect(battle).toMatch(/handover\(state, match\)/);
    expect(battle).toMatch(/joinMatch\(/);
  });
});
