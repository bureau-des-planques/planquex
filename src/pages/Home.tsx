import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coffee, PackageOpen, Swords } from 'lucide-react';
import { ALL_CARDS } from '@/data';
import type { Card } from '@/data/types';
import { useStore } from '@/store/useStore';

import { avancementTirable, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SceneOuverture } from '@/animation/ouverture/SceneOuverture';
import { jouer } from '@/audio/sons';

export function Home() {
  const { owned, deck, openPack, packsOpened } = useStore();
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
          Ton atelier.
          <br />
          Tes Interventions.
          <br />
          Ta survie.
        </h1>
        <p className="hero__lead">
          Ouvre des Arrivages, collectionne les Planqués et affronte la Direction. Le seul TCG où le boss est déjà dans
          ta main.
        </p>
        <div className="hero__actions">
          <button type="button" className="button button--gold button--big" onClick={handleOpenPack}>
            <PackageOpen size={20} /> Ouvrir un Arrivage
          </button>
          <Link className="button button--primary button--big" to="/battle">
            <Swords size={20} /> Affronter la Direction
          </Link>
        </div>
        <div className="hero__hint">
          <Coffee size={14} /> {packsOpened} Arrivage{packsOpened > 1 ? 's' : ''} ouvert{packsOpened > 1 ? 's' : ''} ·{' '}
          {uniqueOwned}/{ALL_CARDS.length} cartes
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-card__label">Collection</span>
          <strong>{completion}%</strong>
          <span className="muted">
            {uniqueOwned} cartes uniques · plafond {PLAFOND_TIRABLE} par Arrivage
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
          <span className="muted">cartes équipées</span>
        </article>
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
