/**
 * **La dernière partie terminée** — ticket #366 (rejeu, depuis Réglages).
 *
 * Une partie **en cours** se range déjà (`@/store/partie`, #126). Une partie **terminée**
 * n'était gardée nulle part : sa trace partait à la base (`@/store/combats`), et le store
 * l'effaçait. Ce module garde **une** partie terminée, de quoi la rejouer et son verdict,
 * pour que le testeur la revoie après coup.
 *
 * Le choix de la voie (ticket #366) : garder la dernière partie dans le store plutôt que
 * demander un code collé. Un code ne sert qu'à une partie à deux déjà partagée ; une partie
 * solo finie n'en a aucun, et « revoir la partie qu'il vient de perdre » n'aurait pas de
 * porte d'entrée. Le coût est une forme persistée de plus (`derniere`, v13, migration).
 *
 * **Pur** : ni React, ni DOM. Le moteur n'est lu qu'à travers `createBattle` et `applyAction`,
 * exactement comme `replayBattle` le fait : aucune règle n'est touchée, le rejeu **rejoue**.
 */
import { applyAction, createBattle } from '@/game/engine';
import { enveloppeDe } from '@/game/rejeu';
import type { EnveloppeRejeu } from '@/game/rejeu';
import type { BattleState, EndReason, PlayerId } from '@/data/types';
import { lirePartie } from '@/store/partie';
import type { Decks, PartieSauvegardee } from '@/store/partie';
import type { Match } from '@/store/pvp';

/** Ce que la partie d'origine a donné : de quoi vérifier que le rejeu rend **le même**. */
export interface VerdictPartie {
  vainqueur: PlayerId | null;
  raison: EndReason | null;
  tours: number;
}

/** La dernière partie terminée : sa partie rangée (enveloppe, mode, camp) et son verdict. */
export interface DernierePartie extends PartieSauvegardee {
  verdict: VerdictPartie;
}

const RAISONS: readonly EndReason[] = ['interventions', 'plateauVide', 'forfait', 'limiteDeTours'];

/**
 * La dernière partie, si la partie est **terminée**, sinon `null`. Même lecture des Decks que
 * `partieSauvegardee` : ceux du `Match` pour une partie à deux, sinon ceux du solo.
 */
export function derniereDe(state: BattleState, match: Match | null, decksSolo: Decks): DernierePartie | null {
  if (state.phase !== 'ended') return null;
  const decks = match ?? decksSolo;
  return {
    mode: match ? 'deux' : 'solo',
    camp: match ? match.camp : 'player',
    ...enveloppeDe(state, decks),
    verdict: { vainqueur: state.winner, raison: state.endReason, tours: state.turn }
  };
}

/**
 * La forme d'une dernière partie rangée, ou `null`. Vérifie la **forme** (la partie via
 * `lirePartie`, puis le verdict) ; que la partie rejoue vraiment, c'est `rejouer` qui le dit.
 */
export function lireDerniere(brut: unknown): DernierePartie | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const base = lirePartie(brut);
  if (base === null) return null;
  const verdict = (brut as Record<string, unknown>).verdict;
  if (typeof verdict !== 'object' || verdict === null) return null;
  const v = verdict as Record<string, unknown>;
  const valide =
    (v.vainqueur === 'player' || v.vainqueur === 'ai' || v.vainqueur === null) &&
    (typeof v.raison === 'string' ? RAISONS.includes(v.raison as EndReason) : v.raison === null) &&
    Number.isSafeInteger(v.tours) &&
    (v.tours as number) >= 0;
  if (!valide) return null;
  return {
    ...base,
    verdict: {
      vainqueur: v.vainqueur as PlayerId | null,
      raison: v.raison as EndReason | null,
      tours: v.tours as number
    }
  };
}

/**
 * Le verdict du rejeu contre celui de la partie d'origine, ou `null` s'ils sont identiques.
 * Un écart rend la phrase à afficher : il ne se tait jamais.
 */
export function ecartVerdict(rejoue: BattleState, origine: VerdictPartie): string | null {
  const ecarts: string[] = [];
  if (rejoue.winner !== origine.vainqueur) ecarts.push('le vainqueur');
  if (rejoue.endReason !== origine.raison) ecarts.push('la raison de la fin');
  if (rejoue.turn !== origine.tours) ecarts.push('le nombre de tours');
  if (ecarts.length === 0) return null;
  return `Le rejeu ne rend pas la même partie : ${ecarts.join(', ')} diffère.`;
}

/**
 * Chaque état du rejeu, du départ (index 0) à la fin (index `actions.length`). Même mise en
 * place et mêmes actions que `replayBattle`, mais chaque étape est gardée. À n'appeler qu'une
 * fois `rejouer` a rendu `ok` : un Deck illégal lève ici.
 */
export function etapesDuRejeu(enveloppe: EnveloppeRejeu, options: { deuxCamps?: boolean } = {}): BattleState[] {
  let state = createBattle(
    enveloppe.playerDeck,
    enveloppe.aiDeck,
    enveloppe.seed,
    { playerCafeTypes: enveloppe.playerCafeTypes, aiCafeTypes: enveloppe.aiCafeTypes },
    { deuxCamps: options.deuxCamps }
  );
  const etapes = [state];
  for (const action of enveloppe.actions) {
    state = applyAction(state, action);
    etapes.push(state);
  }
  return etapes;
}
