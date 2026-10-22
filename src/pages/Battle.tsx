import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ClipboardPaste, Coffee, Copy, RotateCcw, Swords, Users } from 'lucide-react';
import { ALL_CARDS, FACTION_META, getCard, isBasic, isPlanque } from '@/data';
import type {
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
import { applyAction, createBattle, legalActions, legalAttacks } from '@/game/engine';
import { deckLegal } from '@/game/deck';
import { useStore } from '@/store/useStore';
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
import { PasAPasCombat } from '@/components/PasAPasCombat';
import { comportementDeDefilement, usePasAPasCombat } from '@/components/use-pas-a-pas-combat';
import type { PasAPasCombatEtat } from '@/components/use-pas-a-pas-combat';
import { Button } from '@/components/ui/button';
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
    if (deck.length >= 20) break;
    deck.push(card.id);
    if (deck.length < 20) deck.push(card.id);
  }
  return deck.slice(0, 20);
}

function cardName(cardId: string): string {
  return getCard(cardId)?.name ?? 'Carte inconnue';
}

/** Le nom d'une instance, sans mentir quand elle a disparu de l'état. */
function instanceName(instance: CardInstance | null | undefined): string {
  return instance ? cardName(instance.cardId) : 'un Planqué';
}

function kindLabel(definition: Card | undefined): string {
  if (!definition) return '';
  if (isPlanque(definition)) {
    const stage = definition.stage === 'ENTRANT' ? 'Entrant' : definition.stage;
    return definition.ex ? `${stage} · COMEX` : stage;
  }
  return definition.kind === 'OBJET' ? 'Objet' : 'Collègue';
}

/**
 * Un Planqué du Rack, **en Stress** : `hp` reste le champ technique du moteur, le
 * Stress est ce que le joueur lit (D-026). Le Seuil est rappelé pour situer la barre.
 */
function describe(instance: CardInstance | null): string {
  if (!instance) return 'Place libre';
  const stress = instance.maxHp - instance.hp;
  return `${cardName(instance.cardId)} · ${stress}/${instance.maxHp} de Stress`;
}

/** Les cinq conditions, dans l'ordre d'affichage de la légende. */
const STATUS_LIST = Object.keys(STATUS_META) as Status[];

/**
 * La barre de **Stress** : elle monte. `hp` reste le champ technique du moteur — c'est
 * l'affichage qui s'inverse (D-026 : « le Stress remplace les dégâts »). Verte au repos,
 * rouge quand le collègue va craquer.
 */
function StressBar({ stress, max }: { stress: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((stress / max) * 100))) : 0;
  const level = pct >= 75 ? 'is-high' : pct >= 50 ? 'is-mid' : '';
  return (
    <div className="stress" role="img" aria-label={`Stress : ${stress} sur ${max}`}>
      <div className={`stress__fill ${level}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Les cafés **attachés** d'un Planqué, en pastilles typées (D-037) : chaque pastille
 * porte la couleur de sa faction, vide si rien n'est attaché.
 */
function CafesPips({ cafes }: { cafes: readonly CafeSymbol[] }) {
  const names = cafes.map((cafe) => cafeLabel(cafe));
  return <CafePips symbols={cafes} label={names.length > 0 ? `Cafés attachés : ${names.join(' · ')}` : 'Aucun café attaché'} />;
}

/**
 * La **Machine à café** d'un camp : au plus un café typé (D-034) — pastille colorée
 * du type produit, ou pastille vide quand rien n'est à attacher. Le survol rappelle
 * les **types du Deck** (1 à 3, D-037 (4)) dont la Machine tire le café.
 */
function MachinePips({
  zone,
  cafeTypes,
  designe = false
}: {
  zone: CafeSymbol | null;
  cafeTypes: readonly CafeType[];
  /** Le pas-à-pas du combat (#143) désigne la Machine du joueur, pas celle de la Direction. */
  designe?: boolean;
}) {
  const types = cafeTypes.map((type) => FACTION_META[type].name).join(' · ');
  return (
    <span
      className="muted"
      data-pas-a-pas={designe ? 'machine' : undefined}
      title={`Machine à café : ${zone ? cafeLabel(zone) : `vide (types du Deck : ${types || 'aucun'})`}`}
    >
      Machine {zone ? <CafeDot cafe={zone} /> : <i className="pip pip--free" title="Machine à café : vide" />}
    </span>
  );
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
     * au Rack 2 » — et plus le nom de la carte, que le panneau de pose rappelle déjà.
     */
    case 'playBasic':
      return { label: action.slot === 'active' ? 'Poser au Poste' : `Mettre au Rack ${Number(action.slot) + 1}` };
    case 'playAction':
      return {
        label: kindLabel(handDefinition(action.uid)) === 'Objet' ? 'Jouer cet Objet' : 'Jouer ce Collègue'
      };
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
      return { label: 'Relève', detail: `${prefix}${instanceName(state.players[who].bench[action.benchIndex])} au Poste` };
    }
    case 'forfeit':
      return { label: 'Abandonner' };
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
  return (
    <button
      type="button"
      className={`button ${action.type === 'attack' ? 'button--primary' : ''}`}
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

/**
 * **Un camp du plateau** (#169) : l'ordre est celui d'un jeu de cartes à deux joueurs —
 * le camp adverse en haut, **Rack puis Poste**, le mien en bas, **Poste puis Rack** : les
 * deux Postes se font face au milieu. Tout tient dans une carte compacte, pour que les
 * deux camps, la main et les actions se voient d'un coup sur un téléphone.
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
  pasAPas
}: {
  label: string;
  side: PlayerState;
  /** Le camp qui a la main : son cadre s'allume. */
  current: boolean;
  mine: boolean;
  /** Vrai quand ce camp attend de choisir sa relève. */
  pendingPromotion: boolean;
  pasAPas: PasAPasCombatEtat;
}) {
  const poste = (
    <div className="board__poste" data-pas-a-pas={mine ? pasAPas.designe('poste') : undefined}>
      <span className="stat-label">Poste</span>
      <div className="board__content">
        {side.active ? (
          <>
            <div className="poste__head">
              <strong>{cardName(side.active.cardId)}</strong>
              <span className="poste__hp">
                {side.active.maxHp - side.active.hp}/{side.active.maxHp} de Stress
              </span>
            </div>
            <div className="poste__gauge">
              <StressBar stress={side.active.maxHp - side.active.hp} max={side.active.maxHp} />
              <div className="poste__meta">
                <CafesPips cafes={side.active.energy} />
                <MachinePips
                  zone={side.energyZone}
                  cafeTypes={side.cafeTypes}
                  designe={mine && pasAPas.designe('machine') !== undefined}
                />
                {side.active.statuses.map((status) => (
                  <StatusBadge key={status} status={status} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <strong className="muted">{pendingPromotion ? 'Aucun Planqué — relève à choisir' : 'Poste libre'}</strong>
        )}
      </div>
    </div>
  );

  const rack = (
    <div className="board__bench">
      <span className="stat-label">Rack</span>
      <ul className="rack board__content">
        {side.bench.map((slot, index) => (
          <li className={`rack__slot ${slot ? '' : 'is-free'}`} key={index} title={describe(slot)}>
            {slot ? (
              <>
                <strong className="rack__name">{cardName(slot.cardId)}</strong>
                <span className="rack__stress muted">
                  {slot.maxHp - slot.hp}/{slot.maxHp} de Stress
                </span>
              </>
            ) : (
              <span className="muted">Place libre</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <article className={`board__side ${current ? 'is-current' : ''}`}>
      <header className="board__head">
        <h2>{label}</h2>
        <span className="board__counts muted">
          main {side.hand.length} · Deck {side.deck.length} · Rebut {side.discard.length}
        </span>
        <span
          className={`board__points ${side.points > 0 ? 'is-scored' : ''}`}
          role="img"
          aria-label={`Interventions : ${side.points} sur 3`}
          data-pas-a-pas={mine ? pasAPas.designe('interventions') : undefined}
        >
          {'★'.repeat(side.points)}
          {'☆'.repeat(Math.max(0, 3 - side.points))}
        </span>
      </header>
      {mine ? (
        <>
          {poste}
          {rack}
        </>
      ) : (
        <>
          {rack}
          {poste}
        </>
      )}
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
        ? 'Victoire : 3 Interventions.'
        : `Défaite : ${versus ? 'le camp adverse' : 'la Direction'} marque 3 Interventions.`;
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

  const [state, setState] = useState<BattleState>(() =>
    createBattle(playerDeck, testDeck(), undefined, { playerCafeTypes: chosenCafeTypes })
  );

  /**
   * **La partie à deux** (#125) : `null` en solo. Elle ne vit que dans cet onglet —
   * `BattleState` n'est pas persisté (`partialize`, `useStore.ts`) — et le **code** est
   * le seul objet qui la fait passer d'un onglet à l'autre. La reprise après
   * rechargement est le ticket #126, pas celui-ci.
   */
  const [match, setMatch] = useState<Match | null>(null);
  /** Ce que le champ de code dit : la raison d'un refus (telle quelle), ou la reprise. */
  const [codeMessage, setCodeMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null);
  /** Le code collé par l'autre joueur. */
  const [incoming, setIncoming] = useState('');

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
    (action) => action.type === 'playAction' || action.type === 'playBasic' || action.type === 'evolve' || action.type === 'priorityShift'
  );
  const boardActions = playable.filter(
    (action) => action.type === 'attachEnergy' || action.type === 'retreat' || action.type === 'ability'
  );
  const pressions = playable.filter((action) => action.type === 'attack');
  const promotions = playable.filter((action) => action.type === 'promoteActive');
  const turnActions = playable.filter((action) => action.type === 'endTurn');

  /** Les Pressions que le café couvre, selon le moteur (`legalAttacks`, testée). */
  const inReach = useMemo(() => legalAttacks(state), [state]);

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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const action = aiTurnAction(state, match);
    if (!action) return;
    const timer = window.setTimeout(() => play(action), reduceMotion ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [state, match, reduceMotion, play]);

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
    () =>
      legal.some((action) => action.type === 'forfeit')
        ? ({ type: 'forfeit', who: myCamp } as const)
        : undefined,
    [legal, myCamp]
  );

  const abandon = useCallback(
    (action: BattleAction) => {
      const lost = match ? 'l’autre camp' : 'La Direction';
      if (window.confirm(`Déclarer forfait ? ${lost} l’emporte, quel que soit le score.`)) play(action);
    },
    [play, match]
  );

  const restart = useCallback(() => {
    setSelectedUid(null);
    setMatch(null);
    setCodeMessage(null);
    setIncoming('');
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
  }, [playerDeck, chosenCafeTypes]);

  /** Le code de la partie, recalculé à chaque état : il décrit ce qui est à l'écran. */
  const code = useMemo(() => (match ? matchCode(state, match) : ''), [state, match]);
  /** Peut-on transmettre ? La règle est dans `@/store/pvp`, l'écran n'en décide pas. */
  const transfer = useMemo(() => (match ? handover(state, match) : null), [state, match]);

  const copyCode = useCallback(() => {
    // Le presse-papier peut être refusé (contexte non sécurisé, permission) : le code
    // reste dans la zone, il suffit de le sélectionner. On ne ment pas dans le message.
    navigator.clipboard?.writeText(code).then(
      () => setCodeMessage({ ton: 'ok', texte: 'Code copié : donne-le à l’autre joueur.' }),
      () => setCodeMessage({ ton: 'ok', texte: 'Code prêt ci-dessus — recopie-le à la main.' })
    );
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
    setCodeMessage({ ton: 'ok', texte: `Partie reprise : tu joues le ${CAMP_NAME[joined.match.camp]}.` });
  }, [incoming]);

  const campLabel = (id: PlayerId) =>
    match
      ? `${id === myCamp ? 'Toi' : 'Adversaire'} · ${CAMP_NAME[id]}`
      : id === 'player'
        ? 'Toi'
        : 'La Direction';

  /** La carte choisie, **si elle est encore dans la main** : sinon la sélection est vide. */
  const selected = mySide.hand.find((card) => card.uid === selectedUid) ?? null;
  const selectedDefinition = selected ? getCard(selected.cardId) : undefined;
  const selectedActions = selected
    ? handActions.filter((action) => 'uid' in action && action.uid === selected.uid)
    : [];

  /**
   * Ce que dit la section « Au Poste » quand elle est vide : la partie est finie, ou
   * c'est à l'autre joueur d'agir (partie à deux).
   */
  const idleLine =
    match !== null && state.phase === 'playing' && !myMove
      ? `Rien à faire de ton côté : c’est au ${CAMP_NAME[actor]} de jouer.`
      : 'Rien à faire : la partie est terminée.';

  /**
   * La légende des Conditions, rendue **deux fois** : dans la page, et dans le dialogue
   * « Règles » (D-035, composant shadcn `dialog`). Une seule source de JSX, donc un
   * libellé ajouté à `STATUS_META` apparaît dans les deux sans être recopié.
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

  return (
    <div
      className={`page battle${pasAPas.ouvert ? ' battle--pas-a-pas' : ''}`}
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
        </div>
        <div className="actions actions--tight">
          {forfeitAction && (
            <button type="button" className="button button--small" onClick={() => abandon(forfeitAction)}>
              Abandonner
            </button>
          )}
          <button type="button" className="button button--small" onClick={restart}>
            <RotateCcw size={14} /> Nouveau combat
          </button>
        </div>
      </section>

      {/* Le pas-à-pas est **en haut**, collé sous l'en-tête (#169) : il suit la lecture. */}
      <PasAPasCombat pasAPas={pasAPas} />

      {usedTestDeck && (
        <p
          className="notice notice--warn notice--compact"
          title="Un deck valide : 20 cartes, 2 exemplaires max, 1 Entrant minimum."
        >
          Ton deck n’est pas valide : ce combat utilise un deck de test.
        </p>
      )}

      {state.phase === 'ended' && (
        <p className={`notice ${state.winner === myCamp ? 'notice--ok' : 'notice--warn'}`}>
          {endBanner(state, match ? myCamp : null)}
        </p>
      )}

      {lastLog && (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={state.log.length}
            className={`banner ${/craque/.test(lastLog) ? 'banner--ko' : ''}`}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            {lastLog}
          </motion.p>
        </AnimatePresence>
      )}

      {/*
        **La table** (#169) : le plateau des deux camps, puis la console du joueur — relève,
        actions de la Pression, main. Sur téléphone, tout s'empile et tient dans l'écran ;
        sur un écran large, la console passe à côté du plateau. Ce qui est secondaire
        (Conditions, Partie à deux, Journal) est replié plus bas.
      */}
      <div className="battle__table">
        <section className="board" aria-label="Plateau" data-pas-a-pas={pasAPas.designe('plateau')}>
          {[otherCamp(myCamp), myCamp].map((id) => (
            <Camp
              key={id}
              label={campLabel(id)}
              side={state.players[id]}
              current={state.current === id && state.phase === 'playing'}
              mine={id === myCamp}
              pendingPromotion={state.pendingPromotion === id}
              pasAPas={pasAPas}
            />
          ))}
        </section>

        <div className="battle__console">
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
                  <ActionButton key={JSON.stringify(action)} state={state} action={action} myCamp={myCamp} onAction={play} />
                ))}
              </div>
            </section>
          )}

          <section className="section actions-panel" data-pas-a-pas={pasAPas.designe('poste-actions')}>
            <div className="section__head">
              <h2>Au Poste</h2>
              {/* `legalAttacks` lit le camp qui a la main : ce paragraphe ne parle donc que
                  quand c'est mon tour (en solo, il ne décrit plus le Poste de la Direction). */}
              {myMove && myCard && isPlanque(myCard) && myCard.attacks.length > 0 && (
                <p className="muted actions-panel__portee">
                  {mySide.hasAttacked
                    ? 'Pression déjà portée ce tour.'
                    : inReach.length === myCard.attacks.length
                      ? 'Toutes tes Pressions sont à portée de café.'
                      : `Hors de portée du café : ${myCard.attacks
                          .filter((entry) => !inReach.includes(entry))
                          .map((entry) => `${entry.name} (${entry.cost.map(cafeLabel).join(' · ')})`)
                          .join(', ')}.`}
                </p>
              )}
            </div>
            {boardActions.length === 0 && pressions.length === 0 && turnActions.length === 0 ? (
              <p className="muted">{idleLine}</p>
            ) : (
              <>
                {boardActions.length > 0 && (
                  <div className="actions actions--tight">
                    {boardActions.map((action) => (
                      <ActionButton key={JSON.stringify(action)} state={state} action={action} myCamp={myCamp} onAction={play} />
                    ))}
                  </div>
                )}
                {(pressions.length > 0 || turnActions.length > 0) && (
                  <div className="actions actions--tight actions--pressions">
                    {pressions.map((action) => (
                      <ActionButton key={JSON.stringify(action)} state={state} action={action} myCamp={myCamp} onAction={play} />
                    ))}
                    {turnActions.map((action) => (
                      <ActionButton key={JSON.stringify(action)} state={state} action={action} myCamp={myCamp} onAction={play} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="section hand-panel" data-pas-a-pas={pasAPas.designe('main')}>
            <div className="section__head">
              {/* En partie à deux, « ta main » est celle du camp que je tiens : l'autre joueur,
                  lui, n'en voit jamais que le compte (bandeau du plateau). */}
              <h2>{match === null ? 'Ta main' : `Ta main · ${CAMP_NAME[myCamp]}`}</h2>
              <span className="muted">
                {mySide.hand.length} / 10
                {myMove && handActions.length > 0 && !selected ? ' · touche une carte pour la jouer' : ''}
              </span>
            </div>
            {mySide.hand.length === 0 ? (
              <p className="muted">Main vide.</p>
            ) : (
              <ul className="hand">
                {mySide.hand.map((card) => {
                  const definition = getCard(card.cardId);
                  const isSelected = selected?.uid === card.uid;
                  const jouable = handActions.some((action) => 'uid' in action && action.uid === card.uid);
                  return (
                    <li key={card.uid}>
                      <button
                        type="button"
                        className={`hand__card${isSelected ? ' is-selected' : ''}${jouable ? ' is-playable' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedUid(isSelected ? null : card.uid)}
                      >
                        <strong className="hand__name">{cardName(card.cardId)}</strong>
                        <span className="hand__meta">
                          <span className="hand__kind">{kindLabel(definition)}</span>
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
            « Mettre au Rack 2 », « Jouer cet Objet ». Il vient **sous la main** et la page le
            cadre dès qu'une carte est choisie (`poseRef`) : sur téléphone il ne reste jamais
            sous la barre de navigation.
          */}
          {selected && (
            <section className="pose panel" aria-label="Poser la carte choisie" ref={poseRef}>
              <p className="pose__titre">
                <span className="muted">Carte choisie</span> <strong>{cardName(selected.cardId)}</strong>{' '}
                <span className="hand__kind">{kindLabel(selectedDefinition)}</span>
              </p>
              {selectedDefinition && !isPlanque(selectedDefinition) && (
                <p className="hand__text muted">{selectedDefinition.text}</p>
              )}
              {selectedActions.length > 0 ? (
                <>
                  <p className="muted pose__aide">Touche un geste pour la jouer :</p>
                  <div className="actions actions--tight">
                    {selectedActions.map((action) => (
                      <ActionButton key={JSON.stringify(action)} state={state} action={action} myCamp={myCamp} onAction={play} />
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

      <details className="fold" data-pas-a-pas={pasAPas.designe('conditions')} open={pasAPas.designe('conditions') ? true : undefined}>
        <summary>
          <span>Conditions</span> <span className="muted">ce qu’un Planqué au Poste peut subir</span>
        </summary>
        <div className="fold__body">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>Règles</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conditions</DialogTitle>
                <DialogDescription>Ce qu’un Planqué au Poste peut subir.</DialogDescription>
              </DialogHeader>
              {conditionsLegend}
            </DialogContent>
          </Dialog>
          {conditionsLegend}
        </div>
      </details>

      {/*
        La partie à deux (#125) : créer, transmettre le code, le coller. Repliée tant qu'aucune
        partie à deux n'est en cours — elle s'ouvre seule dès qu'il y a un code à passer. Les
        commandes de jeu restent celles du moteur, plus haut : cette section ne fait que
        passer la main.
      */}
      <details className="fold" open={match !== null ? true : undefined}>
        <summary>
          <span>Partie à deux</span> <span className="muted">un code à se passer, sans serveur</span>
        </summary>
        <div className="fold__body">
          {match === null ? (
            <>
              <p className="muted">
                Crée la partie ici : sa graine, ton Deck, et le camp adverse tenu par l’autre
                joueur. Un code apparaît à la fin de ton tour.
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
                Aucun camp n’est joué par l’IA : c’est l’autre joueur qui tient le camp adverse, avec
                les mêmes boutons que toi.
              </p>
              {transfer?.ready ? (
                <>
                  <p className="muted">
                    Ton tour est fini : copie ce code, l’autre joueur le colle dans son onglet et
                    reprend ici, avec le camp adverse.
                  </p>
                  <div className="actions actions--tight">
                    <button type="button" className="button" onClick={copyCode}>
                      <Copy size={16} /> Copier le code
                    </button>
                  </div>
                  <textarea
                    className="pvp__code"
                    readOnly
                    value={code}
                    rows={4}
                    aria-label="Code de la partie, à transmettre"
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
            <textarea
              className="pvp__code"
              value={incoming}
              onChange={(event) => setIncoming(event.target.value)}
              placeholder="PLQ1.…"
              rows={3}
              aria-label="Code reçu, à coller"
            />
          </label>
          <div className="actions actions--tight">
            <button type="button" className="button" onClick={join}>
              <ClipboardPaste size={16} /> Prendre le camp adverse
            </button>
          </div>
          <p className="muted">
            Coller un code remplace le combat affiché : la partie reprend là où l’autre joueur l’a
            laissée, et tu prends le camp qui doit jouer.
          </p>
          {codeMessage && (
            <p className={codeMessage.ton === 'ok' ? 'muted' : 'muted pvp__message--ko'}>{codeMessage.texte}</p>
          )}
        </div>
      </details>

      <details className="fold">
        <summary>
          <span>Journal</span>
        </summary>
        <ol className="log fold__body">
          {state.log.slice(-14).map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      </details>

      {match === null && (
        <p className="muted battle__note">
          La Direction joue toute seule (IA de niveau 1) : son tour s’enchaîne automatiquement. Tous les
          boutons viennent de la liste du moteur — ce qui n’y est pas n’est pas jouable, et rien n’est grisé.
        </p>
      )}
    </div>
  );
}
