import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getCard } from '@/data';
import type { CardInstance } from '@/data/types';
import { CardView } from '@/components/CardView';
import { cardName } from '@/combat/cartes';

/**
 * Le Rebut d'un camp, **consultable** (#740, D-121 (2)) : le bouton montre la dernière carte
 * défaussée et le compte ; un tap ouvre la liste de **toutes** les cartes de `discard`, face
 * visible, dans un panneau **non modal** (pas de voile, pas de piège de focus).
 *
 * - Clic, Entrée ou Espace (le bouton natif) ouvre et ferme.
 * - Échap ferme et rend le focus au bouton d'ouverture, où que soit le focus.
 * - Tab parcourt les cartes du panneau dans l'ordre du DOM : le panneau suit le bouton.
 * - Ce n'est **pas** une grille : une liste (`ul`/`li`), sans `role="grid"` (D-121 (3)).
 */
export function PileRebut({ label, discard }: { label: string; discard: readonly CardInstance[] }) {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const idPanneau = useId();
  const derniere = discard.at(-1);
  const definitionDerniere = derniere ? getCard(derniere.cardId) : undefined;

  const surTouche = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !ouvert) return;
    event.stopPropagation();
    setOuvert(false);
    bouton.current?.focus();
  };

  return (
    <div className="pile-rebut" onKeyDown={surTouche}>
      <button
        ref={bouton}
        type="button"
        className="pile pile--rebut"
        aria-label={`Consulter le Rebut : ${label}`}
        aria-expanded={ouvert}
        aria-controls={ouvert ? idPanneau : undefined}
        onClick={() => setOuvert((etait) => !etait)}
      >
        {/* Une vignette de carte : l'illustration va jusqu'au bord, il n'y a pas de rembourrage à tenir (`cramped-padding`, #784). */}
        <span className="pile__visuel" aria-hidden="true" data-impeccable-ignore="cramped-padding">
          {definitionDerniere && <CardView card={definitionDerniere} calme plateau />}
        </span>
        <span className="pile__compte">
          <span>Rebut</span>
          <strong>{discard.length}</strong>
        </span>
      </button>
      {ouvert && (
        <div id={idPanneau} className="panneau-rebut" role="region" aria-label={`Rebut : ${label}`}>
          {discard.length === 0 ? (
            <p className="panneau-rebut__vide">Rebut vide.</p>
          ) : (
            <ul className="panneau-rebut__liste">
              {discard.map((carte) => {
                const definition = getCard(carte.cardId);
                return (
                  <li key={carte.uid} tabIndex={0}>
                    {definition ? <CardView card={definition} calme plateau /> : cardName(carte.cardId)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
