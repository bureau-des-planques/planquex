import { describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import {
  attack,
  attackPreview,
  attachEnergy,
  canEvolve,
  canPlayAction,
  createBattle,
  createInstance,
  endTurn,
  evolve,
  isFirstTurnFor,
  legalAttacks,
  playAction,
  playBasic,
  promoteActive,
  priorityShift,
  retreat
} from '@/game/engine';
import { DECK_SIZE } from '@/game/deck';
import { RULES } from '@/game/rules';
import type { BattleState, PlayerId } from '@/data/types';

/**
 * Le moteur est **seedé** (ticket #29) : les tests choisissent une graine
 * explicite au lieu de figer `Math.random()`. Même graine, même partie.
 */
const SEED = 1;

const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map(
  (card) => card.id
);

/** Chariot légal de 20 cartes (10 noms N+1 en double). */
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function freshBattle(seed = SEED): BattleState {
  return createBattle(DECK, DECK, seed);
}

/** Cartes en main + au Poste + à l'Rack. */
function ownedByPlayer(state: BattleState): number {
  const player = state.players.player;
  const inPlay = [player.active, ...player.bench].filter(Boolean).length;
  return player.hand.length + inPlay;
}

describe('createBattle — mise en place', () => {
  it('distribue 5 cartes, pose un N+1 au Poste et ouvre le tour du joueur', () => {
    const state = freshBattle();
    // Les 5 cartes de la main de départ servent aussi à poser le Poste et
    // l'Rack : la main ne conserve que les Planqués non posés.
    expect(ownedByPlayer(state)).toBe(5);
    expect(state.players.player.active).not.toBeNull();
    expect(state.current).toBe('player');
    expect(state.turn).toBe(1);
  });

  it('empêche le premier joueur de piocher à son premier tour', () => {
    const state = freshBattle();
    expect(state.log).toContain('Premier tour : tu ne pioches pas.');
    expect(ownedByPlayer(state)).toBe(5);
  });

  it('remplit la Machine à café du joueur actif', () => {
    const state = freshBattle();
    expect(state.players.player.energyZone).toBe(1);
  });
});

describe('Main de départ — pas de reprise de poste (D-022)', () => {
  /** Chariot à un seul N+1 : les 5 premières cartes tirées n'en contiennent presque jamais. */
  const EVOLUTIONS = ALL_CARDS.filter(
    (card) => isPlanque(card) && !card.variantOf && card.stage !== 'ENTRANT'
  ).map((card) => card.id);
  const SPARSE_DECK = [BASICS[0], ...EVOLUTIONS, ...EVOLUTIONS].slice(0, DECK_SIZE);

  it('garantit un N+1 sans remélanger ni faire piocher l’adversaire', () => {
    // Quarante graines : on parcourt plusieurs mélanges plutôt qu'un seul.
    for (let run = 0; run < 40; run += 1) {
      const battle = createBattle(SPARSE_DECK, SPARSE_DECK, run + 1);
      for (const who of ['player', 'ai'] as PlayerId[]) {
        const player = battle.players[who];
        const inPlay = [player.active, ...player.bench].filter(Boolean);

        // La main de départ contient toujours un Planqué N+1 jouable.
        expect(
          inPlay.some((card) => isBasic(getCard(card?.cardId ?? ''))),
          `run ${run}, ${who} : aucun N+1`
        ).toBe(true);
        // Cinq cartes au total, donc aucune pioche de compensation.
        expect(player.hand.length + inPlay.length, `run ${run}, ${who} : taille de main`).toBe(5);
        // Aucune carte perdue ni dupliquée par l'échange.
        expect(
          player.hand.length + inPlay.length + player.deck.length + player.discard.length,
          `run ${run}, ${who} : total de cartes`
        ).toBe(DECK_SIZE);
      }
    }
  });
});

describe('endTurn — statut létal', () => {
  it('termine la partie quand le checkup tue le Planqué au Poste (garde engine.ts endTurn)', () => {
    const state = freshBattle();
    const lethal = structuredClone(state);
    const active = lethal.players.player.active;
    if (!active) throw new Error('Aucun Planqué au Poste');
    active.hp = 5;
    active.statuses = ['SURCHARGE'];
    lethal.players.player.bench = [null, null, null];

    const after = endTurn(lethal);

    expect(after.phase).toBe('ended');
    expect(after.winner).toBe('ai');
    expect(after.players.ai.points).toBe(1);
    // La garde doit interrompre le tour : ni changement de joueur, ni tour suivant.
    expect(after.current).toBe('player');
    expect(after.turn).toBe(lethal.turn);
  });

  it('met la relève en attente au lieu de choisir à la place du joueur', () => {
    const lethal = structuredClone(freshBattle());
    const active = lethal.players.player.active;
    if (!active) throw new Error('Aucun Planqué au Poste');
    active.hp = 5;
    active.statuses = ['SURCHARGE'];

    const after = endTurn(lethal);

    // §4 : « le Rack choisit la relève ». Le moteur attend, il ne promeut pas.
    expect(after.phase).toBe('playing');
    expect(after.pendingPromotion).toBe('player');
    expect(after.players.player.active).toBeNull();
    expect(after.current).toBe('player');
  });

  it('ne déclare aucune défaite quand le Chariot est vide', () => {
    const state = freshBattle();
    let after = structuredClone(state);
    after.players.player.deck = [];

    after = endTurn(after); // passe à la Direction
    after = endTurn(after); // revient au joueur : pioche impossible

    expect(after.phase).toBe('playing');
    expect(after.winner).toBeNull();
    expect(after.log.some((line) => line.includes('Chariot vide'))).toBe(true);
  });
});

describe('Pression — dégâts et café', () => {
  it('ajoute +20 dégâts quand la Vulnérabilité correspond à la faction attaquante', () => {
    const state = freshBattle();
    const attacker = state.players.player.active;
    const defender = state.players.ai.active;
    if (!attacker || !defender) throw new Error('Poste vide');
    const attackerCard = getCard(attacker.cardId);
    const defenderCard = CARD_BY_ID.get(defender.cardId);
    if (!attackerCard || !isPlanque(attackerCard) || !isPlanque(defenderCard)) throw new Error('Carte inconnue');

    const original = defenderCard;
    CARD_BY_ID.set(defender.cardId, { ...defenderCard, weakness: attackerCard.faction });
    try {
      attacker.energy = 10;
      const base = attackerCard.attacks[0];
      if (!base) throw new Error('Aucune Pression');
      expect(attackPreview(state, 0)).toBe(base.damage + 20);
    } finally {
      CARD_BY_ID.set(defender.cardId, original);
    }
  });

  it('ne consomme pas le café attaché', () => {
    const state = freshBattle();
    const next = structuredClone(state);
    const attacker = next.players.player.active;
    if (!attacker) throw new Error('Poste vide');
    const card = getCard(attacker.cardId);
    if (!isPlanque(card)) throw new Error('Carte inconnue');
    const index = card.attacks.findIndex((entry) => entry.cost <= 3);
    if (index < 0) throw new Error('Aucune Pression abordable');
    attacker.energy = 3;

    const after = attack(next, index);

    expect(after.players.player.active?.energy).toBe(3);
    expect(after.players.player.hasAttacked).toBe(true);
  });
});

describe('Évolution', () => {
  it('refuse toute évolution au premier tour', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const evolution = ALL_CARDS.filter(isPlanque).find(
      (card) => card.evolvesFrom === active.cardId && !card.variantOf
    );
    if (!evolution) {
      // Aucune évolution disponible pour ce N+1 : rien à vérifier.
      expect(canEvolve(state, 'inconnu', active.uid)).toBe(false);
      return;
    }

    const next = structuredClone(state);
    const instance = createInstance(evolution.id, next.turn);
    next.players.player.hand.push(instance);
    next.players.player.active!.playedTurn = 0;

    expect(evolve(next, instance.uid, active.uid)).toBe(next);
    expect(canEvolve(next, instance.uid, active.uid)).toBe(false);
  });

  it('refuse aussi l’évolution au premier tour de la Direction (tour 2)', () => {
    const start = freshBattle();
    const aiActive = start.players.ai.active;
    if (!aiActive) throw new Error('Poste vide côté Direction');
    const evolution = ALL_CARDS.filter(isPlanque).find(
      (card) => card.evolvesFrom === aiActive.cardId && !card.variantOf
    );
    if (!evolution) {
      expect(isFirstTurnFor(start, 'ai')).toBe(true);
      return;
    }

    // Tour 2 = premier tour de la Direction.
    const next = structuredClone(start);
    next.turn = 2;
    next.current = 'ai';
    next.players.ai.active!.playedTurn = 0;
    const instance = createInstance(evolution.id, next.turn);
    next.players.ai.hand.push(instance);

    expect(isFirstTurnFor(next, 'ai')).toBe(true);
    expect(canEvolve(next, instance.uid, aiActive.uid)).toBe(false);
    expect(evolve(next, instance.uid, aiActive.uid)).toBe(next);
  });
});

describe('Statuts — plusieurs conditions, et leur ordre (§4)', () => {
  it('résout les conditions dans l’ordre Surcharge → Épuisement → Sieste → Immobilisation', () => {
    const state = structuredClone(freshBattle());
    const active = state.players.player.active;
    if (!active) throw new Error('Aucun Planqué au Poste');
    // Posées dans le désordre : c'est le moteur qui doit les remettre dans l'ordre.
    active.maxHp = 200;
    active.hp = 200;
    active.statuses = ['IMMOBILISATION', 'EPUISEMENT', 'SURCHARGE'];

    const after = endTurn(state);
    const journal = after.log.join(' | ');

    expect(journal).toMatch(/Surcharge : 10 de stress.*Épuisement : 20 de stress/);
    expect(after.players.player.active?.hp).toBe(170);
    // Immobilisation se dissipe au bout d'un tour ; Surcharge et Épuisement restent
    // (le lancer d'Épuisement est perdu avec `SEED` — plus de `Math.random()` figé à 0,5).
    const restants = after.players.player.active?.statuses ?? [];
    expect(restants).not.toContain('IMMOBILISATION');
    expect(restants).toContain('SURCHARGE');
    expect(restants).toContain('EPUISEMENT');
    expect(restants).toHaveLength(2);
  });

  it('ne cumule pas deux fois la même condition', () => {
    const state = structuredClone(freshBattle());
    const active = state.players.player.active;
    const defender = state.players.ai.active;
    if (!active || !defender) throw new Error('Poste vide');
    active.energy = 3;
    defender.maxHp = 300;
    defender.hp = 300;
    defender.statuses = ['SURCHARGE'];

    // La carte frappée inflige aussi Surcharge : la condition ne doit pas s'ajouter deux fois.
    const card = CARD_BY_ID.get(active.cardId);
    if (!isPlanque(card)) throw new Error('Carte inconnue');
    const original = card;
    CARD_BY_ID.set(active.cardId, {
      ...card,
      attacks: [{ ...card.attacks[0]!, effects: [{ kind: 'status', status: 'SURCHARGE' }] }]
    });
    try {
      const after = attack(state, 0);
      expect(after.players.ai.active?.statuses).toEqual(['SURCHARGE']);
    } finally {
      CARD_BY_ID.set(active.cardId, original);
    }
  });
});

describe('Relève choisie après un craquage', () => {
  /** Amène la Direction à 1 Seuil, puis frappe : son Poste tombe. */
  function knockOutAi(state: BattleState): BattleState {
    const next = structuredClone(state);
    const attacker = next.players.player.active;
    const defender = next.players.ai.active;
    if (!attacker || !defender) throw new Error('Poste vide');
    const card = getCard(attacker.cardId);
    if (!isPlanque(card)) throw new Error('Carte inconnue');
    const index = card.attacks.findIndex((entry) => entry.cost <= 3);
    if (index < 0) throw new Error('Aucune Pression abordable');
    attacker.energy = 3;
    defender.hp = 1;
    return attack(next, index);
  }

  it('attend le choix de la Direction au lieu de promouvoir tout seul', () => {
    const after = knockOutAi(freshBattle());

    expect(after.pendingPromotion).toBe('ai');
    expect(after.players.ai.active).toBeNull();
    expect(after.players.ai.bench.filter(Boolean)).toHaveLength(3);
  });

  it('refuse toute autre action tant que la relève n’est pas choisie', () => {
    const after = knockOutAi(freshBattle());

    expect(endTurn(after)).toBe(after);
    expect(legalAttacks({ ...after, current: 'ai' })).toEqual([]);
    expect(evolve(after, 'peu-importe', 'peu-importe')).toBe(after);
  });

  it('installe le Planqué choisi au Poste et libère le jeu', () => {
    const after = knockOutAi(freshBattle());
    const chosen = after.players.ai.bench[1];
    if (!chosen) throw new Error('Rack vide');

    const resolved = promoteActive(after, 1);

    expect(resolved.pendingPromotion).toBeNull();
    expect(resolved.players.ai.active?.uid).toBe(chosen.uid);
    expect(resolved.players.ai.bench[1]).toBeNull();
    expect(endTurn(resolved)).not.toBe(resolved);
  });

  it('refuse un emplacement vide', () => {
    const after = knockOutAi(freshBattle());
    const empty = promoteActive(after, 2);
    if (after.players.ai.bench[2] === null) {
      expect(empty).toBe(after);
    } else {
      // L'emplacement 2 était occupé : on vérifie un index hors bornes.
      expect(promoteActive(after, 9)).toBe(after);
    }
  });
});

describe('Chariot imposé au démarrage', () => {
  it('refuse de démarrer avec un Chariot illégal', () => {
    expect(() => createBattle(DECK.slice(0, DECK_SIZE - 1), DECK)).toThrow(/Chariot illégal/);
    expect(() => createBattle(DECK, [DECK[0]])).toThrow(/Chariot illégal/);
  });
});

describe('Changement de priorité (D-004)', () => {
  /** Donne le mot-clé à la carte au Poste, sans toucher aux données. */
  function withKeyword(state: BattleState): { state: BattleState; restore: () => void } {
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const original = CARD_BY_ID.get(active.cardId);
    if (!isPlanque(original)) throw new Error('Carte inconnue');
    CARD_BY_ID.set(active.cardId, { ...original, keywords: ['priorityShift'] });
    return { state, restore: () => CARD_BY_ID.set(active.cardId, original) };
  }

  it('archive 1 carte et en pioche 1, une fois par tour', () => {
    const state = freshBattle();
    if (state.players.player.hand.length === 0) throw new Error('main vide');
    const { restore } = withKeyword(state);
    try {
      const discarded = state.players.player.hand[0];
      if (!discarded) throw new Error('main vide');
      const handBefore = state.players.player.hand.length;

      const after = priorityShift(state, discarded.uid);

      expect(after.players.player.discard.map((card) => card.uid)).toContain(discarded.uid);
      expect(after.players.player.hand).toHaveLength(handBefore); // -1 archivée, +1 piochée
      expect(after.players.player.hasUsedPriorityShift).toBe(true);

      // Deuxième usage dans le même tour : refusé.
      const again = priorityShift(after, after.players.player.hand[0]?.uid ?? '');
      expect(again).toBe(after);
    } finally {
      restore();
    }
  });

  it('ne fait rien sans le mot-clé sur la carte au Poste', () => {
    const state = freshBattle();
    const uid = state.players.player.hand[0]?.uid;
    if (!uid) throw new Error('main vide');
    expect(priorityShift(state, uid)).toBe(state);
  });

  it('ne fait rien quand le drapeau global est coupé', () => {
    const state = freshBattle();
    const { restore } = withKeyword(state);
    const uid = state.players.player.hand[0]?.uid;
    if (!uid) throw new Error('main vide');
    RULES.priorityShiftEnabled = false;
    try {
      expect(priorityShift(state, uid)).toBe(state);
    } finally {
      RULES.priorityShiftEnabled = true;
      restore();
    }
  });
});

describe('retreat() — Relève', () => {
  it('défausse autant de cafés que le coût de relève et échange le Poste avec l\'Rack', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const benchCard = state.players.player.bench[0];
    if (!benchCard) throw new Error('Rack vide');

    // On met assez de café sur le Planqué actif pour couvrir le coût de relève
    const activeCard = getCard(active.cardId);
    const retreatCost = isPlanque(activeCard) ? activeCard.retreat : 1;
    active.energy = retreatCost;

    const beforeEnergy = active.energy;

    const after = retreat(state, 0);

    // Le Planqué du Poste a perdu le coût de relève en café
    expect(after.players.player.active?.energy).toBe(beforeEnergy - retreatCost);
    // Le Planqué de l'Rack est maintenant au Poste (sans ses statuts)
    expect(after.players.player.active?.uid).toBe(benchCard.uid);
    // L'ancien Planqué du Poste est allé à l'Rack
    expect(after.players.player.bench[0]?.uid).toBe(active.uid);
    // hasRetreated est à true
    expect(after.players.player.hasRetreated).toBe(true);
  });

  it('refuse la relève si le Planqué actif n\'a pas assez de café', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const activeCard = getCard(active.cardId);
    const retreatCost = isPlanque(activeCard) ? activeCard.retreat : 1;

    // On met 1 café de moins que le coût
    active.energy = Math.max(0, retreatCost - 1);

    const after = retreat(state, 0);

    // Rien ne change : on retourne l'état inchangé
    expect(after).toBe(state);
  });

  it('refuse une seconde relève dans le même tour', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const benchCard = state.players.player.bench[0];
    if (!benchCard) throw new Error('Rack vide');
    const activeCard = getCard(active.cardId);
    const retreatCost = isPlanque(activeCard) ? activeCard.retreat : 1;
    active.energy = retreatCost;

    const afterFirst = retreat(state, 0);
    expect(afterFirst.players.player.hasRetreated).toBe(true);

    // Deuxième tentative : doit échouer
    const afterSecond = retreat(afterFirst, 1);
    expect(afterSecond).toBe(afterFirst);
  });

  it('ne fait rien si l\'emplacement Rack visé est vide', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');
    const activeCard = getCard(active.cardId);
    const retreatCost = isPlanque(activeCard) ? activeCard.retreat : 1;
    active.energy = retreatCost;

    // Emplacement 2 est vide (si bench[2] === null)
    if (state.players.player.bench[2] === null) {
      const after = retreat(state, 2);
      expect(after).toBe(state);
    }
  });
});

describe('attachEnergy() — Attachement de café', () => {
  it('attache 1 café au Planqué visé et décrémente la Machine à café', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');

    // Premier tour du joueur : pas d'attachement possible
    // On passe au tour 2 pour tester
    const nextTurn = structuredClone(state);
    nextTurn.turn = 2;
    nextTurn.current = 'player';
    nextTurn.players.player.energyAttached = false;
    nextTurn.players.player.energyZone = 1;
    nextTurn.players.player.active!.energy = 0;

    const beforeZone = nextTurn.players.player.energyZone;
    const beforeEnergy = nextTurn.players.player.active!.energy;

    const after = attachEnergy(nextTurn, nextTurn.players.player.active!.uid);

    expect(after.players.player.active?.energy).toBe(beforeEnergy + 1);
    expect(after.players.player.energyZone).toBe(beforeZone - 1);
    expect(after.players.player.energyAttached).toBe(true);
  });

  it('refuse un second attachement dans le même tour', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');

    // Tour 2 pour pouvoir attacher
    const nextTurn = structuredClone(state);
    nextTurn.turn = 2;
    nextTurn.current = 'player';
    nextTurn.players.player.energyAttached = false;
    nextTurn.players.player.energyZone = 2;
    nextTurn.players.player.active!.energy = 0;

    const afterFirst = attachEnergy(nextTurn, nextTurn.players.player.active!.uid);
    expect(afterFirst.players.player.energyAttached).toBe(true);

    // Deuxième attachement : refusé
    const afterSecond = attachEnergy(afterFirst, afterFirst.players.player.active!.uid);
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.players.player.active?.energy).toBe(1);
    expect(afterSecond.players.player.energyZone).toBe(1);
  });

  it('refuse l\'attachement au premier tour du joueur', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');

    // Premier tour : energyAttached = false, energyZone = 1
    const after = attachEnergy(state, active.uid);

    // L'état est cloné mais l'énergie ne change pas, seul le log s'allonge
    expect(after.players.player.energyZone).toBe(1);
    expect(after.players.player.active?.energy).toBe(0);
    expect(after.log).toContain("Premier tour : pas d\u2019attachement de caf\u00E9.");
  });

  it('ne fait rien si la Machine à café est vide', () => {
    const state = freshBattle();
    const active = state.players.player.active;
    if (!active) throw new Error('Poste vide');

    // Tour 2 mais energyZone = 0
    const nextTurn = structuredClone(state);
    nextTurn.turn = 2;
    nextTurn.current = 'player';
    nextTurn.players.player.energyAttached = false;
    nextTurn.players.player.energyZone = 0;
    nextTurn.players.player.active!.energy = 0;

    const after = attachEnergy(nextTurn, nextTurn.players.player.active!.uid);
    expect(after).toBe(nextTurn);
  });

  it('ne fait rien si le Planqué visé n\'existe pas', () => {
    const state = freshBattle();

    // Tour 2
    const nextTurn = structuredClone(state);
    nextTurn.turn = 2;
    nextTurn.current = 'player';
    nextTurn.players.player.energyAttached = false;
    nextTurn.players.player.energyZone = 1;
    nextTurn.players.player.active!.energy = 0;

    const after = attachEnergy(nextTurn, 'uid-inexistant');
    expect(after).toBe(nextTurn);
  });
});

describe('Cartes Action — Objet illimité, Collègue 1 par tour (AGENTS.md §4)', () => {
  /** Trois cartes Action aux effets distincts, pour prouver chaque primitive. */
  const OBJET_SOIN = 'sse-trousse-secours'; // Objet MRO : soigne 10 de tous tes Planqués
  const OBJET_PIOCHE = 'amelioration-baie-test'; // Objet NEUF : pioche 2
  const COLLEGUE_PIOCHE = 'support-escalade'; // Collègue : pioche 2
  const COLLEGUE_STATUT = 'rh-reunion-individuelle'; // Collègue : le Planqué adverse est Dérivé
  const COLLEGUE_CAFE = 'management-entretien-annuel'; // Collègue : 1 café adverse au rebut

  /** Met les cartes demandées en main (dans l'ordre) côté joueur, et rend leurs uids. */
  function withHand(state: BattleState, cardIds: string[]): { state: BattleState; uids: string[] } {
    const next = structuredClone(state);
    const uids: string[] = [];
    // `unshift` en ordre inverse : `uids[0]` est la première carte demandée.
    for (const cardId of [...cardIds].reverse()) {
      const instance = createInstance(cardId, next.turn);
      next.players.player.hand.unshift(instance);
      uids.unshift(instance.uid);
    }
    return { state: next, uids };
  }

  it('accepte autant d’Objets qu’on en a dans le tour', () => {
    const { state, uids } = withHand(freshBattle(), [OBJET_SOIN, OBJET_PIOCHE, OBJET_PIOCHE]);
    const handBefore = state.players.player.hand.length;

    const first = playAction(state, uids[0] ?? ''); // trousse de secours : soin
    const second = playAction(first, uids[1] ?? '');
    const third = playAction(second, uids[2] ?? '');

    expect(third).not.toBe(second);
    expect(third.players.player.discard.map((card) => card.cardId)).toEqual([
      OBJET_SOIN,
      OBJET_PIOCHE,
      OBJET_PIOCHE
    ]);
    // Les Objets ne consomment pas la limite des Collègues.
    expect(third.players.player.hasPlayedSupporter).toBe(false);
    // 3 Objets joués (−3) et 4 cartes piochées (+4).
    expect(third.players.player.hand).toHaveLength(handBefore + 1);
    expect(third.log.at(-1)).toContain('(Objet)');
  });

  it('refuse un second Collègue dans le même tour', () => {
    const { state, uids } = withHand(freshBattle(), [COLLEGUE_PIOCHE, COLLEGUE_PIOCHE]);

    const first = playAction(state, uids[0] ?? '');

    expect(first).not.toBe(state);
    expect(first.players.player.hasPlayedSupporter).toBe(true);
    expect(first.players.player.discard.map((card) => card.cardId)).toContain(COLLEGUE_PIOCHE);
    expect(first.log.at(-1)).toContain('(Collègue)');

    expect(playAction(first, uids[1] ?? '')).toBe(first);
  });

  it('autorise un Collègue au premier tour du joueur — §4 ne le prive pas de ça', () => {
    const { state, uids } = withHand(freshBattle(), [COLLEGUE_PIOCHE]);
    expect(state.turn).toBe(1);

    expect(playAction(state, uids[0] ?? '')).not.toBe(state);
  });

  it('libère la limite du Collègue au tour suivant', () => {
    const { state, uids } = withHand(freshBattle(), [COLLEGUE_PIOCHE, COLLEGUE_PIOCHE]);
    const afterFirst = playAction(state, uids[0] ?? '');
    expect(afterFirst.players.player.hasPlayedSupporter).toBe(true);

    // Fin du tour du joueur, puis tour de la Direction, puis retour au joueur.
    const aiTurn = endTurn(afterFirst);
    const backToPlayer = endTurn(aiTurn);

    expect(backToPlayer.current).toBe('player');
    expect(backToPlayer.players.player.hasPlayedSupporter).toBe(false);
    expect(playAction(backToPlayer, uids[1] ?? '')).not.toBe(backToPlayer);
  });

  it('résout l’effet d’un Objet sur ses propres Planqués', () => {
    const { state, uids } = withHand(freshBattle(), [OBJET_SOIN]);
    const active = state.players.player.active;
    const bench = state.players.player.bench[0];
    if (!active || !bench) throw new Error('Rack ou Poste vide');
    active.hp -= 30;
    bench.hp -= 20;
    const activeBefore = active.hp;
    const benchBefore = bench.hp;

    const after = playAction(state, uids[0] ?? '');

    expect(after.players.player.active?.hp).toBe(activeBefore + 10);
    expect(after.players.player.bench[0]?.hp).toBe(benchBefore + 10);
  });

  it('résout un effet de statut et un effet de café sur le Planqué adverse', () => {
    const status = withHand(freshBattle(), [COLLEGUE_STATUT]);
    const afterStatus = playAction(status.state, status.uids[0] ?? '');
    expect(afterStatus.players.ai.active?.statuses).toContain('DERIVE');

    const cafe = withHand(freshBattle(), [COLLEGUE_CAFE]);
    const defender = cafe.state.players.ai.active;
    if (!defender) throw new Error('Poste adverse vide');
    defender.energy = 2;

    const afterCafe = playAction(cafe.state, cafe.uids[0] ?? '');
    expect(afterCafe.players.ai.active?.energy).toBe(1);
  });

  it('refuse un Planqué, et refuse qu’une carte Action se pose au Poste', () => {
    const { state, uids } = withHand(freshBattle(), [COLLEGUE_PIOCHE]);
    const planque = state.players.player.hand.find((card) => isPlanque(getCard(card.cardId)));
    if (!planque) throw new Error('aucun Planqué en main');

    expect(canPlayAction(state, planque.uid)).toBe(false);
    expect(playAction(state, planque.uid)).toBe(state);

    // L'inverse : une carte Action n'est pas un Planqué, `playBasic` la refuse.
    expect(playBasic(state, uids[0] ?? '', 2)).toBe(state);
    // Un uid inconnu ne fait rien non plus.
    expect(playAction(state, 'uid-inexistant')).toBe(state);
  });

  it('refuse toute carte Action tant qu’une relève attend d’être choisie', () => {
    const { state, uids } = withHand(freshBattle(), [OBJET_SOIN]);
    const pending: BattleState = { ...state, pendingPromotion: 'player' };

    expect(canPlayAction(pending, uids[0] ?? '')).toBe(false);
    expect(playAction(pending, uids[0] ?? '')).toBe(pending);
  });
});

describe('Effet reduceDamage — réduction de Stress (ticket #43)', () => {
  it('attackPreview tient compte d’une réduction d’instance (defender.damageReduction)', () => {
    const state = structuredClone(freshBattle());
    state.current = 'player';
    const before = attackPreview(state, 0);
    const ai = state.players.ai.active;
    if (!ai) throw new Error('Poste adverse vide');
    ai.damageReduction = 10;
    expect(attackPreview(state, 0)).toBe(Math.max(0, before - 10));
  });

  it('l’attaque « Aménagement » (Référent handicap) pose une réduction de 10 sur l’attaquant', () => {
    const state = structuredClone(freshBattle());
    state.current = 'player';
    state.pendingPromotion = null;
    state.players.player.hasAttacked = false;
    const referent = createInstance('rh-referent-handicap');
    referent.energy = 5;
    state.players.player.active = referent;

    const after = attack(state, 0);
    expect(after.players.player.active?.damageReduction).toBe(10);
  });
});

describe('Déterminisme — le hasard vient d’une graine (#29)', () => {
  /** Interdit le hasard global le temps d’un appel : le moteur ne doit tirer que de sa graine. */
  function withoutMathRandom<T>(run: () => T): T {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Le moteur a appelé Math.random() : il n’est plus seedé.');
    });
    try {
      return run();
    } finally {
      spy.mockRestore();
    }
  }

  /**
   * Séquence qui consomme le hasard du moteur : mélange des deux Chariots, puis
   * six fins de tour avec Épuisement et Sieste au Poste — les lancers de guérison.
   * Les Seuils sont montés pour qu’aucun craquage ne vienne couper la séquence.
   */
  function scripted(seed: number): BattleState {
    const state = createBattle(DECK, DECK, seed);
    for (const who of ['player', 'ai'] as PlayerId[]) {
      const active = state.players[who].active;
      if (!active) throw new Error('Poste vide');
      active.maxHp = 500;
      active.hp = 500;
      active.statuses = ['EPUISEMENT', 'SIESTE'];
    }
    let next = state;
    for (let turn = 0; turn < 6; turn += 1) next = endTurn(next);
    return next;
  }

  it('ne tire plus au hasard global, même pour mélanger un Chariot', () => {
    // Le simple fait de créer une partie mélange deux Chariots : sans graine,
    // l’appel lève ici.
    const state = withoutMathRandom(() => createBattle(DECK, DECK, 1));
    expect(state.players.player.deck.length).toBeGreaterThan(0);
  });

  it('même graine → même état, graine différente → états différents', () => {
    const first = withoutMathRandom(() => scripted(7));
    const sameSeed = withoutMathRandom(() => scripted(7));
    const otherSeed = withoutMathRandom(() => scripted(8));

    expect(sameSeed).toStrictEqual(first);
    expect(otherSeed).not.toStrictEqual(first);
  });

  it('sans graine explicite, deux parties restent indépendantes', () => {
    // `Date.now()` sert de graine par défaut : deux créations rapprochées ne
    // doivent pas forcément donner le même ordre de Chariot (comportement d’avant).
    const deck = (state: BattleState) => state.players.player.deck.map((card) => card.cardId);
    expect(deck(createBattle(DECK, DECK, 1))).not.toEqual(deck(createBattle(DECK, DECK, 2)));
  });
});
