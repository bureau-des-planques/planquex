import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { FACTION_META, RARITY_META, STAGE_META } from '@/data';
import type { Card } from '@/data/types';

interface Props {
  card: Card;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}

export function CardView({ card, onClick, compact, selected }: Props) {
  const faction = FACTION_META[card.faction];
  const rarity = RARITY_META[card.rarity];
  const style = {
    '--accent': faction.color,
    '--card-palette': card.palette
  } as CSSProperties;

  return (
    <motion.button
      type="button"
      className={`card ${compact ? 'card--compact' : ''} ${selected ? 'card--selected' : ''}`}
      style={style}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <div className="card__top">
        <span className="card__name">{card.name}</span>
        <span className="card__hp">{card.hp}</span>
      </div>
      <div className="card__meta">
        <span className="card__stage">{STAGE_META[card.stage].label}</span>
        <span className="card__faction">{faction.short}</span>
      </div>
      <div className="card__art" style={{ background: card.palette }}>
        <span className="card__glyph">{card.glyph}</span>
        {card.ex && <span className="card__ex">COMEX</span>}
        <span className="card__shine" />
      </div>
      <div className="card__attacks">
        {card.attacks.map((attack) => (
          <div className="attack" key={attack.name}>
            <span className="attack__cost">{'●'.repeat(attack.cost)}</span>
            <span className="attack__name">{attack.name}</span>
            <span className="attack__dmg">{attack.damage}</span>
          </div>
        ))}
      </div>
      {!compact && <p className="card__flavor">{card.flavor}</p>}
      <div className="card__footer">
        <span className="card__rarity" style={{ color: rarity.color }}>{rarity.label}</span>
        <span className="card__id">#{card.id.split('-').slice(-1)[0]}</span>
      </div>
    </motion.button>
  );
}
