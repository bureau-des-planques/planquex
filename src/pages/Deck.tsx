import { useMemo, useState } from 'react';
import { Info, Sparkles, Trash2 } from 'lucide-react';
import { ALL_CARDS, FACTION_META, STAGE_META, isPlanque } from '@/data';
import type { Card } from '@/data/types';
import {
  autoDeck,
  deckCanAdd,
  deckCafeTypes,
  deckCards,
  deckCounts,
  deckCountsByName,
  deckLegal,
  MAX_COPIES_PER_NAME
} from '@/game/deck';
import { useStore } from '@/store/useStore';
import { CardView } from '@/components/CardView';
import { CardDetail } from '@/components/CardDetail';

export function Deck() {
  const { owned, deck, addToDeck, removeFromDeck, setDeck, clearDeck, addCard } = useStore();
  const [selected, setSelected] = useState<Card | null>(null);

  const legality = useMemo(() => deckLegal(deck), [deck]);
  const counts = useMemo(() => deckCounts(deck), [deck]);
  const byName = useMemo(() => deckCountsByName(deck), [deck]);
  const inDeck = useMemo(() => deckCards(deck), [deck]);
  const automatic = useMemo(() => autoDeck(owned), [owned]);
  const cafeTypes = useMemo(() => deckCafeTypes(deck), [deck]);

  const available = useMemo(
    () =>
      ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0).sort((a, b) => {
        // Les Planqués d'abord, par stade décroissant ; les cartes Action ensuite.
        const rank = (card: Card) => (isPlanque(card) ? STAGE_META[card.stage].order : 0);
        const stage = rank(b) - rank(a);
        return stage !== 0 ? stage : a.name.localeCompare(b.name);
      }),
    [owned]
  );

  return (
    <div className="page deck">
      <section className="section__head">
        <div>
          <p className="eyebrow">Chariot</p>
          <h1>{deck.length}/20 cartes</h1>
          <p className="muted">
            Un clic sur une carte l’ajoute, un clic sur une carte du haut la retire.{' '}
            {MAX_COPIES_PER_NAME} exemplaires maximum par nom.
          </p>
        </div>
        <div className="section__actions">
          <button
            type="button"
            className="button button--primary"
            disabled={automatic.deck.length === 0}
            onClick={() => setDeck(automatic.deck)}
            title="Remplace le chariot par 20 cartes prises dans ta collection"
          >
            <Sparkles size={16} /> Remplir ({automatic.deck.length})
          </button>
          <button type="button" className="button" onClick={clearDeck} disabled={deck.length === 0}>
            <Trash2 size={16} /> Vider
          </button>
        </div>
      </section>

      {automatic.missing > 0 && (
        <p className="notice notice--warn">
          Ton Parc ne couvre que <strong>{automatic.deck.length}</strong> cartes sur 20 : ouvre des arrivages depuis
          l’accueil pour compléter.
        </p>
      )}

      <p className={`notice ${legality.ok ? 'notice--ok' : 'notice--warn'}`}>
        {legality.ok ? 'Chariot valide : il peut partir au combat.' : legality.reasons.join(' ')}
      </p>

      <p className="muted">
        Types de café du Chariot :{' '}
        {cafeTypes.length > 0
          ? cafeTypes.map((type) => FACTION_META[type].short).join(', ')
          : 'aucun — ce Chariot ne produira pas de café'}
        .
      </p>

      <section className="section">
        <div className="section__head">
          <h2>Dedans ({inDeck.length})</h2>
          <span className="muted">clic = retirer un exemplaire</span>
        </div>
        {inDeck.length === 0 ? (
          <p className="empty">
            Le chariot est vide. Clique une carte du Parc ci-dessous, ou utilise « Remplir ».
          </p>
        ) : (
          <div className="card-grid">
            {inDeck.map((card, index) => (
              <div className="card-slot" key={`${card.id}-${index}`}>
                <CardView card={card} compact onClick={() => removeFromDeck(card.id)} />
                <button
                  type="button"
                  className="card-slot__quick"
                  title={`Fiche de ${card.name}`}
                  aria-label={`Fiche de ${card.name}`}
                  onClick={() => setSelected(card)}
                >
                  <Info size={14} />
                </button>
                <span className="card-slot__count">×{counts[card.id] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Parc ({available.length})</h2>
          <span className="muted">clic = ajouter au chariot</span>
        </div>
        {available.length === 0 ? (
          <p className="empty">Aucune carte possédée. Ouvre un Arrivage depuis l’accueil.</p>
        ) : (
          <div className="card-grid">
            {available.map((card) => {
              const used = byName[card.name] ?? 0;
              const canAdd = deckCanAdd(deck, card.id);
              return (
                <div className={`card-slot ${canAdd ? '' : 'is-full'}`} key={card.id}>
                  <CardView card={card} compact selected={used > 0} onClick={() => addToDeck(card.id)} />
                  <button
                    type="button"
                    className="card-slot__quick"
                    title={`Fiche de ${card.name}`}
                    aria-label={`Fiche de ${card.name}`}
                    onClick={() => setSelected(card)}
                  >
                    <Info size={14} />
                  </button>
                  <span
                    className={`card-slot__count ${used === 0 ? 'is-missing' : ''}`}
                    title={`${used} exemplaire(s) de « ${card.name} » au chariot`}
                  >
                    ×{used}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <CardDetail
          card={selected}
          owned={owned[selected.id] ?? 0}
          onClose={() => setSelected(null)}
          onAddDeck={() => addToDeck(selected.id)}
          onAddCard={() => addCard(selected.id)}
        />
      )}
    </div>
  );
}
