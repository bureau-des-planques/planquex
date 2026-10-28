import type { CafeSymbol } from '@/data/types';

/**
 * **Pourquoi le café n'est pas attachable, ce tour-ci** (#399, OUF `p-mvrome4s-f93mg6`).
 *
 * Le testeur ne savait pas quelles actions étaient possibles : la barre n'offrait un bouton
 * que quand tout allait bien, et son silence ressemblait à un défaut. La règle, elle, est
 * dans le moteur (`attachEnergy`, `engine.ts`) : **un café par tour**, **rien au premier
 * tour** de qui ouvre, **rien sans café en Machine** (D-034), **rien sans Planqué** à qui le
 * donner. Ici, une fonction pure : elle ne décide rien, elle dit dans l'ordre ce qui bloque,
 * comme `phraseDePortee` le fait pour la Pression (#320).
 *
 * Elle se tait quand ce n'est pas mon tour : la barre ne décrit pas le camp adverse.
 */
export function phraseCafeAuPoste({
  aMoi,
  premierTour,
  dejaAttache,
  cafe,
  aCible
}: {
  /** C'est mon tour de jouer. */
  aMoi: boolean;
  /** Le premier tour de qui ouvre (`isOpeningTurn`) : pas d'attachement (D-030). */
  premierTour: boolean;
  /** Un café a déjà été attaché ce tour (`PlayerState.energyAttached`). */
  dejaAttache: boolean;
  /** Le café présent en Machine, s'il y en a un : la zone n'en contient jamais deux (D-034). */
  cafe: CafeSymbol | undefined;
  /** Un Planqué en jeu peut-il le recevoir ? */
  aCible: boolean;
}): string | undefined {
  if (!aMoi) return undefined;
  // L'ordre suit celui du moteur : ce qui est déjà fait passe avant ce qui manque.
  if (dejaAttache) return 'Café déjà attaché — un seul par tour.';
  if (premierTour) return 'Premier tour : pas d’attachement.';
  if (!cafe) return 'Machine à café vide : rien à attacher.';
  if (!aCible) return 'Aucun Planqué en jeu à qui donner le café.';
  return undefined;
}
