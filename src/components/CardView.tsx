import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { FACTION_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { artUrl } from '@/art';
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
      {/* Le cadre (`.card`) est la bordure de rareté ; la **face** est la carte elle-même.
          Du haut en bas : titre et Seuil, illustration (avec l'emblème de faction),
          barre de Seuil, Pressions, pied (rareté, faction). */}
      <div className="card__face">
        <header className="card__top">
          <div className="card__title">
            <span className="card__kind">
              <span
                className={`card__stage ${
                  planque ? `card__stage--${card.stage.toLowerCase().replace('+', '')}` : 'card__stage--action'
                }`}
              >
                {kindLabel(card)}
              </span>
              {comex && <span className="card__comex">COMEX</span>}
            </span>
            <span className="card__name">{card.name}</span>
          </div>
          {/* Le Seuil en pastille, en haut à droite : la place d'une jauge de vie sur une
              carte. Son libellé est dessiné en CSS (`data-label`) : il n'ajoute pas un
              « Seuil » de plus au texte de chaque carte. */}
          {planque && (
            <span className="card__seuil-badge" data-label="Seuil" title="Seuil" aria-label={`Seuil ${card.hp}`}>
              {card.hp}
            </span>
          )}
        </header>

        <div
          className="card__art"
          style={{
            // **Un seul** chemin de fond, le raccourci `background`. Mélanger le raccourci
            // et `backgroundImage` fait **annuler** l'aplat par React — il écrit `""` sur le
            // longhand, ce qui retire la couche image posée par le raccourci (React signale
            // lui-même ce mélange comme source de bugs de style). Les ~276 cartes sans
            // illustration perdaient donc leur fond de faction.
            // Cadrage **haut** (50% 28%) : les illustrations sont des portraits, un cadrage
            // centré leur coupe la tête dès que la fenêtre est plus large que haute.
            //
            // L'URL vient de `@/art` (D-045) : Vite la résout et la hache. Il n'y a plus de
            // copie servie dans `public/` — une image du registre est servie, ou rien.
            background: artUrl(card.art)
              ? `url('${artUrl(card.art)}') 50% 28% / cover no-repeat`
              : card.palette
          }}
        >
          {/* Spec #95 : « l'image **si elle existe** ; sinon l'aplat **+ glyphe** ». Le
              glyphe ne se superpose donc pas à une illustration. */}
          {!card.art && <span className="card__glyph">{card.glyph}</span>}
          <span className="card__shine" />
          {/* L'emblème de la faction, au coin de l'illustration : sa couleur et son glyphe
              viennent de `FACTION_META`. Le nom de la faction est écrit au pied. Sans illustration,
              le glyphe du fond (`.card__glyph`) tient déjà ce rôle : pas de doublon. */}
          {card.art && (
            <span className="card__emblem" title={faction.name} aria-hidden>
              {faction.glyph}
            </span>
          )}
        </div>

        {planque && (
          <div className="card__seuil">
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
          <span className="card__rarity" title={`Rareté ${card.rarity}`}>
            {rarity.label}
          </span>
          <span className="card__faction" title={faction.name}>
            <i className="card__faction-dot" aria-hidden />
            {faction.short}
          </span>
          {!compact && <span className="card__id">#{card.id.split('-').slice(-1)[0]}</span>}
        </footer>
      </div>
    </motion.button>
  );
}
