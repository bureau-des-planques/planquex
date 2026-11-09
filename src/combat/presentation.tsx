import { getCard, isPlanque, kindLabel } from '@/data';
import type { AttackEffect, BattleState, Card, PlayerId } from '@/data/types';
import { dessusDuDeck } from '@/game/engine';
import { POINTS_TO_WIN } from '@/game/rules';
import { campToAct } from '@/store/pvp';

/** Une liste d'effets porte-t-elle le regard `peek` (D-079) ? */
const porteUnRegard = (effects: readonly AttackEffect[] | undefined) =>
  (effects ?? []).some((effect) => effect.kind === 'peek');

/**
 * **Le dessus du Deck, tel que le joueur vient de le regarder** (#162, D-079, #171).
 *
 * Le moteur ne garde **aucune trace** d'un regard : ni champ d'état, ni ligne de
 * journal — c'est le prix de la confidentialité, et D-079 le veut ainsi. L'écran le
 * déduit donc du **dernier geste appliqué** (`actionLog`, qui rejoue à l'identique
 * après un rechargement) :
 * - un Collègue qui regarde est au **Rebut de son propriétaire**, avec son uid : le
 *   Rebut de l'autre camp ne le porte pas, donc rien ne fuit ;
 * - une Pression qui regarde termine le tour : l'attaquant est le camp qui vient de
 *   passer la main, et il est encore au Poste (une Pression part du Poste).
 *
 * Un regard dure le temps de ce geste : le geste suivant l'efface. `dessusDuDeck` ne
 * rend toujours que le Deck du camp demandé.
 */
export function regardDuDernierGeste(state: BattleState, who: PlayerId): Card | undefined {
  const geste = state.actionLog.at(-1)?.action;
  if (!geste) return undefined;
  const side = state.players[who];

  if (geste.type === 'playAction') {
    const jouee = side.discard.find((carte) => carte.uid === geste.uid);
    const definition = jouee ? getCard(jouee.cardId) : undefined;
    return definition && !isPlanque(definition) && porteUnRegard(definition.effects)
      ? dessusDuDeck(state, who)
      : undefined;
  }

  if (geste.type === 'attack') {
    if (state.current === who) return undefined;
    const definition = side.active ? getCard(side.active.cardId) : undefined;
    const regarde =
      definition && isPlanque(definition) && porteUnRegard(definition.attacks[geste.attackIndex]?.effects);
    return regarde ? dessusDuDeck(state, who) : undefined;
  }

  return undefined;
}

/**
 * **Ce que tu viens de regarder** (#162, D-079) : le dessus de **ton** Deck, nommé, dans
 * une section privée — hors de la main et hors du journal, qui sont lus des deux camps.
 * La section ne dit rien de l'adversaire : `dessusDuDeck` ne rend que le Deck demandé.
 */
export function RegardDuDessus({ carte }: { carte: Card }) {
  return (
    <section className="notice regard" aria-label="Dessus de ton Deck, que tu viens de regarder">
      <p>
        <span className="muted">Dessus de ton Deck, pour toi seul :</span> <strong>{carte.name}</strong>
      </p>
      <p className="muted">{kindLabel(carte)}</p>
    </section>
  );
}

/**
 * **Qui joue**, en solo, dans l'en-tête du combat. C'est `campToAct` qui décide, comme pour les
 * boutons : une relève en attente appartient au camp qui doit la choisir, même pendant le tour
 * de l'autre. Lire `state.current` affichait « à la Direction » pendant que le testeur devait
 * choisir sa relève — trouvé par le harnais de partie jouée (#424).
 */
export function libelleDuTour(state: BattleState): string {
  if (state.phase === 'ended') return 'partie terminée';
  return campToAct(state) === 'player' ? 'à toi' : 'à la Direction';
}

/**
 * Le bandeau de fin dit **pourquoi** la partie s'arrête (#84) : le moteur pose la raison
 * (`endReason`), l'écran ne la déduit plus du seul vainqueur.
 *
 * `myCamp` vaut `null` en solo et le camp que je tiens en partie à deux (#125) : « tu »
 * et « la Direction » y deviennent « je » et « l'autre camp », sinon le bandeau dirait à
 * l'un des deux joueurs qu'il est la Direction.
 */
export function endBanner(state: BattleState, myCamp: PlayerId | null): string {
  const versus = myCamp !== null;
  const won = state.winner === (myCamp ?? 'player');
  const other = versus ? 'l’autre camp' : 'la Direction';
  switch (state.endReason) {
    case 'interventions':
      return won
        ? `Victoire : ${POINTS_TO_WIN} Interventions.`
        : `Défaite : ${versus ? 'le camp adverse' : 'la Direction'} marque ${POINTS_TO_WIN} Interventions.`;
    case 'plateauVide':
      return won ? `Victoire : ${other} n’a plus aucun Planqué.` : 'Défaite : tu n’as plus aucun Planqué.';
    case 'forfait':
      return won ? `Victoire : ${other} déclare forfait.` : 'Défaite : tu as déclaré forfait.';
    case 'limiteDeTours':
      return 'Égalité : la limite de tours est atteinte.';
    case null:
      // Une partie terminée porte toujours une raison : ce cas n'arrive que sur un état forgé.
      return won ? 'Victoire.' : state.winner === null ? 'Égalité.' : 'Défaite.';
    default: {
      // **Exhaustif, et il doit le rester** : ajouter une raison de fin au moteur sans lui
      // donner de phrase ici casse la compilation, au lieu de tomber en silence sur un
      // bandeau générique (#84, revue du 29/10/2026).
      const jamais: never = state.endReason;
      return jamais;
    }
  }
}
