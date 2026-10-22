/**
 * **La partie en cours, persistée** — ticket #126.
 *
 * Un combat (solo ou à deux) perdait tout au rechargement : `BattleState` n'était pas
 * persisté. Ce module tient ce qu'il faut pour la **rejouer** — la graine, les deux Decks,
 * les types de café **effectifs** et le journal des actions — exactement le contrat de
 * `replayBattle` (#83) et du codec (#124). Rien de nouveau n'est tiré : la partie repart
 * de sa graine, et `Math.random()` n'entre jamais en jeu.
 *
 * **Pur** : ni React, ni store. Le store (`useStore.ts`) ne fait que la **ranger** dans sa
 * forme persistée (`partie`, `version: 7`) ; l'écran (`Battle.tsx`) la lit au montage et
 * la réécrit à chaque état.
 *
 * Une partie **terminée** n'est pas une partie à reprendre : elle n'est pas enregistrée,
 * et une reprise refusée (journal qui ne rejoue pas, forme illisible) rend `null` — l'écran
 * repart alors d'un combat neuf, sans planter.
 */
import type { BattleAction, BattleState, CafeType, PlayerId } from '@/data/types';
import { isCafeType } from '@/game/deck';
import { replayBattle } from '@/game/engine';
import type { Match } from '@/store/pvp';

/** Les deux Decks d'un combat **solo** (une partie à deux les porte dans son `Match`). */
export interface Decks {
  playerDeck: string[];
  aiDeck: string[];
}

/** Ce qui se range dans le store : de quoi rejouer la partie, à l'identique. */
export interface PartieSauvegardee {
  /** `solo` : contre la Direction. `deux` : une partie à deux (#125). */
  mode: 'solo' | 'deux';
  /** Le camp que je tiens (toujours `player` en solo). */
  camp: PlayerId;
  /** Graine d'origine (`BattleState.seed`), pas `rng`. */
  seed: number;
  playerDeck: string[];
  aiDeck: string[];
  /** Types de café **effectifs** (`BattleState.players[who].cafeTypes`). */
  playerCafeTypes: CafeType[];
  aiCafeTypes: CafeType[];
  /** Journal des actions **appliquées** (`BattleState.actionLog`). */
  actions: BattleAction[];
}

/** Ce que l'écran reprend au montage : l'état rejoué, son match (ou `null`), ses Decks. */
export interface Reprise {
  state: BattleState;
  match: Match | null;
  decksSolo: Decks;
}

/**
 * La partie à ranger, ou `null` si elle est terminée. `match` non nul = partie à deux ;
 * sinon c'est un combat solo et `decksSolo` porte ses Decks.
 */
export function partieSauvegardee(
  state: BattleState,
  match: Match | null,
  decksSolo: Decks
): PartieSauvegardee | null {
  if (state.phase === 'ended') return null;
  const decks = match ?? decksSolo;
  return {
    mode: match ? 'deux' : 'solo',
    camp: match ? match.camp : 'player',
    seed: state.seed,
    playerDeck: [...decks.playerDeck],
    aiDeck: [...decks.aiDeck],
    playerCafeTypes: [...state.players.player.cafeTypes],
    aiCafeTypes: [...state.players.ai.cafeTypes],
    actions: [...state.actionLog]
  };
}

/**
 * Rejoue une partie rangée. `null` si elle ne peut pas l'être : forme illisible, Deck
 * illégal, action que le moteur refuse, ou partie déjà terminée. Ne lève jamais.
 */
export function reprendrePartie(partie: PartieSauvegardee | null): Reprise | null {
  if (partie === null) return null;
  const deux = partie.mode === 'deux';
  let state: BattleState;
  try {
    state = replayBattle(
      partie.playerDeck,
      partie.aiDeck,
      partie.seed,
      partie.actions,
      { playerCafeTypes: partie.playerCafeTypes, aiCafeTypes: partie.aiCafeTypes },
      deux ? { deuxCamps: true } : {}
    );
  } catch {
    return null;
  }
  // Une action refusée par le moteur n'est pas journalisée (#83) : si le compte ne suit
  // pas, le journal ne rejoue pas, et on ne reprend pas une autre partie en silence.
  if (state.actionLog.length !== partie.actions.length) return null;
  if (state.phase === 'ended') return null;
  const decks: Decks = { playerDeck: [...partie.playerDeck], aiDeck: [...partie.aiDeck] };
  return {
    state,
    match: deux ? { camp: partie.camp, ...decks } : null,
    decksSolo: decks
  };
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isCafeList = (value: unknown): value is CafeType[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && isCafeType(item));

/**
 * La forme d'une partie rangée, ou `null`. Vérifie la **forme** seulement : que la partie
 * rejoue vraiment, c'est `reprendrePartie` qui le dit.
 */
export function lirePartie(brut: unknown): PartieSauvegardee | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const p = brut as Record<string, unknown>;
  const valide =
    (p.mode === 'solo' || p.mode === 'deux') &&
    (p.camp === 'player' || p.camp === 'ai') &&
    Number.isSafeInteger(p.seed) &&
    isStringList(p.playerDeck) &&
    isStringList(p.aiDeck) &&
    isCafeList(p.playerCafeTypes) &&
    isCafeList(p.aiCafeTypes) &&
    Array.isArray(p.actions);
  return valide ? (p as unknown as PartieSauvegardee) : null;
}
