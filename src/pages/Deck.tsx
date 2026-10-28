import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Info, Search, Sparkles, Trash2 } from 'lucide-react';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import type { DeckPropose } from '@/data/decks-proposes';
import { ALL_CARDS, FACTION_META, RARITY_META, STAGE_META, VIVIER_META, isPlanque } from '@/data';
import type { Card, CafeType, Rarity } from '@/data/types';
import {
  autoDeck,
  CAFE_FACTIONS,
  DECK_SIZE,
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
import { decodeDeckCode, encodeDeckCode } from '@/game/codec';
import { useStore } from '@/store/useStore';
import { CardSlot } from '@/components/CardSlot';
import { CardDetail } from '@/components/CardDetail';
import { TriCartes } from '@/components/TriCartes';
import { TRI_DEFAUT, trierCartes } from '@/components/tri-cartes';
import type { Tri } from '@/components/tri-cartes';
import {
  COUTS_PRESENTS,
  FILTRES_DEFAUT,
  filtrerCartes,
  filtresActifs,
  libelleCout
} from '@/components/filtres-collection';
import type { Filtres } from '@/components/filtres-collection';
import { causeDuVide } from '@/components/cause-du-vide';
import { courbeDeck } from '@/components/courbe-deck';

const RARETES = Object.keys(RARITY_META) as Rarity[];

/**
 * Le nombre de cartes que le sélecteur du Deck montre d'un coup (#276) : de quoi remplir
 * largement un Deck (2 × 20), pas la Collection entière. Au-delà, on cherche un nom.
 */
export const SELECTEUR_CARTES = DECK_SIZE * 2;

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
  /** Un seul tri pour « Dedans » et pour le sélecteur : les deux se lisent pareil. */
  const [tri, setTri] = useState<Tri>(TRI_DEFAUT);
  /**
   * Les filtres du **sélecteur borné** (#276, #364) : la recherche, la rareté et le coût. Ils
   * vivent en mémoire de la page (pas dans l'adresse) : c'est un outil de composition, pas une
   * adresse à partager. Les filtres de la Collection (`filtres-collection.ts`) en sont la logique.
   */
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_DEFAUT);
  /** Le code qu'on colle pour importer un Deck partagé (#363). */
  const [codeAColler, setCodeAColler] = useState('');
  /** Le retour de la dernière copie ou du dernier import : dit ce qui s'est passé. */
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

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
  // Le **sigle** (et non le nom) : c'est la liste compacte de la Machine, pas un libellé
  // de café. Il ne porte donc pas le nom `cafeLabel`, qui dit le nom ailleurs (#248).
  const cafeSigles = (types: readonly CafeType[]) => types.map((type) => FACTION_META[type].short).join(', ');

  /** Charger un Deck proposé : ses cartes **et** ses types de café, en un geste (#141). */
  const chargerDeck = (deckPropose: DeckPropose) => {
    setDeck([...deckPropose.cartes]);
    setCafeTypes([...deckPropose.cafeTypes]);
  };

  /** Le code du Deck tel qu'on le partage : cartes et types **choisis** (vide = auto). */
  const codeDuDeck = useMemo(() => encodeDeckCode(deck, chosenCafeTypes), [deck, chosenCafeTypes]);
  /** Exemplaires du Deck que la Collection ne possède pas : grisés, comptés, jamais retirés (#363). */
  const absentes = useMemo(() => deck.filter((id) => (owned[id] ?? 0) === 0).length, [deck, owned]);

  const copierLeCode = async () => {
    try {
      await navigator.clipboard.writeText(codeDuDeck);
      setRetour({ ok: true, texte: 'Code copié. Colle-le à qui doit recevoir ce Deck.' });
    } catch {
      setRetour({ ok: false, texte: 'Copie impossible ici : sélectionne le code et copie-le à la main.' });
    }
  };

  const importerLeCode = () => {
    const resultat = decodeDeckCode(codeAColler);
    if (!resultat.ok) {
      setRetour({ ok: false, texte: resultat.raison });
      return;
    }
    // Le Deck importé **remplace** le Deck actuel, comme « Charger » : c'est un geste explicite.
    setDeck([...resultat.deck.cartes]);
    setCafeTypes([...resultat.deck.cafeTypes]);
    const manquantes = resultat.deck.cartes.filter((id) => (owned[id] ?? 0) === 0).length;
    setRetour({
      ok: true,
      texte:
        manquantes > 0
          ? `Deck importé : ${resultat.deck.cartes.length} cartes, dont ${manquantes} que tu ne possèdes pas (grisées ci-dessous).`
          : `Deck importé : ${resultat.deck.cartes.length} cartes, toutes possédées.`
    });
    setCodeAColler('');
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
  const availableTrie = useMemo(
    () => trierCartes(filtrerCartes(available, filtres, owned), tri, owned),
    [available, filtres, tri, owned]
  );
  /** Ce que le sélecteur montre : un **sous-ensemble** de la Collection, jamais son tout. */
  const proposes = availableTrie.slice(0, SELECTEUR_CARTES);
  const restantes = availableTrie.length - proposes.length;
  /** La courbe de coût du Deck (#364) : une lecture, jamais une règle. */
  const courbe = useMemo(() => courbeDeck(inDeck), [inDeck]);
  /** Ce qui manque pour atteindre 20 : le compte du sélecteur le dit en permanence. */
  const manquent = Math.max(0, DECK_SIZE - deck.length);
  /** Le nombre de filtres posés hors recherche : il dit la cause d'un sélecteur vide. */
  const filtresActifsN = filtresActifs(filtres);
  const filtreHorsRecherche = filtresActifsN > (filtres.texte.trim() !== '' ? 1 : 0);
  const videParce = causeDuVide(filtres.texte, filtreHorsRecherche);
  const modifierFiltres = (patch: Partial<Filtres>) => setFiltres((actuels) => ({ ...actuels, ...patch }));

  return (
    <div className="page deck">
      <section className="section__head">
        <div>
          <h1>
            {deck.length}/{DECK_SIZE} cartes
          </h1>
          <p className="muted">
            Un clic sur une carte l’ajoute, un clic sur une carte du haut la retire. {MAX_COPIES_PER_NAME} exemplaires
            maximum par nom.
          </p>
        </div>
        <div className="section__actions">
          <button
            type="button"
            className="button button--primary"
            disabled={automatic.deck.length === 0}
            onClick={() => setDeck(automatic.deck)}
            title={`Remplace le deck par ${DECK_SIZE} cartes prises dans ta collection`}
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
          Ta Collection ne couvre que <strong>{automatic.deck.length}</strong> cartes sur {DECK_SIZE} : ouvre des
          arrivages depuis l’accueil pour compléter.
        </p>
      )}

      <p className={`notice ${legality.ok ? 'notice--ok' : 'notice--warn'}`}>
        {legality.ok ? 'Deck valide : il peut partir au combat.' : legality.reasons.join(' ')}
      </p>

      {absentes > 0 && (
        <p className="notice notice--warn" role="status">
          {absentes} carte{absentes > 1 ? 's' : ''} de ce Deck {absentes > 1 ? 'ne sont' : 'n’est'} pas dans ta
          Collection : {absentes > 1 ? 'elles restent' : 'elle reste'} visible{absentes > 1 ? 's' : ''}, grisée
          {absentes > 1 ? 's' : ''}.
        </p>
      )}

      {/* **Les contraintes du Deck** (#276) : la page dit ce qu'elle demande, en quatre
          lignes. Les valeurs viennent des constantes du moteur (`@/game/deck`), pas d'une
          copie — `AGENTS.md` §4 en est la règle, ce bandeau n'en est que la lecture. */}
      <section className="panel deck-contraintes" aria-labelledby="deck-contraintes-titre">
        <h2 id="deck-contraintes-titre" className="deck-contraintes__titre">
          Ce que le Deck doit respecter
        </h2>
        <ul className="deck-contraintes__liste">
          <li>
            <strong>
              {deck.length}/{DECK_SIZE}
            </strong>{' '}
            cartes, toutes prises dans ta Collection
          </li>
          <li>
            <strong>{MAX_COPIES_PER_NAME}</strong> exemplaires au plus du même nom
          </li>
          <li>
            au moins <strong>1 Planqué Entrant</strong>
          </li>
          <li>
            jusqu’à <strong>{MAX_DECK_CAFE_TYPES}</strong> types de café pour la Machine
          </li>
        </ul>
      </section>

      {/* **La courbe de coût** (#364) : à quelle vitesse le Deck démarre. Une lecture des cartes
          déjà au Deck — elle ne change ni la légalité ni le moteur. Le coût 0, s'il existe, est
          nommé à part (D-039) ; les cartes Action ne paient pas de café et ne sont pas comptées. */}
      <section className="section panel deck-courbe" aria-labelledby="deck-courbe-titre">
        <div className="section__head">
          <div>
            <h2 id="deck-courbe-titre">Courbe de coût</h2>
            <p className="muted">
              Le coût d’un Planqué, c’est celui de sa Pression la moins chère, en cafés. Une carte qui démarre tôt
              compte à gauche.
            </p>
          </div>
        </div>
        {inDeck.length === 0 ? (
          <p className="empty">Le Deck est vide : la courbe apparaîtra dès qu’il a des cartes.</p>
        ) : (
          <>
            <ol className="deck-courbe__barres" aria-label="Nombre de cartes par coût en café">
              {courbe.barres.map((barre) => (
                <li key={barre.cout} className="deck-courbe__barre">
                  <span className="deck-courbe__cout">{libelleCout(barre.cout)}</span>
                  <span className="deck-courbe__piste" aria-hidden="true">
                    <span
                      className="deck-courbe__remplissage"
                      style={{ width: courbe.plusHaute > 0 ? `${(barre.cartes / courbe.plusHaute) * 100}%` : '0%' }}
                    />
                  </span>
                  <span className="deck-courbe__nombre">{barre.cartes}</span>
                </li>
              ))}
            </ol>
            {courbe.zero.length > 0 && (
              <p className="deck-courbe__zero">
                Coût 0 : {courbe.zero.length} carte{courbe.zero.length > 1 ? 's' : ''} ({courbe.zero.join(', ')}).
              </p>
            )}
            {courbe.actions > 0 && (
              <p className="muted deck-courbe__actions">
                {courbe.actions} carte{courbe.actions > 1 ? 's' : ''} Action : pas de café, hors de la courbe.
              </p>
            )}
          </>
        )}
      </section>

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
                    {cafeSigles(deckPropose.cafeTypes)}
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
              Choisis de 1 à {MAX_DECK_CAFE_TYPES} types de café : la Machine ne tire que dans ceux-là. Support et
              Intérim n’en produisent jamais.
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
            // Trois types déjà choisis : les autres capsules se ferment, comme le plafond.
            const full = !chosen && chosenCafeTypes.length >= MAX_DECK_CAFE_TYPES;
            const meta = FACTION_META[type];
            return (
              <button
                key={type}
                type="button"
                className={`cafe-picker__type cafe-capsule ${chosen ? 'is-chosen' : ''} ${inDeck ? 'is-proposed' : ''}`}
                aria-pressed={chosen}
                // L'état est **dit**, pas seulement colorié (#279) : un lecteur d'écran
                // apprend « choisi » ou « non choisi » sans voir la capsule.
                aria-label={`${meta.name}, ${chosen ? 'choisi' : 'non choisi'}${inDeck ? ', présent au Deck' : ''}`}
                disabled={full}
                title={`${meta.name}${inDeck ? ' — présent au Deck' : ''}`}
                style={{ '--cafe': meta.color } as CSSProperties}
                onClick={() => toggleCafeType(type)}
              >
                <span className="cafe-capsule__lid" aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className="cafe-capsule__sigle">{meta.short}</span>
                <span className="cafe-capsule__etat" aria-hidden="true">
                  {chosen ? '✓ choisi' : 'choisir'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="muted">
          {chosenCafeTypes.length > 0
            ? `Choix manuel : ${cafeSigles(chosenCafeTypes)}.`
            : proposed.length > 0
              ? `Proposition automatique : ${cafeSigles(proposed)}.`
              : 'Aucun type : ce Deck ne produira pas de café.'}
          {cafeTypes.length > 0 && ` La Machine tirera dans ${cafeSigles(cafeTypes)}.`}
        </p>
      </section>

      {/* **Partager le Deck par un code** (#363). Le partage est une action explicite :
          rien ne part sans un clic. Un Deck illégal
          s'exporte quand même, avec son avertissement — c'est le partage qui s'ouvre. */}
      <section className="section panel deck-partage" aria-labelledby="deck-partage-titre">
        <div className="section__head">
          <div>
            <h2 id="deck-partage-titre">Partager le Deck</h2>
            <p className="muted">
              Un code à copier : il porte les cartes et les types de café, pas ta Collection. Un Deck reçu montre ce qui
              te manque.
            </p>
          </div>
        </div>

        <label className="field">
          <span>Ton code</span>
          <textarea
            className="deck-partage__code"
            readOnly
            rows={3}
            value={codeDuDeck}
            aria-label="Code du Deck à partager"
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        {!legality.ok && (
          <p className="notice notice--warn">
            Ce code porte un Deck illégal (raisons ci-dessus). Il s’exporte quand même, et s’importe de même.
          </p>
        )}
        <div className="section__actions">
          <button type="button" className="button button--primary" onClick={copierLeCode}>
            Copier le code
          </button>
        </div>

        <label className="field">
          <span>Coller un code reçu</span>
          <textarea
            className="deck-partage__code"
            rows={3}
            value={codeAColler}
            placeholder="PLQ1.…"
            onChange={(event) => setCodeAColler(event.target.value)}
          />
        </label>
        <div className="section__actions">
          <button type="button" className="button" onClick={importerLeCode} disabled={codeAColler.trim() === ''}>
            Importer ce Deck
          </button>
        </div>

        {retour && (
          <p
            className={`notice ${retour.ok ? 'notice--ok' : 'notice--warn'} deck-partage__retour`}
            role={retour.ok ? 'status' : 'alert'}
          >
            {retour.texte}
          </p>
        )}
      </section>

      <div className="filters filters--deck">
        <TriCartes value={tri} onChange={setTri} />
      </div>

      <section className="section">
        <div className="section__head">
          <h2>Dedans ({inDeck.length})</h2>
          {absentes > 0 && (
            <span className="muted">
              dont {absentes} non possédée{absentes > 1 ? 's' : ''}
            </span>
          )}
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
                owned={owned[card.id] ?? 0}
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

      {/* **Le sélecteur borné** (#276) : la page Deck ne déroule pas la Collection. On y
          cherche, et seules les premières cartes compatibles s'affichent — le reste du
          catalogue se parcourt sur `/collection`. */}
      <section className="section deck-selecteur">
        <div className="section__head">
          <h2>Collection — ajouter une carte ({available.length})</h2>
          <span className="muted">clic = ajouter au deck</span>
        </div>
        {/* **Le compte, en permanence** (#364) : combien de cartes la recherche rend, et combien
            il en manque au Deck pour atteindre 20. Il reste là pendant la recherche et les filtres. */}
        <p className="deck-compte" aria-live="polite">
          <span>
            {availableTrie.length} carte{availableTrie.length > 1 ? 's' : ''} trouvée
            {availableTrie.length > 1 ? 's' : ''}
          </span>
          <span>
            {deck.length}/{DECK_SIZE} au Deck
          </span>
          <span>{manquent > 0 ? `il en manque ${manquent}` : 'Deck complet'}</span>
        </p>
        {available.length === 0 ? (
          <p className="empty">Aucune carte possédée. Ouvre un Arrivage depuis l’accueil.</p>
        ) : (
          <>
            <div className="filters deck-selecteur__filtres">
              <label className="field field--search">
                <Search size={16} />
                <input
                  type="search"
                  value={filtres.texte}
                  placeholder="Chercher dans ma Collection"
                  onChange={(event) => modifierFiltres({ texte: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Rareté</span>
                <select
                  value={filtres.rarete}
                  onChange={(event) => modifierFiltres({ rarete: event.target.value as Rarity | 'ALL' })}
                >
                  <option value="ALL">Toutes</option>
                  {RARETES.map((key) => (
                    <option key={key} value={key}>
                      {RARITY_META[key].label} ({key})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Coût en café</span>
                <select
                  value={filtres.cout === 'ALL' ? 'ALL' : String(filtres.cout)}
                  onChange={(event) =>
                    modifierFiltres({ cout: event.target.value === 'ALL' ? 'ALL' : Number(event.target.value) })
                  }
                >
                  <option value="ALL">Tous</option>
                  {COUTS_PRESENTS.map((cafes) => (
                    <option key={cafes} value={cafes}>
                      {libelleCout(cafes)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {filtresActifsN > 0 && (
              <div className="filtres-actifs">
                <span className="muted">
                  {filtresActifsN} filtre{filtresActifsN > 1 ? 's' : ''} actif{filtresActifsN > 1 ? 's' : ''}
                </span>
                <button type="button" className="button" onClick={() => setFiltres(FILTRES_DEFAUT)}>
                  Tout effacer
                </button>
              </div>
            )}
            {proposes.length === 0 ? (
              <div className="empty" role="status">
                <p className="m-0">Aucune carte de ta Collection ne correspond à {videParce}.</p>
                <p className="m-0 mt-2">Retire un filtre, ou efface-les tous pour revoir ta Collection.</p>
              </div>
            ) : (
              <div className="card-grid">
                {proposes.map((card) => {
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
            {restantes > 0 && (
              <p className="muted">
                … et {restantes} autres cartes de ta Collection : cherche un nom, ou trie autrement. La Collection
                entière se parcourt sur <Link to="/collection">la page Collection</Link>.
              </p>
            )}
          </>
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
