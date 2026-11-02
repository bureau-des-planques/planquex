/*
 * **Le pointeur de l'appareil** (#569) : un doigt, ou une souris ?
 *
 * L'ouverture d'un Arrivage parlait de « glisse le doigt » et « touche une carte » même sur un
 * PC à la souris (mesuré à 1280 × 800, critique du 01/11/2026) : une consigne qui nomme un geste
 * que l'appareil ne permet pas. La question se pose au **pointeur**, pas à la largeur de la
 * fenêtre — une tablette tactile est large.
 *
 * Sans `matchMedia` (un double de test, un très vieux navigateur), on répond **doigt** : c'est
 * la cible du projet (D-116, 420 px d'abord), et le pire des deux mots est celui qui nomme un
 * geste absent.
 */
import { useEffect, useState } from 'react';

const GROSSIER = '(pointer: coarse)';

function litPointeur(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(GROSSIER).matches;
}

export function usePointeurTactile(): boolean {
  const [doigt, setDoigt] = useState(litPointeur);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const liste = window.matchMedia(GROSSIER);
    const suivre = (): void => setDoigt(liste.matches);
    suivre();
    liste.addEventListener?.('change', suivre);
    return () => liste.removeEventListener?.('change', suivre);
  }, []);

  return doigt;
}
