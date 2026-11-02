import { Suspense, lazy } from 'react';
import { NavLink } from 'react-router-dom';
import { RepliChargement } from '@/components/RepliChargement';

/**
 * **La Collection et le Deck, un seul écran, deux onglets** (#545, tranché par Bastien le
 * 02/11/2026).
 *
 * Les deux pages se ressemblaient — mêmes cartes, mêmes filtres, même tri — mais font deux
 * métiers : parcourir ce qu'on possède, et composer les vingt cartes qu'on joue. La fusion
 * garde les deux métiers ; ce qui disparaît, c'est le **déplacement** entre eux.
 *
 * **C'est la route qui choisit l'onglet**, pas un état de composant : `/collection` et
 * `/deck` restent valides, partageables et dans les favoris (D-075), aucun lien existant ne
 * casse. Le shell reçoit son onglet de `src/App.tsx`, et les onglets sont des `NavLink` —
 * l'onglet ouvert porte donc `aria-current="page"`, et le navigateur garde le clic droit et
 * l'ouverture dans un onglet. Ce ne sont pas des `role="tab"` pour la raison déjà écrite
 * pour le comité (`SousOngletsComite`) : ce sont deux **adresses**, pas deux panneaux d'un
 * composant — le patron ARIA des onglets mentirait sur ce que fait le navigateur.
 *
 * **Les deux contenus restent paresseux, chacun son morceau** (#478, #480) : le shell est
 * une petite coquille, et ouvrir `/collection` ne télécharge toujours pas le Deck. Le paquet
 * principal n'y gagne rien — c'est le cliquet de `scripts/ci/taille-paquets.mjs` qui le dit.
 *
 * L'écran Deck vide garde son départ : ses Decks proposés s'ouvrent d'emblée, et c'est
 * `Deck.tsx` qui le porte (`proposesOuverts`), pas ce shell.
 */

/** Les deux contenus, chargés à la demande : un morceau chacun, comme avant la fusion. */
const Collection = lazy(() => import('@/pages/Collection').then((module) => ({ default: module.Collection })));
const Deck = lazy(() => import('@/pages/Deck').then((module) => ({ default: module.Deck })));

/** L'onglet que la route demande. Les deux valeurs sont les deux adresses de la page. */
export type OngletCartes = 'collection' | 'deck';

const ONGLETS = [
  { onglet: 'collection', to: '/collection', label: 'Collection' },
  { onglet: 'deck', to: '/deck', label: 'Deck' }
] as const satisfies ReadonlyArray<{ onglet: OngletCartes; to: string; label: string }>;

export function CollectionDeck({ onglet }: { onglet: OngletCartes }) {
  return (
    <div className="page">
      <nav aria-label="Collection et Deck" className="flex flex-wrap gap-2 border-b border-line pb-2">
        {ONGLETS.map((choix) => (
          <NavLink
            key={choix.to}
            to={choix.to}
            end
            aria-label={choix.label}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 py-1.5 text-[0.86rem] no-underline transition-colors ${
                isActive || choix.onglet === onglet
                  ? 'bg-bg-raised font-semibold text-gold'
                  : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            {choix.label}
          </NavLink>
        ))}
      </nav>

      {/* Le repli porte `.repli-chargement` : `attendreEcran` (tests d'écran) attend que le
          contenu de l'onglet soit monté, pas seulement la coquille. */}
      <Suspense fallback={<RepliChargement />}>{onglet === 'deck' ? <Deck /> : <Collection />}</Suspense>
    </div>
  );
}
