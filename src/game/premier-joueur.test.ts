import { describe, expect, it } from 'vitest';
import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import {
  attachEnergy,
  canEvolve,
  createBattle,
  createInstance,
  endTurn,
  evolve,
  isFirstTurnFor,
  legalActions
} from '@/game/engine';
import type { BattleState, PlayerId } from '@/data/types';

/**
 * D-033 (6), capture `04` : « Une pièce est lancée automatiquement. Le joueur qui
 * obtient le côté face a la main. » Le lancer passe par le générateur **seedé** de la
 * partie : une même graine ouvre donc toujours sur le même camp. Ce fichier couvre les
 * **deux issues** du tirage, leurs conséquences (pioche D-030, café absent au premier
 * tour, évolution interdite) et la reproductibilité par graine.
 */

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

const OTHER: Record<PlayerId, PlayerId> = { player: 'ai', ai: 'player' };

function create(seed: number): BattleState {
  return createBattle(DECK, DECK, seed);
}

/** La plus petite graine pour laquelle `who` ouvre, dans une plage bornée. */
function seedOpeningWith(who: PlayerId): number {
  for (let seed = 1; seed <= 200; seed += 1) {
    if (create(seed).firstPlayer === who) return seed;
  }
  throw new Error(`Aucune graine où « ${who} » ouvre dans la plage explorée.`);
}

function inPlayCount(state: BattleState, who: PlayerId): number {
  const player = state.players[who];
  return [player.active, ...player.bench].filter(Boolean).length;
}

/**
 * Un couple **Entrant → N+1** réel du set. Les tests d'évolution placent cet Entrant
 * au Poste plutôt que de dépendre de la carte tirée : sinon ils passeraient sans rien
 * vérifier dès que la carte au Poste n'a pas d'évolution.
 */
const EVOLUTION_PAIR = (() => {
  for (const card of ALL_CARDS) {
    if (!isPlanque(card) || card.variantOf || !card.evolvesFrom) continue;
    const base = ALL_CARDS.find((entry) => entry.id === card.evolvesFrom);
    if (base && isBasic(base)) return { basicId: base.id, evolutionId: card.id };
  }
  throw new Error('Le set ne contient aucune évolution d’Entrant.');
})();

/** Place l'Entrant du couple au Poste de `who` et rend l'id de son évolution. */
function withEvolvableActive(state: BattleState, who: PlayerId): string {
  const active = state.players[who].active;
  if (!active) throw new Error('Poste vide');
  active.cardId = EVOLUTION_PAIR.basicId;
  return EVOLUTION_PAIR.evolutionId;
}

describe('Tirage du premier joueur (D-033 (6))', () => {
  it('est reproductible : même graine → même premier joueur', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(create(seed).firstPlayer, `graine ${seed}`).toBe(create(seed).firstPlayer);
    }
  });

  it('présente les deux issues, et place `current` sur le premier joueur', () => {
    const playerSeed = seedOpeningWith('player');
    const aiSeed = seedOpeningWith('ai');
    expect(playerSeed).not.toBe(aiSeed);
    expect(create(playerSeed).firstPlayer).toBe('player');
    expect(create(playerSeed).current).toBe('player');
    expect(create(aiSeed).firstPlayer).toBe('ai');
    expect(create(aiSeed).current).toBe('ai');
  });

  it('journalise qui ouvre, en français', () => {
    const playerSeed = seedOpeningWith('player');
    const aiSeed = seedOpeningWith('ai');
    expect(create(playerSeed).log).toContain('Lancer de tampon : tu ouvres.');
    expect(create(aiSeed).log).toContain('Lancer de tampon : la Direction ouvre.');
  });

  for (const opener of ['player', 'ai'] as const) {
    const seed = seedOpeningWith(opener);
    const other = OTHER[opener];
    const label = opener === 'player' ? 'le joueur' : 'la Direction';

    it(`le premier tour est le tour 1 pour ${label} (graine ${seed})`, () => {
      const state = create(seed);
      expect(state.turn).toBe(1);
      expect(state.firstPlayer).toBe(opener);
      expect(state.current).toBe(opener);
    });

    it(`${label} pioche à son premier tour`, () => {
      const state = create(seed);
      // 5 cartes de départ + la pioche d'ouverture (D-030) ; l'autre camp reste à 5.
      expect(state.players[opener].hand.length + inPlayCount(state, opener)).toBe(6);
      expect(state.players[other].hand.length + inPlayCount(state, other)).toBe(5);
    });

    it(`n’a aucun café généré ni attachable au premier tour de ${label}`, () => {
      const state = create(seed);
      expect(state.players[opener].energyZone).toBe(0);
      // Aucune ligne de génération, ni pour l'un ni pour l'autre (capture `05`).
      expect(state.log.some((line) => line.includes('produit 1 café'))).toBe(false);

      // La liste du moteur n'offre aucune attache...
      expect(legalActions(state).some((action) => action.type === 'attachEnergy')).toBe(false);

      // ...et `attachEnergy` la refuse : rien n'est attaché, rien n'est dépensé.
      const active = state.players[opener].active;
      if (!active) throw new Error('Poste vide');
      const after = attachEnergy(state, active.uid);
      expect(after.players[opener].active?.energy).toBe(0);
      expect(after.players[opener].energyZone).toBe(0);
    });

    it(`génère normalement dès le premier tour du second joueur (${label} ouvre)`, () => {
      const state = endTurn(create(seed));
      expect(state.turn).toBe(2);
      expect(state.current).toBe(other);
      expect(state.players[other].energyZone).toBe(1);
      expect(state.log).toContain(
        other === 'player' ? 'La machine à café produit 1 café.' : 'La machine à café adverse produit 1 café.'
      );
    });

    it(`interdit l’évolution au premier tour de ${label}`, () => {
      const state = create(seed);
      expect(isFirstTurnFor(state, opener)).toBe(true);

      const next = structuredClone(state);
      const evolutionId = withEvolvableActive(next, opener);
      const instance = createInstance(evolutionId, next.turn);
      next.players[opener].hand.push(instance);
      const target = next.players[opener].active;
      if (!target) throw new Error('Poste vide');

      expect(canEvolve(next, instance.uid, target.uid)).toBe(false);
      expect(evolve(next, instance.uid, target.uid)).toBe(next);
    });

    it(`autorise l’évolution au tour suivant de ${label}`, () => {
      const state = create(seed);

      const prepared = structuredClone(state);
      const evolutionId = withEvolvableActive(prepared, opener);
      const instance = createInstance(evolutionId, prepared.turn);
      prepared.players[opener].hand.push(instance);

      // Deux fins de tour : on revient au premier joueur, à son deuxième tour (tour 3).
      const back = endTurn(endTurn(prepared));
      expect(back.turn).toBe(3);
      expect(back.current).toBe(opener);
      expect(isFirstTurnFor(back, opener)).toBe(false);
      const target = back.players[opener].active;
      if (!target) throw new Error('Poste vide');

      expect(canEvolve(back, instance.uid, target.uid)).toBe(true);
      expect(evolve(back, instance.uid, target.uid)).not.toBe(back);
    });
  }
});
