import { Coffee, Swords } from 'lucide-react';
import { getCard, isPlanque } from '@/data';
import type { BattleAction, BattleState, CafeSymbol, PlayerId, PlayerState } from '@/data/types';
import { degatsDePression } from '@/game/engine';
import { CafePips } from '@/components/CafePips';
import { cardName, instanceName } from '@/combat/cartes';

/**
 * La carte qu'une action `choose` **désigne** (#171, D-076, D-080, D-082) : elle vit
 * là où le choix en attente la cherche — la main (défausse), le Banc (café) ou le
 * Deck (recherche). Le nom est ce que le bouton montre ; `undefined` s'il a disparu.
 */
function choixName(side: PlayerState, uid: string): string | undefined {
  const instance = [...side.hand, ...side.bench, ...side.deck].find((carte) => carte?.uid === uid);
  return instance ? cardName(instance.cardId) : undefined;
}

/** Le coût d'une Rotation, en mots : le nombre de cafés que le Poste défausse (D-033). */
function coutRotation(cafes: number): string {
  if (cafes === 0) return 'aucun café';
  return `${cafes} café${cafes > 1 ? 's' : ''}`;
}

/** Ce qu'un bouton d'action affiche, dérivé de l'action elle-même et de l'état. */
interface ActionView {
  label: string;
  detail?: string;
  /** Le coût **typé** d'une Pression (D-037) : pastilles de `CafePips`, pas des points. */
  cafes?: readonly CafeSymbol[];
  /** Le Stress **appliqué** à la cible (Vulnérabilité et réduction comprises), pas le chiffre imprimé. */
  damage?: number;
  /**
   * Ce qui sépare le chiffre imprimé du Stress appliqué : `+20 vuln.` ou `−10`.
   * Il est **écrit** à côté du total (critique du 31/10/2026) : sans lui, le joueur ne peut pas
   * savoir pourquoi 20 devient 40, et la règle de Vulnérabilité reste à mémoriser.
   */
  note?: string;
  icon?: 'coffee' | 'swords';
}

/**
 * Le libellé d'une action, **à partir de l'action seule** : l'écran n'a pas de liste
 * écrite à la main, donc une transition ajoutée au moteur apparaît ici sans être
 * oubliée (ticket #58). Les noms viennent du vocabulaire d'`docs/JEU.md` §3.
 *
 * `myCamp` sert aux deux libellés qui nomment un camp — la relève et la fin de tour
 * (#125) : en solo il vaut `player`, donc le texte d'avant ne bouge pas.
 */
function describeAction(state: BattleState, action: BattleAction, myCamp: PlayerId): ActionView {
  const side = state.players[state.current];
  const handCard = (uid: string) => side.hand.find((card) => card.uid === uid);
  const handDefinition = (uid: string) => {
    const card = handCard(uid);
    return card ? getCard(card.cardId) : undefined;
  };
  const posted = (uid: string) => [side.active, ...side.bench].find((card) => card?.uid === uid) ?? null;
  const activeCard = side.active ? getCard(side.active.cardId) : undefined;

  switch (action.type) {
    /*
     * **Poser, c'est un geste à deux temps** (#169) : on choisit la carte dans la main, puis
     * on dit **où** elle va. Le libellé porte donc le lieu — « Poser au Poste », « Mettre
     * au Banc 2 » — et plus le nom de la carte, que le panneau de pose rappelle déjà.
     */
    case 'playBasic':
      return { label: action.slot === 'active' ? 'Poser au Poste' : `Mettre au Banc ${Number(action.slot) + 1}` };
    case 'playAction': {
      // On lit la **nature** de la carte, pas son libellé : comparer `kindLabel(…)` à
      // « Objet » faisait dépendre un bouton d'une chaîne d'affichage, et un Objet MRO
      // aurait proposé « Jouer ce Collègue » (#248).
      const jouee = handDefinition(action.uid);
      return { label: jouee?.kind === 'OBJET' ? 'Jouer cet Objet' : 'Jouer ce Collègue' };
    }
    case 'evolve':
      return {
        label: 'Faire évoluer',
        detail: `${instanceName(posted(action.targetUid))} → ${instanceName(handCard(action.uid))}`
      };
    case 'priorityShift':
      return { label: 'Changement de priorité', detail: `archiver ${instanceName(handCard(action.uid))}` };
    case 'attachEnergy':
      return { label: 'Attacher 1 café', detail: instanceName(posted(action.targetUid)), icon: 'coffee' };
    /*
     * **Une cible par Planqué du Banc** (#455, D-147) : la barre n'en porte qu'une entrée, et le
     * panneau du Poste liste ces cibles. Chacune nomme le Planqué qui monte et le coût, c'est-à-dire
     * les cafés que le Poste défausse (`retreat`, la règle n'y change rien).
     */
    case 'retreat': {
      const cout = activeCard && isPlanque(activeCard) ? activeCard.retreat : 0;
      return {
        label: 'Rotation',
        detail: `vers ${instanceName(side.bench[action.benchIndex])} · coût ${coutRotation(cout)}`,
        icon: 'coffee'
      };
    }
    case 'ability': {
      const ability = activeCard && isPlanque(activeCard) ? activeCard.ability : undefined;
      return { label: 'Talent', detail: ability?.name };
    }
    case 'attack': {
      const entry = activeCard && isPlanque(activeCard) ? activeCard.attacks[action.attackIndex] : undefined;
      /*
       * Le chiffre du bouton est le **Stress appliqué**, pas celui imprimé sur la carte
       * (critique du 31/10/2026, P1) : la Vulnérabilité ajoute +20 et la défense du défenseur
       * en retire. Le calcul vient du moteur (`degatsDePression`), donc il ne peut pas diverger
       * de ce que `applyAction` fera.
       */
      const defenseur = state.players[state.current === 'player' ? 'ai' : 'player'].active;
      const degats =
        side.active && defenseur && entry ? degatsDePression(side.active, defenseur, entry, 'poste') : undefined;
      const note = degats
        ? degats.vulnerabilite > 0
          ? `+${degats.vulnerabilite} vuln.`
          : degats.reduction > 0
            ? `−${degats.reduction}`
            : undefined
        : undefined;
      return {
        label: entry?.name ?? 'Pression',
        cafes: entry?.cost,
        damage: degats?.applique ?? entry?.damage,
        note,
        icon: 'swords'
      };
    }
    case 'promoteActive': {
      const who = state.pendingPromotion ?? state.current;
      const prefix = who === myCamp ? '' : 'Direction · ';
      return {
        label: 'Relève',
        detail: `${prefix}${instanceName(state.players[who].bench[action.benchIndex])} au Poste`
      };
    }
    case 'forfeit':
      return { label: 'Abandonner' };
    /*
     * Un choix en attente (D-076, D-080, D-082) : le bouton **nomme la carte qu'il
     * désigne** (#171) — la carte de la main, le Planqué du Deck, celui du Banc. Le
     * choix appartient à `pendingChoice.who`, qui n'est pas forcément le camp au trait.
     */
    case 'choose': {
      const who = state.pendingChoice?.who ?? state.current;
      return { label: 'Choisir cette carte', detail: choixName(state.players[who], action.uid) };
    }
    case 'endTurn':
      return { label: state.current === myCamp ? 'Fin du tour' : 'Passer le tour de la Direction' };
  }
}

/**
 * Un bouton par action rendue par `legalActions` (ticket #58). Aucun bouton n'est
 * jamais désactivé : ce qui n'est pas dans la liste n'est pas affiché, donc l'écran
 * ne peut pas griser une action que le moteur accepterait, ni en offrir une qu'il
 * refuse.
 */
export function ActionButton({
  state,
  action,
  myCamp,
  onAction
}: {
  state: BattleState;
  action: BattleAction;
  myCamp: PlayerId;
  onAction: (action: BattleAction) => void;
}) {
  const view = describeAction(state, action, myCamp);
  /* « Fin du tour » porte l'état de la main (#190) : vert quand c'est à toi, rouge sinon. */
  const fin = action.type === 'endTurn' ? ` button--fin ${state.current === myCamp ? 'is-a-toi' : 'is-direction'}` : '';
  return (
    <button
      type="button"
      className={`button ${action.type === 'attack' ? 'button--primary' : ''}${fin}`}
      onClick={() => onAction(action)}
    >
      {view.icon === 'coffee' && <Coffee size={16} />}
      {view.icon === 'swords' && <Swords size={16} />}
      <span>{view.label}</span>
      {view.cafes && <CafePips symbols={view.cafes} />}
      {/* Le dégât se **lit** « 20 de Stress » : un nombre nu ne dit rien à un lecteur d'écran (WCAG, nom, rôle, valeur). */}
      {view.damage !== undefined && (
        <>
          <span className="attack__dmg" aria-hidden="true">
            {view.damage}
          </span>
          {/* Ce qui sépare le chiffre imprimé du Stress appliqué (critique du 31/10/2026) :
              le total seul laisserait croire à une erreur de carte. */}
          {view.note && (
            <span className="attack__note" aria-hidden="true">
              {view.note}
            </span>
          )}
          <span className="sr-only">
            , {view.damage} de Stress
            {view.note ? (view.note.startsWith('+') ? ', Vulnérabilité comprise' : ', réduction comprise') : ''}
          </span>
        </>
      )}
      {/* Un espace entre le libellé et le détail : le nom accessible dit « Rotation vers … », pas
          « Rotationvers … » (#455). Il est invisible en `flex`. */}
      {view.detail && (
        <>
          {' '}
          <span className="button__detail">{view.detail}</span>
        </>
      )}
    </button>
  );
}
