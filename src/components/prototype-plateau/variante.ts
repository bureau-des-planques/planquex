/**
 * PROTOTYPE JETABLE — rendu des cartes **pendant une partie** (Poste, Banc, main).
 *
 * Question : « à quoi doit ressembler une carte au plateau, à 56–88 px de large ? »
 * Quatre variantes sur la route existante `/battle`, basculables par `?variant=` (A, B, C, D)
 * et par la barre flottante du haut. A est la carte actuelle de la branche (`CardView plateau`).
 * Hors `import.meta.env.DEV`, la variante est toujours A.
 *
 * Copie volontaire de `prototype-cartes/variante.ts` (prototype : pas d'abstraction partagée).
 */
import { useSyncExternalStore } from 'react';

export const VARIANTES = [
  { key: 'A', nom: 'Actuelle (branche)' },
  { key: 'B', nom: 'Portrait plein' },
  { key: 'C', nom: 'Jeton rond' },
  { key: 'D', nom: 'Lisible d’abord' }
] as const;

export type VarianteKey = (typeof VARIANTES)[number]['key'];

const EVENEMENT = 'prototype-plateau:variante';

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
