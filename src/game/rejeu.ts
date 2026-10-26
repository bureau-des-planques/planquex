import type { BattleAction, BattleState, CafeType } from '@/data/types';
import { replayBattle } from '@/game/engine';

/**
 * **Le rejeu** (#249) — une seule enveloppe, un seul rejeu, et un rejeu qui **dit** s'il a
 * réussi.
 *
 * Avant, « de quoi rejouer une partie » existait trois fois : `PartieSauvegardee` (le
 * store), `MatchCode` (le code partagé) et `CombatEnregistre` (la trace). Les deux premiers
 * portaient exactement les mêmes champs ; le troisième les renommait pour ses colonnes.
 * Surtout, **aucun des trois ne savait si le rejeu avait marché** : `replayBattle` ne valide
 * rien, `applyAction` ignore en silence une action refusée, et le seul détecteur était la
 * comparaison de longueurs refaite chez chaque appelant (`codec.ts`, `partie.ts`).
 *
 * Ce module apporte les deux manques, et rien d'autre :
 *
 * 1. `EnveloppeRejeu` — les six champs que `replayBattle` redemande, nommés **une** fois ;
 * 2. `rejouer()` — rend un **verdict** (`ok`) et sa raison, au lieu de laisser deviner.
 *
 * **Les cafés sont les cafés effectifs** (`players[who].cafeTypes`), pas le choix brut du
 * Deck : une liste vide vaudrait « dérivation automatique » (D-037), donc le rejeu ne
 * serait pas le même.
 */

/** De quoi rejouer une partie à l'identique : graine, deux Decks, cafés effectifs, journal. */
export interface EnveloppeRejeu {
  /** Graine d'origine (`BattleState.seed`), pas `rng`. */
  seed: number;
  playerDeck: string[];
  aiDeck: string[];
  playerCafeTypes: CafeType[];
  aiCafeTypes: CafeType[];
  /** Journal des actions **appliquées** (`EntreeJournal.action`), dans l'ordre. */
  actions: BattleAction[];
}

/** Pourquoi un rejeu n'a pas rendu la partie qu'on lui a donnée. */
export type RefusRejeu =
  /** Un Deck est illégal (taille, doublons, pas d'Entrant) : `createBattle` a refusé. */
  | 'deck-illegal'
  /** Le journal ne rejoue pas tel quel : au moins une action a été ignorée en route. */
  | 'journal-incoherent';

/** Le verdict d'un rejeu. `state` est `null` quand la partie n'a même pas pu commencer. */
export type Rejeu = { ok: true; state: BattleState } | { ok: false; raison: RefusRejeu; state: BattleState | null };

/**
 * Rejoue une enveloppe et **dit** si le résultat est celui qu'elle décrit.
 *
 * `deuxCamps` ne change que les **phrases** du journal (D-106 le dit : solo et duel nomment
 * les camps différemment), jamais le déroulement — mais un appelant qui compare deux états
 * doit passer le même drapeau que celui qui a joué la partie, sinon les journaux texte
 * diffèrent.
 */
export function rejouer(enveloppe: EnveloppeRejeu, options: { deuxCamps?: boolean } = {}): Rejeu {
  let state: BattleState;
  try {
    state = replayBattle(
      enveloppe.playerDeck,
      enveloppe.aiDeck,
      enveloppe.seed,
      enveloppe.actions,
      { playerCafeTypes: enveloppe.playerCafeTypes, aiCafeTypes: enveloppe.aiCafeTypes },
      { deuxCamps: options.deuxCamps }
    );
  } catch {
    // `createBattle` lève sur un Deck illégal (`assertDeckLegal`) : c'est un refus, pas un
    // plantage — l'appelant décide quoi en faire (écarter la partie, refuser le code).
    return { ok: false, raison: 'deck-illegal', state: null };
  }
  if (state.actionLog.length !== enveloppe.actions.length) {
    return { ok: false, raison: 'journal-incoherent', state };
  }
  return { ok: true, state };
}

/**
 * L'enveloppe d'un état **et** des Decks qui ont servi. `BattleState` ne porte pas ses
 * Decks (ils sont distribués à la création) : l'appelant les a, c'est lui qui les donne.
 */
export function enveloppeDe(state: BattleState, decks: { playerDeck: string[]; aiDeck: string[] }): EnveloppeRejeu {
  return {
    seed: state.seed,
    playerDeck: [...decks.playerDeck],
    aiDeck: [...decks.aiDeck],
    playerCafeTypes: [...state.players.player.cafeTypes],
    aiCafeTypes: [...state.players.ai.cafeTypes],
    actions: state.actionLog.map((entree) => entree.action)
  };
}
