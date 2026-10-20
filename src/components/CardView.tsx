import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { CafePips } from './CafePips';

interface Props {
  card: Card;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}

/** Les raretés à traitement holographique (`CARD-SPEC.md` §1) : étoiles et Couronne. */
const HOLO_RARITIES: Rarity[] = ['1S', '2S', '3S', 'COU'];

export function CardView({ card, onClick, compact, selected }: Props) {
  const faction = FACTION_META[card.faction];
  const rarity = RARITY_META[card.rarity];
  const planque = isPlanque(card);
  const comex = planque && card.ex === true;
  // `--accent` = couleur **de la faction** (source unique : `FACTION_META`) ; `--rarity`
  // = celle de la rareté. Les deux pilotent le cadre et les accents de la carte.
  const style = {
    '--accent': faction.color,
    '--rarity': rarity.color,
    '--card-palette': card.palette
  } as CSSProperties;

  const classes = [
    'card',
    comex ? 'card--comex' : '',
    HOLO_RARITIES.includes(card.rarity) ? 'card--holo' : '',
    compact ? 'card--compact' : '',
    selected ? 'card--selected' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      type="button"
      className={classes}
      style={style}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <header className="card__top">
        <span className="card__name">{card.name}</span>
      </header>

      <div className="card__meta">
        <span
          className={`card__stage ${
            planque ? `card__stage--${card.stage.toLowerCase().replace('+', '')}` : 'card__stage--action'
          }`}
        >
          {kindLabel(card)}
        </span>
        {comex && <span className="card__comex">COMEX</span>}
        <span className="card__faction" title={faction.name}>
          <i className="card__faction-dot" aria-hidden />
          {faction.short}
        </span>
      </div>

      <div
        className="card__art"
        style={{
          // **Un seul** chemin de fond, le raccourci `background`. Mélanger le raccourci
          // et `backgroundImage` fait **annuler** l'aplat par React — il écrit `""` sur le
          // longhand, ce qui retire la couche image posée par le raccourci (React signale
          // lui-même ce mélange comme source de bugs de style). Les ~276 cartes sans
          // illustration perdaient donc leur fond de faction.
          background: card.art
            ? `url('/design/illustrations/${card.art}') center / cover no-repeat`
            : card.palette
        }}
      >
        {/* Spec #95 : « l'image **si elle existe** ; sinon l'aplat **+ glyphe** ». Le
            glyphe ne se superpose donc pas à une illustration. */}
        {!card.art && <span className="card__glyph">{card.glyph}</span>}
        <span className="card__shine" />
      </div>

      {planque && (
        <div className="card__seuil">
          <span className="card__seuil-label">Seuil</span>
          <span className="card__seuil-value">{card.hp}</span>
          <span className="stress card__seuil-bar" aria-hidden>
            <span className="stress__fill" style={{ width: '100%' }} />
          </span>
        </div>
      )}

      <div className="card__attacks">
        {planque ? (
          card.attacks.map((attack) => (
            <div className="attack" key={attack.name}>
              <CafePips symbols={attack.cost} />
              <span className="attack__name">{attack.name}</span>
              <span className="attack__dmg">{attack.damage}</span>
            </div>
          ))
        ) : (
          <div className="attack">
            <span className="attack__name">{card.text}</span>
          </div>
        )}
      </div>

      {!compact && <p className="card__flavor">{card.flavor}</p>}

      <footer className="card__footer">
        <span className="card__rarity">{rarity.label}</span>
        <span className="card__id">#{card.id.split('-').slice(-1)[0]}</span>
      </footer>
    </motion.button>
  );
}
