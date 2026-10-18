import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ALL_CARDS, STAGE_META } from '@/data';
import type { Card } from '@/data/types';
import { deckCards, deckCounts, deckLegal, useStore } from '@/store/useStore';
import { CardView } from '@/components/CardView';
import { CardDetail } from '@/components/CardDetail';

export function Deck() {
  const { owned, deck, toggleDeck, clearDeck } = useStore();
  const [selected, setSelected] = useState<Card | null>(null);

  const legality = useMemo(() => deckLegal(deck), [deck]);
  const counts = useMemo(() => deckCounts(deck), [deck]);
  const inDeck = useMemo(() => deckCards(deck), [deck]);

  const available = useMemo(
    () =>
      ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0).sort((a, b) => {
        const stage = STAGE_META[b.stage].order - STAGE_META[a.stage].order;
        return stage !== 0 ? stage : a.name.localeCompare(b.name);
      }),
    [owned]
  );

  return (
    <div className="page deck">
      <section className="section__head">
        <div>
          <p className="eyebrow">Classeur</p>
          <h1>{deck.length}/20 cartes</h1>
          <p className="muted">2 exemplaires maximum par nom, au moins un Planqué N+1.</p>
        </div>
        <button type="button" className="button" onClick={clearDeck} disabled={deck.length === 0}>
          <Trash2 size={16} /> Vider
        </button>
      </section>

      <p className={`notice ${legality.ok ? 'notice--ok' : 'notice--warn'}`}>
        {legality.ok ? 'Classeur valide.' : legality.reasons.join(' ')}
      </p>

      <section className="section">
        <div className="section__head">
          <h2>Dedans ({inDeck.length})</h2>
        </div>
        {inDeck.length === 0 ? (
          <p className="empty">Le classeur est vide. Ajoute des cartes depuis ta collection.</p>
        ) : (
          <div className="card-grid">
            {inDeck.map((card, index) => (
              <div className="card-slot" key={`${card.id}-${index}`}>
                <CardView card={card} compact onClick={() => toggleDeck(card.id)} />
                <span className="card-slot__count">×{counts[card.id] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Collection ({available.length})</h2>
        </div>
        {available.length === 0 ? (
          <p className="empty">Aucune carte possédée. Ouvre un bac à courrier depuis l’accueil.</p>
        ) : (
          <div className="card-grid">
            {available.map((card) => (
              <div className="card-slot" key={card.id}>
                <CardView
                  card={card}
                  compact
                  selected={deck.includes(card.id)}
                  onClick={() => setSelected(card)}
                />
                <span className={`card-slot__count ${(counts[card.id] ?? 0) === 0 ? 'is-missing' : ''}`}>
                  ×{counts[card.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <CardDetail
          card={selected}
          owned={owned[selected.id] ?? 0}
          onClose={() => setSelected(null)}
          onAddDeck={() => toggleDeck(selected.id)}
          onAddCard={() => useStore.getState().addCard(selected.id)}
        />
      )}
    </div>
  );
}
