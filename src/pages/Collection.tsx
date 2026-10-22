import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { ALL_CARDS, FACTION_META, STAGE_META, isPlanque } from '@/data';
import type { Card, Faction, Stage } from '@/data/types';
import { deckCanAdd, deckCountsByName, MAX_COPIES_PER_NAME } from '@/game/deck';
import { useStore } from '@/store/useStore';
import { CardView } from '@/components/CardView';
import { CardDetail } from '@/components/CardDetail';

const STAGES: Stage[] = ['ENTRANT', 'N+1', 'N+2'];

export function Collection() {
  const { owned, deck, addToDeck, addCard } = useStore();
  const [query, setQuery] = useState('');
  const [faction, setFaction] = useState<Faction | 'ALL'>('ALL');
  const [stage, setStage] = useState<Stage | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Card | null>(null);

  const byName = useMemo(() => deckCountsByName(deck), [deck]);

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
      // Le filtre porte sur le stade : il ne concerne que les Planqués, une carte Action
      // n'a pas de stade (elle est rangée dans son vivier, via sa faction).
      if (stage !== 'ALL' && (!isPlanque(card) || card.stage !== stage)) return false;
      if (needle && !card.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [query, faction, stage]);

  const uniqueOwned = ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0).length;

  return (
    <div className="page collection">
      <section className="section__head">
        <div>
          <h1>{uniqueOwned}/{ALL_CARDS.length} cartes</h1>
          <p className="muted">{visible.length} affichés</p>
        </div>
      </section>

      <div className="filters">
        <label className="field field--search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            placeholder="Chercher une carte"
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
        <p className="empty">Aucune carte ne correspond à cette recherche.</p>
      ) : (
        <div className="card-grid">
          {visible.map((card) => {
            const count = owned[card.id] ?? 0;
            const used = byName[card.name] ?? 0;
            const canAdd = deckCanAdd(deck, card.id);
            return (
              <div className={`card-slot ${canAdd ? '' : 'is-full'}`} key={card.id}>
                <CardView card={card} compact selected={used > 0} onClick={() => setSelected(card)} />
                <button
                  type="button"
                  className="card-slot__quick"
                  title={
                    canAdd
                      ? `Ajouter « ${card.name} » au deck (${used}/${MAX_COPIES_PER_NAME})`
                      : `Deck complet pour « ${card.name} »`
                  }
                  aria-label={`Ajouter ${card.name} au deck`}
                  disabled={!canAdd}
                  onClick={() => addToDeck(card.id)}
                >
                  <Plus size={14} />
                </button>
                <span className={`card-slot__count ${count === 0 ? 'is-missing' : ''}`}>×{count}</span>
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
          onAddDeck={() => addToDeck(selected.id)}
          onAddCard={() => addCard(selected.id)}
        />
      )}
    </div>
  );
}
