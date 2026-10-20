import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import { attack, createBattle, createInstance, endTurn, promoteActive } from '@/game/engine';
import type { BattleState, PlayerId } from '@/data/types';

/**
 * **Contrôle Pokémon sur les deux Postes après chaque tour** (D-033 §5, ticket #78).
 *
 * La capture `07` de `docs/preuves/astuces-2026-10-20/` dit : « Le Contrôle Pokémon
 * est une étape ayant lieu après la fin de chaque tour » et « Si les Pokémon des deux
 * joueurs sont affectés par des États Spéciaux, le joueur dont le tour vient de prendre
 * fin procède d'abord au contrôle ».
 *
 * Ces tests portent uniquement sur `endTurn`/`checkup` : ni `attack`, ni `retreat`,
 * ni `evolve`, ni `legalActions` (d'autres agents les modifient en parallèle).
 */

const SEED = 1;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const FIRST_BASIC = BASICS[0];
if (!FIRST_BASIC) throw new Error('Aucun Entrant dans les données');

/** Chariot légal de 20 cartes, comme `engine.test.ts`. */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(seed = SEED): BattleState {
  return createBattle(DECK, DECK, seed);
}

/** Garnit la première place du Rack : de quoi relever après un craquage. */
function withBench(state: BattleState, who: PlayerId): void {
  state.players[who].bench[0] = createInstance(FIRST_BASIC, state.turn);
}

/** Monte le Seuil d'un Poste pour qu'un statut non létal ne le craque pas. */
function brace(state: BattleState, who: PlayerId): void {
  const active = state.players[who].active;
  if (!active) throw new Error('Poste vide');
  active.maxHp = 300;
  active.hp = 300;
}

describe('Contrôle des deux Postes après chaque tour (D-033 §5)', () => {
  it('frappe le Poste ADVERSE à la Surcharge, dès la fin de MON tour', () => {
    const state = freshBattle();
    brace(state, 'ai');
    const foe = state.players.ai.active;
    if (!foe) throw new Error('Poste adverse vide');
    foe.statuses = ['SURCHARGE'];
    const mineBefore = state.players.player.active?.hp;

    const after = endTurn(state); // fin de MON tour

    // Le Poste adverse a été contrôlé alors que c'est MON tour qui s'achève.
    expect(after.players.ai.active?.hp).toBe(290);
    // Le mien n'avait aucun statut : rien à perdre.
    expect(after.players.player.active?.hp).toBe(mineBefore);
    // Le tour a bien passé à l'adversaire.
    expect(after.current).toBe('ai');
  });

  it('contrôle le joueur dont le tour finit AVANT l’adversaire', () => {
    const state = freshBattle();
    for (const who of ['player', 'ai'] as PlayerId[]) {
      brace(state, who);
      const active = state.players[who].active;
      if (!active) throw new Error('Poste vide');
      active.statuses = ['SURCHARGE'];
    }

    const after = endTurn(state);

    // L'ordre du journal prouve l'ordre des Contrôles : d'abord le camp qui finit.
    const mineIndex = after.log.findIndex((line) => line.includes('Surcharge') && line.includes('ton Poste'));
    const foeIndex = after.log.findIndex((line) => line.includes('Surcharge') && line.includes('Poste adverse'));
    expect(mineIndex).toBeGreaterThanOrEqual(0);
    expect(foeIndex).toBeGreaterThan(mineIndex);
    // Les deux Postes ont bien encaissé les 10 de Surcharge (chaque camp est contrôlé).
    expect(after.players.player.active?.hp).toBe(290);
    expect(after.players.ai.active?.hp).toBe(290);
  });

  it('Immobilisation posée sur l’adversaire bloque SON tour, puis guérit à la fin de CE tour-là', () => {
    const state = freshBattle();
    brace(state, 'ai');
    const foe = state.players.ai.active;
    if (!foe) throw new Error('Poste adverse vide');
    // Posée pendant MON tour (c'est ce que fait une Pression qui inflige le statut).
    foe.statuses = ['IMMOBILISATION'];

    const afterMine = endTurn(state); // fin de MON tour

    // Le Contrôle de fin de MON tour ne guérit pas : l'Immobilisation appartient au camp
    // d'en face, dont le tour n'a pas encore eu lieu.
    expect(afterMine.current).toBe('ai');
    expect(afterMine.players.ai.active?.statuses).toContain('IMMOBILISATION');

    // Elle bloque bien SON tour : la Pression est refusée, aucun Stress n'est infligé.
    const foeDuring = { ...afterMine, current: 'ai' as PlayerId };
    const aiActive = foeDuring.players.ai.active;
    if (!aiActive) throw new Error('Poste adverse vide');
    aiActive.energy = 9;
    foeDuring.players.ai.hasAttacked = false;
    const hpBefore = foeDuring.players.player.active?.hp;
    const attacked = attack(foeDuring, 0);
    expect(attacked.log).toContain('Immobilisation : impossible d’attaquer.');
    expect(attacked.players.player.active?.hp).toBe(hpBefore);

    const afterTheirs = endTurn(afterMine); // fin de SON tour

    // « Après le prochain tour de la personne à laquelle il appartient, il guérit au
    // cours du Contrôle Pokémon » : c'est le Contrôle qui suit SON tour.
    expect(afterTheirs.players.ai.active?.statuses).not.toContain('IMMOBILISATION');
  });

  it('un craquage par Surcharge au Contrôle ouvre la relève et compte l’Intervention (D-031)', () => {
    const state = freshBattle();
    withBench(state, 'player');
    const mine = state.players.player.active;
    if (!mine) throw new Error('Poste vide');
    mine.hp = 5;
    mine.statuses = ['SURCHARGE'];

    const after = endTurn(state);

    expect(after.phase).toBe('playing');
    expect(after.pendingPromotion).toBe('player');
    expect(after.players.player.active).toBeNull();
    expect(after.players.ai.points).toBe(1);

    const resolved = promoteActive(after, 0);
    expect(resolved.pendingPromotion).toBeNull();
    expect(resolved.players.player.active).not.toBeNull();
  });

  it('deux Postes qui craquent au même Contrôle : les deux Interventions, le joueur qui finit relève en premier', () => {
    const state = freshBattle();
    withBench(state, 'player');
    withBench(state, 'ai');
    const mine = state.players.player.active;
    const foe = state.players.ai.active;
    if (!mine || !foe) throw new Error('Poste vide');
    mine.hp = 5;
    mine.statuses = ['SURCHARGE'];
    foe.hp = 5;
    foe.statuses = ['SURCHARGE'];

    const after = endTurn(state);

    expect(after.phase).toBe('playing');
    expect(after.players.player.active).toBeNull();
    expect(after.players.ai.active).toBeNull();
    // Un craquage simultané rapporte un point par Planqué mis K.O. (capture `06`).
    expect(after.players.ai.points).toBe(1);
    expect(after.players.player.points).toBe(1);
    // Le camp qui a fini son tour a contrôlé en premier : il relève en premier.
    expect(after.pendingPromotion).toBe('player');

    const first = promoteActive(after, 0);
    expect(first.players.player.active).not.toBeNull();
    expect(first.pendingPromotion).toBe('ai');
    const second = promoteActive(first, 0);
    expect(second.pendingPromotion).toBeNull();
    expect(second.players.ai.active).not.toBeNull();
  });
});

/**
 * Les statuts qui ne sont **pas** bornés au tour de leur propriétaire (Surcharge,
 * Épuisement, Sieste) s'appliquent à **chaque** Contrôle, pour les deux camps (D-033 §5).
 */
describe('Surcharge, Épuisement et Sieste à chaque Contrôle (D-033 §5)', () => {
  it('l’Épuisement frappe aussi le Poste adverse à la fin de MON tour', () => {
    const state = freshBattle();
    brace(state, 'ai');
    const foe = state.players.ai.active;
    if (!foe) throw new Error('Poste adverse vide');
    foe.statuses = ['EPUISEMENT'];

    const after = endTurn(state);

    // 20 de Stress, et le lancer de guérison consomme le générateur seedé.
    expect(after.players.ai.active?.hp).toBe(280);
    const journal = after.log.join(' | ');
    expect(journal).toContain('Épuisement : 20 de stress (Poste adverse).');
  });

  it('la Surcharge ne frappe pas un Poste sans statut', () => {
    const state = freshBattle();
    brace(state, 'ai');
    const before = state.players.ai.active?.hp;

    const after = endTurn(state);

    expect(after.players.ai.active?.hp).toBe(before);
  });

  it('chaque camp est contrôlé : l’Épuisement du joueur et celui de l’adversaire tombent au même Contrôle', () => {
    const state = freshBattle();
    for (const who of ['player', 'ai'] as PlayerId[]) {
      brace(state, who);
      const active = state.players[who].active;
      if (!active) throw new Error('Poste vide');
      active.statuses = ['EPUISEMENT'];
    }

    const after = endTurn(state);

    expect(after.players.player.active?.hp).toBe(280);
    expect(after.players.ai.active?.hp).toBe(280);
  });
});

/** La tour de contrôle n'altère pas les cartes : elle n'existe que pour lire le Poste. */
describe('checkup — le Poste du Rack n’est jamais contrôlé (D-030)', () => {
  it('ignore les statuts portés au Rack', () => {
    const state = freshBattle();
    brace(state, 'ai');
    const benched = state.players.ai.bench.find(Boolean);
    if (!benched) {
      // Rack vide : on en pose un, avec un statut — il ne doit rien subir.
      state.players.ai.bench[0] = createInstance(FIRST_BASIC, state.turn);
    }
    const card = state.players.ai.bench.find(Boolean);
    if (!card) throw new Error('Rack vide');
    card.statuses = ['SURCHARGE'];
    const hpBefore = card.hp;

    const after = endTurn(state);

    const still = after.players.ai.bench.find((entry) => entry?.uid === card.uid);
    expect(still?.hp).toBe(hpBefore);
    expect(still?.statuses).toContain('SURCHARGE');
  });
});

/** Garde-fou : les données employées par ces tests restent cohérentes. */
describe('support des tests', () => {
  it('le premier Entrant du Chariot est un Planqué de stade ENTRANT', () => {
    const card = getCard(FIRST_BASIC);
    expect(isPlanque(card) && card.stage === 'ENTRANT').toBe(true);
  });
});
