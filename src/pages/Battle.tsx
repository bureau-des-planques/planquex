import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coffee, RotateCcw, Swords } from 'lucide-react';
import { ALL_CARDS, getCard, isBasic, isPlanque } from '@/data';
import type { BattleAction, BattleState, Card, CardInstance, PlayerId } from '@/data/types';
import { applyAction, createBattle, legalActions, legalAttacks } from '@/game/engine';
import { deckLegal } from '@/game/deck';
import { useStore } from '@/store/useStore';

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

const STATUS_LABELS: Record<string, string> = {
  SURCHARGE: 'Surcharge',
  EPUISEMENT: 'Épuisement',
  SIESTE: 'Sieste',
  IMMOBILISATION: 'Immobilisation',
  DERIVE: 'Dérive'
};

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

/** Ce qu'un bouton d'action affiche, dérivé de l'action elle-même et de l'état. */
interface ActionView {
  label: string;
  detail?: string;
  cost?: number;
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
        cost: entry?.cost,
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
      {view.cost !== undefined && <span className="pips">{'●'.repeat(view.cost) || '○'}</span>}
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

  // Le chariot du joueur est utilisé s'il est légal, sinon on retombe sur un
  // chariot de test. Calculé une seule fois par rendu : `deckLegal` est appelé
  // au plus une fois, et l'identité de la référence dit si on a replié.
  const playerDeck = useMemo(() => (deckLegal(storeDeck).ok ? storeDeck : testDeck()), [storeDeck]);
  const usedTestDeck = playerDeck !== storeDeck;

  const [state, setState] = useState<BattleState>(() => createBattle(playerDeck, testDeck()));

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
   * **Forfait** (D-030) : la seule action que la Direction ne peut pas porter. Elle
   * vient de `legalActions` (le moteur dit si la partie vit encore, relève comprise) —
   * l'écran ne décide rien — et elle passe par `applyAction` comme les autres boutons.
   * Le camp qui se couche est toujours l'humain : d'où le filtre sur les actions du
   * joueur, même pendant le tour de la Direction.
   */
  const forfeitAction = useMemo(
    () =>
      legal.find(
        (action): action is Extract<BattleAction, { type: 'forfeit' }> =>
          action.type === 'forfeit' && action.who === 'player'
      ),
    [legal]
  );

  const abandon = useCallback(
    (action: BattleAction) => {
      if (window.confirm('Déclarer forfait ? La Direction l’emporte, quel que soit le score.')) play(action);
    },
    [play]
  );

  const restart = useCallback(() => {
    setState(createBattle(playerDeck, testDeck()));
  }, [playerDeck]);

  const rows = useMemo(
    () =>
      [
        { id: 'ai' as PlayerId, label: 'La Direction', side: ai },
        { id: 'player' as PlayerId, label: 'Toi', side: player }
      ] satisfies { id: PlayerId; label: string; side: typeof ai }[],
    [ai, player]
  );

  return (
    <div className="page battle">
      <section className="section__head">
        <div>
          <p className="eyebrow">Prototype</p>
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
        La Direction ne joue pas encore : son tour se termine tout seul. Tous les boutons ci-dessous viennent de la
        liste du moteur — ce qui n’y est pas n’est pas jouable, et rien n’est grisé.
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
                    <span className="pips" title={`${side.active.energy} café(s) attaché(s)`}>
                      {side.active.energy > 0 ? '●'.repeat(side.active.energy) : '○'}
                    </span>
                    <span className="muted">Machine {side.energyZone}</span>
                    {side.active.statuses.map((status) => (
                      <span key={status} className={`status-chip status-chip--${status.toLowerCase()}`}>
                        {STATUS_LABELS[status]}
                      </span>
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

      {state.pendingPromotion && (
        <section className="notice notice--warn promotion">
          {state.pendingPromotion === 'player' ? (
            <p>Ton Poste a craqué. À toi de choisir ta relève.</p>
          ) : (
            <p>
              La Direction doit choisir sa relève. Aucune IA ne joue encore : ces boutons tiennent sa place et
              t’évitent un blocage.
            </p>
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
                        .map((entry) => `${entry.name} (${entry.cost} café${entry.cost > 1 ? 's' : ''})`)
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
