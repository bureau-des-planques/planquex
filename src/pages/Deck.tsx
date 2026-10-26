import { useMemo, useState } from 'react';
import { Info, Sparkles, Trash2 } from 'lucide-react';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import type { DeckPropose } from '@/data/decks-proposes';
import { ALL_CARDS, FACTION_META, STAGE_META, VIVIER_META, isPlanque } from '@/data';
import type { Card, CafeType } from '@/data/types';
import {
  autoDeck,
  CAFE_FACTIONS,
  deckCanAdd,
  deckCafeTypes,
  deckCards,
  deckCounts,
  deckCountsByName,
  deckLegal,
  MAX_COPIES_PER_NAME,
  MAX_DECK_CAFE_TYPES,
  normalizeCafeTypes,
  resolveCafeTypes
} from '@/game/deck';
import { useStore } from '@/store/useStore';
import { CardSlot } from '@/components/CardSlot';
import { CardDetail } from '@/components/CardDetail';
import { TriCartes } from '@/components/TriCartes';
import { TRI_DEFAUT, trierCartes } from '@/components/tri-cartes';
import type { Tri } from '@/components/tri-cartes';

export function Deck() {
  const {
    owned,
    deck,
    cafeTypes: storedCafeTypes,
    addToDeck,
    removeFromDeck,
    setDeck,
    clearDeck,
    addCard,
    setCafeTypes,
    toggleCafeType
  } = useStore();
  const [selected, setSelected] = useState<Card | null>(null);
  /** Un seul tri pour « Dedans » et pour la Collection du Deck : les deux se lisent pareil. */
  const [tri, setTri] = useState<Tri>(TRI_DEFAUT);

  /**
   * Le choix **normalisé**, lu ici et pas seul dans le moteur : l'écran est le dernier à
   * lire la valeur brute du store, et un état trafiqué (`localStorage` modifié à la main)
   * ferait planter `cafeLabel` sur `FACTION_META[d'une valeur inconnue]` — ou afficherait
   * « SUP » pour un type que la Machine n'utilise pas (relecture lourde de #91).
   */
  const chosenCafeTypes = useMemo(() => normalizeCafeTypes(storedCafeTypes), [storedCafeTypes]);

  const legality = useMemo(() => deckLegal(deck), [deck]);
  const counts = useMemo(() => deckCounts(deck), [deck]);
  const byName = useMemo(() => deckCountsByName(deck), [deck]);
  const inDeck = useMemo(() => deckCards(deck), [deck]);
  const automatic = useMemo(() => autoDeck(owned), [owned]);
  /** La proposition automatique : les factions que le Deck porte déjà (D-037 (4)). */
  const proposed = useMemo(() => deckCafeTypes(deck), [deck]);
  /** Ce que la Machine produira : le choix validé, sinon la proposition. */
  const cafeTypes = useMemo(() => resolveCafeTypes(deck, chosenCafeTypes), [deck, chosenCafeTypes]);
  /** Les types présents au Deck d'abord, les autres factions produisibles ensuite. */
  const cafeProposals = useMemo(
    () => [...proposed, ...CAFE_FACTIONS.filter((type) => !proposed.includes(type))],
    [proposed]
  );
  const cafeLabel = (types: readonly CafeType[]) =>
    types.map((type) => FACTION_META[type].short).join(', ');

  /** Charger un Deck proposé : ses cartes **et** ses types de café, en un geste (#141). */
  const chargerDeck = (deckPropose: DeckPropose) => {
    setDeck([...deckPropose.cartes]);
    setCafeTypes([...deckPropose.cafeTypes]);
  };

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
  const dedansTrie = useMemo(() => trierCartes(inDeck, tri, owned), [inDeck, tri, owned]);
  const availableTrie = useMemo(() => trierCartes(available, tri, owned), [available, tri, owned]);

  return (
    <div className="page deck">
      <section className="section__head">
        <div>
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
            title="Remplace le deck par 20 cartes prises dans ta collection"
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
          Ta Collection ne couvre que <strong>{automatic.deck.length}</strong> cartes sur 20 : ouvre des arrivages depuis
          l’accueil pour compléter.
        </p>
      )}

      <p className={`notice ${legality.ok ? 'notice--ok' : 'notice--warn'}`}>
        {legality.ok ? 'Deck valide : il peut partir au combat.' : legality.reasons.join(' ')}
      </p>

      <section className="section panel decks-proposes">
        <div className="section__head">
          <div>
            <h2>Decks proposés</h2>
            <p className="muted">
              Des Decks prêts à jouer, indépendants de ta Collection. Charger remplace le Deck actuel.
            </p>
          </div>
        </div>
        <ul className="decks-proposes__list">
          {DECKS_PROPOSES.map((deckPropose) => (
            <li key={deckPropose.id} className="decks-proposes__item">
              <div>
                <h3>
                  {deckPropose.name}{' '}
                  <span className="muted">
                    — {deckPropose.vivier === 'MIXTE' ? 'Mixte' : VIVIER_META[deckPropose.vivier].label} ·{' '}
                    {cafeLabel(deckPropose.cafeTypes)}
                  </span>
                </h3>
                <p>{deckPropose.strategie}</p>
                <p className="muted">Faible : {deckPropose.faiblesse}</p>
              </div>
              <button type="button" className="button" onClick={() => chargerDeck(deckPropose)}>
                Charger
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="section panel cafe-picker">
        <div className="section__head">
          <div>
            <h2>Machine à café</h2>
            <p className="muted">
              Choisis de 1 à {MAX_DECK_CAFE_TYPES} types de café : la Machine ne tire que dans ceux-là.
              Support et Intérim n’en produisent jamais.
            </p>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => setCafeTypes([])}
            disabled={chosenCafeTypes.length === 0}
            title="Revenir aux factions présentes dans le Deck"
          >
            Proposition automatique
          </button>
        </div>

        <div className="cafe-picker__types" role="group" aria-label="Types de café du Deck">
          {cafeProposals.map((type) => {
            const chosen = chosenCafeTypes.includes(type);
            const inDeck = proposed.includes(type);
            // Trois types déjà choisis : les autres cases se ferment, comme le plafond.
            const full = !chosen && chosenCafeTypes.length >= MAX_DECK_CAFE_TYPES;
            return (
              <button
                key={type}
                type="button"
                className={`cafe-picker__type ${chosen ? 'is-chosen' : ''} ${inDeck ? 'is-proposed' : ''}`}
                aria-pressed={chosen}
                disabled={full}
                title={`${FACTION_META[type].name}${inDeck ? ' — présent au Deck' : ''}`}
                onClick={() => toggleCafeType(type)}
              >
                <span
                  className="cafe-picker__glyph"
                  aria-hidden="true"
                  style={{ background: FACTION_META[type].color }}
                >
                  {FACTION_META[type].glyph}
                </span>
                {FACTION_META[type].short}
                {inDeck && <span className="cafe-picker__tag">au Deck</span>}
              </button>
            );
          })}
        </div>

        <p className="muted">
          {chosenCafeTypes.length > 0
            ? `Choix manuel : ${cafeLabel(chosenCafeTypes)}.`
            : proposed.length > 0
              ? `Proposition automatique : ${cafeLabel(proposed)}.`
              : 'Aucun type : ce Deck ne produira pas de café.'}
          {cafeTypes.length > 0 && ` La Machine tirera dans ${cafeLabel(cafeTypes)}.`}
        </p>
      </section>

      <div className="filters filters--deck">
        <TriCartes value={tri} onChange={setTri} />
      </div>

      <section className="section">
        <div className="section__head">
          <h2>Dedans ({inDeck.length})</h2>
          <span className="muted">clic = retirer un exemplaire</span>
        </div>
        {inDeck.length === 0 ? (
          <p className="empty">
            Le deck est vide. Clique une carte de la Collection ci-dessous, ou utilise « Remplir ».
          </p>
        ) : (
          <div className="card-grid">
            {dedansTrie.map((card, index) => (
              <CardSlot
                key={`${card.id}-${index}`}
                card={card}
                inDeck={counts[card.id] ?? 0}
                onClick={() => removeFromDeck(card.id)}
                quick={{
                  icon: <Info size={14} />,
                  label: `Fiche de ${card.name}`,
                  title: `Fiche de ${card.name}`,
                  onClick: () => setSelected(card)
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Collection ({available.length})</h2>
          <span className="muted">clic = ajouter au deck</span>
        </div>
        {available.length === 0 ? (
          <p className="empty">Aucune carte possédée. Ouvre un Arrivage depuis l’accueil.</p>
        ) : (
          <div className="card-grid">
            {availableTrie.map((card) => {
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
                  onClick={() => addToDeck(card.id)}
                  quick={{
                    icon: <Info size={14} />,
                    label: `Fiche de ${card.name}`,
                    title: `Fiche de ${card.name}`,
                    onClick: () => setSelected(card)
                  }}
                />
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
