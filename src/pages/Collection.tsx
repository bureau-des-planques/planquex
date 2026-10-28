import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ALL_CARDS, FACTION_META, RARITY_META, STAGE_META } from '@/data';
import type { Card, Faction, Rarity, Stage } from '@/data/types';
import { deckCanAdd, deckCountsByName, MAX_COPIES_PER_NAME } from '@/game/deck';
import { useStore } from '@/store/useStore';
import { CardSlot } from '@/components/CardSlot';
import { CardDetail } from '@/components/CardDetail';
import { causeDuVide } from '@/components/cause-du-vide';
import { HORS_ARRIVAGE, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { TriCartes } from '@/components/TriCartes';
import { trierCartes } from '@/components/tri-cartes';
import type { Tri } from '@/components/tri-cartes';
import {
  COUTS_PRESENTS,
  FILTRES_DEFAUT,
  ecrireFiltres,
  filtrerCartes,
  filtresActifs,
  lireFiltres,
  libelleCout
} from '@/components/filtres-collection';
import type { Filtres } from '@/components/filtres-collection';

const STAGES: Stage[] = ['ENTRANT', 'N+1', 'N+2'];
const RARETES = Object.keys(RARITY_META) as Rarity[];

export function Collection() {
  const { owned, deck, addToDeck, addCard } = useStore();
  // Les filtres et le tri vivent dans l'adresse de la page (#365) : revenir de la fiche, ou de
  // n'importe quelle page, les retrouve sans toucher au store.
  const [params, setParams] = useSearchParams();
  const { filtres, tri } = useMemo(() => lireFiltres(params), [params]);
  const [selected, setSelected] = useState<Card | null>(null);

  const modifier = (patch: Partial<Filtres>, nouveauTri: Tri = tri) => {
    setParams((precedent) => ecrireFiltres(precedent, { ...filtres, ...patch }, nouveauTri), { replace: true });
  };
  const setTri = (nouveauTri: Tri) => {
    setParams((precedent) => ecrireFiltres(precedent, filtres, nouveauTri), { replace: true });
  };

  const byName = useMemo(() => deckCountsByName(deck), [deck]);

  const factions = useMemo(
    () =>
      (Object.keys(FACTION_META) as Faction[]).sort((a, b) => FACTION_META[a].name.localeCompare(FACTION_META[b].name)),
    []
  );

  const visible = useMemo(
    () => trierCartes(filtrerCartes(ALL_CARDS, filtres, owned), tri, owned),
    [filtres, tri, owned]
  );

  const uniqueOwned = ALL_CARDS.filter((card) => (owned[card.id] ?? 0) > 0).length;
  const nbFiltres = filtresActifs(filtres);

  /** Pourquoi la grille est vide : ce que le message accuse (`causeDuVide`). */
  const rechercheActive = filtres.texte.trim() !== '';
  const filtreHorsRecherche = nbFiltres > (rechercheActive ? 1 : 0);
  const videParce = causeDuVide(filtres.texte, filtreHorsRecherche);
  const toutEffacer = () => {
    setParams((precedent) => ecrireFiltres(precedent, FILTRES_DEFAUT, tri), { replace: true });
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
            value={filtres.texte}
            placeholder="Chercher une carte"
            onChange={(event) => modifier({ texte: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">Faction</span>
          <select
            value={filtres.faction}
            onChange={(event) => modifier({ faction: event.target.value as Faction | 'ALL' })}
          >
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
          <select value={filtres.stade} onChange={(event) => modifier({ stade: event.target.value as Stage | 'ALL' })}>
            <option value="ALL">Tous</option>
            {STAGES.map((key) => (
              <option key={key} value={key}>
                {STAGE_META[key].label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Rareté</span>
          <select
            value={filtres.rarete}
            onChange={(event) => modifier({ rarete: event.target.value as Rarity | 'ALL' })}
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
            onChange={(event) => modifier({ cout: event.target.value === 'ALL' ? 'ALL' : Number(event.target.value) })}
          >
            <option value="ALL">Tous</option>
            {COUTS_PRESENTS.map((cafes) => (
              <option key={cafes} value={cafes}>
                {libelleCout(cafes)}
              </option>
            ))}
          </select>
        </label>

        <label className="filtre-case">
          <input
            type="checkbox"
            checked={filtres.possedees}
            onChange={(event) => modifier({ possedees: event.target.checked })}
          />
          <span>Seulement ce que je possède</span>
        </label>

        <TriCartes value={tri} onChange={setTri} />
      </div>

      {nbFiltres > 0 && (
        <div className="filtres-actifs">
          <span className="muted">
            {nbFiltres} filtre{nbFiltres > 1 ? 's' : ''} actif{nbFiltres > 1 ? 's' : ''}
          </span>
          <button type="button" className="button" onClick={toutEffacer}>
            Tout effacer
          </button>
        </div>
      )}

      {uniqueOwned === 0 && (
        <p className="notice notice--warn">
          Ta Collection est vide : ouvre un Arrivage depuis l’accueil. Les cartes ci-dessous sont celles qu’il te reste
          à trouver.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="empty" role="status">
          <p className="m-0">Aucune carte ne correspond à {videParce}.</p>
          <p className="m-0 mt-2">Retire un filtre, ou efface-les tous pour revoir les {ALL_CARDS.length} cartes.</p>
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
    </div>
  );
}
