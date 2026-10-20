import { getCard, isPlanque } from '@/data';
import type {
  BattleAction,
  BattleState,
  CardInstance,
  PlayerId,
  PlayerState
} from '@/data/types';
import { applyAction, attackDamage, attackPreview, legalActions } from '@/game/engine';

/**
 * **L'IA du Bureau des Planqués** — la Direction.
 *
 * Un seul endroit porte la politique : `nextAction` choisit, dans `legalActions`,
 * l'action suivante du camp au trait. Le simulateur (`@/game/simulation`) et l'écran
 * de combat (`@/pages/Battle`) la lisent tous les deux — aucune copie.
 *
 * Deux **niveaux**, un seul module : le niveau est un **paramètre**, jamais une
 * seconde implémentation (spec #92).
 *
 * - **Niveau 1 — la Direction** (scripté, sobre, déterministe). Politique, dans
 *   l'ordre — celui de la simulation d'origine, préservé tel quel pour que le
 *   rapport du simulateur ne bouge pas d'un tour :
 *
 *   1. jouer une **carte Action** utile (un Objet illimité ou le Collègue du tour) ;
 *   2. **évoluer**, en préférant le Poste ;
 *   3. **poser un Entrant** si le Poste est vide, sinon au premier Rack libre ;
 *   4. le **Talent** du Poste, une fois par tour ;
 *   5. **attacher un café** au Poste ;
 *   6. jouer la **meilleure Pression** abordable (dégâts effectifs) ;
 *   7. sinon, **fin de tour**.
 *
 * - **Niveau 2 — la Direction qui évalue** (ticket #93). Pour chaque action de
 *   `legalActions`, on **applique** l'action, on **évalue** la position résultante
 *   avec l'**unique fonction d'évaluation** (`evaluatePosition`), et on garde le
 *   meilleur score. Un seul coup de profondeur : c'est ce que demande la spec #92.
 *
 * `nextAction` ne construit jamais une action « à la main » : elle part de
 * `legalActions(state)` et choisit dedans, donc elle ne peut pas produire une action
 * que le moteur refuserait. Aucun `Math.random()` : le hasard de la partie reste dans
 * l'`rng` seedé de `BattleState`. Le niveau 2 n'en tire pas davantage : il **applique**
 * des actions sur des clones (`structuredClone`), et seul le générateur **du clone**
 * avance — jamais celui de la partie.
 */

/**
 * Les niveaux de la Direction. `1` : la politique scriptée. `2` : la politique qui
 * évalue chaque coup légal. Le niveau est un **paramètre** : `ia.ts` reste le seul
 * module de politique.
 */
export type AiLevel = 1 | 2;

/* ------------------------------------------------------------------ */
/* Niveau 1 — la Direction scriptée                                   */
/* ------------------------------------------------------------------ */

/**
 * Prochaine action de la politique, **sans garde de camp** : c'est le simulateur qui
 * l'emploie pour les deux camps, et c'est le socle de `nextAiAction`. Traite aussi la
 * **relève** (`pendingPromotion`), que le camp dont le Poste a craqué doit trancher.
 *
 * @param level 1 (défaut) : la Direction scriptée. 2 : la Direction qui évalue.
 */
export function nextAction(state: BattleState, level: AiLevel = 1): BattleAction | null {
  if (state.phase === 'ended') return null;

  if (state.pendingPromotion) {
    const who = state.pendingPromotion;
    if (level === 2) {
      // La relève se tranche par évaluation : chaque Rack garni est un candidat,
      // et l'on garde celui qui donne la meilleure position au camp qui relève.
      return bestEvaluatedAction(state, legalActions(state), who);
    }
    const benchIndex = chooseBench(state, who);
    // Le moteur ne pose `pendingPromotion` que si le Rack n'est pas vide ; cette garde
    // évite une boucle si une future règle changeait ce contrat.
    if (benchIndex < 0) return null;
    return { type: 'promoteActive', benchIndex };
  }

  const legal = legalActions(state);

  if (level === 2) {
    return bestEvaluatedAction(state, legal, state.current);
  }

  // Les actions non terminales, dans l'ordre de la politique. On saute les types que
  // la politique de niveau 1 n'emploie pas (Rotation, Changement de priorité) : ils
  // sont légaux, mais ce n'est pas son répertoire.
  for (const type of NON_TERMINAL_ORDER) {
    const found = legal.find((action) => action.type === type);
    if (found) return found;
  }

  const move = chooseAttack(state, legal);
  if (move) return move;

  return legal.find((action) => action.type === 'endTurn') ?? null;
}

/**
 * Prochaine action de **la Direction** (`ai`) — `null` quand ce n'est pas son tour,
 * quand la partie est finie, ou quand c'est au joueur de choisir sa relève. C'est le
 * point d'entrée de l'écran de combat.
 *
 * @param level 1 (défaut) : la Direction scriptée — le comportement de l'écran ne
 * change pas. 2 : la Direction qui évalue (mesurée par le simulateur, ticket #93).
 */
export function nextAiAction(state: BattleState, level: AiLevel = 1): BattleAction | null {
  if (state.phase === 'ended') return null;
  if (state.pendingPromotion) {
    return state.pendingPromotion === 'ai' ? nextAction(state, level) : null;
  }
  if (state.current !== 'ai') return null;
  return nextAction(state, level);
}

/** L'ordre de préférence des actions non terminales de la politique. */
const NON_TERMINAL_ORDER = ['playAction', 'evolve', 'playBasic', 'ability', 'attachEnergy'] as const;

/**
 * Meilleure Pression **légale** (donc abordable), au sens des dégâts effectifs
 * (`attackPreview`) ; premier index en cas d'égalité, comme le reste de la politique.
 */
function chooseAttack(state: BattleState, legal: readonly BattleAction[]): BattleAction | null {
  const player = state.players[state.current];
  if (player.hasAttacked || !player.active) return null;

  let best: BattleAction | null = null;
  let bestDamage = -1;
  for (const action of legal) {
    if (action.type !== 'attack') continue;
    const damage = attackPreview(state, action.attackIndex);
    if (damage > bestDamage) {
      best = action;
      bestDamage = damage;
    }
  }
  return best;
}

/** Relève : le Rack le plus solide, premier index en cas d'égalité. */
function chooseBench(state: BattleState, who: PlayerId): number {
  const bench = state.players[who].bench;
  let best = -1;
  let bestHp = -1;
  for (let index = 0; index < bench.length; index += 1) {
    const card = bench[index];
    if (card && card.hp > bestHp) {
      best = index;
      bestHp = card.hp;
    }
  }
  return best < 0 ? bench.findIndex(Boolean) : best;
}

/* ------------------------------------------------------------------ */
/* La fonction d'évaluation — une seule, paramétrique                  */
/* ------------------------------------------------------------------ */

/**
 * **Poids de l'évaluation.** Une seule fonction d'évaluation, mais **paramétrique** :
 * les chiffres qui décident du classement sont ici, et nulle part ailleurs.
 *
 * - `points` : une **Intervention** marquée vaut ce nombre de points d'évaluation.
 *   C'est le terme le plus lourd : 3 Interventions gagnent la partie.
 * - `board` : le **Seuil restant × cafés utiles** de **mon** plateau (Poste et Rack).
 * - `rival` : le plateau **adverse**, un risque : son poids est **négatif**.
 * - `safety` : la **sécurité de mon Poste** — le Seuil au Poste moins les dégâts que
 *   le camp adverse peut me porter.
 * - `hand` : la **taille de main** — une carte de plus, c'est une option de plus.
 * - `threat` : la **menace** — les dégâts que je peux porter, moins ceux que je subis.
 */
export interface EvaluationWeights {
  points: number;
  board: number;
  rival: number;
  safety: number;
  hand: number;
  threat: number;
}

/**
 * Poids **par défaut** de l'évaluation. Ils sont **mesurés**, pas choisis à l'aveugle :
 * le simulateur (`npm run simulate -- --games 100 --seed 42 --ai-level 2`) compare le
 * niveau 2 au niveau 1, et ce sont ces chiffres qui rendent le niveau 2 devantable
 * (ticket #93). La mesure : sur 1 000 parties seedées (5 graines maîtresses), le
 * camp de niveau 2 l'emporte **56 %** des parties, contre 44 % au niveau 1.
 *
 * Trois réglages méritent une explication :
 *
 * - `rival` est **négatif et plus léger** que `board` : un Planqué gagné au Rack vaut
 *   plus qu'un Seuil pris sur l'adversaire. Un dégât peut être soigné, un Planqué
 *   reste. C'est aussi ce qui fait que la Direction **développe son plateau avant de
 *   frapper** — une Pression termine le tour (D-033), développer est gratuit.
 * - `threat` est **modeste** : une Direction qui ne pense qu'à frapper cesse de
 *   développer, et les parties s'éternisent en égalité.
 * - `board` est **fort** : le plateau est ce qui gagne les parties.
 */
export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeights = {
  points: 300,
  board: 3,
  rival: -0.8,
  safety: 4,
  hand: 4,
  threat: 3
};

/** Le camp adverse. */
function opponentOf(who: PlayerId): PlayerId {
  return who === 'player' ? 'ai' : 'player';
}

/**
 * Les cafés attachés qui **servent à une Pression**.
 *
 * C'est le nombre de cafés engagés vers la Pression la plus chère du Planqué : un
 * café qui ne sert à rien ne vaut rien, et un café au-delà du coût maximal non
 * plus. Un café qui ne paie pas encore une Pression compte quand même : il s'y
 * engage.
 *
 * ⚠️ **Approximation assumée** : depuis #88/#90, le moteur exige
 * `satisfiesCafeCost` (un symbole typé n'est payé que par un café **de ce type**),
 * alors que cette estimation compte les cafés **au nombre**. Elle **surestime**
 * donc la menace et la sécurité quand les types ne correspondent pas. Changer la
 * mesure changerait le niveau 2 tel qu'il a été pesé — c'est le ticket #108.
 */
function paidCafes(instance: CardInstance): number {
  const card = getCard(instance.cardId);
  if (!isPlanque(card)) return 0;
  const maxCost = card.attacks.reduce((max, attack) => Math.max(max, attack.cost.length), 0);
  if (maxCost === 0) return 0;
  return Math.min(instance.energy.length, maxCost);
}

/**
 * Valeur d'un Planqué : **Seuil restant × cafés utiles**.
 *
 * Les « cafés utiles » comptent 1 pour le Planqué lui-même, plus les cafés attachés
 * qui servent à une Pression : un Planqué à 60 de Seuil et 2 cafés utiles vaut 180.
 */
function planqueValue(instance: CardInstance): number {
  return instance.hp * (1 + paidCafes(instance));
}

/**
 * Valeur du plateau d'un camp : la somme des **Seuils restants × cafés utiles** de ses
 * Planqués, Poste et Rack. Le Rack ne vaut pas moins que le Poste : un Planqué
 * préparé vaut son Seuil et ses cafés — c'est la mesure qui l'a décidé.
 */
function boardValue(player: PlayerState): number {
  const active = player.active ? planqueValue(player.active) : 0;
  const bench = player.bench.reduce((sum, card) => sum + (card ? planqueValue(card) : 0), 0);
  return active + bench;
}

/**
 * **Menace** d'un camp : les dégâts qu'il peut porter au Poste adverse **avec les
 * cafés qu'il a**. C'est ce qui rend la Direction **concentrée** : un café au Poste
 * qui débloque une Pression vaut bien plus qu'un café réparti sur le Rack.
 *
 * Les conditions réduisent la menace : l'**Immobilisation** interdit toute Pression,
 * la **Sieste** et la **Dérive** la font échouer une fois sur deux (D-033).
 */
function threatOf(player: PlayerState, defender: CardInstance | null): number {
  if (!player.active || !defender) return 0;
  const card = getCard(player.active.cardId);
  if (!isPlanque(card)) return 0;

  let best = 0;
  for (const attack of card.attacks) {
    if (player.active.energy.length < attack.cost.length) continue;
    const damage = attackDamage(player.active, defender, attack, 'poste');
    if (damage > best) best = damage;
  }

  const statuses = player.active.statuses;
  if (statuses.includes('IMMOBILISATION')) return 0;
  if (statuses.includes('SIESTE') || statuses.includes('DERIVE')) return best / 2;
  return best;
}

/**
 * **Sécurité du Poste** d'un camp : le Seuil restant au Poste moins la menace
 * adverse. Positive, le Poste tient ; négative, il va craquer au prochain tour.
 */
function safetyOf(player: PlayerState, opponent: PlayerState): number {
  const hp = player.active ? player.active.hp : 0;
  return hp - threatOf(opponent, player.active);
}

/**
 * **La fonction d'évaluation** — une seule, et elle vit **à côté de la politique**
 * (`@/game/ia`), pas dans le moteur (`@/game/engine`).
 *
 * Elle note une position **du point de vue d'un camp** : plus le score est grand,
 * meilleure est la position pour ce camp. Les termes sont ceux de la spec #92 :
 *
 * 1. les **Interventions** marquées (écart entre les deux camps) ;
 * 2. le **Seuil restant × cafés utiles** (mon plateau, moins le risque du leur) ;
 * 3. la **sécurité du Poste** (Seuil au Poste moins les dégâts adverses) ;
 * 4. la **taille de main** (écart) ;
 * 5. la **menace** (les dégâts que je peux porter, moins ceux que l'adversaire peut
 *    me porter).
 *
 * Le score est **relatif à un camp** : les deux camps ne sont donc pas notés de la
 * même façon, et c'est volontaire — on compare des positions pour **un** camp.
 *
 * La fonction est **pure** : mêmes état, camp et poids → même score. Aucun tirage,
 * aucun `Math.random()`.
 */
export function evaluatePosition(
  state: BattleState,
  who: PlayerId,
  weights: EvaluationWeights = DEFAULT_EVALUATION_WEIGHTS
): number {
  const me = state.players[who];
  const opponent = state.players[opponentOf(who)];

  const myThreat = threatOf(me, opponent.active);
  const opponentThreat = threatOf(opponent, me.active);

  return (
    weights.points * (me.points - opponent.points) +
    weights.board * boardValue(me) +
    weights.rival * boardValue(opponent) +
    weights.safety * safetyOf(me, opponent) +
    weights.hand * (me.hand.length - opponent.hand.length) +
    weights.threat * (myThreat - opponentThreat)
  );
}

/* ------------------------------------------------------------------ */
/* Niveau 2 — la Direction qui évaluate                               */
/* ------------------------------------------------------------------ */

/**
 * **Le meilleur coup évalué** : pour chaque action légale, on l'applique, on évalue
 * la position résultante, et on garde le meilleur score.
 *
 * - les actions viennent **de `legalActions`** : le niveau 2 ne peut donc pas
 *   produire une action que le moteur refuserait ;
 * - le **forfait** est exclu : c'est une décision humaine (D-030) ;
 * - une action **refusée** par le moteur (`applyAction` rend l'état d'entrée) est
 *   ignorée : elle ne change rien, elle ne peut pas être « la meilleure » ;
 * - `applyAction` **clone** l'état (`structuredClone`, la convention du moteur) :
 *   le clone est modifié, la partie ne l'est pas. Aucun tirage n'est consommé dans
 *   le générateur de la partie : le niveau 2 est **déterministe par graine**.
 */
function bestEvaluatedAction(
  state: BattleState,
  legal: readonly BattleAction[],
  who: PlayerId,
  weights: EvaluationWeights = DEFAULT_EVALUATION_WEIGHTS
): BattleAction | null {
  let best: BattleAction | null = null;
  let bestScore = -Infinity;

  for (const action of legal) {
    if (action.type === 'forfeit') continue;
    const after = applyAction(state, action);
    if (after === state) continue;

    let score = evaluatePosition(after, who, weights);

    // **Finir son tour** : l'adversaire pioche au début du sien, nous piocherons au
    // début du nôtre. Sans cette anticipation, « finir son tour » paraîtrait toujours
    // moins bien que « jouer un coup de plus » — alors que les deux camps piochent
    // autant. On rend donc la comparaison honnête.
    if (action.type === 'endTurn') score += weights.hand;

    // Premier arrivé, premier servi : à score égal, l'ordre de `legalActions` tranche.
    // C'est ce qui rend le niveau 2 déterministe.
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }

  return best;
}
