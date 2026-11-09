import { useLayoutEffect, useState } from 'react';

/**
 * Combien de temps une **information** du tour reste à l'écran (la bulle du haut de la table) avant
 * de s'effacer. Les décisions qui attendent (relève, carte à désigner) ne passent jamais par là.
 */
export const DELAI_MESSAGE_MS = 4000;

/**
 * **Le message du tour s'efface** (D-193 (2), #750) : la bulle du haut de la table cache le Banc de
 * la Direction. Visible à l'arrivée de chaque `cle` (le texte affiché), elle redevient visible à
 * chaque changement de `cle` et se cache `delai` ms après. `useLayoutEffect` : le retour se peint
 * dès le premier rendu du nouveau texte, sans une image de bulle cachée.
 *
 * Le composant ne fait que lire la valeur : c'est le CSS (`.combat-toast--sorti`) qui fond la bulle,
 * sans toucher à sa place dans la mise en page.
 */
export function useMessageFugace(cle: string, delai: number = DELAI_MESSAGE_MS): boolean {
  const [etat, setEtat] = useState<{ cle: string; cache: boolean }>({ cle, cache: false });

  useLayoutEffect(() => {
    setEtat({ cle, cache: false });
    const minuterie = window.setTimeout(() => setEtat({ cle, cache: true }), delai);
    return () => window.clearTimeout(minuterie);
  }, [cle, delai]);

  return !(etat.cle === cle && etat.cache);
}
