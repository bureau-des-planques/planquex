import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ALL_CARDS, FACTION_META, RARITY_META, STAGE_META } from '@/data';
import type { Card, Faction, Rarity, Stage } from '@/data/types';
import { DECK_SIZE, deckCanAdd, deckCountsByName } from '@/game/deck';
import { useStore } from '@/store/useStore';
import { CardSlot } from '@/components/CardSlot';
import { CardDetail } from '@/components/CardDetail';
import { causeDuVide } from '@/components/cause-du-vide';
import { avancementTirable, HORS_ARRIVAGE } from '@/components/plafond-collection';
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
  // Le volet des filtres (faction, stade, rareté, coût, possession) : replié par défaut pour que la
  // première carte se voie sans défiler à 420 × 900 (il prenait 330 px), **ouvert** d'emblée si
  // l'adresse porte déjà un filtre — on ne cache pas un filtre qui agit.
  const [voletOuvert, setVoletOuvert] = useState(() => {
    const { filtres: initiaux } = lireFiltres(params);
    return filtresActifs({ ...initiaux, texte: '' }) > 0;
  });

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
  // La jauge se lit sur ce qu'un Arrivage **peut** donner (301), pas sur le catalogue (308) :
  // un testeur qui a tout tiré lirait sinon 98 %, jamais 100 % (`plafond-collection.ts`, #196).
  const { possedees, plafond, pourcent } = avancementTirable(owned);
  const nbFiltres = filtresActifs(filtres);

  /** Pourquoi la grille est vide : ce que le message accuse (`causeDuVide`). */
  const rechercheActive = filtres.texte.trim() !== '';
  const filtreHorsRecherche = nbFiltres > (rechercheActive ? 1 : 0);
  const videParce = causeDuVide(filtres.texte, filtreHorsRecherche);
  const toutEffacer = () => {
    setParams((precedent) => ecrireFiltres(precedent, FILTRES_DEFAUT, tri), { replace: true });
  };

  // Les filtres posés, **nommés** et retirables un par un : un compteur obligeait à rouvrir le
  // volet pour savoir ce qui agissait (critique du 30/10/2026, P2). La recherche en fait
  // partie : elle filtre autant que les autres.
  const jetons: { cle: string; libelle: string; retirer: () => void }[] = [];
  if (rechercheActive) {
    jetons.push({
      cle: 'texte',
      libelle: `Recherche : « ${filtres.texte.trim()} »`,
      retirer: () => modifier({ texte: '' })
    });
  }
  if (filtres.faction !== 'ALL') {
    jetons.push({
      cle: 'faction',
      libelle: `Faction : ${FACTION_META[filtres.faction].name}`,
      retirer: () => modifier({ faction: 'ALL' })
    });
  }
  if (filtres.stade !== 'ALL') {
    jetons.push({
      cle: 'stade',
      libelle: `Stade : ${STAGE_META[filtres.stade].label}`,
      retirer: () => modifier({ stade: 'ALL' })
    });
  }
  if (filtres.rarete !== 'ALL') {
    jetons.push({
      cle: 'rarete',
      libelle: `Rareté : ${RARITY_META[filtres.rarete].label} (${filtres.rarete})`,
      retirer: () => modifier({ rarete: 'ALL' })
    });
  }
  if (filtres.cout !== 'ALL') {
    jetons.push({
      cle: 'cout',
      libelle: `Coût : ${libelleCout(filtres.cout)}`,
      retirer: () => modifier({ cout: 'ALL' })
    });
  }
  if (filtres.possedees) {
    jetons.push({
      cle: 'possedees',
      libelle: 'Seulement ce que je possède',
      retirer: () => modifier({ possedees: false })
    });
  }
  /** L'état vide ne propose que le geste qui le résout : la recherche seule n'a pas de filtre à retirer. */
  const videParRecherche = rechercheActive && !filtreHorsRecherche;

  return (
    <div className="page collection">
      <section className="section__head">
        <div>
          <h1>
            {possedees}/{plafond} cartes tirables
          </h1>
          <div
            className="collection__jauge"
            role="progressbar"
            aria-label="Avancement de la collection"
            aria-valuemin={0}
            aria-valuemax={plafond}
            aria-valuenow={possedees}
            aria-valuetext={`${possedees} sur ${plafond} cartes tirables`}
          >
            <span style={{ width: `${pourcent}%` }} />
          </div>
          <p className="muted" aria-live="polite">
            {visible.length} affichés
          </p>
          <p className="collection__plafond muted">{HORS_ARRIVAGE} cartes ne sortent d’aucun Arrivage.</p>
          {/* Le **rôle** de la page (#276, vitrine depuis le 30/10/2026) : ici on regarde ce qu'on
              possède ; le Deck se compose sur sa page, et la grille n'y ajoute plus rien. L'ajout
              d'une carte vit dans la fiche, où c'est un geste délibéré. */}
          <p className="collection__role">
            Tout ce que tu possèdes : cherche, filtre, ouvre une fiche. Le Deck se compose sur{' '}
            <Link to="/deck">la page Deck</Link> ; une fiche peut y ajouter sa carte.
          </p>
        </div>
      </section>

      <div className="filters">
        <label className="field field--search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Chercher une carte"
            value={filtres.texte}
            placeholder="Chercher une carte"
            onChange={(event) => modifier({ texte: event.target.value })}
          />
        </label>

        <details
          className="filtres-volet"
          open={voletOuvert}
          onToggle={(event) => setVoletOuvert(event.currentTarget.open)}
        >
          <summary className="button filtres-volet__bouton">
            <SlidersHorizontal size={16} aria-hidden="true" /> Filtres
            {filtreHorsRecherche && (
              <span className="filtres-volet__compte">{nbFiltres - (rechercheActive ? 1 : 0)}</span>
            )}
          </summary>
          <div className="filtres-volet__corps">
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
              <select
                value={filtres.stade}
                onChange={(event) => modifier({ stade: event.target.value as Stage | 'ALL' })}
              >
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
                onChange={(event) =>
                  modifier({ cout: event.target.value === 'ALL' ? 'ALL' : Number(event.target.value) })
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

            <label className="filtre-case">
              <input
                type="checkbox"
                checked={filtres.possedees}
                onChange={(event) => modifier({ possedees: event.target.checked })}
              />
              <span>Seulement ce que je possède</span>
            </label>
          </div>
        </details>

        <TriCartes value={tri} onChange={setTri} />
      </div>

      {nbFiltres > 0 && (
        <div className="filtres-actifs">
          <ul className="jetons" aria-label="Filtres actifs">
            {jetons.map((jeton) => (
              <li key={jeton.cle}>
                <button type="button" className="jeton" onClick={jeton.retirer} aria-label={`Retirer ${jeton.libelle}`}>
                  {jeton.libelle}
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
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
        <div className="empty">
          <p className="m-0" role="status">
            Aucune carte ne correspond à {videParce}.
          </p>
          <p className="m-0 mt-2">
            {videParRecherche
              ? `Efface la recherche pour revoir les ${ALL_CARDS.length} cartes.`
              : `Retire un filtre, ou efface-les tous pour revoir les ${ALL_CARDS.length} cartes.`}
          </p>
          <button
            type="button"
            className="button"
            onClick={videParRecherche ? () => modifier({ texte: '' }) : toutEffacer}
          >
            {videParRecherche ? 'Effacer la recherche' : 'Effacer les filtres'}
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {visible.map((card) => {
            const used = byName[card.name] ?? 0;
            return (
              <CardSlot
                key={card.id}
                card={card}
                owned={owned[card.id] ?? 0}
                inDeck={used}
                selected={used > 0}
                onClick={() => setSelected(card)}
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
          deck={{
            taille: deck.length,
            max: DECK_SIZE,
            peutAjouter: deckCanAdd(deck, selected.id)
          }}
        />
      )}
    </div>
  );
}
