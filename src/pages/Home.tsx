import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Coffee, Library, PackageOpen, Swords } from 'lucide-react';
import { ALL_CARDS } from '@/data';
import type { Card } from '@/data/types';
import { useStore } from '@/store/useStore';
import { CardView } from '@/components/CardView';

export function Home() {
  const { owned, deck, openPack, packsOpened } = useStore();
  const [lastPack, setLastPack] = useState<Card[] | null>(null);

  const uniqueOwned = Object.keys(owned).filter((id) => (owned[id] ?? 0) > 0).length;
  const totalOwned = Object.values(owned).reduce((sum, count) => sum + count, 0);
  const completion = Math.round((uniqueOwned / ALL_CARDS.length) * 100);

  const handleOpenPack = () => {
    setLastPack(openPack());
  };

  return (
    <div className="page home">
      <section className="hero">
        <p className="eyebrow">Bureau des Planqués</p>
        <h1>Ton atelier.<br />Tes Interventions.<br />Ta survie.</h1>
        <p className="hero__lead">
          Ouvre des arrivages, collectionne les Planqués et affronte la Direction.
          Le seul TCG où le boss est déjà dans ta main.
        </p>
        <div className="hero__actions">
          <button type="button" className="button button--primary" onClick={handleOpenPack}>
            <PackageOpen size={18} /> Ouvrir un arrivage
          </button>
          <Link className="button" to="/battle">
            <Swords size={18} /> Combat test
          </Link>
        </div>
        <div className="hero__hint">
          <Coffee size={14} /> {packsOpened} bac{packsOpened > 1 ? 's' : ''} ouvert{packsOpened > 1 ? 's' : ''} · {uniqueOwned}/{ALL_CARDS.length} cartes
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-card__label">Parc</span>
          <strong>{completion}%</strong>
          <span className="muted">{uniqueOwned} cartes uniques</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Exemplaires</span>
          <strong>{totalOwned}</strong>
          <span className="muted">toutes raretés</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Chariot</span>
          <strong>{deck.length}/20</strong>
          <span className="muted">cartes équipées</span>
        </article>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <p className="eyebrow">Raccourcis</p>
            <h2>Le bureau t’attend</h2>
          </div>
        </div>
        <div className="quick-grid">
          <Link className="quick-card" to="/collection">
            <Library size={22} />
            <div>
              <strong>Ouvrir le Parc</strong>
              <span>Filtrer, chercher, admirer les cartes brillantes.</span>
            </div>
            <ArrowRight size={18} />
          </Link>
          <Link className="quick-card" to="/deck">
            <Library size={22} />
            <div>
              <strong>Construire un chariot</strong>
              <span>20 cartes, 2 exemplaires max, 1 Entrant minimum.</span>
            </div>
            <ArrowRight size={18} />
          </Link>
          <Link className="quick-card" to="/battle">
            <Swords size={22} />
            <div>
              <strong>Affronter la Direction</strong>
              <span>Un prototype de combat, 3 Interventions, zéro pitié.</span>
            </div>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {lastPack && (
        <div className="modal-backdrop" onClick={() => setLastPack(null)} role="presentation">
          <div className="modal pack-reveal" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Arrivage</p>
            <h2>Cinq nouvelles cartes</h2>
            <div className="pack-reveal__cards">
              {lastPack.map((card, index) => (
                <motion.div
                  key={`${card.id}-${index}`}
                  initial={{ opacity: 0, y: 24, rotate: -2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 24 }}
                >
                  <CardView card={card} compact />
                </motion.div>
              ))}
            </div>
            <button type="button" className="button button--primary" onClick={() => setLastPack(null)}>
              Ranger dans le Parc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
