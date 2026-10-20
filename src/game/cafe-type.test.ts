import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import {
  applyAction,
  attack,
  attackPreview,
  createBattle,
  endTurn,
  legalActions,
  legalAttacks,
  retreat
} from '@/game/engine';
import { satisfiesCafeCost } from '@/game/rules';
import { nextAiAction } from '@/game/ia';
import type { Attack, BattleState, Card, PlanqueCard } from '@/data/types';

/**
 * **Le paiement des Pressions suit le coût typé** (ticket #88/#90, D-037) : chaque
 * symbole du coût exige un café de son type, un symbole `INCOLORE` accepte tout, et
 * un café ne paie qu'**une fois**. Une seule fonction décide — `satisfiesCafeCost`
 * (rules.ts) — et le moteur n'en déphase aucun appel : les Pressions listées
 * (`legalAttacks`), exécutées (`attack`) et prévisualisées (`attackPreview`)
 * répondent pareil. La **Rotation**, elle, reste le seul paiement **au nombre** de
 * cafés (`AGENTS.md` §4) : son coût n'est pas un coût typé.
 */
const SEED = 5;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);

/** Chariot légal de 20 cartes (10 noms N+1 en double). */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(seed = SEED): BattleState {
  return createBattle(DECK, DECK, seed);
}

/**
 * **Mutations de la table globale, rendues réversibles** (#118).
 *
 * Les Pressions d'essai ne peuvent pas vivre dans le `BattleState` : `CardInstance`
 * ne porte ni `attacks` ni `retreat` — `legalAttacks`, `attack`, `attackPreview` et
 * `retreat` lisent tous la carte par `getCard(cardId)`, donc dans `CARD_BY_ID`. Le
 * test doit donc patcher la table, et c'est le **nettoyage** qu'il
 * faut rendre infaillible : chaque patch est enregistré ici et `afterEach` remet la
 * carte d'origine, **même si une assertion échoue avant la fin du test**. Le
 * nettoyage ne dépend plus de l'auteur du test : un `restore()` oublié en fin de
 * `it` — il y en avait un, sur la Rotation — ne peut plus fuir vers les suivants.
 */
const PATCHES: { id: string; original: Card }[] = [];

/** Remplace des champs d'un Planqué de test, en retenant l'original pour `afterEach`. */
function patchPlanque(id: string, patch: Partial<PlanqueCard>): void {
  const original = CARD_BY_ID.get(id);
  if (!isPlanque(original)) throw new Error(`Carte inconnue : ${id}`);
  PATCHES.push({ id, original });
  CARD_BY_ID.set(id, { ...original, ...patch });
}

/** Remet toutes les cartes patchées dans l'ordre inverse, puis vide le registre. */
afterEach(() => {
  for (const { id, original } of PATCHES.splice(0).reverse()) CARD_BY_ID.set(id, original);
});

/**
 * **Détecteur de fuite** : une mutation qui aurait survécu à un test précédent fait
 * échouer le suivant **en nommant la carte fautive**, au lieu de fausser une
 * assertion plus loin. C'est ce que #118 reprochait au `restore()` hors `finally`.
 */
beforeEach(() => {
  for (const card of ALL_CARDS) {
    expect(CARD_BY_ID.get(card.id), `carte mutée par un test précédent : ${card.id}`).toBe(card);
  }
});

/**
 * Remplace les Pressions du Poste du camp au trait par des Pressions d'essai, le
 * temps du test : `afterEach` restaure la carte de données.
 */
function withPressions(state: BattleState, pressions: Attack[]): BattleState {
  const player = state.players[state.current];
  const active = player.active;
  if (!active) throw new Error('Poste vide');
  patchPlanque(active.cardId, { attacks: pressions });
  return state;
}

describe('Paiement typé — le contrat d’une Pression (D-037)', () => {
  it('refuse une Pression dont le type exigé n’est pas dans les cafés du Poste', () => {
    const state = withPressions(freshBattle(), [
      { name: 'Pression test', cost: ['QVT'], damage: 10 }
    ]);
    const player = state.players[state.current];
    player.active!.energy = ['SSE'];
    player.hasAttacked = false;

    // Un café SSE ne paie jamais un symbole QVT : ni la liste, ni la transition.
    expect(legalAttacks(state)).toEqual([]);
    expect(attackPreview(state, 0)).toBe(0);
    const after = attack(state, 0);
    expect(after).toBe(state);
  });

  it('paie un symbole incolore avec n’importe quel café, et une fois seulement', () => {
    const state = withPressions(freshBattle(), [
      { name: 'Pression incolore', cost: ['INCOLORE'], damage: 10 },
      { name: 'Pression double', cost: ['INCOLORE', 'INCOLORE'], damage: 20 }
    ]);
    const player = state.players[state.current];
    // Un café typé quelconque — ici SSE — paie le symbole incolore (D-037 (2)).
    player.active!.energy = ['SSE'];
    player.hasAttacked = false;

    expect(legalAttacks(state).map((entry) => entry.name)).toEqual(['Pression incolore']);

    // Une fois payé correctement, le deuxième incolore lance la Pression en paie deux.
    player.active!.energy = ['SSE', 'QVT'];
    expect(legalAttacks(state).map((entry) => entry.name)).toEqual([
      'Pression incolore',
      'Pression double'
    ]);
  });

  it('exige le nombre exact de cafés quand le coût mélange types et incolore', () => {
    const state = withPressions(freshBattle(), [
      { name: 'Pression mixte', cost: ['QVT', 'INCOLORE'], damage: 20 }
    ]);
    const player = state.players[state.current];

    // Deux cafés, mais aucun QVT : l'incolore couvre QVT? Non — un café paie **une
    // exigence** : `QVT` reste impayé avec deux cafés SSE.
    player.active!.energy = ['SSE', 'SSE'];
    player.hasAttacked = false;
    expect(legalAttacks(state)).toEqual([]);

    // Un QVT paie le symbole QVT, le second café (peu importe lequel) paie l'incolore.
    player.active!.energy = ['QVT', 'SSE'];
    expect(legalAttacks(state)).toHaveLength(1);
  });

  it('l’IA ne joue jamais une Pression non payable, sur plusieurs graines (#90)', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      let state = createBattle(DECK, DECK, seed);
      for (let turn = 0; turn < 60 && state.phase === 'playing'; turn += 1) {
        // On n'examine que les tours de la Direction ; le joueur passe son tour
        // par `endTurn` — la politique du simulateur emploie `nextAction` pareil.
        if (state.pendingPromotion && state.pendingPromotion !== 'ai') break; // relève du joueur : hors périmètre
        if (state.current !== 'ai') {
          state = endTurn(state);
          continue;
        }
        const action = nextAiAction(state);
        if (!action) break;
        const after = applyAction(state, action);
        if (action.type === 'attack') {
          const active = state.players.ai.active;
          if (!active) throw new Error('Poste adverse vide');
          const card = getCard(active.cardId);
          if (!isPlanque(card)) throw new Error('Carte inconnue');
          const pression = card.attacks[action.attackIndex];
          if (!pression) throw new Error('Pression inconnue');
          // Le contrat : le café couvre le coût **typé**, et la transition
          // accepte — une action refusée retournant l'état tel quel.
          expect(
            satisfiesCafeCost(active.energy, pression.cost),
            `graine ${seed}, « ${pression.name} »`
          ).toBe(true);
          expect(after).not.toBe(state);
        }
        state = after;
      }
      // La partie derrière cette boucle n'a pas d'attente : seule la politique
      // est interrogée, à graine fixe.
    }
  });
});

describe('Rotation — le seul paiement au nombre', () => {
  it('défausse autant de cafés que le coût de relève, sans égard aux types', () => {
    const state = freshBattle();
    const player = state.players.player;
    const active = player.active;
    const slot = player.bench.findIndex(Boolean);
    if (!active || slot < 0) throw new Error('Poste ou Rack vide');
    // Une relève à 2 : trois cafés typés sans ordre requis — la relève se paye au
    // nombre, les **premiers** de la liste partent (défausse déterministe).
    // `patchPlanque` retient l'original : `afterEach` le remet (#118).
    patchPlanque(active.cardId, { retreat: 2 });
    active.energy = ['QVT', 'RH', 'SSE'];

    const after = retreat(state, slot);

    expect(after.players.player.bench[slot]?.energy).toEqual(['SSE']);
  });
});

describe('Effet discardEnergy — un seul café au rebut', () => {
  it('retire le premier café du Planqué frappé, sans restaurer la Machine d’en face', () => {
    const state = withPressions(freshBattle(), [
      {
        name: 'Pression saisie',
        cost: ['SSE'],
        damage: 10,
        effects: [{ kind: 'discardEnergy' }]
      }
    ]);
    const player = state.players[state.current];
    const foeId = state.current === 'player' ? 'ai' : 'player';
    const defender = state.players[foeId].active;
    if (!player.active || !defender) throw new Error('Poste vide');
    player.active.energy = ['SSE'];
    player.hasAttacked = false;
    // Deux cafés au Poste d'en face : l'effet n'en couche qu'**un** au rebut, le
    // premier de la liste — et la Machine d'en face n'est pas reliée à ce café
    // défaussé : sa zone, vide, reste vide.
    defender.energy = ['QVT', 'SSE'];
    defender.maxHp = 300;
    defender.hp = 300;

    const after = attack(state, 0);

    expect(after.players[foeId].active?.energy).toEqual(['SSE']);
    expect(after.players[foeId].energyZone).toBeNull();
  });

  it('un Poste sans café n’offre aucune Pression : la liste est déjà filtrée', () => {
    const state = freshBattle();
    const player = state.players.player;
    if (!player.active) throw new Error('Poste vide');
    // Un Poste sans café : aucune Pression payée à la liste, comme à la main.
    player.active.energy = [];
    player.hasAttacked = false;

    const attacks = legalActions(state).filter((action) => action.type === 'attack');

    expect(attacks).toEqual([]);
  });
});
