import { CARD_BY_ID } from '@/data';
import type { BattleState, CafeSymbol, CafeType, CardInstance, PlayerId } from '@/data/types';
import { createBattle } from './engine';

/**
 * **La fin scriptée du tutoriel de combat** (30/10/2026, D-160 (5)).
 *
 * Le testeur ne regarde pas une fin de partie : il la **joue**. L'état de départ est
 * construit pour que la victoire soit **déjà à portée** — deux Interventions partout,
 * un Poste adverse à 10 de Seuil, et le Technicien système au Poste du joueur, un café
 * en main. Une Pression, et c'est la troisième Intervention.
 *
 * **Rien n'est nouveau au catalogue** : les cartes sont celles du set, et leurs textes
 * sont les leurs — la paire Joueur de flûte → Technicien système est celle que l'étape
 * « La Collection et le Deck » vient de montrer. La Direction tient le Chef de projet
 * fantôme, « en réunion depuis 2019 ».
 *
 * **Pourquoi un état construit et non une partie rejouée** : le joueur garde la main, et
 * une suite de coups rejouée l'aurait privé du geste. La contrepartie est qu'il peut
 * faire autre chose que la Pression — c'est permis : l'état reste gagnable, et le
 * panneau du pas-à-pas dit quoi faire.
 */
export const SCENARIO_FIN = {
  /** Le tour où l'on arrive : les deux camps ont eu le temps d'évoluer. */
  tour: 6,
  /** Interventions déjà marquées : deux pour le joueur, une pour la Direction. */
  interventions: { player: 2, ai: 1 } as const,
  joueur: 'atelier-technicien-systeme',
  direction: 'direction-chef-projet-fantome',
  /**
   * Le Seuil qui reste au Poste de la Direction : 10. La Pression du Technicien en fait
   * 50 (60 avec la Vulnérabilité), donc **une seule** suffit — c'est la fin en un geste.
   */
  hpDirection: 10
} as const;

/** Une instance de carte telle que le moteur la fabrique — assez pour tenir un Poste. */
function instance(cardId: string, uid: string, hp: number, energy: CafeSymbol[] = []): CardInstance {
  const card = CARD_BY_ID.get(cardId);
  if (!card) throw new Error(`carte inconnue du scénario : ${cardId}`);
  const maxHp = 'hp' in card ? card.hp : 0;
  return { uid, cardId, hp, maxHp, energy, statuses: [], playedTurn: 1, evolvedTurn: 2, damageReduction: 0 };
}

/**
 * L'état de départ de la fin scriptée. `playerDeck` et `aiDeck` viennent du Deck chargé à
 * l'étape 2 et du Deck de la Direction : le combat reste **le même moteur**, avec les
 * mêmes Decks — seule la position de départ est posée.
 */
export function etatFinScriptee(
  playerDeck: readonly string[],
  aiDeck: readonly string[],
  playerCafeTypes: readonly CafeType[] = []
): BattleState {
  const base = createBattle([...playerDeck], [...aiDeck], 20261030, {
    playerCafeTypes: [...playerCafeTypes]
  });
  const state = structuredClone(base);

  state.turn = SCENARIO_FIN.tour;
  state.current = 'player';
  state.phase = 'playing';
  state.winner = null;
  state.endReason = null;
  state.pendingPromotion = null;
  state.pendingChoice = null;
  state.players.player.points = SCENARIO_FIN.interventions.player;
  state.players.ai.points = SCENARIO_FIN.interventions.ai;

  // Le Poste du joueur : le Technicien système, un cran au-dessus du Joueur de flûte,
  // avec de quoi payer sa Pression.
  state.players.player.active = instance(SCENARIO_FIN.joueur, 'scenario-joueur-poste', 90, ['ATELIER', 'ATELIER']);
  // Le Banc garde de quoi tenir si le Poste tombe : la ligne d'évolution est dans le Deck.
  state.players.player.bench = [null, null, null];
  state.players.player.energyZone = 'ATELIER';

  // Le Poste de la Direction : le Chef de projet fantôme, à 10 de Seuil.
  state.players.ai.active = instance(SCENARIO_FIN.direction, 'scenario-direction-poste', SCENARIO_FIN.hpDirection);
  // **Un Banc, même vide de sens** : sans lui, le craquage viderait le plateau de la
  // Direction et la victoire serait « plus aucun Planqué » (`plateauVide`) au lieu de la
  // **troisième Intervention** que l'étape raconte. Le Banc garde la bonne fin.
  state.players.ai.bench = [instance(SCENARIO_FIN.direction, 'scenario-direction-banc', 60), null, null];

  const neuf = (camp: PlayerId) => {
    const joueur = state.players[camp];
    joueur.energyAttached = false;
    joueur.hasAttacked = false;
    joueur.hasRetreated = false;
    joueur.hasUsedAbility = false;
    joueur.hasUsedPriorityShift = false;
    joueur.hasPlayedSupporter = false;
  };
  neuf('player');
  neuf('ai');

  return state;
}

/** Vrai quand l'état est celui de la fin scriptée : la page le dit dans son journal. */
export function estFinScriptee(state: BattleState): boolean {
  return state.players.player.active?.uid === 'scenario-joueur-poste';
}
