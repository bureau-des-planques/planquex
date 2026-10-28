import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ALL_CARDS, FACTION_META, STAGE_META, isPlanque } from '@/data';
import type { Card, Faction, Stage } from '@/data/types';
import { deckCanAdd, deckCountsByName, MAX_COPIES_PER_NAME } from '@/game/deck';
import { useStore } from '@/store/useStore';
import { CardSlot } from '@/components/CardSlot';
import { CardDetail } from '@/components/CardDetail';
import { causeDuVide } from '@/components/cause-du-vide';
import { HORS_ARRIVAGE, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { TriCartes } from '@/components/TriCartes';
// PROTOTYPE JETABLE (variantes de carte).
import { PrototypeSwitcher } from '@/components/prototype-cartes/PrototypeSwitcher';
import { TRI_DEFAUT, trierCartes } from '@/components/tri-cartes';
import type { Tri } from '@/components/tri-cartes';

const STAGES: Stage[] = ['ENTRANT', 'N+1', 'N+2'];

export function Collection() {
  const { owned, deck, addToDeck, addCard } = useStore();
  const [query, setQuery] = useState('');
  const [faction, setFaction] = useState<Faction | 'ALL'>('ALL');
  const [stage, setStage] = useState<Stage | 'ALL'>('ALL');
  const [tri, setTri] = useState<Tri>(TRI_DEFAUT);
  const [selected, setSelected] = useState<Card | null>(null);

  const byName = useMemo(() => deckCountsByName(deck), [deck]);

  const factions = useMemo(
    () =>
      (Object.keys(FACTION_META) as Faction[]).sort((a, b) => FACTION_META[a].name.localeCompare(FACTION_META[b].name)),
    []
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const gardees = ALL_CARDS.filter((card) => {
      if (faction !== 'ALL' && card.faction !== faction) return false;
      // Le filtre porte sur le stade : il ne concerne que les Planqués, une carte Action
      // n'a pas de stade (elle est rangée dans son vivier, via sa faction).
      if (stage !== 'ALL' && (!isPlanque(card) || card.stage !== stage)) return false;
      if (needle && !card.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    return trierCartes(gardees, tri, owned);
  }, [query, faction, stage, tri, owned]);

  const uniqueOwned = ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0).length;

  /** Pourquoi la grille est vide : ce que le message accuse (`causeDuVide`). */
  const videParce = causeDuVide(query, faction !== 'ALL' || stage !== 'ALL');
  const toutEffacer = () => {
    setQuery('');
    setFaction('ALL');
    setStage('ALL');
  };

  return (
    <div className="page collection">
      <section className="section__head">
        <div>
          <h1>
            {uniqueOwned}/{ALL_CARDS.length} cartes
          </h1>
          <p className="muted">
            {visible.length} affichés · {HORS_ARRIVAGE} cartes ne sortent d’aucun Arrivage : le maximum à tirer est{' '}
            {PLAFOND_TIRABLE}
          </p>
          {/* Le **rôle** de la page (#276) : ici on regarde ce qu'on possède ; le Deck, lui, se
              compose sur sa propre page. Deux lieux, deux gestes — une phrase le dit. */}
          <p className="collection__role">
            Tout ce que tu possèdes : cherche, filtre, ouvre une fiche. Pour composer ton Deck, va sur{' '}
            <Link to="/deck">la page Deck</Link>.
          </p>
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

        <TriCartes value={tri} onChange={setTri} />
      </div>

      {uniqueOwned === 0 && (
        <p className="notice notice--warn">
          Ta Collection est vide : ouvre un Arrivage depuis l’accueil. Les cartes ci-dessous sont celles qu’il te reste
          à trouver.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="empty" role="status">
          <p className="m-0">Aucune carte ne correspond à {videParce}.</p>
          <button type="button" className="button mt-3" onClick={toutEffacer}>
            Tout effacer
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {visible.map((card) => {
            const used = byName[card.name] ?? 0;
            const canAdd = deckCanAdd(deck, card.id);
            return (
              <CardSlot
                key={card.id}
                card={card}
                owned={owned[card.id] ?? 0}
                inDeck={used}
                full={!canAdd}
                selected={used > 0}
                onClick={() => setSelected(card)}
                quick={{
                  icon: <Plus size={14} />,
                  label: `Ajouter ${card.name} au deck`,
                  title: canAdd
                    ? `Ajouter « ${card.name} » au deck (${used}/${MAX_COPIES_PER_NAME})`
                    : `Deck complet pour « ${card.name} »`,
                  disabled: !canAdd,
                  onClick: () => addToDeck(card.id)
                }}
              />
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
      <PrototypeSwitcher />
    </div>
  );
}
