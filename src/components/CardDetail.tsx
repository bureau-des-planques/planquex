import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ACTION_KIND_META, FACTION_META, ITEM_KIND_META, RARITY_META, isPlanque, kindLabel } from '@/data';
import type { Card } from '@/data/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
  /**
   * L'état du Deck, quand l'écran qui ouvre la fiche sait y ajouter. La fiche affiche alors le
   * compte (`Deck 12/20`) et, quand l'ajout est refusé, **le motif du refus** — un bouton
   * désactivé qui ne dit rien est un bouton mort (#533, P0 de la critique du 30/10/2026).
   */
  deck?: { taille: number; max: number; peutAjouter: boolean };
}

export function CardDetail({ card, owned, onClose, onAddDeck, onAddCard, deck }: Props) {
  // L'identifiant de la carte **ajoutée**, pas un booléen : la fiche peut passer d'une carte à
  // l'autre sans être démontée, et la confirmation ne doit pas suivre la mauvaise.
  const [confirme, setConfirme] = useState<string | null>(null);
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
              {planque && (
                <div>
                  <span className="stat-label">Seuil</span>
                  <strong>{card.hp}</strong>
                </div>
              )}
              {planque && (
                <div>
                  <span className="stat-label">Rotation</span>
                  <strong>{card.retreat}</strong>
                </div>
              )}
              {!planque && card.itemKind && (
                <div title={ITEM_KIND_META[card.itemKind].description}>
                  <span className="stat-label">Catégorie</span>
                  <strong>{ITEM_KIND_META[card.itemKind].label}</strong>
                </div>
              )}
              <div>
                <span className="stat-label">Rareté</span>
                <strong className="card__rarity">{rarity.label}</strong>
              </div>
              <div>
                <span className="stat-label">Possédés</span>
                <strong>{owned}</strong>
              </div>
            </div>

            {planque && card.ability && (
              <section className="detail-section">
                <h3>Talent</h3>
                <p>
                  <strong>{card.ability.name}</strong> — {card.ability.text}
                </p>
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
                <strong style={{ color: FACTION_META[card.weakness].color }}>{FACTION_META[card.weakness].name}</strong>
                (+{WEAKNESS_BONUS})
              </p>
            )}

            <div className="card-detail__actions">
              {onAddDeck && (
                <div className="card-detail__deck">
                  {owned === 0 && (
                    <p className="card-detail__note">Non possédée — l’ajout au Deck reste possible pour l’alpha.</p>
                  )}
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={deck ? !deck.peutAjouter : false}
                    aria-describedby={deck && 'deck-note'}
                    onClick={() => {
                      onAddDeck();
                      setConfirme(card.id);
                    }}
                  >
                    Ajouter au Deck
                  </button>
                  {deck && (
                    <p className="card-detail__note muted" id="deck-note" role="status">
                      {confirme === card.id ? (
                        `Ajouté au Deck — ${deck.taille}/${deck.max}.`
                      ) : deck.peutAjouter ? (
                        `Deck ${deck.taille}/${deck.max}.`
                      ) : (
                        <>
                          {deck.taille >= deck.max
                            ? `Ton Deck fait ${deck.max} cartes.`
                            : 'Deux exemplaires de ce nom au maximum.'}{' '}
                          <Link to="/deck">Voir le Deck</Link>.
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
              {onAddCard && outilsDeTest() && (
                <button type="button" className="button" onClick={onAddCard}>
                  Ajouter un exemplaire (test)
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
