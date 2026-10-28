import { CafeDot, cafeLabel } from '@/components/CafePips';
import type { CafeSymbol } from '@/data/types';

/**
 * **Le panneau d'attache du café** (#399, OUF `p-mvrome4s-f93mg6`) : la barre d'action
 * disait « Attacher 1 café » sans dire **lequel** — le testeur choisissait la cible à
 * l'aveugle, dans une couleur qu'il ne voyait pas avant de cliquer.
 *
 * Le café présent en Machine est montré, avec sa pastille colorée
 * (`CafeDot` → `FACTION_META`, la seule source des couleurs, §6) et son nom (`cafeLabel`,
 * `@/data/vocabulaire`, #248). Les cibles ne sont plus dans la barre (#454, D-145) : le café
 * se touche sur le Planqué qui le reçoit, et ce panneau n'offre rien — il **explique**.
 *
 * Quand l'attachement n'est pas offert, le même panneau porte la **raison** (`phraseCafeAuPoste`)
 * plutôt qu'un silence : pas de café en zone, café déjà attaché ce tour, premier tour, pas de
 * Planqué à qui le donner.
 */
export function PanneauAttacheCafe({
  cafe,
  raison
}: {
  /** Le café en Machine, s'il y en a un (la zone n'en contient jamais deux, D-034). */
  cafe: CafeSymbol | undefined;
  /** La raison du refus, quand l'attachement n'est pas possible : le panneau la dit. */
  raison: string | undefined;
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
        </>
      ) : (
        <p className="muted combat-barre__cafe-raison">{raison ?? 'Aucun café à attacher.'}</p>
      )}
    </section>
  );
}
