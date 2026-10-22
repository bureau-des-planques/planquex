/**
 * **La partie à deux** — ticket #125, la tranche qui prouve le PvP par code (D-049).
 *
 * Le PvP de la beta n'a **aucun serveur** : la partie est déterministe et journalisée
 * (#29, #83), donc « graine + deux Decks + journal des actions » suffit à la
 * reconstruire. `@/game/codec` (#124) porte ce format ; ce module-ci tient ce que
 * l'**écran** ajoute par-dessus, et rien de plus :
 *
 * 1. **quel camp je tiens** — le code ne le dit pas (il n'a que la graine, les deux
 *    Decks et les actions). Il se **déduit** : on transmet le code quand l'autre camp
 *    doit jouer, donc celui qui le colle prend le camp qui a la main
 *    (`campToAct`, relève comprise) ;
 * 2. **quand** le code se transmet (`handover`) — à la fin de mon tour, et pas avant ;
 * 3. **l'IA ne joue jamais** dans une partie à deux (`aiTurnAction`) : c'est le critère
 *    qui a fait échouer le premier essai, la Direction jouant à la place du second
 *    joueur parce que l'écran appelait `nextAiAction` sur le camp `ai`.
 *
 * **Pur** : ni React, ni store, ni réseau. `BattleState` n'est pas persisté (`partialize`,
 * `useStore.ts`) : une partie à deux vit dans l'onglet, et le code est le seul objet qui
 * la fait passer de l'un à l'autre. La reprise après rechargement est le ticket #126.
 */
import type { BattleAction, BattleState, PlayerId } from '@/data/types';
import { decodeMatch, encodeMatch } from '@/game/codec';
import type { Refusal } from '@/game/codec';
import { createBattle, replayBattle } from '@/game/engine';
import type { BattleCafeTypes } from '@/game/engine';
import { nextAiAction } from '@/game/ia';

/**
 * Les deux camps du moteur, nommés pour l'écran. Ce sont les **sièges** du moteur
 * (`player`, `ai`), pas des personnes : en partie à deux, celui qui colle le code peut
 * tenir l'un ou l'autre, et l'écran doit le dire sans se tromper (critère #125).
 */
export const CAMP_NAME: Readonly<Record<PlayerId, string>> = {
  player: 'camp Toi',
  ai: 'camp Direction'
};

/** L'autre camp. Une seule écriture, donc pas de camp « oublié » dans une branche. */
export function otherCamp(camp: PlayerId): PlayerId {
  return camp === 'player' ? 'ai' : 'player';
}

/**
 * Ce que l'écran retient d'une partie à deux : **mon camp** et les **deux Decks**
 * tels qu'ils ont été posés. La graine, les types de café et le journal des actions se
 * lisent dans le `BattleState` : une seule source, donc un code qui ne peut pas mentir
 * sur une copie qui aurait divergé.
 */
export interface Match {
  camp: PlayerId;
  playerDeck: string[];
  aiDeck: string[];
}

/**
 * Ouvre une partie à deux : sa **graine**, mon Deck au camp `player` (je crée, donc
 * j'ouvre le siège `player`), et le Deck adverse. Le camp n'est pas choisi par le
 * joueur : c'est le siège du moteur, et le code le redistribuera à l'autre.
 */
export function createMatch(
  playerDeck: string[],
  aiDeck: string[],
  seed: number,
  cafeTypes: BattleCafeTypes = {}
): { state: BattleState; match: Match } {
  return {
    state: createBattle(playerDeck, aiDeck, seed, cafeTypes, { deuxCamps: true }),
    match: { camp: 'player', playerDeck: [...playerDeck], aiDeck: [...aiDeck] }
  };
}

/**
 * Le camp qui **doit agir** : la relève en attente d'abord, sinon le camp qui a la main.
 * Les deux divergent : après une Pression qui craque le Poste adverse, `current` reste
 * l'attaquant et `pendingPromotion` désigne l'autre — c'est ce dernier qui joue.
 */
export function campToAct(state: BattleState): PlayerId {
  return state.pendingPromotion ?? state.current;
}

/**
 * Le **code** de la partie, prêt à transmettre. Il part de l'état vivant (graine, types
 * de café **effectifs**, journal des actions) : un code recopié à la main ne peut pas
 * décrire une autre partie que celle qui est à l'écran.
 */
export function matchCode(state: BattleState, match: Match): string {
  return encodeMatch({
    seed: state.seed,
    playerDeck: match.playerDeck,
    aiDeck: match.aiDeck,
    playerCafeTypes: state.players.player.cafeTypes,
    aiCafeTypes: state.players.ai.cafeTypes,
    actions: state.actionLog
  });
}

export type Handover = { ready: true } | { ready: false; raison: string };

/**
 * **Peut-on transmettre le code maintenant ?** Oui quand c'est à l'autre camp d'agir —
 * c'est-à-dire à la fin de mon tour, relève adverse comprise. Non dans les trois autres
 * cas, chacun avec sa raison (l'écran les affiche telles quelles) :
 *
 * - la partie est terminée : il n'y a plus de tour à passer ;
 * - **ma relève** est en attente : mon Poste a craqué au Contrôle de fin de tour, et
 *   c'est à moi de choisir avant de passer la main ;
 * - c'est encore à moi de jouer.
 */
export function handover(state: BattleState, match: Match): Handover {
  if (state.phase === 'ended') {
    return { ready: false, raison: 'La partie est terminée : il n’y a plus de code à transmettre.' };
  }
  const actor = campToAct(state);
  if (actor === match.camp) {
    return state.pendingPromotion === match.camp
      ? { ready: false, raison: 'Ton Poste a craqué : choisis ta relève avant de transmettre le code.' }
      : { ready: false, raison: 'C’est encore à toi de jouer : le code se transmet à la fin de ton tour.' };
  }
  return { ready: true };
}

/**
 * La ligne de camp de l'écran (critère #125) : **de quel camp je joue**, et **à qui
 * c'est le tour**. Elle vient du moteur (`campToAct`), jamais d'un compteur d'écran.
 */
export function campLine(state: BattleState, match: Match): string {
  const mine = `Tu joues le ${CAMP_NAME[match.camp]}`;
  if (state.phase === 'ended') return `${mine} · partie terminée`;
  const actor = campToAct(state);
  return actor === match.camp
    ? `${mine} · à toi de jouer`
    : `${mine} · c’est au ${CAMP_NAME[actor]} de jouer`;
}

export type JoinResult = { ok: true; state: BattleState; match: Match } | Refusal;

/**
 * **Coller un code** : la partie est rejouée telle quelle et l'écran prend le camp qui
 * doit agir — le camp adverse de celui qui vient d'envoyer, par construction de
 * `handover`.
 *
 * Un refus du codec passe **tel quel** : sa `raison` est déjà une phrase française
 * affichable, et l'écran ne la remplace pas par un message générique (critère #124).
 */
export function joinMatch(code: string): JoinResult {
  const decoded = decodeMatch(code);
  if (!decoded.ok) return decoded;
  const state = replayBattle(
    decoded.match.playerDeck,
    decoded.match.aiDeck,
    decoded.match.seed,
    decoded.match.actions,
    {
      playerCafeTypes: decoded.match.playerCafeTypes,
      aiCafeTypes: decoded.match.aiCafeTypes
    },
    { deuxCamps: true }
  );
  return {
    ok: true,
    state,
    match: {
      camp: campToAct(state),
      playerDeck: decoded.match.playerDeck,
      aiDeck: decoded.match.aiDeck
    }
  };
}

/**
 * L'action de l'IA à jouer, ou `null`. **En partie à deux, il n'y a aucune IA** : le
 * camp `ai` est tenu par quelqu'un, et le faire jouer tout seul retirerait son tour au
 * second joueur. `nextAiAction` n'est donc **pas appelé** quand `match` est non nul —
 * c'est le critère du #125, et `pvp.test.ts` le prouve en espionnant le module.
 *
 * En solo, la condition est celle de l'écran d'avant : la Direction agit à son tour ou
 * pendant sa relève, jamais quand une relève humaine est en attente.
 */
export function aiTurnAction(state: BattleState, match: Match | null): BattleAction | null {
  if (match !== null) return null;
  if (state.phase !== 'playing') return null;
  const pending = state.pendingPromotion;
  const directionPlays = pending === 'ai' || (state.current === 'ai' && pending === null);
  return directionPlays ? nextAiAction(state) : null;
}
