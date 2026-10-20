import type { BattleAction, BattleState, PlayerId } from '@/data/types';
import { attackPreview, legalActions } from '@/game/engine';

/**
 * **IA de niveau 1 — la Direction** (scriptée, sobre, déterministe).
 *
 * Un seul endroit porte la politique : `nextAction` choisit, dans `legalActions`,
 * l'action suivante du camp au trait. Le simulateur (`@/game/simulation`) et l'écran
 * de combat (`@/pages/Battle`) la lisent tous les deux — aucune copie.
 *
 * Politique, dans l'ordre — celui de la simulation d'origine, préservé tel quel pour
 * que le rapport du simulateur ne bouge pas d'un tour :
 *
 * 1. jouer une **carte Action** utile (un Objet illimité ou le Collègue du tour) ;
 * 2. **évoluer**, en préférant le Poste ;
 * 3. **poser un Entrant** si le Poste est vide, sinon au premier Rack libre ;
 * 4. le **Talent** du Poste, une fois par tour ;
 * 5. **attacher un café** au Poste ;
 * 6. jouer la **meilleure Pression** abordable (dégâts effectifs) ;
 * 7. sinon, **fin de tour**.
 *
 * `nextAction` ne construit jamais une action « à la main » : elle part de
 * `legalActions(state)` et choisit dedans, donc elle ne peut pas produire une action
 * que le moteur refuserait. Aucun `Math.random()` : le hasard de la partie reste dans
 * l'`rng` seedé de `BattleState`.
 */

/**
 * Prochaine action de la politique, **sans garde de camp** : c'est le simulateur qui
 * l'emploie pour les deux camps, et c'est le socle de `nextAiAction`. Traite aussi la
 * **relève** (`pendingPromotion`), que le camp dont le Poste a craqué doit trancher.
 */
export function nextAction(state: BattleState): BattleAction | null {
  if (state.phase === 'ended') return null;

  if (state.pendingPromotion) {
    const who = state.pendingPromotion;
    const benchIndex = chooseBench(state, who);
    // Le moteur ne pose `pendingPromotion` que si le Rack n'est pas vide ; cette garde
    // évite une boucle si une future règle changeait ce contrat.
    if (benchIndex < 0) return null;
    return { type: 'promoteActive', benchIndex };
  }

  const legal = legalActions(state);

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
 */
export function nextAiAction(state: BattleState): BattleAction | null {
  if (state.phase === 'ended') return null;
  if (state.pendingPromotion) {
    return state.pendingPromotion === 'ai' ? nextAction(state) : null;
  }
  if (state.current !== 'ai') return null;
  return nextAction(state);
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
