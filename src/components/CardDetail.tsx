import type { CSSProperties } from 'react';
import { ACTION_KIND_META, FACTION_META, ITEM_KIND_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card } from '@/data/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog';
import { WEAKNESS_BONUS } from '@/game/rules';
import { outilsDeTest } from '@/lib/outils-de-test';
import { CafePips } from './CafePips';
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
  const planque = isPlanque(card);
  const style = {
    '--accent': faction.color,
    '--rarity': rarity.color
  } as CSSProperties;

  // La fiche est un **dialogue** du composant générique (D-035, #131) : rôle, Échap, focus
  // piégé et fond sont ceux de shadcn, comme la Journée d'intégration et les Conditions. Le
  // composant est toujours monté par un écran qui le rend à la demande : `open` est donc vrai.
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogContent className="card-detail-dialog" style={style}>
        <div className="card-detail">
          <div className="card-detail__visual">
            <CardView card={card} />
          </div>
          <div className="card-detail__body">
            <p className="eyebrow">
              <span className="card-detail__faction">
                <i className="card__faction-dot" aria-hidden />
                {faction.name}
              </span>
              {' · '}
              {kindLabel(card)}
            </p>
            <DialogTitle>{card.name}</DialogTitle>
            <DialogDescription className="card-detail__flavor">« {card.flavor} »</DialogDescription>

            <div className="stat-row">
              {planque && <div><span className="stat-label">Seuil</span><strong>{card.hp}</strong></div>}
              {planque && <div><span className="stat-label">Rotation</span><strong>{card.retreat}</strong></div>}
              {!planque && card.itemKind && (
                <div title={ITEM_KIND_META[card.itemKind].description}>
                  <span className="stat-label">Catégorie</span>
                  <strong>{ITEM_KIND_META[card.itemKind].label}</strong>
                </div>
              )}
              <div><span className="stat-label">Rareté</span><strong className="card__rarity">{rarity.label}</strong></div>
              <div><span className="stat-label">Possédés</span><strong>{owned}</strong></div>
            </div>

            {planque && card.ability && (
              <section className="detail-section">
                <h3>Talent</h3>
                <p><strong>{card.ability.name}</strong> — {card.ability.text}</p>
              </section>
            )}

            {planque ? (
              <section className="detail-section">
                <h3>Pressions</h3>
                {card.attacks.map((attack) => (
                  <div className="detail-attack" key={attack.name}>
                    <div className="detail-attack__head">
                      <CafePips symbols={attack.cost} />
                      <strong>{attack.name}</strong>
                      <span className="detail-attack__dmg">{attack.damage}</span>
                    </div>
                    {attack.text && <p>{attack.text}</p>}
                  </div>
                ))}
              </section>
            ) : (
              <section className="detail-section">
                <h3>{ACTION_KIND_META[card.kind].label}</h3>
                <p>{card.text}</p>
                <p className="muted">{ACTION_KIND_META[card.kind].rule}</p>
              </section>
            )}

            {planque && card.weakness && (
              <p className="muted card-detail__weakness">
                Vulnérable à
                <strong style={{ color: FACTION_META[card.weakness].color }}>
                  {FACTION_META[card.weakness].name}
                </strong>
                (+{WEAKNESS_BONUS})
              </p>
            )}

            <div className="card-detail__actions">
              {onAddDeck && <button type="button" className="button button--primary" onClick={onAddDeck}>Ajouter au Deck</button>}
              {onAddCard && outilsDeTest() && <button type="button" className="button" onClick={onAddCard}>Ajouter un exemplaire (test)</button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
