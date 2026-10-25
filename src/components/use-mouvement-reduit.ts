import { useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useStore } from '@/store/useStore';

/**
 * **Le seul point de bascule du mouvement** (#192, `SPEC-COMBAT-UI` §6.8 borne 4).
 *
 * Deux demandes, une réponse : le réglage « Mouvement réduit » du store **et**
 * `prefers-reduced-motion` du système. Aujourd'hui le store n'était relié à aucun CSS :
 * seul le média coupait le soulèvement des cartes. Le composant qui lit ce hook pose aussi
 * l'attribut `data-mouvement-reduit` sur la racine, que `src/styles.css` lit — un seul
 * point, donc un seul endroit où oublier de couper un effet.
 */
export function useMouvementReduit(): boolean {
  const reglage = useStore((state) => state.reducedMotion);
  const systeme = useReducedMotion();
  return reglage || systeme === true;
}

/**
 * Relie le réglage du store au CSS, **au niveau du document** : une préférence d'affichage
 * ne devrait pas dépendre de l'écran qui l'affiche. Posé une fois par `App`, il couvre le
 * combat comme les autres pages.
 */
export function useMouvementReduitGlobal(): boolean {
  const reduit = useMouvementReduit();
  useEffect(() => {
    document.documentElement.dataset.mouvementReduit = reduit ? 'true' : 'false';
    return () => {
      delete document.documentElement.dataset.mouvementReduit;
    };
  }, [reduit]);
  return reduit;
}
