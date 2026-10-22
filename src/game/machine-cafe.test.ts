import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import { applyAction, attachEnergy, createBattle, endTurn, replayBattle } from '@/game/engine';
import { deckCafeTypes } from '@/game/deck';
import type { BattleState, CafeType } from '@/data/types';

/**
 * **Le café de la Machine à café a un type** (ticket #88/#89, D-034/D-037).
 *
 * La Machine ne produit plus « un café » abstrait : elle tire **un type** parmi
 * ceux du Deck (jusqu'à 3, `deckCafeTypes`), par le générateur **seedé** de la
 * partie — même graine, même café. L'attachement déplace ce café vers l'instance,
 * qui **conserve son type**.
 */
const SEED = 5;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map(
  (card) => card.id
);

/** Deck légal de 20 cartes (10 noms N+1 en double). */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(seed = SEED): BattleState {
  return createBattle(DECK, DECK, seed);
}

describe('Machine à café — les types du Deck', () => {
  it('dresse cafeTypes des deux camps à la création, dérivés du Deck', () => {
    const state = freshBattle();

    expect(state.players.player.cafeTypes).toEqual(deckCafeTypes(DECK));
    expect(state.players.ai.cafeTypes).toEqual(deckCafeTypes(DECK));
    // Le Deck d'essai produit quelque chose : sinon la suite ne testerait rien.
    expect(state.players.player.cafeTypes.length).toBeGreaterThan(0);
  });

  it('ne retient ni SUPPORT ni INTERIM, et plafonne à 3 types (D-034)', () => {
    // Un Deck Sprinter : les factions, dans l'ordre où le Deck les porte,
    // sont échantillonnées à 3 — au-delà, les suivantes n'entrent pas.
    const types = deckCafeTypes(DECK);
    expect(types.length).toBeLessThanOrEqual(3);
    expect(types).not.toContain('SUPPORT');
    expect(types).not.toContain('INTERIM');
    // Toujours dans le Deck d'essai : chaque type annoncé est bien celui d'un
    // Planqué présent dans le Deck.
    const factions = new Set(
      DECK.map((id) => getCard(id))
        .filter(isPlanque)
        .map((card) => card.faction)
    );
    for (const type of types) expect(factions.has(type)).toBe(true);
  });

  it('produit un café tiré dans les types du Deck, dès son deuxième tour (D-034)', () => {
    const state = freshBattle();
    // Premier tour de la partie : aucune génération (capture `05`).
    expect(state.players.player.energyZone).toBeNull();

    const next = endTurn(endTurn(state)); // retour au joueur, tour 3
    const zone = next.players.player.energyZone;
    expect(zone).not.toBeNull();
    expect(next.players.player.cafeTypes).toContain(zone);
    expect(next.log.join(' ')).toMatch(/produit 1 café /);
  });

  it('même graine → même café, graine différente → café différent possible (déterminisme, #29)', () => {
    const zoneOf = (seed: number) => {
      const next = endTurn(endTurn(freshBattle(seed)));
      return next.players.player.energyZone;
    };

    expect(zoneOf(SEED)).toBe(zoneOf(SEED));
    // Le tirage dépend de la graine : on vérifie seulement que l'ensemble des
    // graines reste dans les types du Deck, jamais hors d'eux.
    const types = deckCafeTypes(DECK);
    expect(types).toContain(zoneOf(1));
    expect(types).toContain(zoneOf(2));
  });

  it('l’attachement conserve le type : le café de la Machine rejoint l’instance (D-037)', () => {
    const state = endTurn(endTurn(freshBattle())); // tour 3 : café produit, attachement ouvert
    const player = state.players.player;
    const zone = player.energyZone;
    if (!zone) throw new Error('Aucun café produit');
    if (!player.active) throw new Error('Poste vide');

    const after = attachEnergy(state, player.active.uid);

    expect(after.players.player.energyZone).toBeNull();
    expect(after.players.player.active?.energy).toEqual([zone]);
  });
});

/**
 * **Le joueur choisit les types de café de son Deck** (#91, D-037 (4)). Le choix
 * traverse `createBattle` (4ᵉ argument) jusqu'à `PlayerState.cafeTypes`, et c'est
 * cette liste-là que la Machine tire — pas la dérivation.
 */
describe('Machine à café — les types choisis par le joueur (#91)', () => {
  it('dresse les types choisis pour le joueur, et la dérivation pour l’autre camp', () => {
    const state = createBattle(DECK, DECK, SEED, { playerCafeTypes: ['RH'] });

    expect(state.players.player.cafeTypes).toEqual(['RH']);
    expect(state.players.ai.cafeTypes).toEqual(deckCafeTypes(DECK));
  });

  it('ne tire que dans les types choisis, même un type absent du Deck', () => {
    expect(deckCafeTypes(DECK)).not.toContain('RH');

    for (let seed = 1; seed <= 12; seed += 1) {
      const battle = createBattle(DECK, DECK, seed, { playerCafeTypes: ['RH'] });
      const zone = endTurn(endTurn(battle)).players.player.energyZone;
      expect(zone, `graine ${seed}`).toBe('RH');
    }
  });

  it('refuse SUPPORT et INTERIM dans le choix : retombe sur la proposition', () => {
    const forged = ['SUPPORT', 'INTERIM'] as unknown as CafeType[];
    const state = createBattle(DECK, DECK, SEED, { playerCafeTypes: forged });

    expect(state.players.player.cafeTypes).toEqual(deckCafeTypes(DECK));
    expect(state.players.player.cafeTypes).not.toContain('SUPPORT');
    expect(state.players.player.cafeTypes).not.toContain('INTERIM');
  });

  it('fait partie de la mise en place : le rejeu le reprend (ticket #83)', () => {
    const chosen: CafeType[] = ['RH', 'QVT'];
    let state = createBattle(DECK, DECK, SEED, { playerCafeTypes: chosen });
    state = applyAction(state, { type: 'endTurn' });
    state = applyAction(state, { type: 'endTurn' });

    const replayed = replayBattle(DECK, DECK, state.seed, state.actionLog, {
      playerCafeTypes: chosen
    });
    expect(replayed).toEqual(state);
  });
});

/**
 * Garde-fou de l'**écran de combat** : les cafés du plateau se dessinent depuis un
 * seul motif. Même technique que `Battle.test.ts` : le contrat porte sur la source,
 * donc c'est la source qu'on lit.
 */
const battleSource = readFileSync(
  fileURLToPath(new URL('../pages/Battle.tsx', import.meta.url)),
  'utf8'
);

describe('Battle.tsx — le plateau rend les cafés typés', () => {
  it('dessine les cafés par les pastilles de la maison (CafePips / CafeDot / cafeLabel)', () => {
    expect(battleSource).toMatch(/<CafePips\b/);
    expect(battleSource).toMatch(/<CafeDot\b/);
    expect(battleSource).toMatch(/cafeLabel\(/);
  });

  it('pose ses deux gabarits dédiés : CafesPips et MachinePips', () => {
    // `CafesPips` dessine les cafés attachés d'un Planqué, `MachinePips` la zone
    // de la Machine : deux gabarits, un seul motif de pastille.
    expect(battleSource).toMatch(/<CafesPips\b/);
    expect(battleSource).toMatch(/<MachinePips\b/);
  });

  it('passe au moteur les types de café choisis du Deck (#91)', () => {
    // Sans ce passage, l'écran de combat jouerait la dérivation alors que le joueur
    // a choisi ses types au Deck : le défaut serait invisible côté moteur.
    expect(battleSource).toMatch(/state\.cafeTypes/);
    expect(battleSource).toMatch(
      /createBattle\(playerDeck, testDeck\(\), undefined, \{ playerCafeTypes: chosenCafeTypes \}\)/
    );
  });
});
