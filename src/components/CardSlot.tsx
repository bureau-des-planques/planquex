import type { ReactNode } from 'react';
import type { Card } from '@/data/types';
import { CardView } from './CardView';

interface Props {
  card: Card;
  /** Le clic sur la carte. */
  onClick: () => void;
  /** Le bouton rond du coin : ajouter au Deck, ou ouvrir la fiche. Absent, le slot n'en porte pas. */
  quick?: { icon: ReactNode; label: string; title: string; onClick: () => void; disabled?: boolean };
  /**
   * Exemplaires **possédés**. Absent, le slot n'écrit rien de la possession (« Dedans »).
   * À **zéro**, la carte est atténuée et son absence est écrite : « ×0 », « Non possédée ».
   */
  owned?: number;
  /** Exemplaires de cette carte **dans le Deck** ; la pastille « Deck ×n » n'existe qu'au-dessus de zéro. */
  inDeck?: number;
  /** Le Deck ne peut plus en recevoir (plafond par nom ou Deck plein). */
  full?: boolean;
  selected?: boolean;
}

/**
 * Une carte de la Collection ou du Deck, avec ce qui n'est pas la carte : la **possession**
 * et l'appartenance au **Deck**. Les trois grilles (Collection, « Dedans », Collection du
 * Deck) posent le même slot — une carte non possédée y est atténuée **de la même façon**
 * partout (#179).
 *
 * Les pastilles sont **hors** de `.card`, donc elles ne s'atténuent pas avec elle : le « ×0 »
 * reste lisible sur une carte presque éteinte.
 *
 * Le bouton du coin est **facultatif** : la Collection, qui est une vitrine de lecture
 * (30/10/2026), n'en porte plus ; le Deck s'en sert pour ouvrir la fiche. Sans lui, le pied
 * de la carte reprend sa marge (`card-slot--sans-quick`).
 */
export function CardSlot({ card, onClick, quick, owned, inDeck = 0, full = false, selected = false }: Props) {
  const missing = owned === 0;
  const classes = ['card-slot', missing && 'is-missing', full && 'is-full', !quick && 'card-slot--sans-quick']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-card-id={card.id}>
      <CardView card={card} compact selected={selected} onClick={onClick} />
      {quick && (
        <button
          type="button"
          className="card-slot__quick"
          title={quick.title}
          aria-label={quick.label}
          disabled={quick.disabled}
          onClick={quick.onClick}
        >
          {quick.icon}
        </button>
      )}
      {missing && <span className="card-slot__absent">Non possédée</span>}
      <div className="card-slot__plates">
        {inDeck > 0 && (
          <span className="card-slot__deck" title={`${inDeck} exemplaire(s) de « ${card.name} » au Deck`}>
            Deck ×{inDeck}
          </span>
        )}
        {owned !== undefined && (
          <span
            className={`card-slot__count ${missing ? 'is-missing' : ''}`}
            title={
              missing ? `« ${card.name} » : non possédée` : `${owned} exemplaire(s) de « ${card.name} » possédé(s)`
            }
          >
            ×{owned}
          </span>
        )}
      </div>
    </div>
  );
}
