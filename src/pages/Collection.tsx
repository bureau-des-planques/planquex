import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ALL_CARDS, FACTION_META, STAGE_META } from '@/data';
import type { Card, Faction, Stage } from '@/data/types';
import { useStore } from '@/store/useStore';
import { CardView } from '@/components/CardView';
import { CardDetail } from '@/components/CardDetail';

const STAGES: Stage[] = ['N+1', 'N+2', 'COMEX'];

export function Collection() {
  const { owned, deck, toggleDeck, addCard } = useStore();
  const [query, setQuery] = useState('');
  const [faction, setFaction] = useState<Faction | 'ALL'>('ALL');
  const [stage, setStage] = useState<Stage | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Card | null>(null);

  const factions = useMemo(
    () => (Object.keys(FACTION_META) as Faction[]).sort((a, b) =>
      FACTION_META[a].name.localeCompare(FACTION_META[b].name)
    ),
    []
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      if (faction !== 'ALL' && card.faction !== faction) return false;
      if (stage !== 'ALL' && card.stage !== stage) return false;
      if (needle && !card.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [query, faction, stage]);

  const uniqueOwned = ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0).length;

  return (
    <div className="page collection">
      <section className="section__head">
        <div>
          <p className="eyebrow">Galérodex</p>
          <h1>Collection</h1>
          <p className="muted">
            {uniqueOwned}/{ALL_CARDS.length} Planqués possédés · {visible.length} affichés
          </p>
        </div>
      </section>

      <div className="filters">
        <label className="field field--search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            placeholder="Chercher un Planqué"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Faction</span>
          <select value={faction} onChange={(event) => setFaction(event.target.value as Faction | 'ALL')}>
            <option value="ALL">Toutes</option>
            {factions.map((key) => (
              <option key={key} value={key}>
                {FACTION_META[key].name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Stade</span>
          <select value={stage} onChange={(event) => setStage(event.target.value as Stage | 'ALL')}>
            <option value="ALL">Tous</option>
            {STAGES.map((key) => (
              <option key={key} value={key}>
                {STAGE_META[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="empty">Aucun Planqué ne correspond à cette recherche.</p>
      ) : (
        <div className="card-grid">
          {visible.map((card) => {
            const count = owned[card.id] ?? 0;
            return (
              <div className="card-slot" key={card.id}>
                <CardView
                  card={card}
                  compact
                  selected={deck.includes(card.id)}
                  onClick={() => setSelected(card)}
                />
                <span className={`card-slot__count ${count === 0 ? 'is-missing' : ''}`}>
                  ×{count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <CardDetail
          card={selected}
          owned={owned[selected.id] ?? 0}
          onClose={() => setSelected(null)}
          onAddDeck={() => toggleDeck(selected.id)}
          onAddCard={() => addCard(selected.id)}
        />
      )}
    </div>
  );
}
