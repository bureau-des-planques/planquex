import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Les gestes d'un invité sur le **menu `⋯` du combat** (D-093, #191), pour les tests d'écran :
 * Journal, Partie à deux, Règles, Abandonner et Nouveau combat n'ont plus de place sur la table,
 * ils sont derrière un seul bouton. Chaque test qui les cherche passe par ici — c'est le même
 * chemin que l'invité, donc un menu qui ne s'ouvre plus fait échouer **tous** ces tests.
 */

/** Ouvre le menu (s'il ne l'est pas) et rend son panneau. */
export function menuDuCombat(): HTMLElement {
  const bouton = screen.getByRole('button', { name: 'Menu du combat' });
  if (bouton.getAttribute('aria-expanded') !== 'true') fireEvent.click(bouton);
  return screen.getByRole('region', { name: 'Menu du combat' });
}

/** Ouvre le menu sur sa liste, d'où partent Règles, Abandonner et Nouveau combat. */
export function menuSurLaListe(): HTMLElement {
  const menu = menuDuCombat();
  const retour = within(menu).queryByRole('button', { name: /Retour au menu/ });
  if (retour) fireEvent.click(retour);
  return menu;
}

/** Ouvre le menu sur l'une de ses deux vues (le Journal, la Partie à deux). */
export function menuSurLaVue(vue: 'Journal' | 'Partie à deux'): HTMLElement {
  const menu = menuDuCombat();
  if (within(menu).queryByRole('heading', { name: vue })) return menu;
  menuSurLaListe();
  fireEvent.click(within(screen.getByRole('region', { name: 'Menu du combat' })).getByRole('button', { name: new RegExp(vue) }));
  return screen.getByRole('region', { name: 'Menu du combat' });
}

/** Le menu est-il ouvert ? Lu sur le bouton, comme un lecteur d'écran le lit. */
export function menuEstOuvert(): boolean {
  return screen.getByRole('button', { name: 'Menu du combat' }).getAttribute('aria-expanded') === 'true';
}
