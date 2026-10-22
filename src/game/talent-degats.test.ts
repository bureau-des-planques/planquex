import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, getCard, isBasic, isPlanque } from '@/data';
import type { AttackEffect, BattleState, PlanqueCard } from '@/data/types';
import { applyAction, createBattle, createInstance, legalActions, useAbility } from '@/game/engine';

/**
 * Un Talent qui inflige des dégâts (#164, D-077). Comme pour #159, les cartes qui le vendent
 * (Manager de proximité) ne sont pas câblées dans `src/data` : on injecte des fixtures dans
 * le catalogue, et la règle est celle du moteur.
 */

const SEED = 5;
const BASICS = ALL_CARDS.filter((card) => isBasic(card) && !card.variantOf).map((card) => card.id);
const DECK = [...BASICS.slice(0, 10), ...BASICS.slice(0, 10)];

function basePlanque(): PlanqueCard {
  const base = getCard(BASICS[0]);
  if (!base || !isPlanque(base)) throw new Error('Entrant de base introuvable');
  return base;
}

/** Un Talent `effects` sur un Entrant réel (1 par tour, comme la spec). */
function enregistrerTalent(effects: AttackEffect[]) {
  CARD_BY_ID.set('test-talent-degats', {
    ...basePlanque(),
    id: 'test-talent-degats',
    ability: {
      name: 'Pression',
      text: 'Une fois par tour : défausse 1 carte, 10 dégâts au Planqué adverse actif.',
      kind: 'effects',
      effects,
      oncePerTurn: true
    }
  });
}

/** Une cible fictive de faction `weakness` choisie par le test. */
function enregistrerCible(weakness: PlanqueCard['weakness']) {
  CARD_BY_ID.set('test-cible', { ...basePlanque(), id: 'test-cible', weakness, ability: undefined });
}

interface Decor {
  effects: AttackEffect[];
  /** Cartes en main du joueur. */
  joueur?: number;
  /** PV du Planqué adverse au Poste. */
  pvCible?: number;
  /** Faiblesse de la cible : `null` = aucune, la faction de l'attaquant = Vulnérabilité. */
  faiblesse?: PlanqueCard['weakness'];
}

/** Une partie où le joueur (qui ouvre, graine 5) a le Talent au Poste. */
function scene({ effects, joueur = 2, pvCible, faiblesse = null }: Decor): BattleState {
  enregistrerTalent(effects);
  enregistrerCible(faiblesse);
  const state = structuredClone(createBattle(DECK, DECK, SEED));
  expect(state.current).toBe('player');
  state.players.player.active = createInstance('test-talent-degats', 0, 'talent-poste');
  state.players.player.hand = Array.from({ length: joueur }, (_, index) =>
    createInstance(BASICS[index + 1] ?? BASICS[0], 0, `main-joueur-${index}`)
  );
  state.players.ai.active = createInstance('test-cible', 0, 'cible-poste');
  if (pvCible !== undefined) state.players.ai.active.hp = pvCible;
  return state;
}

const TALENT = { type: 'ability' } as const;
const FAIBLESSE_ATTAQUANT = baseFaction();

function baseFaction(): PlanqueCard['faction'] {
  return basePlanque().faction;
}

describe('Talent qui inflige des dégâts — primitive `damage` (#164, D-077)', () => {
  it('le Talent inflige ses dégâts au Planqué adverse au Poste', () => {
    const avant = scene({ effects: [{ kind: 'damage', amount: 10 }], joueur: 0, pvCible: 60 });
    const apres = applyAction(avant, TALENT);
    // Mord : sans la primitive, le Poste adverse garderait ses 60 PV.
    expect(apres.players.ai.active?.hp).toBe(50);
    expect(apres.players.player.hasUsedAbility).toBe(true);
  });

  it('la Vulnérabilité s’applique au Poste : +20 si la cible est faible contre l’attaquant', () => {
    const avant = scene({ effects: [{ kind: 'damage', amount: 10 }], joueur: 0, pvCible: 60, faiblesse: FAIBLESSE_ATTAQUANT });
    const apres = applyAction(avant, TALENT);
    expect(apres.players.ai.active?.hp).toBe(30);
  });

  it('un Talent n’est pas une Pression : il ne termine pas le tour', () => {
    const avant = scene({ effects: [{ kind: 'damage', amount: 10 }], joueur: 0, pvCible: 60 });
    const apres = applyAction(avant, TALENT);
    expect(apres.players.player.hasAttacked).toBe(false);
    expect(apres.current).toBe('player');
    expect(apres.phase).toBe('playing');
  });

  it('le Talent reste 1 par tour', () => {
    const avant = scene({ effects: [{ kind: 'damage', amount: 10 }], joueur: 0, pvCible: 60 });
    const apres = applyAction(avant, TALENT);
    expect(legalActions(apres).some((action) => action.type === 'ability')).toBe(false);
    // Mord : un second emploi est refusé et ne touche pas le Poste adverse.
    expect(useAbility(apres)).toBe(apres);
  });

  it('un craquage provoqué par le Talent suit le chemin ordinaire : Intervention, relève', () => {
    const avant = scene({ effects: [{ kind: 'damage', amount: 10 }], joueur: 0, pvCible: 10 });
    // La mise en place garnit le Banc adverse : le craquage ouvre donc une relève, il ne vide pas le plateau.
    const apres = applyAction(avant, TALENT);
    expect(apres.players.ai.active).toBeNull();
    expect(apres.players.player.points).toBe(1);
    expect(apres.pendingPromotion).toBe('ai');
  });

  it('les effets d’un Talent s’appliquent dans l’ordre D-031 : dégâts avant défausse (Q6)', () => {
    const avant = scene({
      effects: [
        { kind: 'discardHand', target: 'self', amount: 1 },
        { kind: 'damage', amount: 10 }
      ],
      joueur: 2,
      pvCible: 60
    });
    const apres = applyAction(avant, TALENT);
    expect(apres.players.ai.active?.hp).toBe(50);
    expect(apres.pendingChoice).toEqual({ kind: 'defausse', who: 'player', restant: 1 });
    // Mord : le journal écrit les dégâts avant le choix, même si la liste les déclare après.
    const ligneDegats = apres.log.findIndex((entry) => entry.includes('de stress'));
    const ligneChoix = apres.log.findIndex((entry) => entry.includes('à défausser'));
    expect(ligneDegats).toBeGreaterThanOrEqual(0);
    expect(ligneDegats).toBeLessThan(ligneChoix);
  });

  it('un Talent qui défausse sa propre main n’est pas proposé sur une main vide (Q3 bis)', () => {
    const avant = scene({
      effects: [
        { kind: 'discardHand', target: 'self', amount: 1 },
        { kind: 'damage', amount: 10 }
      ],
      joueur: 0,
      pvCible: 60
    });
    // Mord : sans le garde, le Talent serait proposé et frapperait quand même.
    expect(legalActions(avant).some((action) => action.type === 'ability')).toBe(false);
    expect(useAbility(avant)).toBe(avant);
  });

  it('une liste sans dégât ne touche pas le Poste adverse, mais applique bien son effet', () => {
    const avant = scene({ effects: [{ kind: 'draw', amount: 1 }], joueur: 0, pvCible: 60 });
    const apres = applyAction(avant, TALENT);
    expect(apres.players.ai.active?.hp).toBe(60);
    // Le Talent est bien résolu : la pioche a lieu (la main passe de 0 à 1).
    expect(apres.players.player.hand).toHaveLength(1);
  });
});
