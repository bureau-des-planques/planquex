import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coffee, PackageOpen, Swords } from 'lucide-react';
import { ALL_CARDS } from '@/data';
import type { Card } from '@/data/types';
import { useStore } from '@/store/useStore';
import { CardView } from '@/components/CardView';
import { avancementTirable, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

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
        <div className="hero__hint">
          <Coffee size={14} /> {uniqueOwned}/{ALL_CARDS.length} cartes uniques
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
          <DialogTitle>Arrivage : cinq nouvelles cartes</DialogTitle>
          <DialogDescription className="sr-only">
            Les cartes de l’Arrivage sont rangées dans ta Collection.
          </DialogDescription>
          <div className="pack-reveal__cards">
            {lastPack?.map((card, index) => (
              <motion.div
                key={`${card.id}-${index}`}
                className="pack-reveal__card"
                initial={{ opacity: 0, y: 24, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 24 }}
              >
                {nouvelles.has(index) && <span className="pack-reveal__neuve">Nouvelle</span>}
                <CardView card={card} compact />
              </motion.div>
            ))}
          </div>
          <button type="button" className="button button--primary" onClick={() => setLastPack(null)}>
            Ranger dans la Collection
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
