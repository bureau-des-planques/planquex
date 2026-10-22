import { ALL_CARDS, getCard, isPlanque } from '@/data';
import type {
  BattleAction,
  BattleState,
  CardInstance,
  PlayerId,
  PlayerState
} from '@/data/types';
import { applyAction, attackDamage, attackPreview, createInstance, legalActions } from '@/game/engine';
import { MAX_COPIES_PER_NAME } from '@/game/deck';
import { drawRandom, seedRng } from '@/game/rng';
import type { RngState } from '@/game/rng';
import { satisfiesCafeCost } from '@/game/rules';

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
 * l'`rng` seedé de `BattleState`.
 *
 * **Ce que le niveau 2 fait du hasard (ticket #114).** Il **applique** chaque coup sur
 * une copie dont le générateur est une **sous-graine dérivée** (`evaluationRng`), jamais
 * le flux de la partie : le générateur du clone **n'avance pas** avec celui de la partie.
 * Sans cela, le clone reprenait le flux au même endroit, et le lancer de **Dérive** tiré
 * pendant l'évaluation d'une Pression était **exactement** celui que la Pression réelle
 * allait tirer : la Direction savait d'avance qu'elle échouerait et renonçait à frapper.
 * La sous-graine ne dépend que de la **position visible** et de l'**index du coup** —
 * jamais de `state.rng` — donc à position égale le choix ne bouge pas quand la graine de
 * la partie change. Même traitement pour le **type de café** d'un Talent `attachEnergy`,
 * les **lancers du Contrôle** et le **café que la Machine adverse produit** dans
 * `endTurn`.
 *
 * Limite **assumée** : la politique évalue **un** côté du lancer, pas son espérance.
 * Une évaluation par espérance demanderait de connaître chaque lancer *à l'intérieur* du
 * moteur (Dérive, Contrôle, café du Talent, café adverse), donc de dupliquer ses
 * transitions ou d'en changer la sémantique : c'est une autre décision que ce ticket.
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

  // Un choix en attente (D-076) : la Direction en désigne la première option. Le choix
  // est déterministe ; une politique plus fine ne change pas le contrat du moteur.
  if (state.pendingChoice) {
    const choice = legalActions(state).find((action) => action.type === 'choose');
    return choice ?? null;
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
 * - `safety` : le **Seuil restant au Poste** — ce que mon Poste peut encore encaisser.
 *   La menace entrante n'y est **pas** soustraite : elle est comptée une seule fois,
 *   par `threat` (ticket #111).
 * - `hand` : la **taille de main** — une carte de plus, c'est une option de plus.
 * - `threat` : l'**échange de menace** — les dégâts que je peux porter **moins** ceux
 *   que je subis, au même poids : c'est une différence symétrique, pas un risque caché.
 * - `endTurn` : le **bonus de fin de tour** — l'anticipation de la carte que je piocherai
 *   au début de mon prochain tour. Il a son **propre** poids (ticket #111) : régler la
 *   valeur d'une carte en main ne doit pas déplacer l'arbitrage « jouer un coup de plus
 *   ou finir son tour ».
 */
export interface EvaluationWeights {
  points: number;
  board: number;
  rival: number;
  safety: number;
  hand: number;
  threat: number;
  endTurn: number;
}

/**
 * Poids **par défaut** de l'évaluation.
 *
 * Ils viennent de #93, réglés sur une mesure qui comptait les cafés **au nombre**.
 * #108 a corrigé cette mesure (`satisfiesCafeCost`), puis #113 a armé les Decks
 * `SUPPORT` et `INTERIM` du simulateur (types de café explicites) : **le gain de #93
 * n'est pas démontré**. Sur 600 parties appariées (graines 1, 7, 42, 99, 1234 ;
 * 60 parties par série et par sens), le camp de niveau 2 gagne **206** parties contre
 * **279** au niveau 1, avec 115 nulles (ratio 0,738). La mesure d'#108, sur les mêmes
 * graines, donnait 203 / 254 et 143 nulles — mais environ une partie sur trois
 * opposait alors un Deck **incapable d'attaquer**, donc elle ne mesurait pas la même
 * chose. Les poids restent ceux de #93 : un re-pesage mesuré, y compris sur des graines
 * de contrôle, est un travail distinct (rapports #108 et #113), et le niveau 1 reste le
 * défaut de l'écran comme du simulateur.
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
 *
 * **Deux défauts de modèle corrigés par #111**, avant tout re-pesage :
 *
 * - le bonus de fin de tour était `weights.hand` : régler la valeur d'une carte en main
 *   déplaçait **silencieusement** l'arbitrage « jouer un coup de plus ou finir son
 *   tour ». Il a désormais son poids propre (`endTurn`) et il est **nul quand la main
 *   est pleine** (10 cartes), puisque le camp qui termine ne piochera alors pas ;
 * - `safety` **et** `threat` soustrayaient tous deux la menace adverse (poids 4 + 3) :
 *   l'asymétrie n'était pas un choix, c'était la somme de deux réglages. `safety` ne
 *   compte plus que le **Seuil restant au Poste**, et `threat` est une différence
 *   **symétrique** (ma menace moins la sienne). Chaque menace est comptée **une fois**.
 */
export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeights = {
  points: 300,
  board: 3,
  rival: -0.8,
  safety: 4,
  hand: 4,
  threat: 3,
  endTurn: 4
};

/** Le camp adverse. */
function opponentOf(who: PlayerId): PlayerId {
  return who === 'player' ? 'ai' : 'player';
}

/**
 * Les cafés attachés qui **paient réellement** une Pression du Planqué.
 *
 * C'est le plus grand coût, **en nombre de cafés**, parmi les Pressions que les cafés
 * attachés couvrent — et c'est `satisfiesCafeCost` qui tranche, la **même** décision
 * que le moteur (`legalAttacks`, `attack`, `attackPreview`). Conséquences (ticket #108) :
 * un café d'un **autre type** ne compte pas, un café **au-delà** du coût maximal non
 * plus, et un Planqué dont aucun coût n'est payable ne compte aucun café utile — son
 * avancement partiel n'est pas encore une Pression.
 */
function paidCafes(instance: CardInstance): number {
  const card = getCard(instance.cardId);
  if (!isPlanque(card)) return 0;
  let best = 0;
  for (const attack of card.attacks) {
    if (satisfiesCafeCost(instance.energy, attack.cost)) {
      best = Math.max(best, attack.cost.length);
    }
  }
  return best;
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
    // Un café d'un autre type ne paie pas le coût (D-037) : `satisfiesCafeCost` est la
    // seule décision, celle que lit aussi le moteur (ticket #108).
    if (!satisfiesCafeCost(player.active.energy, attack.cost)) continue;
    const damage = attackDamage(player.active, defender, attack, 'poste');
    if (damage > best) best = damage;
  }

  const statuses = player.active.statuses;
  if (statuses.includes('IMMOBILISATION')) return 0;
  if (statuses.includes('SIESTE') || statuses.includes('DERIVE')) return best / 2;
  return best;
}

/**
 * **Sécurité du Poste** d'un camp : le **Seuil restant** au Poste, rien de plus.
 *
 * La menace adverse n'est **pas** soustraite ici (ticket #111) : elle est déjà dans
 * le terme `threat`, en différence symétrique. La soustraire aussi ici la comptait
 * deux fois, avec un poids 4 + 3 que personne n'avait choisi.
 */
function safetyOf(player: PlayerState): number {
  return player.active ? player.active.hp : 0;
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
 * 3. la **sécurité du Poste** (Seuil restant au Poste) ;
 * 4. la **taille de main** (écart) ;
 * 5. la **menace** (les dégâts que je peux porter, moins ceux que l'adversaire peut
 *    me porter — chaque menace comptée une seule fois, ticket #111).
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
    weights.safety * safetyOf(me) +
    weights.hand * (me.hand.length - opponent.hand.length) +
    weights.threat * (myThreat - opponentThreat)
  );
}

/** La main pleine (10 cartes) — la même limite que `draw` dans le moteur (§4). */
const HAND_LIMIT = 10;

/**
 * **Bonus de fin de tour** : la carte que le camp qui termine **piochera** au début de
 * son prochain tour. Après `endTurn`, l'adversaire a déjà pioché au début du sien ;
 * sans cette anticipation, finir son tour paraîtrait toujours moins bon que jouer un
 * coup de plus.
 *
 * Le bonus vaut `weights.endTurn`, et **zéro quand la main est pleine** : un camp à
 * 10 cartes ne piochera pas, le bonus serait faux (ticket #111). Il ne lit **pas**
 * `weights.hand` : la valeur d'une carte en main et l'arbitrage de fin de tour sont
 * deux réglages distincts.
 */
export function endTurnBonus(player: PlayerState, weights: EvaluationWeights): number {
  return player.hand.length >= HAND_LIMIT ? 0 : weights.endTurn;
}

/* ------------------------------------------------------------------ */
/* Niveau 2 — la Direction qui évalue                                 */
/* ------------------------------------------------------------------ */

/**
 * **Sous-graine d'évaluation** (ticket #114) : l'état de générateur que reçoit la copie
 * sur laquelle on essaie un coup.
 *
 * Elle ne dépend **jamais** de `state.rng` — c'est tout le point. Tant que l'évaluation
 * repartait du flux de la partie, le clone consommait **exactement** les tirages que
 * l'action réelle allait consommer : le lancer de **Dérive** de la Pression évaluée était
 * le lancer réel, et la politique savait d'avance si elle échouait. Elle ne dépend que de
 * la **position visible** (tour, Interventions) et de l'**index du coup** évalué, donc :
 * même position → même sous-graine → même évaluation, et le choix ne bouge pas quand la
 * **graine de la partie** change. La reproductibilité par graine reste donc entière
 * (`replayBattle` retombe sur la même partie).
 */
function evaluationRng(state: BattleState, index: number): RngState {
  const signature =
    state.turn * 31 + state.players.player.points * 7 + state.players.ai.points * 101 + index;
  return seedRng(signature);
}

/**
 * **Le meilleur coup évalué** : pour chaque action légale, on l'applique, on évalue
 * la position résultante, et on garde le meilleur score.
 *
 * - les actions viennent **de `legalActions`** : le niveau 2 ne peut donc pas
 *   produire une action que le moteur refuserait ;
 * - le **forfait** est exclu : c'est une décision humaine (D-030) ;
 * - une action **refusée** par le moteur (`applyAction` rend l'état d'entrée) est
 *   ignorée : elle ne change rien, elle ne peut pas être « la meilleure » ;
 * - `applyAction` **clone** l'état (`structuredClone`, la convention du moteur) : la
 *   copie est modifiée, la partie ne l'est pas. Et cette copie porte une **sous-graine
 *   dérivée** (`evaluationRng`) : l'évaluation ne consomme jamais le flux du jeu, donc
 *   elle ne peut pas lire le lancer que l'action réelle tirera (ticket #114).
 */
function bestEvaluatedAction(
  state: BattleState,
  legal: readonly BattleAction[],
  who: PlayerId,
  weights: EvaluationWeights = DEFAULT_EVALUATION_WEIGHTS
): BattleAction | null {
  let best: BattleAction | null = null;
  let bestScore = -Infinity;

  for (const [index, action] of legal.entries()) {
    if (action.type === 'forfeit') continue;
    // La copie d'essai **remplace** le générateur par une sous-graine dérivée : le
    // clone n'hérite donc pas du flux de la partie (ticket #114).
    const probe: BattleState = { ...state, rng: evaluationRng(state, index) };
    const after = applyAction(probe, action);
    // Refusée : `applyAction` rend **son** argument, c'est-à-dire la copie d'essai.
    if (after === probe) continue;

    let score = evaluatePosition(after, who, weights);

    // **Finir son tour** : l'adversaire pioche au début du sien, nous piocherons au
    // début du nôtre. Sans cette anticipation, « finir son tour » paraîtrait toujours
    // moins bien que « jouer un coup de plus » — alors que les deux camps piochent
    // autant. On rend donc la comparaison honnête, avec un poids **propre** et un
    // bonus **nul** quand la main est pleine (ticket #111, cf. `endTurnBonus`).
    if (action.type === 'endTurn') score += endTurnBonus(after.players[who], weights);

    // Premier arrivé, premier servi : à score égal, l'ordre de `legalActions` tranche.
    // C'est ce qui rend le niveau 2 déterministe.
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }

  return best;
}

/* ------------------------------------------------------------------ */
/* Recherche à deux coups — expérimentale (piste 2, `docs/ESSAIS-IA.md`) */
/* ------------------------------------------------------------------ */

/**
 * **Recherche à deux coups au niveau du tour**, expérimentale. Elle n'est **pas** le
 * niveau 2 : `nextAction(state, 2)` reste la référence mesurée (#93, #111). Elle n'est
 * branchée nulle part dans l'écran ; seul `scripts/pesage.mjs --direction recherche`
 * l'emploie, pour la mesurer dans le même harnais.
 *
 * **Pourquoi « au niveau du tour »** : une Pression, une fin de tour ou une relève ne
 * laissent pas la main à l'adversaire à chaque action ; un coup de la Direction n'est
 * donc pas suivi d'un coup adverse immédiat. La réponse adverse est **un tour entier** :
 * son premier coup légal, puis sa politique scriptée (`nextAction(…, 1)`) jusqu'à
 * sa fin de tour.
 *
 * Pour chaque décision de la Direction (`who`) :
 *
 * 1. **Élagage à un coup** : les actions légales sont notées comme le niveau 2 (même
 *    `evaluatePosition`, même `endTurnBonus`) ; on garde les `candidates` meilleures.
 * 2. **Mondes** : pour chaque candidat, on joue sur `worlds` mondes. Chaque monde remplace
 *    la **main** et le **Deck** de l'adversaire par un tirage dans le **pool des cartes
 *    inconnues** (`unknownPool`, §ci-dessous) — jamais par ses vraies cartes.
 * 3. **Ma suite** : le candidat, puis mon tour terminé par la politique scriptée.
 * 4. **Réponse adverse** : parmi ses coups légals dans le monde, les `replies` plus
 *    nocifs à un coup (évalués pour moi) sont joués **en entier** (politique scriptée).
 *    Le camp de la Direction prend le **pire** de ces tours pour lui (minimum).
 * 5. **Feuille** : la position au début de mon prochain tour, notée par
 *    `evaluatePosition` (le bonus de fin de tour n'a plus lieu d'être : la pioche est faite).
 *    Une partie finie vaut ±`SEARCH_WIN` (gagnée / perdue).
 *
 * La valeur d'un candidat est la **moyenne** des valeurs sur les mondes ; le meilleur
 * candidat gagne, à égalité le premier de l'élagage (déterministe).
 *
 * **Équité (règle centrale, `docs/ESSAIS-IA.md` §Équité)** :
 * - la décision ne lit **jamais** `state.players[adversaire].hand` ni `.deck` (contenu) :
 *   seuls leurs **comptes** (`hand.length`, `deck.length`), déjà visibles de la table ;
 * - le pool (`unknownPool`) est construit sans lire la main ni le Deck adverses : il ne
 *   retire que mes cartes (main, Deck) et les cartes **publiques** (Postes, Racks,
 *   défausses des deux camps) ;
 * - les tirages passent par un générateur **seedé** dérivé de la **graine de la partie**
 *   (`state.seed`) et du tour, jamais de `state.rng` : aucun tirage ne consomme le flux réel
 *   (même raison que #114 — la politique ne doit pas deviner le prochain lancer) ;
 * - aucun `Math.random()`, aucun uid nouveau dans le compteur global du moteur.
 */

/** Réglages de la recherche (le harnais en fait varier un par essai). */
export interface SearchOptions {
  /** Nombre de mes coups retenus après l'élagage à un coup. */
  candidates: number;
  /** Nombre de mondes tirés dans le pool des cartes inconnues. */
  worlds: number;
  /** Nombre de tours adverses joués en entier par monde (les plus nocifs à un coup). */
  replies: number;
}

/** Réglages par défaut de la recherche. Choisis avant toute mesure du contrôle (protocole). */
export const DEFAULT_SEARCH_OPTIONS: SearchOptions = { candidates: 6, worlds: 3, replies: 4 };

/** Valeur d'une victoire (ou défaite) dans la recherche : elle écrase toute évaluation. */
const SEARCH_WIN = 1_000_000;

/** Garde-fou : nombre maximal de coups joués dans un tour scripté. */
const CONTINUATION_CAP = 60;

/** Un coup noté à un coup : son score pour le camp `who`. */
interface ScoredMove {
  action: BattleAction;
  index: number;
  score: number;
}

/**
 * **Pool des cartes inconnues** du camp `who`, vu de sa place : chaque carte que le
 * catalogue permet (`MAX_COPIES_PER_NAME` exemplaires de chaque carte), **moins** celles
 * qu'il voit — sa main, son Deck, les Postes et Racks des deux camps, les défausses des
 * deux camps. Il reste donc exactement les cartes que l'adversaire peut tenir en main ou
 * en Deck. Ordre : celui de `ALL_CARDS`, donc déterministe.
 *
 * Approximation assumée : la règle des exemplaires est **par nom** (`deck.ts`), le pool la
 * compte **par identifiant** (une variante et sa base ne partagent pas leur quota ici).
 */
export function unknownPool(state: BattleState, who: PlayerId): string[] {
  const me = state.players[who];
  const opponent = state.players[opponentOf(who)];
  const seen = new Map<string, number>();
  const see = (card: CardInstance | null | undefined) => {
    if (card) seen.set(card.cardId, (seen.get(card.cardId) ?? 0) + 1);
  };
  me.hand.forEach(see);
  me.deck.forEach(see);
  [me.active, ...me.bench, opponent.active, ...opponent.bench].forEach(see);
  me.discard.forEach(see);
  opponent.discard.forEach(see);

  const pool: string[] = [];
  for (const card of ALL_CARDS) {
    const left = MAX_COPIES_PER_NAME - (seen.get(card.id) ?? 0);
    for (let copy = 0; copy < left; copy += 1) pool.push(card.id);
  }
  return pool;
}

/** Graine d'un tirage de la recherche : dérivée de la graine de la partie, jamais de `state.rng`. */
function searchSeed(state: BattleState, salt: number): RngState {
  return seedRng(Math.trunc(state.seed) + salt * 7919 + state.turn * 104729);
}

/**
 * **Monde** : copie de `state` où la main et le Deck du camp adverse sont tirés dans le
 * pool (`unknownPool`). Seuls les **comptes** de la main et du Deck adverses sont lus.
 * Les autres champs adverses (Postes, Racks, défausse, points, Machine) sont publics et
 * repris tels quels. Exporté pour le test d'équité (`ia-recherche.test.ts`) : le monde
 * tiré ne doit jamais dépendre du **contenu** de la main réelle de l'adversaire.
 */
export function sampleWorld(state: BattleState, who: PlayerId, index: number): BattleState {
  const opponentId = opponentOf(who);
  const hidden = state.players[opponentId];
  const handSize = hidden.hand.length;
  const deckSize = hidden.deck.length;

  const pool = unknownPool(state, who);
  const need = Math.min(pool.length, handSize + deckSize);
  // Tirage sans remise (Fisher–Yates partiel) : une carte ne sort jamais deux fois.
  const drawing = { rng: searchSeed(state, 2 * index + 1) };
  for (let i = 0; i < need; i += 1) {
    const j = i + Math.floor(drawRandom(drawing) * (pool.length - i));
    const kept = pool[i];
    pool[i] = pool[j] as string;
    pool[j] = kept as string;
  }

  const drawn = pool.slice(0, need);
  const hand = drawn
    .slice(0, handSize)
    .map((cardId, i) => createInstance(cardId, state.turn, `w${index}h${i}`));
  const deck = drawn
    .slice(handSize)
    .map((cardId, i) => createInstance(cardId, state.turn, `w${index}d${i}`));

  return {
    ...state,
    // Le monde joue avec son propre générateur : il ne consomme pas `state.rng`.
    rng: searchSeed(state, 2 * index + 2),
    log: [],
    actionLog: [],
    players: { ...state.players, [opponentId]: { ...hidden, hand, deck } }
  };
}

/**
 * Note chaque action légale **à un coup** pour le camp `who` (même critère que le niveau 2).
 * Le forfait est exclu ; une action refusée n'est pas notée. `bonus` ajoute le bonus de
 * fin de tour à la seule fin de tour (utile pour élaguer mes coups, pas pour les réponses).
 */
function scoreMoves(
  state: BattleState,
  legal: readonly BattleAction[],
  who: PlayerId,
  bonus: boolean
): ScoredMove[] {
  const moves: ScoredMove[] = [];
  legal.forEach((action, index) => {
    if (action.type === 'forfeit') return;
    const probe: BattleState = { ...state, rng: evaluationRng(state, index), log: [], actionLog: [] };
    const after = applyAction(probe, action);
    if (after === probe) return;
    let score = evaluatePosition(after, who);
    if (bonus && action.type === 'endTurn') {
      score += endTurnBonus(after.players[who], DEFAULT_EVALUATION_WEIGHTS);
    }
    moves.push({ action, index, score });
  });
  return moves;
}

/**
 * Joue la politique scriptée (niveau 1) **tant que** c'est au camp `side` de jouer, ou
 * tant qu'une relève est en attente (c'est alors `nextAction` qui tranche, pour l'un ou
 * l'autre camp). Rend l'état à la fin du tour, ou à la fin de la partie.
 */
function playOutTurn(state: BattleState, side: PlayerId): BattleState {
  let current = state;
  for (let step = 0; step < CONTINUATION_CAP; step += 1) {
    if (current.phase === 'ended') break;
    if (!current.pendingPromotion && current.current !== side) break;
    const action = nextAction(current, 1);
    if (!action) break;
    const after = applyAction(current, action);
    if (after === current) break;
    current = after;
  }
  return current;
}

/** Valeur d'une position pour `who` : la fin de partie l'emporte sur l'évaluation. */
function valueOf(state: BattleState, who: PlayerId): number {
  const outcome =
    state.phase !== 'ended' ? 0 : state.winner === who ? SEARCH_WIN : state.winner === null ? 0 : -SEARCH_WIN;
  return outcome + evaluatePosition(state, who);
}

/**
 * Valeur d'**un** coup `action` de `who` dans **un** monde : mon tour (coup + suite
 * scriptée), puis le pire tour adverse parmi les `replies` plus nocifs à un coup.
 */
function lineValue(world: BattleState, action: BattleAction, who: PlayerId, options: SearchOptions): number {
  const first = applyAction(world, action);
  if (first === world) return -Infinity;
  const mine = playOutTurn(first, who);
  // Partie finie, ou tour de `who` qui ne rend pas la main (garde-fou atteint) : pas de réponse.
  if (mine.phase === 'ended' || mine.current === who) return valueOf(mine, who);

  const opponentId = opponentOf(who);
  const replies = scoreMoves(mine, legalActions(mine), who, false)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, options.replies);

  let worst = Infinity;
  for (const reply of replies) {
    const next = applyAction(mine, reply.action);
    if (next === mine) continue;
    const leaf = playOutTurn(next, opponentId);
    worst = Math.min(worst, valueOf(leaf, who));
  }
  return worst === Infinity ? valueOf(mine, who) : worst;
}

/**
 * **Prochaine action de la recherche à deux coups** (expérimentale). Même contrat que
 * `nextAction` : rend une action de `legalActions` ou `null`. Une relève en attente est
 * tranchée par le niveau 2 (1 coup), la recherche ne porte que sur le tour.
 */
export function nextSearchAction(
  state: BattleState,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS
): BattleAction | null {
  if (state.phase === 'ended') return null;
  if (state.pendingPromotion) return nextAction(state, 2);

  const who = state.current;
  const candidates = scoreMoves(state, legalActions(state), who, true)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, options.candidates);
  const only = candidates[0];
  if (!only) return null;
  if (candidates.length === 1) return only.action;

  const worlds = Array.from({ length: options.worlds }, (_, index) => sampleWorld(state, who, index));
  let best: BattleAction = only.action;
  let bestValue = -Infinity;
  for (const candidate of candidates) {
    let total = 0;
    for (const world of worlds) total += lineValue(world, candidate.action, who, options);
    const value = total / worlds.length;
    if (value > bestValue) {
      best = candidate.action;
      bestValue = value;
    }
  }
  return best;
}
