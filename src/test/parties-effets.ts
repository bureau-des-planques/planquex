import { ALL_CARDS, isBasic, isPlanque } from '@/data';
import type { BattleState } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { nextAiAction } from '@/game/ia';
import { partieSauvegardee } from '@/store/partie';

/**
 * **Des parties où un coup précis est jouable** (#294) — l'écran reprend une partie en la
 * rejouant depuis sa graine, donc ces parties sont cherchées **en jouant légalement**, jamais
 * bricolées. Partagé par `Battle.effets.test.tsx` (les replis) et par la prise de la planche de
 * frames (`scripts/filmer-animation.mjs`).
 */

/** Le Deck de tous les jours : ce que le joueur tirerait avec toute la collection. */
export function deckComplet(): string[] {
  return autoDeck(Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]))).deck;
}

/**
 * Un Deck de **Planqués qui posent une Condition** : dix Entrants dont une Pression à un ou deux
 * cafés pose une Condition à l'adversaire, deux exemplaires chacun. Sans lui, la recherche de
 * graine ne verrait presque jamais de Condition tomber au bon moment.
 */
export function deckDeConditions(): string[] {
  const posent = ALL_CARDS.filter(
    (card) =>
      isPlanque(card) &&
      isBasic(card) &&
      !card.variantOf &&
      card.attacks.some(
        (attaque) =>
          attaque.cost.length <= 2 &&
          attaque.effects?.some((effet) => effet.kind === 'status' && effet.target === 'opponent')
      )
  );
  // Les poseurs d'abord, puis des Entrants de leurs factions pour faire dix noms (vingt cartes).
  const factions = new Set(posent.map((card) => card.faction));
  const complement = ALL_CARDS.filter(
    (card) =>
      isPlanque(card) && isBasic(card) && !card.variantOf && factions.has(card.faction) && !posent.includes(card)
  );
  return [...posent, ...complement].slice(0, 10).flatMap((card) => [card.id, card.id]);
}

/**
 * Un coup **atteignable en jouant** : l'écran reprend une partie en la **rejouant** depuis sa
 * graine (`reprendrePartie`), on ne peut donc pas lui poser un état bricolé. On cherche, parmi
 * des parties jouées légalement (le joueur attache puis frappe, la Direction suit sa politique),
 * un tour du joueur où l'une de ses Pressions produit l'effet voulu — et on rend la partie
 * **avant** ce coup, avec le nom de la Pression à cliquer.
 */
export function partieOuLaPressionFait(
  voulu: (avant: BattleState, apres: BattleState) => boolean,
  deck = deckComplet()
) {
  for (let seed = 1; seed < 600; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 300 && s.phase === 'playing'; i += 1) {
      const auTour = s.current === 'player' && s.pendingPromotion === null && s.pendingChoice === null;
      const legales = legalActions(s);
      if (auTour) {
        for (const action of legales.filter((a) => a.type === 'attack')) {
          const apres = applyAction(s, action);
          if (apres.phase !== 'playing' || !voulu(s, apres)) continue;
          const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
          const carte = ALL_CARDS.find((c) => c.id === s.players.player.active?.cardId);
          if (!partie || !carte || !('attacks' in carte) || action.type !== 'attack') continue;
          return { partie, nom: carte.attacks[action.attackIndex].name };
        }
      }
      const action =
        s.current === 'ai'
          ? nextAiAction(s, 'scripte')
          : (legales.find((a) => a.type === 'attack') ??
            legales.find((a) => a.type === 'attachEnergy') ??
            legales.find((a) => a.type === 'promoteActive') ??
            legales.find((a) => a.type === 'endTurn'));
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie ne donne le coup voulu au joueur');
}

/** La Pression pose une Condition que le Planqué adverse n'avait pas. */
export const poseUneCondition = (avant: BattleState, apres: BattleState) =>
  (apres.players.ai.active?.statuses.length ?? 0) > (avant.players.ai.active?.statuses.length ?? 0);

/** La Pression fait craquer le Poste adverse, et la Direction a de quoi le relever. */
export const faitCraquer = (avant: BattleState, apres: BattleState) =>
  apres.players.player.points > avant.players.player.points &&
  apres.players.ai.active === null &&
  apres.pendingPromotion === 'ai' &&
  apres.players.ai.bench.some(Boolean);
