import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coffee, RotateCcw, Swords } from 'lucide-react';
import { ALL_CARDS, getCard } from '@/data';
import type { BattleState, CardInstance, PlayerId } from '@/data/types';
import { attachEnergy, attack, createBattle, endTurn, promoteActive } from '@/game/engine';
import { deckLegal } from '@/game/deck';
import { useStore } from '@/store/useStore';

/**
 * Classeur de test : 10 cartes de base en double, en commençant par les N+1.
 * Sert quand le classeur du joueur n'est pas encore valide.
 */
function testDeck(): string[] {
  const bases = ALL_CARDS.filter((card) => !card.variantOf);
  const ordered = [
    ...bases.filter((card) => card.stage === 'N+1'),
    ...bases.filter((card) => card.stage !== 'N+1')
  ];
  const deck: string[] = [];
  for (const card of ordered) {
    if (deck.length >= 20) break;
    deck.push(card.id);
    if (deck.length < 20) deck.push(card.id);
  }
  return deck.slice(0, 20);
}

function describe(instance: CardInstance | null): string {
  if (!instance) return 'Aucun';
  const card = getCard(instance.cardId);
  return card ? `${card.name} · ${instance.hp}/${instance.maxHp} moral` : 'Carte inconnue';
}

const STATUS_LABELS: Record<string, string> = {
  SURCHARGE: 'Surcharge',
  BURNOUT: 'Burn-out',
  BLOQUE: 'Bloqué',
  GELE: 'Gelé',
  DERIVE: 'Dérive'
};

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const level = pct <= 25 ? 'is-low' : pct <= 50 ? 'is-mid' : '';
  return (
    <div className="hp" role="img" aria-label={`Moral : ${current} sur ${max}`}>
      <div className={`hp__fill ${level}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Battle() {
  const storeDeck = useStore((state) => state.deck);

  // Le classeur du joueur est utilisé s'il est légal, sinon on retombe sur un
  // classeur de test. Calculé une seule fois par rendu : `deckLegal` est appelé
  // au plus une fois, et l'identité de la référence dit si on a replié.
  const playerDeck = useMemo(() => (deckLegal(storeDeck).ok ? storeDeck : testDeck()), [storeDeck]);
  const usedTestDeck = playerDeck !== storeDeck;

  const [state, setState] = useState<BattleState>(() => createBattle(playerDeck, testDeck()));

  const player = state.players.player;
  const ai = state.players.ai;
  const isPlayerTurn = state.current === 'player' && state.phase === 'playing';
  // Une relève en attente bloque tout : il faut la choisir d'abord (§4).
  const canAct = isPlayerTurn && state.pendingPromotion === null;
  const playerCard = player.active ? getCard(player.active.cardId) : undefined;
  /** Dernière ligne du journal : ce qui vient de se passer, mis en avant. */
  const lastLog = state.log.at(-1) ?? '';

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
        <button type="button" className="button" onClick={restart}>
          <RotateCcw size={16} /> Nouveau combat
        </button>
      </section>

      {usedTestDeck && (
        <p className="notice notice--warn">
          Ton classeur n’est pas valide (20 cartes, 2 exemplaires max, 1 N+1 minimum) : ce combat utilise un classeur de test.
        </p>
      )}

      <p className="notice">
        L’IA ne joue pas encore : son tour se termine tout seul. Aucune pose manuelle ni évolution n’est exposée pour l’instant.
      </p>

      {state.phase === 'ended' && (
        <p className={`notice ${state.winner === 'player' ? 'notice--ok' : 'notice--warn'}`}>
          {state.winner === 'player' ? 'Victoire : 3 Primes.' : 'Défaite : la Direction marque 3 Primes.'}
        </p>
      )}

      {lastLog && (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={state.log.length}
            className={`banner ${/K\.O\./.test(lastLog) ? 'banner--ko' : ''}`}
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
                    <strong>{getCard(side.active.cardId)?.name ?? 'Carte inconnue'}</strong>
                    <span className="poste__hp">
                      {side.active.hp}/{side.active.maxHp}
                    </span>
                  </div>
                  <HpBar current={side.active.hp} max={side.active.maxHp} />
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
              <span className="stat-label">Open-space</span>
              <ul>
                {side.bench.map((slot, index) => (
                  <li key={index}>{describe(slot)}</li>
                ))}
              </ul>
            </div>

            <p className="muted">
              Courrier {side.hand.length} · Classeur {side.deck.length} · Archive {side.discard.length}
            </p>
          </article>
        ))}
      </section>

      {state.pendingPromotion && (
        <section className="notice notice--warn promotion">
          {state.pendingPromotion === 'player' ? (
            <>
              <p>Ton Poste est K.-O. À toi de choisir ta relève.</p>
              <div className="actions">
                {player.bench.map((slot, index) =>
                  slot ? (
                    <button
                      key={slot.uid}
                      type="button"
                      className="button button--primary"
                      onClick={() => setState((current) => promoteActive(current, index))}
                    >
                      {getCard(slot.cardId)?.name ?? 'Un Planqué'} au Poste
                    </button>
                  ) : null
                )}
              </div>
            </>
          ) : (
            <>
              <p>
                La Direction doit choisir sa relève. Aucune IA ne joue encore : ce bouton tient sa place et
                prend le premier Planqué de son Open-space.
              </p>
              <button
                type="button"
                className="button"
                onClick={() =>
                  setState((current) => promoteActive(current, current.players.ai.bench.findIndex(Boolean)))
                }
              >
                Faire choisir la Direction (provisoire)
              </button>
            </>
          )}
        </section>
      )}

      <section className="actions">
        <button
          type="button"
          className="button"
          disabled={!canAct || !player.active || player.energyAttached || player.energyZone <= 0}
          onClick={() => setState((current) => attachEnergy(current, current.players.player.active?.uid ?? ''))}
        >
          <Coffee size={16} /> Attacher 1 café
        </button>

        {(playerCard?.attacks ?? []).map((attackEntry, index) => (
          <button
            type="button"
            className="button button--primary"
            key={attackEntry.name}
            disabled={!canAct || player.hasAttacked || (player.active?.energy ?? 0) < attackEntry.cost}
            onClick={() => setState((current) => attack(current, index))}
          >
            <Swords size={16} /> {attackEntry.name}
            <span className="pips">{'●'.repeat(attackEntry.cost) || '○'}</span>
            <span className="attack__dmg">{attackEntry.damage}</span>
          </button>
        ))}

        <button
          type="button"
          className="button"
          disabled={state.phase === 'ended' || state.pendingPromotion !== null}
          onClick={() => setState((current) => endTurn(current))}
        >
          {isPlayerTurn ? 'Fin du tour' : 'Passer le tour de la Direction'}
        </button>
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
