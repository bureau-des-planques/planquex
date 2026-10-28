import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { AttackEffect, BattleState, PlanqueCard } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions, useAbility } from '@/game/engine';

/**
 * Les Talents « en jouant » (#163, D-081) : résolus une fois, à la mise en jeu (pose ou
 * évolution), jamais parmi les actions `ability`.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function basePlanque(): PlanqueCard {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  return base;
}

/** Un Entrant portant un Talent « en jouant » `effects`. */
function enregistrerEntrant(effects: AttackEffect[]) {
  CARD_BY_ID.set('test-entrant-en-jouant', {
    ...basePlanque(),
    id: 'test-entrant-en-jouant',
    ability: { name: 'Sourcing', text: 'En jouant : pioche 1 carte.', kind: 'effects', effects, trigger: 'onPlay' }
  });
}

/** Un N+1 qui évolue depuis l'Entrant, portant le même Talent « en jouant ». */
function enregistrerEvolution(effects: AttackEffect[]) {
  CARD_BY_ID.set('test-n1-en-jouant', {
    ...basePlanque(),
    id: 'test-n1-en-jouant',
    stage: 'N+1',
    evolvesFrom: 'test-entrant-en-jouant',
    hp: 90,
    ability: { name: 'Audit', text: 'En jouant : pioche 1 carte.', kind: 'effects', effects, trigger: 'onPlay' }
  });
}

/** Une partie au tour 3 (évolution permise), le joueur au trait, son Deck garni. */
function scene(): BattleState {
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  state.turn = 3;
  expect(state.current).toBe('player');
  return state;
}

describe('Talent « en jouant » — déclenchement à la mise en jeu (#163, D-081)', () => {
  it('poser un Entrant au Poste déclenche son Talent une fois', () => {
    enregistrerEntrant([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = null;
    avant.players.player.hand = [createInstance('test-entrant-en-jouant', 0, 'jouant-poste')];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-poste', slot: 'active' });
    // Mord : sans déclenchement, la main resterait vide après la pose (la pioche, elle, la remplit).
    expect(apres.players.player.hand).toHaveLength(1);
    expect(apres.log.at(-1)).toContain('Sourcing');
  });

  it('poser au Banc déclenche le Talent aussi', () => {
    enregistrerEntrant([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.bench[0] = null;
    avant.players.player.hand = [createInstance('test-entrant-en-jouant', 0, 'jouant-banc')];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-banc', slot: 0 });
    expect(apres.players.player.hand).toHaveLength(1);
  });

  it('une évolution déclenche le Talent du N+1 qui arrive', () => {
    enregistrerEntrant([]);
    enregistrerEvolution([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = createInstance('test-entrant-en-jouant', 0, 'base-poste');
    avant.players.player.hand = [createInstance('test-n1-en-jouant', 0, 'evolue-main')];
    const apres = applyAction(avant, { type: 'evolve', uid: 'evolue-main', targetUid: 'base-poste' });
    expect(apres.players.player.active?.cardId).toBe('test-n1-en-jouant');
    // Mord : la main ne contient que la pioche déclenchée par l'évolution.
    expect(apres.players.player.hand).toHaveLength(1);
  });

  it('un Talent « en jouant » n’apparaît jamais parmi les actions `ability`', () => {
    enregistrerEntrant([{ kind: 'draw', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = createInstance('test-entrant-en-jouant', 0, 'poste-seul');
    expect(legalActions(avant).some((action) => action.type === 'ability')).toBe(false);
    // Mord : l'action directe est refusée, l'état rendu tel quel.
    expect(useAbility(avant)).toBe(avant);
  });

  it('le Talent « en jouant » se déclenche avant tout autre effet de la carte : il peut ouvrir un choix', () => {
    enregistrerEntrant([{ kind: 'discardHand', target: 'self', amount: 1 }]);
    const avant = scene();
    avant.players.player.active = null;
    avant.players.player.hand = [
      createInstance('test-entrant-en-jouant', 0, 'jouant-choix'),
      createInstance(BASICS[5] ?? BASICS[0], 0, 'autre-main')
    ];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-choix', slot: 'active' });
    // Le choix s'ouvre à la pose : les actions du joueur sont bloquées jusqu'à la défausse.
    expect(apres.pendingChoice).toEqual({ kind: 'defausse', who: 'player', restant: 1 });
    expect(legalActions(apres).some((action) => action.type === 'endTurn')).toBe(false);
  });
});

/**
 * **Le Talent « en jouant » collecte ses faits** (#353, D-081).
 *
 * Le Talent s'exécutait déjà à la pose et à l'évolution (#163), mais `playBasic` et
 * `evolve` ne portaient pas le collecteur de `applyAction` : la transition produisait son
 * Stress sans le dire, et le journal restait muet là où une Pression ou un Talent à la
 * demande parlent (#250). Ce bloc tient les trois cas du ticket :
 *
 * 1. la **pose directe** collecte le fait, une seule fois ;
 * 2. l'**évolution** collecte le fait du Planqué qui arrive (D-081 : la mise en jeu est la
 *    pose *ou* l'évolution — comportement de #163, inchangé) ;
 * 3. la **relève** (promotion depuis le Banc) ne le collecte **pas** : le Planqué n'est pas
 *    *joué*, il remplace un Poste vide, et son Talent « en jouant » ne se déclenche pas.
 */
describe('Talent « en jouant » — les faits de la mise en jeu (#353, D-081)', () => {
  /** Un Talent « en jouant » qui se blesse : la seule primitive qui écrit un fait de Stress. */
  const enregistrerEntrantQuiSeBlesse = () => {
    CARD_BY_ID.set('test-entrant-en-jouant', {
      ...basePlanque(),
      id: 'test-entrant-en-jouant',
      ability: {
        name: 'Sourcing',
        text: 'En jouant : ce Planqué prend 10 de stress.',
        kind: 'effects',
        effects: [{ kind: 'selfDamage', amount: 10 }],
        trigger: 'onPlay'
      }
    });
  };

  /** Les faits de l'entrée de journal de la dernière action. */
  const faitsDeLaDerniereAction = (state: BattleState) => state.actionLog.at(-1)?.faits ?? [];

  it('la pose au Poste collecte le fait de Stress du Talent, une seule fois', () => {
    enregistrerEntrantQuiSeBlesse();
    const avant = scene();
    avant.players.player.active = null;
    avant.players.player.hand = [createInstance('test-entrant-en-jouant', 0, 'jouant-fait')];
    const apres = applyAction(avant, { type: 'playBasic', uid: 'jouant-fait', slot: 'active' });

    const faits = faitsDeLaDerniereAction(apres);
    const stress = faits.filter((fait) => fait.type === 'stress');
    // Le fait vient du moteur : c'est le Stress réellement appliqué au Planqué qui arrive.
    expect(stress).toEqual([{ type: 'stress', uid: 'jouant-fait', montant: 10, auPoste: true }]);
    // Une seule fois : la pose ne rejoue pas le Talent.
    expect(stress).toHaveLength(1);
    expect(apres.actionLog.at(-1)?.action).toEqual({ type: 'playBasic', uid: 'jouant-fait', slot: 'active' });
  });

  it('l’évolution collecte le fait du Planqué qui arrive', () => {
    enregistrerEntrant([]);
    enregistrerEvolution([{ kind: 'selfDamage', amount: 10 }]);
    const avant = scene();
    avant.players.player.active = createInstance('test-entrant-en-jouant', 0, 'base-poste');
    avant.players.player.hand = [createInstance('test-n1-en-jouant', 0, 'evolue-fait')];
    const apres = applyAction(avant, { type: 'evolve', uid: 'evolue-fait', targetUid: 'base-poste' });

    expect(apres.players.player.active?.cardId).toBe('test-n1-en-jouant');
    const stress = faitsDeLaDerniereAction(apres).filter((fait) => fait.type === 'stress');
    // Le Planqué garde son instance : c'est bien le Poste `base-poste` qui porte le fait.
    expect(stress).toEqual([{ type: 'stress', uid: 'base-poste', montant: 10, auPoste: true }]);
  });

  it('la relève ne collecte aucun fait : le Planqué n’est pas *joué*', () => {
    enregistrerEntrantQuiSeBlesse();
    const avant = scene();
    // Un Poste vide à pourvoir : le Banc porte le Planqué au Talent « en jouant ».
    avant.players.player.active = null;
    avant.players.player.bench[0] = createInstance('test-entrant-en-jouant', 0, 'releve-fait');
    avant.pendingPromotion = 'player';
    const apres = applyAction(avant, { type: 'promoteActive', benchIndex: 0 });

    expect(apres.players.player.active?.uid).toBe('releve-fait');
    // Mord : aucune entrée de journal ne porte le fait, et le Stress n'a pas bougé.
    expect(faitsDeLaDerniereAction(apres)).toEqual([]);
    expect(apres.players.player.active?.hp).toBe(apres.players.player.active?.maxHp);
  });
});
