import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/data';
import type { BattleAction, BattleState, CafeSymbol } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';

/**
 * **« Le café attaché change de place et disparaît »** (OUF `p-mvrome4s-f93mg6`, #399).
 *
 * Le testeur décrit un café déjà attaché qui passe en première position quand il en attache
 * un autre, et un café qui disparaît. La reproduction commence donc par **le moteur**, avec
 * une graine et un journal : si un état reconstruit `energy` autrement que par ajout en fin
 * de liste, c'est ici que ça se voit — et pas sur une capture.
 *
 * `attachEnergy` fait `target.energy.push(cafe)` (`engine.ts`), et seul
 * `discardFirstCafes` retire des cafés (`slice`) — pour la Rotation et l'effet
 * `discardEnergy`, pas pour un attachement. Ce fichier **le prouve sur une partie réelle**
 * au lieu de le lire : une instance qui reçoit deux cafés les garde dans l'ordre reçu.
 *
 * S'il passe alors que l'écran, lui, se trompe, la conclusion est nette : le défaut est à
 * l'écran, et il se corrige là-bas (`Battle.cafe.test.tsx` le mesure).
 */
function deckDeTest() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  return autoDeck(owned).deck;
}

/** Les cafés d'un Planqué, par `uid`, Poste et Banc confondus. */
function cafesParUid(state: BattleState, who: 'player' | 'ai'): Map<string, CafeSymbol[]> {
  const side = state.players[who];
  const map = new Map<string, CafeSymbol[]>();
  for (const carte of [side.active, ...side.bench]) {
    if (carte) map.set(carte.uid, [...carte.energy]);
  }
  return map;
}

interface DeuxCafes {
  etat: BattleState;
  uid: string;
  cafes: CafeSymbol[];
  graine: number;
  journal: string[];
}

/**
 * Cherche, par graines croissantes, une partie où **une même instance** reçoit deux cafés
 * par `attachEnergy`. Le choix est scripté (le premier attachement possible sur une carte
 * qui porte déjà un café), pour que la reproduction soit la même à chaque exécution.
 */
function partieAvecDeuxCafesSurUneMemeCarte(): DeuxCafes {
  const deck = deckDeTest();
  for (let graine = 1; graine < 400; graine += 1) {
    let state = createBattle(deck, deck, graine);
    for (let i = 0; i < 400 && state.phase === 'playing'; i += 1) {
      const legales = legalActions(state).filter((action) => action.type !== 'forfeit');
      const actor = state.current;
      const avant = cafesParUid(state, actor);
      const attachement = legales.find((action) => {
        if (action.type !== 'attachEnergy') return false;
        return (avant.get(action.targetUid)?.length ?? 0) >= 1;
      });
      if (attachement && attachement.type === 'attachEnergy') {
        const suivant = applyAction(state, attachement);
        const cafes = cafesParUid(suivant, actor).get(attachement.targetUid);
        if (cafes && cafes.length >= 2) {
          return {
            etat: suivant,
            uid: attachement.targetUid,
            cafes,
            graine,
            journal: suivant.actionLog.map((entree) => entree.action.type)
          };
        }
      }
      const action: BattleAction | undefined =
        legales.find((entree) => entree.type === 'promoteActive') ??
        legales.find((entree) => entree.type === 'attachEnergy') ??
        legales.find((entree) => entree.type === 'attack') ??
        legales.find((entree) => entree.type === 'endTurn');
      if (!action) break;
      state = applyAction(state, action);
    }
  }
  throw new Error('aucune partie trouvée : la reproduction ne prouve rien');
}

describe('le café attaché ne change pas de place — le moteur (#399)', () => {
  it('ajoute le café en fin de liste : l’ordre reçu est l’ordre gardé', () => {
    const { etat, uid, cafes, graine } = partieAvecDeuxCafesSurUneMemeCarte();

    // Les deux cafés sont là, dans l'ordre où ils sont arrivés — rien n'a été retiré.
    expect(cafes.length).toBeGreaterThanOrEqual(2);

    // Le premier café reçu est toujours en première position : c'est l'ajout qui se fait
    // en fin de liste, jamais un réordonnancement.
    const premier = etat.actionLog
      .filter((entree) => entree.action.type === 'attachEnergy')
      .map((entree) => entree.action)
      .filter((action) => action.type === 'attachEnergy' && action.targetUid === uid)[0];
    expect(premier, `graine ${graine} : le journal doit nommer les deux attachements`).toBeDefined();

    const relu = cafesParUid(etat, etat.current).get(uid) ?? [];
    expect(relu).toEqual(cafes);
  });

  it('ne retire jamais un café d’une instance qui n’a pas fait de Rotation', () => {
    const deck = deckDeTest();
    const graine = 31337;
    let state = createBattle(deck, deck, graine);
    for (let i = 0; i < 300 && state.phase === 'playing'; i += 1) {
      const avant = new Map<string, CafeSymbol[]>([
        ...cafesParUid(state, 'player'),
        ...[...cafesParUid(state, 'ai')].map(([uid, cafes]) => [`ai:${uid}`, cafes] as const)
      ]);
      const legales = legalActions(state).filter((action) => action.type !== 'forfeit');
      const action: BattleAction | undefined =
        legales.find((entree) => entree.type === 'promoteActive') ??
        legales.find((entree) => entree.type === 'attachEnergy') ??
        legales.find((entree) => entree.type === 'attack') ??
        legales.find((entree) => entree.type === 'endTurn');
      if (!action) break;
      const suivant = applyAction(state, action);
      // Hors Rotation et effet `discardEnergy`, une liste de cafés ne peut que s'allonger :
      // les cafés déjà attachés restent en tête, dans leur ordre. Les deux gestes qui
      // retirent des cafés sont nommés ici, pas devinés par une comparaison de littéraux.
      const retireDesCafes: readonly string[] = ['retreat', 'attack'];
      if (!retireDesCafes.includes(action.type)) {
        for (const [uid, cafes] of avant) {
          const futur = uid.startsWith('ai:')
            ? cafesParUid(suivant, 'ai').get(uid.slice(3))
            : cafesParUid(suivant, 'player').get(uid);
          if (!futur) continue; // la carte a quitté le plateau (craquage, relève)
          expect(futur.slice(0, cafes.length)).toEqual(cafes);
        }
      }
      state = suivant;
    }
  });
});
