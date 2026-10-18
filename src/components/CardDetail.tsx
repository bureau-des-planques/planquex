import { X } from 'lucide-react';
import { FACTION_META, RARITY_META, STAGE_META } from '@/data';
import type { Card } from '@/data/types';
import { CardView } from './CardView';

interface Props {
  card: Card;
  owned: number;
  onClose: () => void;
  onAddDeck?: () => void;
  onAddCard?: () => void;
}

export function CardDetail({ card, owned, onClose, onAddDeck, onAddCard }: Props) {
  const faction = FACTION_META[card.faction];
  const rarity = RARITY_META[card.rarity];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card-detail" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button modal__close" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
        <div className="card-detail__visual">
          <CardView card={card} />
        </div>
        <div className="card-detail__body">
          <p className="eyebrow">{faction.name} · {STAGE_META[card.stage].label}</p>
          <h2>{card.name}</h2>
          <p className="card-detail__flavor">« {card.flavor} »</p>

          <div className="stat-row">
            <div><span className="stat-label">Moral</span><strong>{card.hp}</strong></div>
            <div><span className="stat-label">Relève</span><strong>{card.retreat}</strong></div>
            <div><span className="stat-label">Rareté</span><strong style={{ color: rarity.color }}>{rarity.label}</strong></div>
            <div><span className="stat-label">Possédés</span><strong>{owned}</strong></div>
          </div>

          {card.ability && (
            <section className="detail-section">
              <h3>Talent</h3>
              <p><strong>{card.ability.name}</strong> — {card.ability.text}</p>
            </section>
          )}

          <section className="detail-section">
            <h3>Pressions</h3>
            {card.attacks.map((attack) => (
              <div className="detail-attack" key={attack.name}>
                <div className="detail-attack__head">
                  <span className="attack__cost">{'●'.repeat(attack.cost)}</span>
                  <strong>{attack.name}</strong>
                  <span className="detail-attack__dmg">{attack.damage}</span>
                </div>
                {attack.text && <p>{attack.text}</p>}
              </div>
            ))}
          </section>

          {card.weakness && (
            <p className="muted">Vulnérable à : <strong>{FACTION_META[card.weakness].name}</strong> (+20)</p>
          )}

          <div className="card-detail__actions">
            {onAddDeck && <button type="button" className="button button--primary" onClick={onAddDeck}>Ajouter au classeur</button>}
            {onAddCard && <button type="button" className="button" onClick={onAddCard}>Ajouter un exemplaire (test)</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
