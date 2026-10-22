import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Coffee, RotateCcw, Swords } from 'lucide-react';
import { ALL_CARDS, FACTION_META, getCard, isBasic, isPlanque } from '@/data';
import type { BattleAction, BattleState, CafeSymbol, CafeType, Card, CardInstance, PlayerId, Status } from '@/data/types';
import { applyAction, createBattle, legalActions, legalAttacks } from '@/game/engine';
import { nextAiAction } from '@/game/ia';
import { deckLegal } from '@/game/deck';
import { useStore } from '@/store/useStore';
import { STATUS_META, StatusBadge } from '@/components/StatusBadge';
import { CafeDot, cafeLabel, CafePips } from '@/components/CafePips';
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
 * Chariot de test, quand le chariot du joueur n'est pas encore valide : 8 cartes
 * Action (2 Objets et 2 Collègues distincts, en double) puis des Planqués, en
 * commençant par les Entrants.
 *
 * Les cartes Action y sont volontairement : depuis le ticket #58 la main est
 * affichée et ses cartes se jouent, et un chariot de démonstration sans aucun
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
 * les **types du Chariot** (1 à 3, D-037 (4)) dont la Machine tire le café.
 */
function MachinePips({ zone, cafeTypes }: { zone: CafeSymbol | null; cafeTypes: readonly CafeType[] }) {
  const types = cafeTypes.map((type) => FACTION_META[type].name).join(' · ');
  return (
    <span
      className="muted"
      title={`Machine à café : ${zone ? cafeLabel(zone) : `vide (types du Chariot : ${types || 'aucun'})`}`}
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
 */
function describeAction(state: BattleState, action: BattleAction): ActionView {
  const side = state.players[state.current];
  const handCard = (uid: string) => side.hand.find((card) => card.uid === uid);
  const handDefinition = (uid: string) => {
    const card = handCard(uid);
    return card ? getCard(card.cardId) : undefined;
  };
  const posted = (uid: string) => [side.active, ...side.bench].find((card) => card?.uid === uid) ?? null;
  const activeCard = side.active ? getCard(side.active.cardId) : undefined;

  switch (action.type) {
    case 'playBasic':
      return {
        label: 'Poser',
        detail: `${instanceName(handCard(action.uid))} ${action.slot === 'active' ? 'au Poste' : `au Rack ${Number(action.slot) + 1}`}`
      };
    case 'playAction':
      return {
        label: 'Jouer',
        detail: `${instanceName(handCard(action.uid))} · ${kindLabel(handDefinition(action.uid))}`
      };
    case 'evolve':
      return {
        label: 'Évolution',
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
      const prefix = who === 'player' ? '' : 'Direction · ';
      return { label: 'Relève', detail: `${prefix}${instanceName(state.players[who].bench[action.benchIndex])} au Poste` };
    }
    case 'forfeit':
      return { label: 'Abandonner' };
    case 'endTurn':
      return { label: state.current === 'player' ? 'Fin du tour' : 'Passer le tour de la Direction' };
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
  onAction
}: {
  state: BattleState;
  action: BattleAction;
  onAction: (action: BattleAction) => void;
}) {
  const view = describeAction(state, action);
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
 * Le bandeau de fin dit **pourquoi** la partie s'arrête (#84) : le moteur pose la raison
 * (`endReason`), l'écran ne la déduit plus du seul vainqueur.
 */
function endBanner(state: BattleState): string {
  const won = state.winner === 'player';
  switch (state.endReason) {
    case 'interventions':
      return won ? 'Victoire : 3 Interventions.' : 'Défaite : la Direction marque 3 Interventions.';
    case 'plateauVide':
      return won ? 'Victoire : la Direction n’a plus aucun Planqué.' : 'Défaite : tu n’as plus aucun Planqué.';
    case 'forfait':
      return won ? 'Victoire : la Direction déclare forfait.' : 'Défaite : tu as déclaré forfait.';
    case 'limiteDeTours':
      return 'Égalité : la limite de tours est atteinte.';
    default:
      return won ? 'Victoire.' : state.winner === 'ai' ? 'Défaite.' : 'Égalité.';
  }
}

export function Battle() {
  const storeDeck = useStore((state) => state.deck);
  /** Les types de café choisis au Chariot (#91), lus bruts dans le store. */
  const storedCafeTypes = useStore((state) => state.cafeTypes);

  // Le chariot du joueur est utilisé s'il est légal, sinon on retombe sur un
  // chariot de test. Calculé une seule fois par rendu : `deckLegal` est appelé
  // au plus une fois, et l'identité de la référence dit si on a replié.
  const playerDeck = useMemo(() => (deckLegal(storeDeck).ok ? storeDeck : testDeck()), [storeDeck]);
  const usedTestDeck = playerDeck !== storeDeck;

  /**
   * Le choix **appliqué à ce combat** (#117). Il appartient au Chariot du joueur
   * (`useStore`, `cafeTypes`) : le poser sur un **chariot de test** ferait afficher
   * les types d'un contenu à la place d'un autre. Replié sur le chariot de test, le
   * combat repart donc en **proposition automatique** (`[]`), dérivée de ce chariot —
   * ce que dit aussi le bandeau « ce combat utilise un chariot de test ».
   */
  const chosenCafeTypes = useMemo<CafeType[]>(
    () => (usedTestDeck ? [] : storedCafeTypes),
    [usedTestDeck, storedCafeTypes]
  );

  const [state, setState] = useState<BattleState>(() =>
    createBattle(playerDeck, testDeck(), undefined, { playerCafeTypes: chosenCafeTypes })
  );

  const player = state.players.player;
  const ai = state.players.ai;
  const isPlayerTurn = state.current === 'player' && state.phase === 'playing';
  const playerCard = player.active ? getCard(player.active.cardId) : undefined;
  /** Dernière ligne du journal : ce qui vient de se passer, mis en avant. */
  const lastLog = state.log.at(-1) ?? '';

  /** Le moteur dit ce qui est possible ; l'écran ne fait que le rendre. */
  const legal = useMemo(() => legalActions(state), [state]);
  // Le camp : seul le joueur dont c'est le tour agit. La Direction n'a pas d'IA, donc
  // hors relève l'écran ne montre que la fin de son tour. Ce n'est pas une garde de
  // légalité — la liste ci-dessus la porte déjà — mais une garde de camp.
  const playable = state.pendingPromotion || isPlayerTurn ? legal : legal.filter((action) => action.type === 'endTurn');

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

  const play = useCallback(
    (action: BattleAction) => setState((current) => applyAction(current, action)),
    []
  );

  /**
   * **IA de niveau 1** : quand c'est à la Direction de jouer — ou de choisir sa
   * relève après un craquage —, ses actions s'enchaînent seules, une par un court
   * délai pour rester lisibles. `prefers-reduced-motion` supprime le délai, comme
   * pour les animations de l'écran. La politique vit dans `@/game/ia` : l'écran ne
   * décide rien, il applique ce que `nextAiAction` rend, comme pour ses boutons.
   */
  const reduceMotion = useReducedMotion();
  const aiTurn =
    state.phase === 'playing' &&
    (state.pendingPromotion === 'ai' || (state.current === 'ai' && state.pendingPromotion === null));

  useEffect(() => {
    if (!aiTurn) return;
    const action = nextAiAction(state);
    if (!action) return;
    const timer = window.setTimeout(() => play(action), reduceMotion ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [state, aiTurn, reduceMotion, play]);

  /**
   * **Forfait** (D-030) : la seule action que la Direction ne peut pas porter. Elle
   * vient de `legalActions` (le moteur dit si la partie vit encore, relève comprise) —
   * l'écran ne décide rien — et elle passe par `applyAction` comme les autres boutons.
   *
   * Deux questions distinctes, deux réponses (#123) : le **moteur** dit *si* le forfait
   * est ouvert (`forfeitOffer`), et il le nomme au camp qui a la main ; l'**écran** dit
   * *qui* se couche, et en solo c'est toujours l'humain, `player`, même pendant le tour
   * de la Direction ou pendant une relève. On lit donc la présence de l'action, pas son
   * camp : s'arrêter au camp ferait disparaître le bouton pendant le tour de la Direction,
   * ce que D-030 / #79 a justement ouvert. Le forfait du siège `player` est accepté tant
   * que la partie vit, donc ce bouton ne peut pas être refusé par le moteur (#58).
   */
  const forfeitAction = useMemo(
    () =>
      legal.some((action) => action.type === 'forfeit')
        ? ({ type: 'forfeit', who: 'player' } as const)
        : undefined,
    [legal]
  );

  const abandon = useCallback(
    (action: BattleAction) => {
      if (window.confirm('Déclarer forfait ? La Direction l’emporte, quel que soit le score.')) play(action);
    },
    [play]
  );

  const restart = useCallback(() => {
    setState(createBattle(playerDeck, testDeck(), undefined, { playerCafeTypes: chosenCafeTypes }));
  }, [playerDeck, chosenCafeTypes]);

  const rows = useMemo(
    () =>
      [
        { id: 'ai' as PlayerId, label: 'La Direction', side: ai },
        { id: 'player' as PlayerId, label: 'Toi', side: player }
      ] satisfies { id: PlayerId; label: string; side: typeof ai }[],
    [ai, player]
  );

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
    <div className="page battle">
      <section className="section__head">
        <div>
          <h1>Combat</h1>
          <p className="muted">
            Tour {state.turn} · {state.phase === 'ended' ? 'partie terminée' : isPlayerTurn ? 'à toi' : 'à la Direction'}
          </p>
        </div>
        <div className="actions actions--tight">
          {forfeitAction && (
            <button type="button" className="button" onClick={() => abandon(forfeitAction)}>
              Abandonner
            </button>
          )}
          <button type="button" className="button" onClick={restart}>
            <RotateCcw size={16} /> Nouveau combat
          </button>
        </div>
      </section>

      {usedTestDeck && (
        <p className="notice notice--warn">
          Ton chariot n’est pas valide (20 cartes, 2 exemplaires max, 1 Entrant minimum) : ce combat utilise un chariot de test.
        </p>
      )}

      <p className="notice">
        La Direction joue toute seule (IA de niveau 1) : son tour s’enchaîne automatiquement. Tous les boutons
        ci-dessous viennent de la liste du moteur — ce qui n’y est pas n’est pas jouable, et rien n’est grisé.
      </p>

      {state.phase === 'ended' && (
        <p className={`notice ${state.winner === 'player' ? 'notice--ok' : 'notice--warn'}`}>
          {endBanner(state)}
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

      <section className="board">
        {rows.map(({ id, label, side }) => (
          <article className={`board__side ${state.current === id && state.phase === 'playing' ? 'is-current' : ''}`} key={id}>
            <header className="board__head">
              <h2>{label}</h2>
              <span className={`board__points ${side.points > 0 ? 'is-scored' : ''}`}>
                {'★'.repeat(side.points)}
                {'☆'.repeat(Math.max(0, 3 - side.points))}
              </span>
            </header>

            <div className="board__poste">
              <span className="stat-label">Poste</span>
              {side.active ? (
                <>
                  <div className="poste__head">
                    <strong>{cardName(side.active.cardId)}</strong>
                    <span className="poste__hp">
                      {side.active.maxHp - side.active.hp}/{side.active.maxHp} de Stress
                    </span>
                  </div>
                  <StressBar stress={side.active.maxHp - side.active.hp} max={side.active.maxHp} />
                  <div className="poste__meta">
                    <CafesPips cafes={side.active.energy} />
                    <MachinePips zone={side.energyZone} cafeTypes={side.cafeTypes} />
                    {side.active.statuses.map((status) => (
                      <StatusBadge key={status} status={status} />
                    ))}
                  </div>
                </>
              ) : (
                <strong className="muted">Aucun Planqué — relève à choisir</strong>
              )}
            </div>

            <div className="board__bench">
              <span className="stat-label">Rack</span>
              <ul>
                {side.bench.map((slot, index) => (
                  <li key={index}>{describe(slot)}</li>
                ))}
              </ul>
            </div>

            <p className="muted">
              main {side.hand.length} · Chariot {side.deck.length} · Rebut {side.discard.length}
            </p>
          </article>
        ))}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Conditions</h2>
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
          <span className="muted">ce qu’un Planqué au Poste peut subir</span>
        </div>
        {conditionsLegend}
      </section>

      {state.pendingPromotion && (
        <section className="notice notice--warn promotion">
          {state.pendingPromotion === 'player' ? (
            <p>Ton Poste a craqué. À toi de choisir ta relève.</p>
          ) : (
            <p>Le Poste de la Direction a craqué. Elle choisit sa relève toute seule.</p>
          )}
          <div className="actions">
            {promotions.map((action) => (
              <ActionButton key={JSON.stringify(action)} state={state} action={action} onAction={play} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Ta main</h2>
          <span className="muted">{player.hand.length} / 10</span>
        </div>
        {player.hand.length === 0 ? (
          <p className="muted">Main vide.</p>
        ) : (
          <ul className="hand">
            {player.hand.map((card) => {
              const definition = getCard(card.cardId);
              const mine = handActions.filter((action) => 'uid' in action && action.uid === card.uid);
              return (
                <li className="hand__card" key={card.uid}>
                  <div className="hand__head">
                    <strong>{cardName(card.cardId)}</strong>
                    <span className="hand__kind">{kindLabel(definition)}</span>
                  </div>
                  {definition && !isPlanque(definition) && <p className="hand__text muted">{definition.text}</p>}
                  {mine.length > 0 && (
                    <div className="actions actions--tight">
                      {mine.map((action) => (
                        <ActionButton key={JSON.stringify(action)} state={state} action={action} onAction={play} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Au Poste</h2>
        </div>
        {boardActions.length === 0 && pressions.length === 0 && turnActions.length === 0 ? (
          <p className="muted">Rien à faire : la partie est terminée.</p>
        ) : (
          <>
            {boardActions.length > 0 && (
              <div className="actions">
                {boardActions.map((action) => (
                  <ActionButton key={JSON.stringify(action)} state={state} action={action} onAction={play} />
                ))}
              </div>
            )}
            {pressions.length > 0 && (
              <div className="actions actions--pressions">
                {pressions.map((action) => (
                  <ActionButton key={JSON.stringify(action)} state={state} action={action} onAction={play} />
                ))}
              </div>
            )}
            {state.pendingPromotion === null && playerCard && isPlanque(playerCard) && playerCard.attacks.length > 0 && (
              <p className="muted">
                {player.hasAttacked
                  ? 'Pression déjà portée ce tour.'
                  : inReach.length === playerCard.attacks.length
                    ? 'Toutes tes Pressions sont à portée de café.'
                    : `Hors de portée du café : ${playerCard.attacks
                        .filter((entry) => !inReach.includes(entry))
                        .map((entry) => `${entry.name} (${entry.cost.map(cafeLabel).join(' · ')})`)
                        .join(', ')}.`}
              </p>
            )}
            {turnActions.length > 0 && (
              <div className="actions actions--turn">
                {turnActions.map((action) => (
                  <ActionButton key={JSON.stringify(action)} state={state} action={action} onAction={play} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Journal</h2>
        </div>
        <ol className="log">
          {state.log.slice(-14).map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
