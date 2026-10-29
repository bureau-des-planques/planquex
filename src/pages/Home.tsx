import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, Swords } from 'lucide-react';
import { ALL_CARDS } from '@/data';
import { NOTES_VERSIONS, type NoteVersion } from '@/data/versions';
import type { Card } from '@/data/types';
import { useStore } from '@/store/useStore';
import { APP_LABEL, APP_VERSION } from '@/version';
import { avancementTirable, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SceneOuverture } from '@/animation/ouverture/SceneOuverture';
import { jouer } from '@/audio/sons';

/** La date se lit en français (« 21 octobre 2026 ») : `date` est un jour, pas un instant. */
function dateLongue(jour: string): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * **La dernière release publiée** (#274) : la note de la version sous les yeux si elle est
 * sortie, sinon la plus récente des notes **publiées** — un brouillon attend sa release et
 * ne s'annonce donc pas ici. La donnée vient de `src/data/versions.ts` (D-090), jamais d'un
 * numéro recopié ; `notes` est injectable pour que le test éprouve le cas du brouillon sans
 * dépendre de l'état du journal un jour donné.
 */
function derniereRelease(notes: readonly NoteVersion[]): NoteVersion | undefined {
  return notes.find((note) => !note.brouillon && note.version === APP_VERSION) ?? notes.find((note) => !note.brouillon);
}

export function Home({ notes = NOTES_VERSIONS }: { notes?: readonly NoteVersion[] } = {}) {
  const { owned, deck, openPack, packsOpened } = useStore();
  const derniere = derniereRelease(notes);
  const [lastPack, setLastPack] = useState<Card[] | null>(null);
  /** Les cartes de l'Arrivage que le testeur n'avait pas : une carte tirée deux fois n'est neuve qu'une. */
  const [nouvelles, setNouvelles] = useState<ReadonlySet<number>>(() => new Set());

  const uniqueOwned = Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0).length;
  const totalOwned = Object.values(owned).reduce((sum, count) => sum + count, 0);
  // Le pourcentage se lit **sur ce qu'un Arrivage peut donner** : sept cartes (raretés hautes)
  // n'en sortent jamais, donc diviser par tout le catalogue promettrait un 100 % inatteignable.
  const { pourcent: completion } = avancementTirable(owned);

  const handleOpenPack = () => {
    // **Le son de l'Arrivage part au clic** (D-137) : le geste est ce qui autorise l'audio, et le
    // son accompagne l'ouverture, pas la révélation.
    jouer('arrivage');
    const connues = new Set(Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0));
    const cartes = openPack();
    const neuves = new Set<number>();
    cartes.forEach((card, index) => {
      if (connues.has(card.id)) return;
      connues.add(card.id);
      neuves.add(index);
    });
    setNouvelles(neuves);
    setLastPack(cartes);
  };

  return (
    <div className="page home">
      <section className="hero">
        <h1>
          Ton atelier. <br />
          Tes Interventions. <br />
          Ta survie.
        </h1>
        <p className="hero__lead">
          Ouvre des Arrivages, collectionne les Planqués et affronte la Direction. Le seul TCG où le boss est déjà dans
          ta main.
        </p>
        <div className="hero__actions">
          <button type="button" className="button button--gold button--big hero__ouvrir" onClick={handleOpenPack}>
            <PackageOpen size={22} /> Ouvrir un Arrivage
          </button>
          <Link className="button button--primary button--big" to="/battle">
            <Swords size={20} /> Affronter la Direction
          </Link>
        </div>
        {/* Le compteur (#273) : ce qu'un testeur a ouvert depuis le début. L'alpha ne limite
            rien (D-127, Arrivages illimités et gratuits) : aucun quota, aucun prix, aucun
            bouton grisé ici — la cadence est une décision de beta. */}
        <div className="hero__packs">
          <p className="hero__packs-compteur">
            {/* La phrase et le chiffre dans le **même** nœud de texte : le compteur se lit
                d'un bloc, et un test qui cherche « 3 Arrivages ouverts » le trouve. */}
            <strong className="hero__packs-nombre">
              {packsOpened} Arrivage{packsOpened > 1 ? 's' : ''} ouvert{packsOpened > 1 ? 's' : ''}
            </strong>
          </p>
          {packsOpened === 0 && <p className="hero__packs-invite">Aucun Arrivage ouvert : le premier est pour toi.</p>}
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card stat-card--large">
          <span className="stat-card__label">Collection</span>
          <strong>{completion}%</strong>
          {/* La jauge redit le pourcentage écrit au-dessus : décorative, le chiffre porte l'information. */}
          <span className="stat-card__jauge" aria-hidden="true">
            <span style={{ width: `${Math.min(100, completion)}%` }} />
          </span>
          <span className="muted">
            {uniqueOwned}/{ALL_CARDS.length} cartes uniques · plafond {PLAFOND_TIRABLE} par Arrivage
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Exemplaires</span>
          <strong>{totalOwned}</strong>
          <span className="muted">toutes raretés</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Deck</span>
          <strong>{deck.length}/20</strong>
          <span className="stat-card__jauge" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (deck.length / 20) * 100)}%` }} />
          </span>
          <span className="muted">cartes équipées</span>
        </article>
      </section>

      {/* La dernière release (#274) : une seule, avec sa date, et une porte vers l'historique
          complet. L'accueil est un écran de jeu, pas un journal : les précédentes restent sur
          `/feuille-de-route`. Le libellé vient de `APP_LABEL`, la note de `versions.ts` — rien
          n'est recopié (`src/version.test.ts` le refuse). */}
      <section className="section panel home__version">
        <div className="home__version-texte">
          <h2 className="home__version-titre">La dernière version</h2>
          <p className="home__version-libelle">
            <strong className="settings__version">{APP_LABEL}</strong>
            {derniere && <span className="muted"> · {derniere.titre}</span>}
          </p>
          <p className="muted home__version-date">
            {derniere ? (
              <>
                Publiée le <time dateTime={derniere.date}>{dateLongue(derniere.date)}</time>
              </>
            ) : (
              'Cette build n’a pas encore sa note : elle arrive avec la publication.'
            )}
          </p>
        </div>
        <Link className="button" to="/feuille-de-route">
          Voir toutes les versions
        </Link>
      </section>

      {/* L'Arrivage est un dialogue du composant générique (D-035, #131) : rôle, Échap et
          focus piégé en viennent. `lastPack` reste porté jusqu'à la fermeture. */}
      <Dialog open={lastPack !== null} onOpenChange={(ouvert) => !ouvert && setLastPack(null)}>
        <DialogContent className="pack-reveal">
          <DialogTitle className="sr-only">Arrivage</DialogTitle>
          <DialogDescription className="sr-only">
            Les cartes de l’Arrivage sont rangées dans ta Collection.
          </DialogDescription>
          {lastPack && <SceneOuverture cartes={lastPack} neuves={nouvelles} onRanger={() => setLastPack(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
