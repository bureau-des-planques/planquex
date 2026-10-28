/**
 * PROTOTYPE JETABLE — disposition et rendu des cartes.
 *
 * Question : « à quoi doit ressembler une carte hors plateau (Collection, Deck, fiche) ? »
 * Quatre variantes sur la route existante `/collection`, basculables par `?variant=`
 * (A, B, C, D) et par la barre flottante du bas. A est la carte actuelle de la branche.
 *
 * Le paramètre est lu sur `window.location` (et non `useSearchParams`) pour que `CardSlot`
 * et `CardDetail` restent rendables sans routeur dans leurs tests. Hors `import.meta.env.DEV`,
 * la variante est toujours A : un prototype fusionné par erreur ne change rien en production.
 */
import { useSyncExternalStore } from 'react';

export const VARIANTES = [
  { key: 'A', nom: 'Actuelle (branche)' },
  { key: 'B', nom: 'Pleine illustration' },
  { key: 'C', nom: 'Gabarit Pocket' },
  { key: 'D', nom: "Badge d'employé" }
] as const;

export type VarianteKey = (typeof VARIANTES)[number]['key'];

const EVENEMENT = 'prototype-cartes:variante';

function lire(): VarianteKey {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 'A';
  const brute = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return VARIANTES.some((v) => v.key === brute) ? (brute as VarianteKey) : 'A';
}

function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('popstate', rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener('popstate', rappel);
  };
}

export function useVariante(): VarianteKey {
  return useSyncExternalStore(abonner, lire, () => 'A');
}

export function choisirVariante(key: VarianteKey) {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', key);
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(EVENEMENT));
}
