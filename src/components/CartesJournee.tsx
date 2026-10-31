import { CARTES_MONTREES } from '@/components/journee-etapes';
import { CARD_BY_ID } from '@/data';
import type { Card } from '@/data/types';

/**
 * **Les cartes montrées pendant le tutoriel** (30/10/2026).
 *
 * Elles vivaient dans le panneau de la Journée, qui montait alors à **455 px sur 843** et
 * poussait « Charger » sous la ligne de flottaison. La critique du 30/10/2026 a tranché :
 * elles vont **là où l'écran parle déjà des Decks**, dans le volet déplié — le panneau ne
 * garde que son texte et son geste.
 *
 * La carte parle : la vanne est sa `flavor`, lue dans `src/data`. Aucun texte ajouté.
 */
export function CartesJournee() {
  const cartes = CARTES_MONTREES.map((id) => CARD_BY_ID.get(id)).filter((card): card is Card => Boolean(card));

  return (
    <ul className="journee__cartes" aria-label="Quelques cartes, pour le plaisir">
      {cartes.map((card) => (
        <li key={card.id} className="journee__carte">
          <strong>{card.name}</strong>
          {'flavor' in card && card.flavor ? <em>{card.flavor}</em> : null}
        </li>
      ))}
    </ul>
  );
}
