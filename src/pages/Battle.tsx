import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ClipboardPaste, Coffee, Copy, Flag, Info, RotateCcw, ScrollText, Swords, Users } from 'lucide-react';
import { ALL_CARDS, FACTION_META, getCard, isBasic, isPlanque, kindLabel } from '@/data';
import type {
  AttackEffect,
  BattleAction,
  BattleState,
  CafeSymbol,
  CafeType,
  Card,
  CardInstance,
  PlayerId,
  PlayerState,
  Status
} from '@/data/types';
import { applyAction, createBattle, dessusDuDeck, legalActions, legalAttacks } from '@/game/engine';
import { DECK_SIZE, MAX_COPIES_PER_NAME, deckLegal } from '@/game/deck';
import { HAND_LIMIT, POINTS_TO_WIN } from '@/game/rules';
import { useStore } from '@/store/useStore';
import { partieSauvegardee, reprendrePartie } from '@/store/partie';
import type { Decks, Reprise } from '@/store/partie';
import { combatTermine, tracerCombat } from '@/store/combats';
import {
  aiTurnAction,
  CAMP_NAME,
  campLine,
  campToAct,
  createMatch,
  handover,
  joinMatch,
  matchCode,
  otherCamp
} from '@/store/pvp';
import type { Match } from '@/store/pvp';
import { STATUS_META, StatusBadge } from '@/components/StatusBadge';
import { CafeDot, cafeLabel, CafePips } from '@/components/CafePips';
import { CardView } from '@/components/CardView';
import { CarteSurvolable, FicheCarte, InspecteurCombat } from '@/components/InspecteurCombat';
import { Confirmation } from '@/components/Confirmation';
import { PasAPasCombat } from '@/components/PasAPasCombat';
import { comportementDeDefilement, usePasAPasCombat } from '@/components/use-pas-a-pas-combat';
import type { PasAPasCombatEtat } from '@/components/use-pas-a-pas-combat';
import { MenuCombat } from '@/components/MenuCombat';
import { PisteInterventions } from '@/components/PisteInterventions';
import { useEffetsDeCombat } from '@/components/effets-combat';
import { SceneAttaque } from '@/animation/SceneAttaque';
import type { EffetCombat } from '@/components/effets-combat';
import { useMouvementReduit } from '@/components/use-mouvement-reduit';
import type { EtatMenu } from '@/components/MenuCombat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

/**
 * Deck de test, quand le deck du joueur n'est pas encore valide : 8 cartes
 * Action (2 Objets et 2 Collègues distincts, en double) puis des Planqués, en
 * commençant par les Entrants.
 *
 * Les cartes Action y sont volontairement : depuis le ticket #58 la main est
 * affichée et ses cartes se jouent, et un deck de démonstration sans aucun
 * Objet ne montrerait jamais cette partie de l'écran.
 */
function testDeck(): string[] {
  const planques = ALL_CARDS.filter(isPlanque).filter((card) => !card.variantOf);
  const ordered = [...planques.filter(isBasic), ...planques.filter((card) => !isBasic(card))];
  const actionCards = ALL_CARDS.filter((card) => !isPlanque(card)).filter((card) => !card.variantOf);
  const showcase = [
    ...actionCards.filter((card) => card.kind === 'OBJET').slice(0, 2),
    ...actionCards.filter((card) => card.kind === 'COLLEAGUE').slice(0, 2)
  ];
  const deck: string[] = [];
  for (const card of showcase) deck.push(card.id, card.id);
  for (const card of ordered) {
    if (deck.length >= DECK_SIZE) break;
    deck.push(card.id);
    if (deck.length < DECK_SIZE) deck.push(card.id);
  }
  return deck.slice(0, DECK_SIZE);
}

function cardName(cardId: string): string {
  return getCard(cardId)?.name ?? 'Carte inconnue';
}

/** Le nom d'une instance, sans mentir quand elle a disparu de l'état. */
function instanceName(instance: CardInstance | null | undefined): string {
  return instance ? cardName(instance.cardId) : 'un Planqué';
}

/**
 * La carte qu'une action `choose` **désigne** (#171, D-076, D-080, D-082) : elle vit
 * là où le choix en attente la cherche — la main (défausse), le Banc (café) ou le
 * Deck (recherche). Le nom est ce que le bouton montre ; `undefined` s'il a disparu.
 */
function choixName(side: PlayerState, uid: string): string | undefined {
  const instance = [...side.hand, ...side.bench, ...side.deck].find((carte) => carte?.uid === uid);
  return instance ? cardName(instance.cardId) : undefined;
}

/**
 * Un Planqué **sur le plateau** (D-093, #187) : la carte du gabarit, figée, avec son Stress
 * vivant (`hp` reste le champ technique du moteur ; le Stress est ce que le joueur lit, D-026).
 * Le groupe porte le **nom** du Planqué : c'est par lui qu'on le retrouve, au Poste comme au
 * Banc. Sans définition connue, le nom seul reste lisible.
 */
function CartePlateau({
  instance,
  className,
  machine,
  inspectee,
  annotations = false,
  effets = [],
  dansScene = false,
  onInspecter
}: {
  instance: CardInstance;
  className: string;
  /** Le texte de la Machine du camp, pour le Poste : il entre dans l'inspecteur (#188). */
  machine?: string;
  /** Cette carte est celle que le panneau montre. */
  inspectee: boolean;
  /** Le mode `détaillé` du combat (#189) : les Pressions et le chiffre du Stress reviennent. */
  annotations?: boolean;
  /** Les effets de la scène qui visent cette instance (#192) : un chiffre de Stress, pas plus. */
  effets?: readonly EffetCombat[];
  /**
   * C'est **la cible de la Pression en cours** : la scène dessine son chiffre à l'impact, donc
   * le chiffre du DOM s'efface pour ne pas en afficher deux (D-098). Les autres chiffres —
   * Surcharge et Épuisement au Contrôle, dégâts sur soi — restent visibles.
   */
  dansScene?: boolean;
  onInspecter: () => void;
}) {
  const nom = cardName(instance.cardId);
  const definition = getCard(instance.cardId);
  if (!definition) return <span className="muted">{nom}</span>;
  return (
    <CarteSurvolable
      uid={instance.uid}
      nom={nom}
      className={className}
      inspectee={inspectee}
      onInspecter={onInspecter}
      fiche={<FicheCarte instance={instance} card={definition} machine={machine} />}
    >
      <CardView
        card={definition}
        figee
        plateau
        annotations={annotations}
        stress={instance.maxHp - instance.hp}
        seuil={instance.maxHp}
      />
      {/* Le chiffre de Stress (#192) : il naît avec l'instance touchée, vit 700 ms et quitte le
          DOM. `aria-hidden` : l'information est déjà dans la barre de Stress et au journal. */}
      {effets.map((effet) => (
        <span
          key={effet.id}
          className={`stress-flottant${effet.anime ? '' : ' is-fixe'}${dansScene ? ' is-scene' : ''}`}
          aria-hidden="true"
        >
          +{effet.valeur}
        </span>
      ))}
    </CarteSurvolable>
  );
}

/**
 * Localiser une instance **sur le plateau** : son camp, et si elle est au Poste ou au Banc (et
 * à quelle place). `null` si elle n'y est plus — la carte est morte ou a changé de zone.
 */
function localiser(
  state: BattleState,
  uid: string
): { camp: PlayerId; carte: CardInstance; auPoste: boolean; rang: number } | null {
  for (const camp of ['player', 'ai'] as const) {
    const side = state.players[camp];
    if (side.active?.uid === uid) return { camp, carte: side.active, auPoste: true, rang: -1 };
    const rang = side.bench.findIndex((carte) => carte?.uid === uid);
    const carte = side.bench[rang];
    if (rang >= 0 && carte) return { camp, carte, auPoste: false, rang };
  }
  return null;
}

/**
 * Les gestes qu'une carte **porte**, pris dans la liste du moteur : attacher un café, évoluer,
 * Talent (au Poste), Rotation (vers elle, ou depuis le Poste), relève (depuis le Banc). Rien d'autre :
 * un geste qui n'est pas dans la liste n'est pas offert (SPEC-COMBAT-UI §6.4).
 */
function gestesDeLaCarte(
  actions: readonly BattleAction[],
  uid: string,
  auPoste: boolean,
  rang: number
): BattleAction[] {
  return actions.filter((action) => {
    switch (action.type) {
      case 'attachEnergy':
      case 'evolve':
        return action.targetUid === uid;
      case 'ability':
        return auPoste;
      case 'retreat':
        return auPoste || action.benchIndex === rang;
      case 'promoteActive':
        return action.benchIndex === rang;
      default:
        return false;
    }
  });
}

/** Les cinq conditions, dans l'ordre d'affichage de la légende. */
const STATUS_LIST = Object.keys(STATUS_META) as Status[];

/**
 * **La leçon du critère WCAG sur les raccourcis à une touche** (#189, `SPEC-COMBAT-UI` §4.2) : un raccourci à une touche est
 * neutralisé dans un champ de saisie, sinon « i » devient une commande au milieu d'un code
 * de partie à deux. Le test couvre les deux zones de texte du code.
 */
function dansUnChampDeSaisie(cible: EventTarget | null): boolean {
  return cible instanceof Element && cible.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

/** Le menu `⋯` au repos : fermé, sur sa liste. */
const MENU_FERME: EtatMenu = { ouvert: false, vue: 'racine' };

/**
 * Les cafés **attachés** d'un Planqué, en pastilles typées (D-037) : chaque pastille
 * porte la couleur de sa faction, vide si rien n'est attaché.
 */
function CafesPips({ cafes }: { cafes: readonly CafeSymbol[] }) {
  const names = cafes.map((cafe) => cafeLabel(cafe));
  return (
    <CafePips
      symbols={cafes}
      label={names.length > 0 ? `Cafés attachés : ${names.join(' · ')}` : 'Aucun café attaché'}
    />
  );
}

/**
 * La **Machine à café** d'un camp : au plus un café typé (D-034) — pastille colorée
 * du type produit, ou pastille vide quand rien n'est à attacher. Le survol rappelle
 * les **types du Deck** (1 à 3, D-037 (4)) dont la Machine tire le café.
 */
function MachinePips({
  side,
  designe = false,
  detaille = false
}: {
  side: PlayerState;
  /** Le pas-à-pas du combat (#143) désigne la Machine du joueur, pas celle de la Direction. */
  designe?: boolean;
  /** Le mode `détaillé` (#189) remet les **types du Deck** à côté de la pastille. */
  detaille?: boolean;
}) {
  const zone = side.energyZone;
  const types = side.cafeTypes.map((type) => FACTION_META[type].name).join(' · ');
  // La Machine se **lit** dans l'inspecteur du Poste (#188) : sur le plateau, seule sa pastille
  // reste — sans le mot « Machine », qui ne dit plus rien à côté de la carte. Le texte est lu
  // par le nom accessible, comme l'ancien `title` (SPEC-COMBAT-UI §6.7). En `détaillé`, les
  // types du Deck sont une annotation visible (#189).
  return (
    <span className="poste__machine" data-pas-a-pas={designe ? 'machine' : undefined}>
      <span aria-hidden="true">{zone ? <CafeDot cafe={zone} /> : <i className="pip pip--free" />}</span>
      <span className="sr-only">{texteMachine(side)}</span>
      {detaille && <span className="poste__machine-types">{types || 'aucun type particulier'}</span>}
    </span>
  );
}

/** La Machine à café d'un camp, dite en une phrase : le café produit, les types du Deck (D-037 (4)). */
function texteMachine(side: PlayerState): string {
  const types = side.cafeTypes.map((type) => FACTION_META[type].name).join(' · ');
  return `Machine à café : ${side.energyZone ? cafeLabel(side.energyZone) : 'vide'} (types du Deck : ${types || 'aucun'})`;
}

/** Ce qu'un bouton d'action affiche, dérivé de l'action elle-même et de l'état. */
interface ActionView {
  label: string;
  detail?: string;
  /** Le coût **typé** d'une Pression (D-037) : pastilles de `CafePips`, pas des points. */
  cafes?: readonly CafeSymbol[];
  damage?: number;
  icon?: 'coffee' | 'swords';
}

/**
 * Le libellé d'une action, **à partir de l'action seule** : l'écran n'a pas de liste
 * écrite à la main, donc une transition ajoutée au moteur apparaît ici sans être
 * oubliée (ticket #58). Les noms viennent du vocabulaire d'`AGENTS.md` §3.
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
    case 'retreat':
      return { label: 'Rotation', detail: `vers ${instanceName(side.bench[action.benchIndex])}`, icon: 'coffee' };
    case 'ability': {
      const ability = activeCard && isPlanque(activeCard) ? activeCard.ability : undefined;
      return { label: 'Talent', detail: ability?.name };
    }
    case 'attack': {
      const entry = activeCard && isPlanque(activeCard) ? activeCard.attacks[action.attackIndex] : undefined;
      return {
        label: entry?.name ?? 'Pression',
        cafes: entry?.cost,
        damage: entry?.damage,
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
function ActionButton({
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
      {view.damage !== undefined && <span className="attack__dmg">{view.damage}</span>}
      {view.detail && <span className="button__detail">{view.detail}</span>}
    </button>
  );
}

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
function regardDuDernierGeste(state: BattleState, who: PlayerId): Card | undefined {
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
function RegardDuDessus({ carte }: { carte: Card }) {
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
 * **Un camp du plateau** (#169, #187) : le Poste (une carte) et le Banc (trois cartes) se
 * côtoient sur une ligne, le Poste à gauche, pour les deux camps : les deux Postes sont sur
 * le même axe vertical. La hauteur est comptée : il faut que les deux camps, la main et les
 * actions se voient d'un coup sur un téléphone (`npm run capturer`).
 *
 * Le pas-à-pas désigne le Poste, la Machine et les Interventions **du joueur seulement**
 * (`mine`) : l'adversaire n'a jamais d'attribut `data-pas-a-pas`.
 */
function Camp({
  label,
  side,
  current,
  mine,
  pendingPromotion,
  pasAPas,
  inspecte,
  detaille,
  effets = [],
  cibleScene,
  deckDeTest = false,
  onInspecter
}: {
  label: string;
  side: PlayerState;
  /** Le camp qui a la main : son cadre s'allume. */
  current: boolean;
  mine: boolean;
  /** Vrai quand ce camp attend de choisir sa relève. */
  pendingPromotion: boolean;
  pasAPas: PasAPasCombatEtat;
  /** Le `uid` de la carte que le panneau montre, ou `null` (#188). */
  inspecte: string | null;
  /** La densité du combat (#189) : annotations sur le Poste et sur la Machine. */
  detaille: boolean;
  /** Les effets de la scène qui touchent **ce** camp (#192). */
  effets?: readonly EffetCombat[];
  /** Le `uid` de la cible de la Pression en cours : c'est elle que la scène anime (D-098). */
  cibleScene?: string;
  /**
   * Ce camp joue le **deck de test**, parce que le Deck du joueur n'est pas valide (D-103, #243).
   * L'avertissement tenait sur sa propre ligne (30 px) ; il est désormais une étiquette de la
   * fiche du camp, où la place existait déjà.
   */
  deckDeTest?: boolean;
  onInspecter: (uid: string) => void;
}) {
  const effetsStress = effets.filter((effet) => effet.nature === 'stress');
  const craquage = effets.find((effet) => effet.nature === 'craquage');
  const pioche = effets.some((effet) => effet.nature === 'pioche');
  const uidsEnJeu = new Set([side.active, ...side.bench].filter(Boolean).map((carte) => carte!.uid));
  // Un Planqué qui vient de craquer n'a plus de carte au Poste : son chiffre de Stress reste
  // à la place de la carte, sur le fantôme désaturé, plutôt que de disparaître avec elle.
  const stressHorsCarte = effetsStress.filter((effet) => effet.auPoste && (!effet.uid || !uidsEnJeu.has(effet.uid)));
  const craquageDefinition = craquage ? getCard(craquage.carte?.cardId ?? '') : undefined;
  // Le Poste : la carte, en grand, au centre du camp (R4). Le nom et la barre de Stress sont
  // **sur** la carte. Le mot « Poste » est lu, pas affiché : la hauteur du plateau est comptée par
  // la garde (`npm run capturer`), et une étiquette de plus la ferait déborder.
  const posteActif = side.active;
  // **La Pression** est jouée par la scène (D-098) : le cabrage, le trait et l'anneau d'impact
  // du CSS de #207 ont disparu, sinon deux animations se superposeraient. Ce qui reste ici, et
  // qui ne dépend d'aucun mouvement, c'est le **chiffre de Stress** (`effetsStress`).
  const poste = (
    <div className="board__poste" data-pas-a-pas={mine ? pasAPas.designe('poste') : undefined}>
      <span className="sr-only">Poste</span>
      {posteActif ? (
        <CartePlateau
          instance={posteActif}
          className="poste__carte"
          machine={texteMachine(side)}
          inspectee={inspecte === posteActif.uid}
          annotations={detaille}
          effets={effetsStress.filter((effet) => effet.uid === posteActif.uid)}
          dansScene={cibleScene === posteActif.uid}
          onInspecter={() => onInspecter(posteActif.uid)}
        />
      ) : (
        <strong className="muted poste__libre">
          {pendingPromotion ? 'Aucun Planqué — relève à choisir' : 'Poste libre'}
        </strong>
      )}
      {/* Le craquage (#192) : la carte tombée reste une fraction de seconde, désaturée, à la
          place qu'elle occupait — et son chiffre de Stress avec elle. Le bandeau « a craqué »
          et le journal restent les porteurs de l'information sous mouvement réduit. */}
      {craquage && craquage.auPoste && (
        <div className="craquage__carte" data-uid={craquage.uid} aria-hidden="true">
          {craquageDefinition && <CardView card={craquageDefinition} figee plateau />}
        </div>
      )}
      {stressHorsCarte.map((effet) => (
        <span key={effet.id} className={`stress-flottant${effet.anime ? '' : ' is-fixe'}`} aria-hidden="true">
          +{effet.valeur}
        </span>
      ))}
    </div>
  );

  // La fiche du camp, **à côté** de la carte du Poste et non au-dessus (#199) : le nom du camp, ses
  // piles, puis ce qui se passe au Poste (Stress écrit, cafés, Machine, Conditions). Le camp tient
  // ainsi en deux rangées, et non en trois : c'est ce qui rend la hauteur au plateau.
  const fiche = (
    <div className="board__fiche">
      <header className="board__head">
        <h2>{label}</h2>
        <span className="board__counts muted">main {side.hand.length}</span>
        {deckDeTest && (
          <span
            className="board__test"
            title={`Un deck valide : ${DECK_SIZE} cartes, ${MAX_COPIES_PER_NAME} exemplaires max, 1 Entrant minimum.`}
          >
            <span aria-hidden="true">deck de test</span>
            <span className="sr-only">Ton deck n’est pas valide : ce combat utilise un deck de test.</span>
          </span>
        )}
        {/* Les piles de Deck et de Rebut (D-093, #190), visibles des deux camps, avec leur compte. Le
            Rebut ne s'ouvre pas encore : son panneau arrive avec #188, et d'ici là ce n'est pas un bouton. */}
        <span className="piles">
          <span className={`pile pile--deck${pioche ? ' is-piochante' : ''}`}>
            Deck <strong>{side.deck.length}</strong>
          </span>
          <span className="pile pile--rebut">
            Rebut <strong>{side.discard.length}</strong>
          </span>
        </span>
      </header>
      {side.active && (
        <div className="poste__info">
          {/* Le chiffre du Stress et le mot « Machine » sont dans l'inspecteur (#188) : la carte
              porte la barre, et la pastille de la Machine reste seule, pour le pas-à-pas. */}
          <CafesPips cafes={side.active.energy} />
          <MachinePips side={side} designe={mine && pasAPas.designe('machine') !== undefined} detaille={detaille} />
          {side.active.statuses.map((status) => (
            <StatusBadge key={status} status={status} nomAffiche={detaille} />
          ))}
        </div>
      )}
    </div>
  );

  // Le Banc : trois places, sur une seule rangée. Une place libre garde la forme d'une carte.
  const banc = (
    <div className="board__bench">
      <span className="sr-only">Banc</span>
      <ul className="bench">
        {side.bench.map((slot, index) => (
          <li className={`bench__slot ${slot ? '' : 'is-free'}`} key={index}>
            {slot ? (
              <CartePlateau
                instance={slot}
                className="bench__carte"
                inspectee={inspecte === slot.uid}
                effets={effetsStress.filter((effet) => effet.uid === slot.uid)}
                dansScene={cibleScene === slot.uid}
                onInspecter={() => onInspecter(slot.uid)}
              />
            ) : (
              <span className="sr-only">Place libre</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  // La pile du camp (#199) : le camp adverse lit **Banc puis Poste**, le mien **Poste puis Banc**.
  // Ainsi les deux Postes se font face, au centre du plateau.
  const ligneDuPoste = (
    <div className="board__poste-ligne">
      {poste}
      {fiche}
    </div>
  );

  // Empilés (#199) : le Poste et le Banc du camp, dans l'ordre qui met les deux Postes face à face.
  // Le camp qui a la main est porté par le cadre du camp.
  return (
    <article className={`board__side ${current ? 'is-current' : ''} ${mine ? '' : 'is-direction'}`}>
      <div className="board__zone">
        {mine ? (
          <>
            {ligneDuPoste}
            {banc}
          </>
        ) : (
          <>
            {banc}
            {ligneDuPoste}
          </>
        )}
      </div>
    </article>
  );
}

/**
 * Le bandeau de fin dit **pourquoi** la partie s'arrête (#84) : le moteur pose la raison
 * (`endReason`), l'écran ne la déduit plus du seul vainqueur.
 *
 * `myCamp` vaut `null` en solo et le camp que je tiens en partie à deux (#125) : « tu »
 * et « la Direction » y deviennent « je » et « l'autre camp », sinon le bandeau dirait à
 * l'un des deux joueurs qu'il est la Direction.
 */
function endBanner(state: BattleState, myCamp: PlayerId | null): string {
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
    default:
      return won ? 'Victoire.' : state.winner === null ? 'Égalité.' : 'Défaite.';
  }
}

export function Battle() {
  const storeDeck = useStore((state) => state.deck);
  /** Les types de café choisis au Deck (#91), lus bruts dans le store. */
  const storedCafeTypes = useStore((state) => state.cafeTypes);
  /**
   * **La densité d'infos** (#189, `SPEC-COMBAT-UI` §4.3) : `sobre` par défaut, `détaillé`
   * sur geste. Elle vit dans le store persisté : le choix survit au rechargement.
   */
  const combatDetaille = useStore((state) => state.combatDetaille);
  const basculerCombatDetaille = useStore((state) => state.basculerCombatDetaille);
  /** Les raccourcis clavier du combat, réglés dans Réglages (#189). */
  const raccourcisCombat = useStore((state) => state.raccourcisCombat);
  /**
   * Le **pas-à-pas du premier combat** (#143) : son ouverture, son cran et ses cibles
   * vivent dans un seul module (`usePasAPasCombat`) — la page ne fait que poser
   * l'attribut qui met l'élément désigné en avant, et rendre le panneau.
   */
  const pasAPas = usePasAPasCombat();

  // Le deck du joueur est utilisé s'il est légal, sinon on retombe sur un
  // deck de test. Calculé une seule fois par rendu : `deckLegal` est appelé
  // au plus une fois, et l'identité de la référence dit si on a replié.
  const playerDeck = useMemo(() => (deckLegal(storeDeck).ok ? storeDeck : testDeck()), [storeDeck]);
  const usedTestDeck = playerDeck !== storeDeck;

  /**
   * Le choix **appliqué à ce combat** (#117). Il appartient au Deck du joueur
   * (`useStore`, `cafeTypes`) : le poser sur un **deck de test** ferait afficher
   * les types d'un contenu à la place d'un autre. Replié sur le deck de test, le
   * combat repart donc en **proposition automatique** (`[]`), dérivée de ce deck —
   * ce que dit aussi le bandeau « ce combat utilise un deck de test ».
   */
  const chosenCafeTypes = useMemo<CafeType[]>(
    () => (usedTestDeck ? [] : storedCafeTypes),
    [usedTestDeck, storedCafeTypes]
  );

  /**
   * **La partie reprise** (#126) : la partie rangée dans le store, rejouée depuis sa graine
   * et son journal. À défaut (rien de rangé, partie terminée, journal qui ne rejoue pas),
   * un combat neuf contre la Direction, comme avant.
   */
  const [depart] = useState<Reprise>(
    () =>
      reprendrePartie(useStore.getState().partie) ?? {
        state: createBattle(playerDeck, testDeck(), undefined, { playerCafeTypes: chosenCafeTypes }),
        match: null,
        decksSolo: { playerDeck, aiDeck: testDeck() }
      }
  );
  const [state, setState] = useState<BattleState>(depart.state);
  /** Les Decks du combat solo : une partie à deux porte les siens dans son `Match`. */
  const [decksSolo, setDecksSolo] = useState<Decks>(depart.decksSolo);

  /**
   * **La partie à deux** (#125) : `null` en solo. Le **code** reste le moyen de la passer
   * d'un onglet à l'autre ; la reprise après rechargement passe par le store (#126).
   */
  const [match, setMatch] = useState<Match | null>(depart.match);
  /** Ce que le champ de code dit : la raison d'un refus (telle quelle), ou la reprise. */
  const [codeMessage, setCodeMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);
  /** Le code collé par l'autre joueur. */
  const [incoming, setIncoming] = useState('');

  /**
   * **Le menu `⋯`** (D-093, #191) : ouvert ou non, et laquelle de ses trois vues il montre.
   * `codeAnnonce` est le dernier code que le menu a **annoncé** en s'ouvrant seul — voir plus bas.
   */
  const [menu, setMenu] = useState<EtatMenu>(MENU_FERME);
  const [codeAnnonce, setCodeAnnonce] = useState<string | null>(null);
  /** « Nouveau combat » sur une partie commencée demande confirmation (comme le forfait). */
  const [nouveauDemande, setNouveauDemande] = useState(false);

  /**
   * Le camp que **je** tiens. En solo c'est `player` ; en partie à deux, celui que le
   * code m'a donné (`match.camp`). C'est le seul endroit où l'écran se nomme un siège —
   * tout le reste en dérive, y compris le forfait et la main affichée.
   */
  const myCamp: PlayerId = match?.camp ?? 'player';
  const mySide = state.players[myCamp];
  /** Le camp qui doit agir : la relève en attente d'abord (moteur, `campToAct`). */
  const actor = campToAct(state);
  /** Mon tour ? Sinon l'écran attend l'autre joueur — et ne lui prête aucun bouton. */
  const myMove = state.phase === 'playing' && actor === myCamp;

  const isPlayerTurn = state.current === 'player' && state.phase === 'playing';
  const myCard = mySide.active ? getCard(mySide.active.cardId) : undefined;
  /** Dernière ligne du journal : ce qui vient de se passer, mis en avant. */
  const lastLog = state.log.at(-1) ?? '';

  /** Le moteur dit ce qui est possible ; l'écran ne fait que le rendre. */
  const legal = useMemo(() => legalActions(state), [state]);
  // Le camp : seul le joueur dont c'est le tour agit. C'est une garde de **camp**, pas de
  // légalité — la liste du moteur la porte déjà. En solo, la Direction n'a pas de main
  // humaine : hors relève, l'écran ne montre que la fin de son tour. En partie à deux,
  // le camp adverse est tenu par quelqu'un : on ne montre **rien** de ses actions.
  const playable = match
    ? myMove
      ? legal.filter((action) => action.type !== 'forfeit')
      : []
    : state.pendingPromotion || isPlayerTurn
      ? legal
      : legal.filter((action) => action.type === 'endTurn');

  const handActions = playable.filter(
    (action) =>
      action.type === 'playAction' ||
      action.type === 'playBasic' ||
      action.type === 'evolve' ||
      action.type === 'priorityShift'
  );
  const boardActions = playable.filter(
    (action) => action.type === 'attachEnergy' || action.type === 'retreat' || action.type === 'ability'
  );
  const pressions = playable.filter((action) => action.type === 'attack');
  const promotions = playable.filter((action) => action.type === 'promoteActive');
  const choices = playable.filter((action) => action.type === 'choose');
  const turnActions = playable.filter((action) => action.type === 'endTurn');

  /** Les Pressions que le café couvre, selon le moteur (`legalAttacks`, testée). */
  const inReach = useMemo(() => legalAttacks(state), [state]);

  /**
   * **Le dessus de mon Deck, regardé** (#162, D-079) : `undefined` quand mon dernier
   * geste n'était pas un regard. C'est *mon* Deck — l'adversaire n'y a jamais accès.
   */
  const regard = useMemo(() => regardDuDernierGeste(state, myCamp), [state, myCamp]);

  /**
   * **La carte choisie dans la main** (#169). Poser est un geste à deux temps : on touche
   * la carte, puis on choisit **où** elle va. La sélection reste visible (cadre accentué,
   * panneau de pose) tant qu'aucune action ne l'a consommée : `play` la vide, et une
   * sélection dont la carte a quitté la main ne montre plus rien (`selected`, plus bas).
   */
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  /**
   * Le panneau de pose vient sous la main : choisir une carte le **cadre** (`nearest` —
   * rien ne bouge s'il est déjà tout entier à l'écran), pour que le geste suivant soit
   * sous le doigt. La marge basse de `.pose` laisse la barre de navigation à sa place.
   */
  const poseRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!selectedUid) return;
    poseRef.current?.scrollIntoView({ behavior: comportementDeDefilement(), block: 'nearest' });
  }, [selectedUid]);

  const play = useCallback((action: BattleAction) => {
    setSelectedUid(null);
    setState((current) => applyAction(current, action));
  }, []);

  /**
   * **IA de niveau 1, en solo seulement** : quand c'est à la Direction de jouer — ou de
   * choisir sa relève après un craquage —, ses actions s'enchaînent seules, une par un
   * court délai pour rester lisibles. `prefers-reduced-motion` supprime le délai, comme
   * pour les animations de l'écran.
   *
   * La décision appartient à `aiTurnAction` (`@/store/pvp`) : en **partie à deux**, elle
   * rend `null` **sans appeler** la politique — le camp `ai` est tenu par quelqu'un, et
   * l'écran ne doit pas jouer son tour à sa place (critère du #125).
   */
  const sansMouvement = useMouvementReduit();

  /**
   * **Les effets de la scène** (#192) : le chiffre de Stress, la traînée de craquage, la pile
   * qui s'allume, l'Intervention qui se remplit. Le compteur (quatre au plus) et la durée
   * (800 ms au plus) vivent dans `effets-combat.ts`, pas dans le CSS.
   */
  const effets = useEffetsDeCombat(state, sansMouvement);

  /**
   * **La chorégraphie de la Pression** (D-098) : l'effet d'attaque dit qui frappe qui, le
   * journal dit quelle Pression (`attackIndex`). La carte est retrouvée par son `uid` au Poste
   * ou au Banc **des deux camps**. Un attaquant qui a craqué sur son propre coup
   * (`selfDamage`) n'est plus ni à l'un ni à l'autre : la scène n'a alors rien à animer, et
   * c'est le chiffre de Stress de #192 qui raconte le coup.
   */
  const effetAttaque = effets.findLast((effet) => effet.nature === 'attaque');
  const carteAttaque = useMemo(() => {
    if (!effetAttaque?.uid) return undefined;
    for (const camp of ['player', 'ai'] as const) {
      const cote = state.players[camp];
      const instance = [cote.active, ...cote.bench].find((carte) => carte !== null && carte.uid === effetAttaque.uid);
      if (instance) {
        const definition = getCard(instance.cardId);
        if (definition && isPlanque(definition)) return definition;
      }
    }
    return undefined;
  }, [effetAttaque?.uid, state.players]);
  const attaqueJouee = carteAttaque?.attacks[effetAttaque?.attackIndex ?? 0];
  /**
   * Le Stress **encaissé** par la cible : c'est la valeur de l'effet `stress` qui la vise, donc
   * celle que le jeu a réellement retirée (Vulnérabilité comprise) — jamais le chiffre imprimé
   * sur la carte. La scène n'affiche rien si la cible n'a rien encaissé.
   */
  /**
   * **Le coup de grâce** : la cible de la Pression est aussi celle qui craque. La scène joue
   * alors sa saynète de sortie, et vise le **fantôme** de la carte tombée — elle a déjà quitté
   * le plateau, mais `craquage__carte` la montre encore une fraction de seconde.
   */
  const coupDeGrace = effetAttaque?.cibleCraque === true;
  const stressEncaisse = effetAttaque?.stressCible ?? 0;

  /**
   * **Le raccourci de la bascule d'infos** (#189, `SPEC-COMBAT-UI` §4.6) : `I` et son alias
   * `Ctrl`+`I` (le « remap avec un modificateur » du critère WCAG sur les raccourcis à une touche). Les deux se coupent ensemble
   * depuis Réglages — c'est la **désactivation** qu'exige le critère — et aucun des deux ne
   * réagit dans un champ de saisie. `Ctrl`+`Maj`+`I` est laissé au navigateur (outils de
   * développement) : ce n'est pas l'alias.
   */
  useEffect(() => {
    if (!raccourcisCombat) return;
    const surTouche = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.isComposing) return;
      if (event.key !== 'i' && event.key !== 'I') return;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) return;
      if (dansUnChampDeSaisie(event.target)) return;
      event.preventDefault();
      basculerCombatDetaille();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [raccourcisCombat, basculerCombatDetaille]);

  /**
   * Ce que la Direction va jouer, ou `null` quand ce n'est pas à elle (ou en partie à deux).
   * Lu au rendu, et pas seulement dans l'effet : sa **présence** est l'attente que l'écran
   * montre (« La Direction réfléchit… », #131) — sans elle, 600 ms de silence par action
   * ressemblaient à un écran figé.
   */
  const aiAction = useMemo(() => aiTurnAction(state, match), [state, match]);

  useEffect(() => {
    if (!aiAction) return;
    const timer = window.setTimeout(() => play(aiAction), sansMouvement ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [aiAction, sansMouvement, play]);

  /**
   * **Forfait** (D-030) : la seule action que la Direction ne peut pas porter. Elle
   * vient de `legalActions` (le moteur dit si la partie vit encore, relève comprise) —
   * l'écran ne décide rien — et elle passe par `applyAction` comme les autres boutons.
   *
   * Deux questions distinctes, deux réponses (#123) : le **moteur** dit *si* le forfait
   * est ouvert (`forfeitOffer`), et il le nomme au camp qui a la main ; l'**écran** dit
   * *qui* se couche — mon camp, `myCamp`, qui vaut `player` en solo. On lit donc la
   * présence de l'action, pas son camp : s'arrêter au camp ferait disparaître le bouton
   * pendant le tour de la Direction, ce que D-030 / #79 a justement ouvert. Le forfait de
   * mon siège est accepté tant que la partie vit, donc ce bouton ne peut pas être refusé
   * par le moteur (#58).
   */
  const forfeitAction = useMemo(
    () => (legal.some((action) => action.type === 'forfeit') ? ({ type: 'forfeit', who: myCamp } as const) : undefined),
    [legal, myCamp]
  );

  /**
   * Le forfait **demande confirmation**, avec le composant du jeu (`Confirmation`, #131) :
   * c'est le même que « Réinitialiser la progression » dans Réglages, et il remplace
   * `window.confirm`. La question vit ici ; `forfaitDemande` garde l'action à jouer.
   */
  const [forfaitDemande, setForfaitDemande] = useState<BattleAction | null>(null);
  const gagnantDuForfait = match ? 'L’autre camp' : 'La Direction';

  const restart = useCallback(() => {
    setSelectedUid(null);
    setMatch(null);
    setCodeMessage(null);
    setIncoming('');
    setMenu(MENU_FERME);
    setCodeAnnonce(null);
    setNouveauDemande(false);
    setDecksSolo({ playerDeck, aiDeck: testDeck() });
    setState(createBattle(playerDeck, testDeck(), undefined, { playerCafeTypes: chosenCafeTypes }));
  }, [playerDeck, chosenCafeTypes]);

  /**
   * **Créer une partie à deux** : elle a sa **graine** (l'horloge, comme le `createBattle`
   * par défaut d'un combat solo), **mon Deck** au siège `player`, et le Deck de
   * démonstration pour le camp adverse — l'échange des deux Decks est le ticket
   * suivant, le code porte déjà les deux. Le lancer de tampon décide qui ouvre (D-033) :
   * si la Direction ouvre, le code est prêt tout de suite, et c'est à l'autre joueur de
   * commencer.
   */
  const startTwoPlayer = useCallback(() => {
    const created = createMatch(playerDeck, testDeck(), Date.now(), { playerCafeTypes: chosenCafeTypes });
    setSelectedUid(null);
    setMatch(created.match);
    setState(created.state);
    setCodeMessage(null);
    setIncoming('');
    // La table est rendue au joueur : c'est à lui de jouer. Si un code est déjà à passer (la
    // Direction ouvrait), le menu se rouvre seul au rendu qui suit.
    setMenu(MENU_FERME);
  }, [playerDeck, chosenCafeTypes]);

  /**
   * **Ranger la partie** (#126) : à chaque état, le store garde de quoi la rejouer. Une
   * partie terminée n'y reste pas (`partieSauvegardee` rend `null`). Le store ne fait
   * qu'écrire ; l'écran reste seul maître de l'état.
   */
  const enregistrerPartie = useStore((store) => store.enregistrerPartie);
  useEffect(() => {
    enregistrerPartie(partieSauvegardee(state, match, decksSolo));
  }, [state, match, decksSolo, enregistrerPartie]);

  /**
   * **La trace du combat** (#173, D-086 ; #228, D-105) : une partie **terminée** part en
   * arrière-plan, une seule fois — solo comme à deux, le mode de la ligne le dit. Sans
   * configuration, rien ne part ; un échec réseau ne touche pas l'écran — la partie n'a
   * jamais été perdue, elle vit dans le store (`partieSauvegardee` ci-dessus).
   *
   * La clé évite un second envoi : la fin d'une partie peut re-rendre l'écran (choix, relève),
   * et la même trace ne se dépose qu'une fois.
   */
  const tracesEnvoyees = useRef<Set<string>>(new Set());
  useEffect(() => {
    const combat = combatTermine(state, match, decksSolo);
    if (combat === null) return;
    const cle = `${combat.graine}:${combat.journal.length}`;
    if (tracesEnvoyees.current.has(cle)) return;
    tracesEnvoyees.current.add(cle);
    // `tracerCombat` avale le rejet : une trace perdue ne change rien à la fin de partie
    // affichée, et un rejet non traité ne doit jamais remonter d'un simple effet.
    void tracerCombat(combat);
  }, [state, match, decksSolo]);

  /** Le code de la partie, recalculé à chaque état : il décrit ce qui est à l'écran. */
  const code = useMemo(() => (match ? matchCode(state, match) : ''), [state, match]);
  /** Peut-on transmettre ? La règle est dans `@/store/pvp`, l'écran n'en décide pas. */
  const transfer = useMemo(() => (match ? handover(state, match) : null), [state, match]);

  /**
   * **La Partie à deux s'ouvre seule** quand un code est prêt à transmettre (D-093, #191) : c'est
   * le seul moment où l'invité a quelque chose à faire dans le menu. On l'annonce **une fois par
   * code** — l'invité qui referme le menu n'est pas rouvert à chaque rendu —, par un ajustement
   * d'état pendant le rendu (la forme que React recommande pour un état dérivé d'un autre) et non
   * par un effet, qui laisserait passer un rendu sans le menu.
   */
  if (transfer?.ready && codeAnnonce !== code) {
    setCodeAnnonce(code);
    setMenu({ ouvert: true, vue: 'pvp' });
  }

  /**
   * La copie du code (#128), **sans mentir** : le presse-papier peut manquer (page servie
   * en clair, navigateur de téléphone ancien — `navigator.clipboard` est alors `undefined`)
   * ou être refusé (permission, geste non reconnu). Les deux cas sont traités : promettre
   * « copié » sans succès ferait perdre le code, et `navigator.clipboard?.writeText(...).then`
   * levait un `TypeError` quand l'API manquait, donc le message ne venait jamais.
   *
   * Le repli est **le code lui-même** : il reste dans la zone, sélectionné d'office, et
   * l'invité le recopie à la main.
   */
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const copyCode = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('presse-papier indisponible');
      await navigator.clipboard.writeText(code);
      setCodeMessage({ ton: 'ok', texte: 'Code copié : donne-le à l’autre joueur.' });
    } catch {
      codeRef.current?.select();
      setCodeMessage({
        ton: 'ok',
        texte: 'Le presse-papier a refusé : le code est sélectionné, recopie-le à la main.'
      });
    }
  }, [code]);

  /** **Coller un code** : la partie reprend, et je prends le camp qui doit jouer. */
  const join = useCallback(() => {
    const joined = joinMatch(incoming);
    if (!joined.ok) {
      // La raison du codec est déjà une phrase française : on l'affiche telle quelle.
      setCodeMessage({ ton: 'ko', texte: joined.raison });
      return;
    }
    setSelectedUid(null);
    setMatch(joined.match);
    setState(joined.state);
    setIncoming('');
    // La partie est reprise : la table redevient l'écran (le menu se rouvre seul si un code est prêt).
    setMenu(MENU_FERME);
    setCodeMessage({ ton: 'ok', texte: `Partie reprise : tu joues le ${CAMP_NAME[joined.match.camp]}.` });
  }, [incoming]);

  const campLabel = (id: PlayerId) =>
    match ? `${id === myCamp ? 'Toi' : 'Adversaire'} · ${CAMP_NAME[id]}` : id === 'player' ? 'Toi' : 'La Direction';
  /* Le nom court d'un camp, pour la piste d'Interventions (#190) : sans le nom du siège. */
  const pisteLabel = (id: PlayerId) => (match ? (id === myCamp ? 'Toi' : 'Adversaire') : campLabel(id));

  /**
   * **L'inspecteur** (#188) : la carte que le panneau montre, par son `uid`. Il se ferme de lui-même
   * quand la carte n'est plus sur le plateau (`localiser` rend `null`). Ses gestes viennent de la
   * même liste que la barre d'action (`playable`) — rien de grisé, et seulement mon camp.
   */
  const [inspecte, setInspecte] = useState<string | null>(null);
  /**
   * L'inspecteur lit **le plateau et la main** (#192) : sous mouvement réduit, une carte de la
   * main ne se soulève pas — c'est le panneau qui s'ouvre au survol et au focus. Une carte de
   * main n'a ni Poste ni rang ; ses gestes sont ceux que la main porte déjà (`playable`).
   */
  const inspecteurPlateau = inspecte ? localiser(state, inspecte) : null;
  const carteEnMain = inspecte ? (mySide.hand.find((carte) => carte.uid === inspecte) ?? null) : null;
  const inspecteur = inspecteurPlateau
    ? { ...inspecteurPlateau, enMain: false }
    : carteEnMain
      ? { camp: myCamp, carte: carteEnMain, auPoste: false, rang: -1, enMain: true }
      : null;
  const inspecteurDefinition = inspecteur ? getCard(inspecteur.carte.cardId) : undefined;
  const gestesInspectes =
    inspecteur && inspecteur.camp === myCamp
      ? inspecteur.enMain
        ? playable.filter((action) => 'uid' in action && action.uid === inspecteur.carte.uid)
        : gestesDeLaCarte(playable, inspecteur.carte.uid, inspecteur.auPoste, inspecteur.rang)
      : [];
  const gestesDuPanneau =
    inspecteur && inspecteur.camp === myCamp ? (
      gestesInspectes.length > 0 ? (
        <div className="actions actions--tight">
          {gestesInspectes.map((action) => (
            <ActionButton
              key={JSON.stringify(action)}
              state={state}
              action={action}
              myCamp={myCamp}
              onAction={(geste) => {
                setInspecte(null);
                play(geste);
              }}
            />
          ))}
        </div>
      ) : (
        <p className="muted">Aucun geste pour cette carte ce tour.</p>
      )
    ) : undefined;

  /** La carte choisie, **si elle est encore dans la main** : sinon la sélection est vide. */
  const selected = mySide.hand.find((card) => card.uid === selectedUid) ?? null;
  const selectedDefinition = selected ? getCard(selected.cardId) : undefined;
  const selectedActions = selected
    ? handActions.filter((action) => 'uid' in action && action.uid === selected.uid)
    : [];

  /**
   * Ce que dit la barre d'action quand elle n'a rien à offrir : la partie est finie, c'est à
   * l'autre joueur d'agir (partie à deux), ou — le temps d'un rendu — rien n'est ouvert.
   */
  const attendLAutre = match !== null && state.phase === 'playing' && !myMove;
  const idleLine = attendLAutre
    ? `C’est au ${CAMP_NAME[actor]} de jouer.`
    : state.phase === 'ended'
      ? 'Rien à faire : la partie est terminée.'
      : 'Rien à faire pour le moment.';

  /**
   * « Nouveau combat » jette la partie affichée : sur une partie **commencée** il demande
   * confirmation, comme le forfait (T6 : le menu ne détruit rien sans dialogue). Une partie
   * neuve, ou finie, n'a rien à perdre : le geste est direct.
   */
  const demanderNouveauCombat = () => {
    if (state.phase === 'playing' && state.actionLog.length > 0) setNouveauDemande(true);
    else restart();
  };

  /**
   * La légende des Conditions : une seule source de JSX, pour les deux dialogues qui la montrent —
   * « Conditions » (le lien de la barre d'état, #199) et « Règles » (le menu `⋯`). Composant
   * `dialog` (D-035). Un libellé ajouté à `STATUS_META` y apparaît sans être recopié.
   */
  const conditionsLegend = (
    <ul className="status-legend">
      {STATUS_LIST.map((status) => (
        <li key={status}>
          <StatusBadge status={status} />
          <span className="muted">{STATUS_META[status].description}</span>
        </li>
      ))}
    </ul>
  );

  /**
   * La vue « Partie à deux » du menu (#125) : créer, transmettre le code, le coller. Les
   * commandes de jeu restent celles du moteur, dans la barre d'action : cette vue ne fait que
   * passer la main. Elle s'ouvre seule dès qu'il y a un code à passer (voir plus haut).
   */
  const partieADeux = (
    <div className="combat-menu__corps">
      {match === null ? (
        <>
          <p className="muted">
            Crée la partie ici : sa graine, ton Deck, et le camp adverse tenu par l’autre joueur. Un code apparaît à la
            fin de ton tour.
          </p>
          <div className="actions actions--tight">
            <button type="button" className="button button--primary" onClick={startTwoPlayer}>
              <Users size={16} /> Créer une partie à deux
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="notice">{campLine(state, match)}</p>
          <p className="muted">
            Aucun camp n’est joué par l’IA : c’est l’autre joueur qui tient le camp adverse, avec les mêmes boutons que
            toi.
          </p>
          {transfer?.ready ? (
            <>
              <p className="muted">
                Ton tour est fini : copie ce code, l’autre joueur le colle dans son onglet et reprend ici, avec le camp
                adverse.
              </p>
              <div className="actions actions--tight">
                <button type="button" className="button" onClick={copyCode}>
                  <Copy size={16} /> Copier le code
                </button>
              </div>
              {/* Un appui sélectionne le code entier : sur téléphone, c'est le repli
                  quand la copie automatique est refusée (#128). */}
              <textarea
                className="pvp__code"
                ref={codeRef}
                readOnly
                value={code}
                rows={4}
                aria-label="Code de la partie, à transmettre"
                onFocus={(event) => event.currentTarget.select()}
              />
            </>
          ) : (
            <p className="muted">{transfer?.raison}</p>
          )}
          <p className="muted">« Nouveau combat » quitte la partie à deux et rend le combat solo.</p>
        </>
      )}

      <label className="field">
        <span className="field__label">Coller un code reçu</span>
        {/* Sur téléphone, le clavier corrige : un code base64url n'a ni majuscules
            initiales à deviner ni mots à corriger, et une correction le casse en
            silence (#128). Le champ grandit vers le bas, la page ne bouge pas. */}
        <textarea
          className="pvp__code"
          value={incoming}
          onChange={(event) => setIncoming(event.target.value)}
          placeholder="PLQ1.…"
          rows={3}
          aria-label="Code reçu, à coller"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <div className="actions actions--tight">
        <button type="button" className="button" onClick={join}>
          <ClipboardPaste size={16} /> Prendre le camp adverse
        </button>
      </div>
      <p className="muted">
        Coller un code remplace le combat affiché : la partie reprend là où l’autre joueur l’a laissée, et tu prends le
        camp qui doit jouer.
      </p>
      {codeMessage && (
        <p className={codeMessage.ton === 'ok' ? 'muted' : 'muted pvp__message--ko'}>{codeMessage.texte}</p>
      )}
    </div>
  );

  return (
    <div
      className={`page battle battle--${combatDetaille ? 'detaille' : 'sobre'}${
        pasAPas.ouvert ? ' battle--pas-a-pas' : ''
      }${sansMouvement ? ' battle--mouvement-reduit' : ''}`}
      /* Le CSS lit aussi cet attribut local : le réglage du store passait jusque-là inaperçu
         (#192), seul `prefers-reduced-motion` coupait le soulèvement des cartes. */
      data-mouvement-reduit={sansMouvement ? 'true' : 'false'}
      /* Les cibles de l'étape courante : `styles.css` met en avant l'élément qui porte
         le `data-pas-a-pas` correspondant (`pasAPas.designe`). Fermé, aucun élément ne
         porte l'attribut — donc aucun contour. */
      data-pas-a-pas-cibles={pasAPas.cibles}
    >
      <section className="battle__head">
        <div className="battle__title">
          <h1>Combat</h1>
          <p className="muted">
            Tour {state.turn} ·{' '}
            {match
              ? campLine(state, match)
              : state.phase === 'ended'
                ? 'partie terminée'
                : isPlayerTurn
                  ? 'à toi'
                  : 'à la Direction'}
          </p>
          {/* L'attente de la Direction (#131) : annoncée au lecteur d'écran, et elle disparaît
              dès que le coup est joué. Aucun point animé : le mouvement réduit n'a rien à couper. */}
          {aiAction && (
            <p className="battle__attente" role="status">
              La Direction réfléchit…
            </p>
          )}
        </div>
        {/* Les Conditions (#199) : la rangée des cinq a quitté le plateau. Elle tient ici en un lien,
            qui ouvre la même légende que « Règles » dans le menu ; c'est la cible « conditions » du
            pas-à-pas, et elle reste à l'écran. La place du `ⓘ` (#189) reste libre. */}
        <Dialog>
          <DialogTrigger
            render={
              <button type="button" className="battle__conditions" data-pas-a-pas={pasAPas.designe('conditions')} />
            }
          >
            Conditions
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conditions</DialogTitle>
              <DialogDescription>Ce qu’un Planqué au Poste peut subir.</DialogDescription>
            </DialogHeader>
            {conditionsLegend}
          </DialogContent>
        </Dialog>
        {/* La **bascule d'infos** (#189) : c'est elle qui possède cette place dans la barre
            d'état, le `⋯` appartient au menu (#191). Le bouton visible est l'équivalent tactile
            du raccourci (le critère WCAG sur les raccourcis à une touche), `aria-pressed` dit le mode, `aria-keyshortcuts` le geste. */}
        <button
          type="button"
          className="battle__infos"
          aria-pressed={combatDetaille}
          aria-keyshortcuts="I"
          aria-label="Infos détaillées"
          title={`Infos détaillées — I (${combatDetaille ? 'détaillé' : 'sobre'})`}
          onClick={basculerCombatDetaille}
        >
          <Info size={18} aria-hidden="true" />
        </button>
        <MenuCombat etat={menu} onChange={setMenu}>
          {(menuApi) => {
            if (menu.vue === 'journal') {
              return (
                <ol className="log combat-menu__corps">
                  {state.log.slice(-14).map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ol>
              );
            }
            if (menu.vue === 'pvp') return partieADeux;
            return (
              <ul className="combat-menu__liste">
                <li>
                  <button type="button" className="combat-menu__entree" onClick={() => menuApi.aller('journal')}>
                    <ScrollText size={16} aria-hidden="true" /> Journal
                  </button>
                </li>
                <li>
                  <button type="button" className="combat-menu__entree" onClick={() => menuApi.aller('pvp')}>
                    <Users size={16} aria-hidden="true" /> Partie à deux
                    <span className="muted">un code à se passer, sans serveur</span>
                  </button>
                </li>
                <li>
                  <Dialog>
                    <DialogTrigger render={<button type="button" className="combat-menu__entree" />}>
                      <BookOpen size={16} aria-hidden="true" /> Règles
                      <span className="muted">les Conditions</span>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Conditions</DialogTitle>
                        <DialogDescription>Ce qu’un Planqué au Poste peut subir.</DialogDescription>
                      </DialogHeader>
                      {conditionsLegend}
                    </DialogContent>
                  </Dialog>
                </li>
                {forfeitAction && (
                  <li>
                    <button
                      type="button"
                      className="combat-menu__entree"
                      onClick={() => setForfaitDemande(forfeitAction)}
                    >
                      <Flag size={16} aria-hidden="true" /> Abandonner
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className="combat-menu__entree" onClick={demanderNouveauCombat}>
                    <RotateCcw size={16} aria-hidden="true" /> Nouveau combat
                  </button>
                </li>
              </ul>
            );
          }}
        </MenuCombat>
      </section>

      {/* Le pas-à-pas est **en haut**, collé sous l'en-tête (#169) : il suit la lecture. */}
      <PasAPasCombat pasAPas={pasAPas} />

      {state.phase === 'ended' && (
        <p className={`notice ${state.winner === myCamp ? 'notice--ok' : 'notice--warn'}`}>
          {endBanner(state, match ? myCamp : null)}
        </p>
      )}

      {/*
        **La table** (#169) : le plateau des deux camps, puis la console du joueur — la main et la
        pose. Sur téléphone, tout s'empile et tient dans l'écran ; sur un écran large, la console
        passe à côté du plateau. Les actions sont dans la barre collée plus bas, et tout ce qui est
        secondaire (Journal, Partie à deux, Règles, Abandonner, Nouveau combat) dans le menu `⋯`.
      */}
      <div className="battle__table">
        <section className="board" aria-label="Plateau" data-pas-a-pas={pasAPas.designe('plateau')}>
          {/* La scène de la Pression (D-098) : deux `canvas` et les cartes animées par l'API
              Web Animations. Rien ne se monte sous « Mouvement réduit ». */}
          <SceneAttaque
            effetId={effetAttaque?.id}
            uid={effetAttaque?.uid}
            uidCible={effetAttaque?.uidCible}
            carte={carteAttaque}
            attaque={attaqueJouee}
            stress={stressEncaisse}
            coupDeGrace={coupDeGrace}
            sansMouvement={sansMouvement}
          />
          {/* La piste d'Interventions (#190) sépare les deux camps : elle est **une** seule cible du
              pas-à-pas (son conteneur), jamais une par camp. */}
          {[otherCamp(myCamp), myCamp].map((id, index) => (
            <Fragment key={id}>
              {index === 1 && (
                <PisteInterventions
                  camps={[otherCamp(myCamp), myCamp].map((camp) => ({
                    label: pisteLabel(camp),
                    points: state.players[camp].points,
                    /* Les crans qui viennent d'être acquis (#192) : leur hexagone rebondit
                       une fois ; sous mouvement réduit, il est simplement déjà rempli. */
                    fraiches: effets
                      .filter((effet) => effet.nature === 'intervention' && effet.camp === camp)
                      .map((effet) => effet.numero ?? 0)
                  }))}
                  designe={pasAPas.designe('interventions')}
                />
              )}
              <Camp
                label={campLabel(id)}
                side={state.players[id]}
                current={state.current === id && state.phase === 'playing'}
                mine={id === myCamp}
                pendingPromotion={state.pendingPromotion === id}
                pasAPas={pasAPas}
                inspecte={inspecte}
                detaille={combatDetaille}
                effets={effets.filter((effet) => effet.camp === id)}
                cibleScene={sansMouvement ? undefined : effetAttaque?.uidCible}
                deckDeTest={usedTestDeck && id === myCamp}
                onInspecter={setInspecte}
              />
            </Fragment>
          ))}
          {/* Le trait de la Pression est **dessiné par la scène** (D-098) : deux animations
              pour un seul coup se verraient. La traînée de craquage, elle, reste ici — c'est
              la même règle : une seule bande à la fois. */}
          {/* La traînée de craquage (#192) : une seule, entre l'attaquant et sa cible. Elle ne
              traverse **jamais** sous mouvement réduit — le fantôme désaturé et le bandeau
              « a craqué » disent tout, sans mouvement. */}
          {!sansMouvement &&
            effets
              .filter((effet) => effet.nature === 'craquage')
              .map((effet) => (
                <span
                  key={`train-${effet.id}`}
                  className={`craquage__train ${
                    effet.camp === myCamp ? 'craquage__train--vers-le-bas' : 'craquage__train--vers-le-haut'
                  }`}
                  aria-hidden="true"
                />
              ))}
        </section>

        <div className="battle__console">
          {/* L'inspecteur (#188) : la colonne de droite à partir de 900 px, une feuille basse sur
              téléphone. Il ne recouvre pas la carte qu'il décrit (`InspecteurCombat`). */}
          <InspecteurCombat
            ouvert={inspecteur !== null}
            onOpenChange={(ouvert) => {
              if (!ouvert) setInspecte(null);
            }}
            nom={inspecteur ? cardName(inspecteur.carte.cardId) : ''}
            ancre={inspecte}
            fiche={
              inspecteur && inspecteurDefinition ? (
                <FicheCarte
                  instance={inspecteur.carte}
                  card={inspecteurDefinition}
                  machine={inspecteur.auPoste ? texteMachine(state.players[inspecteur.camp]) : undefined}
                />
              ) : null
            }
            gestes={gestesDuPanneau}
          />
          {regard && <RegardDuDessus carte={regard} />}

          <section className="section hand-panel" data-pas-a-pas={pasAPas.designe('main')}>
            <div className="section__head">
              {/* En partie à deux, « ta main » est celle du camp que je tiens : l'autre joueur,
                  lui, n'en voit jamais que le compte (bandeau du plateau). */}
              <h2>{match === null ? 'Ta main' : `Ta main · ${CAMP_NAME[myCamp]}`}</h2>
              <span className="muted">
                {mySide.hand.length} / {HAND_LIMIT}
                {myMove && handActions.length > 0 && !selected ? ' · touche une carte pour la jouer' : ''}
              </span>
            </div>
            {mySide.hand.length === 0 ? (
              <p className="muted">Main vide.</p>
            ) : (
              // **L'éventail** (#200, SPEC-COMBAT-UI §6.8 R1) : chaque carte est le gabarit (`CardView`),
              // inclinée et chevauchée, rognée par le conteneur `.hand`. Le **bouton** est posé par-dessus
              // la carte : il porte le geste, `aria-pressed` et le nom lu par un lecteur d'écran.
              <ul className="hand" style={{ '--n': mySide.hand.length } as CSSProperties}>
                {mySide.hand.map((card, index) => {
                  const definition = getCard(card.cardId);
                  const isSelected = selected?.uid === card.uid;
                  const jouable = handActions.some((action) => 'uid' in action && action.uid === card.uid);
                  // L'éventail se déploie autour du centre : les cartes du bord s'inclinent et s'abaissent.
                  const decalage = index - (mySide.hand.length - 1) / 2;
                  const etat = `${isSelected ? ' is-selected' : ''}${jouable ? ' is-playable' : ''}`;
                  return (
                    <li
                      key={card.uid}
                      className={`hand__carte${etat}`}
                      data-uid={card.uid}
                      style={
                        {
                          '--rot': `${decalage * 2}deg`,
                          '--dec': `${decalage * decalage * 0.8}px`
                        } as CSSProperties
                      }
                      /* Sous « Mouvement réduit », la carte ne se soulève pas : c'est
                         l'inspecteur qui s'ouvre au survol et au focus (#192, #188). */
                      onPointerEnter={(evenement) => {
                        if (!sansMouvement || evenement.pointerType !== 'mouse') return;
                        setInspecte(card.uid);
                      }}
                      onFocus={() => {
                        if (sansMouvement) setInspecte(card.uid);
                      }}
                    >
                      {definition && (
                        <div className="hand__visuel" aria-hidden>
                          <CardView card={definition} figee plateau compact />
                        </div>
                      )}
                      <button
                        type="button"
                        className={`hand__card${etat}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedUid(isSelected ? null : card.uid)}
                      >
                        {/* Le nom et l'état, lus à voix haute : la carte visible est `aria-hidden`. */}
                        <span className="hand__name sr-only">{cardName(card.cardId)}</span>
                        <span className="hand__meta sr-only">
                          <span className="hand__kind">{definition && kindLabel(definition)}</span>
                          {jouable && <span className="hand__tag">Jouable</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/*
            **La pose** (#169) : la carte choisie reste sous les yeux — nommée, avec son texte —
            tant qu'on ne l'a pas posée, et chaque geste dit **où** : « Poser au Poste »,
            « Mettre au Banc 2 », « Jouer cet Objet ». Il vient **sous la main** et la page le
            cadre dès qu'une carte est choisie (`poseRef`) : sur téléphone il ne reste jamais
            sous la barre de navigation.
          */}
          {selected && (
            <section className="pose panel" aria-label="Poser la carte choisie" ref={poseRef}>
              <p className="pose__titre">
                <span className="muted">Carte choisie</span> <strong>{cardName(selected.cardId)}</strong>{' '}
                <span className="hand__kind">{selectedDefinition && kindLabel(selectedDefinition)}</span>
              </p>
              {selectedDefinition && !isPlanque(selectedDefinition) && (
                <p className="hand__text muted">{selectedDefinition.text}</p>
              )}
              {/* Un Planqué de la main se lit comme au plateau : son Seuil, ses Pressions et leur coût,
                  son Talent. Au toucher, l'inspecteur au survol n'existe pas : la fiche est ici. */}
              {selectedDefinition && isPlanque(selectedDefinition) && (
                <FicheCarte instance={selected} card={selectedDefinition} />
              )}
              {selectedActions.length > 0 ? (
                <>
                  <p className="muted pose__aide">Touche un geste pour la jouer :</p>
                  <div className="actions actions--tight">
                    {selectedActions.map((action) => (
                      <ActionButton
                        key={JSON.stringify(action)}
                        state={state}
                        action={action}
                        myCamp={myCamp}
                        onAction={play}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">
                  {myMove ? 'Cette carte ne peut pas être jouée maintenant.' : 'Ce n’est pas ton tour de jouer.'}
                </p>
              )}
              <button type="button" className="link-button" onClick={() => setSelectedUid(null)}>
                Reprendre une autre carte
              </button>
            </section>
          )}
        </div>
      </div>

      {/*
        **La barre d'action** (D-093, #191) : collée au-dessus de la navigation, elle porte ce qui
        se joue au Poste — café, Rotation, Talent, les Pressions, « Fin du tour » — et, quand le
        moteur l'ouvre, la relève ou le choix en attente. Elle est **toujours là** (`.combat-barre`,
        mesurée par `npm run capturer`) : c'est la cible « poste-actions » du pas-à-pas, et c'est
        elle qui libère la hauteur dont la main a besoin. Elle ne rend que ce que dit la liste du
        moteur : en partie à deux, le tour de l'autre ne lui prête aucun bouton (#125).
      */}
      <section className="combat-barre" aria-label="Actions du tour" data-pas-a-pas={pasAPas.designe('poste-actions')}>
        {/* La dernière ligne du journal (#199) : « Lancer de tampon : tu ouvres. » et le reste de ce
            qui vient de se passer. Elle vit dans la barre d'action, là où l'œil est déjà : une
            information temporaire n'a pas à occuper une bande de plus. */}
        {lastLog && (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={state.log.length}
              className={`banner combat-barre__journal ${/craque/.test(lastLog) ? 'banner--ko' : ''}`}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              {lastLog}
            </motion.p>
          </AnimatePresence>
        )}

        {state.pendingPromotion && (
          <section className="notice notice--warn promotion">
            {state.pendingPromotion === myCamp ? (
              <p>Ton Poste a craqué. À toi de choisir ta relève.</p>
            ) : match === null ? (
              <p>Le Poste de la Direction a craqué. Elle choisit sa relève toute seule.</p>
            ) : (
              <p>Le Poste adverse a craqué : c’est à l’autre joueur de choisir sa relève. Transmets-lui le code.</p>
            )}
            <div className="actions actions--tight">
              {promotions.map((action) => (
                <ActionButton
                  key={JSON.stringify(action)}
                  state={state}
                  action={action}
                  myCamp={myCamp}
                  onAction={play}
                />
              ))}
            </div>
          </section>
        )}

        {choices.length > 0 && (
          <section className="notice notice--warn choix">
            <p>Un effet te demande de désigner une carte.</p>
            <div className="actions actions--tight">
              {choices.map((action) => (
                <ActionButton
                  key={JSON.stringify(action)}
                  state={state}
                  action={action}
                  myCamp={myCamp}
                  onAction={play}
                />
              ))}
            </div>
          </section>
        )}

        {/* `legalAttacks` lit le camp qui a la main : cette ligne ne parle donc que quand c'est
            mon tour (en solo, elle ne décrit plus le Poste de la Direction). */}
        {myMove &&
          myCard &&
          isPlanque(myCard) &&
          myCard.attacks.length > 0 &&
          (mySide.hasAttacked || inReach.length < myCard.attacks.length) && (
            <p className="muted combat-barre__portee">
              {mySide.hasAttacked
                ? 'Pression déjà portée ce tour.'
                : `Hors de portée du café : ${myCard.attacks
                    .filter((entry) => !inReach.includes(entry))
                    .map((entry) => `${entry.name} (${entry.cost.map(cafeLabel).join(' · ')})`)
                    .join(', ')}.`}
            </p>
          )}

        {/* Les gestes du Poste sur **une seule ligne** quand ils tiennent : la rangée de café,
            Rotation et Talent défile au lieu de passer à la ligne (quatre Planqués à nourrir ne
            font pas quatre lignes), et les Pressions avec « Fin du tour » viennent à côté ou
            dessous. La barre ne doit jamais recouvrir la main (`npm run capturer` le mesure). */}
        {(boardActions.length > 0 || pressions.length > 0 || turnActions.length > 0) && (
          <div className="combat-barre__gestes">
            {boardActions.length > 0 && (
              <div className="actions actions--tight combat-barre__rang">
                {boardActions.map((action) => (
                  <ActionButton
                    key={JSON.stringify(action)}
                    state={state}
                    action={action}
                    myCamp={myCamp}
                    onAction={play}
                  />
                ))}
              </div>
            )}
            {pressions.map((action) => (
              <ActionButton
                key={JSON.stringify(action)}
                state={state}
                action={action}
                myCamp={myCamp}
                onAction={play}
              />
            ))}
            {turnActions.map((action) => (
              <span className="combat-barre__fin" key={JSON.stringify(action)}>
                <ActionButton state={state} action={action} myCamp={myCamp} onAction={play} />
              </span>
            ))}
          </div>
        )}

        {playable.length === 0 && (
          <p className="muted combat-barre__repos">
            {idleLine}
            {attendLAutre && (
              <>
                {' '}
                <button type="button" className="link-button" onClick={() => setMenu({ ouvert: true, vue: 'pvp' })}>
                  Coller un code
                </button>
              </>
            )}
          </p>
        )}
      </section>

      <Confirmation
        open={forfaitDemande !== null && forfeitAction !== undefined}
        titre="Déclarer forfait ?"
        texte={`${gagnantDuForfait} l’emporte, quel que soit le score. Tu ne pourras pas reprendre cette partie.`}
        confirmer="Abandonner"
        onConfirm={() => {
          if (forfaitDemande) play(forfaitDemande);
          setForfaitDemande(null);
          // La partie est finie : le menu qui portait « Abandonner » n'a plus rien à offrir.
          setMenu(MENU_FERME);
        }}
        onCancel={() => setForfaitDemande(null)}
      />
      <Confirmation
        open={nouveauDemande}
        titre="Recommencer un combat ?"
        texte="La partie en cours est jetée, et un combat neuf commence. Tu ne pourras pas la reprendre."
        confirmer="Nouveau combat"
        onConfirm={restart}
        onCancel={() => setNouveauDemande(false)}
      />
    </div>
  );
}
