import type { ReactNode } from 'react';
import { CafeDot, cafeLabel } from '@/components/CafePips';
import type { CafeSymbol } from '@/data/types';

/**
 * **Le panneau d'attache du café** (#399, OUF `p-mvrome4s-f93mg6`) : la barre d'action
 * disait « Attacher 1 café » sans dire **lequel** — le testeur choisissait la cible à
 * l'aveugle, dans une couleur qu'il ne voyait pas avant de cliquer.
 *
 * Le café présent en Machine est donc montré **avant** les cibles, avec sa pastille colorée
 * (`CafeDot` → `FACTION_META`, la seule source des couleurs, §6) et son nom (`cafeLabel`,
 * `@/data/vocabulaire`, #248). Les boutons de cible sont ses enfants : ils viennent de la
 * liste du moteur, comme partout ailleurs — ici on n'offre rien, on **explique**.
 *
 * Quand l'attachement n'est pas offert, le même panneau porte la **raison** (`phraseCafeAuPoste`)
 * plutôt qu'un silence : pas de café en zone, café déjà attaché ce tour, premier tour, pas de
 * Planqué à qui le donner.
 */
export function PanneauAttacheCafe({
  cafe,
  raison,
  children
}: {
  /** Le café en Machine, s'il y en a un (la zone n'en contient jamais deux, D-034). */
  cafe: CafeSymbol | undefined;
  /** La raison du refus, quand l'attachement n'est pas possible : le panneau la dit. */
  raison: string | undefined;
  /** Les boutons de cible, rendus par la page à partir de `legalActions`. */
  children?: ReactNode;
}) {
  return (
    <section className="combat-barre__cafe" aria-label="Café à attacher" role="region">
      {cafe && !raison ? (
        <>
          <p className="combat-barre__cafe-titre">
            <span className="muted">Café en Machine :</span>{' '}
            <span aria-hidden="true">
              <CafeDot cafe={cafe} />
            </span>{' '}
            <strong>{cafeLabel(cafe)}</strong>
            <span className="sr-only"> ({cafeLabel(cafe)})</span>
          </p>
          <p className="muted combat-barre__cafe-aide">Choisis le Planqué qui le reçoit :</p>
          {children}
        </>
      ) : (
        <p className="muted combat-barre__cafe-raison">{raison ?? 'Aucun café à attacher.'}</p>
      )}
    </section>
  );
}
