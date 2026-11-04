/**
 * Scène d'Arrivage isolée pour les preuves locales quand aucun serveur Supabase n'est configuré.
 * Le navigateur charge ce module depuis le serveur Vite de développement ; il n'entre pas dans le
 * bundle de production et ne simule aucune réponse serveur ni acquisition de Collection.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ALL_CARDS } from '../../src/data';
import type { Card, Rarity } from '../../src/data/types';
import { SceneOuverture } from '../../src/animation/ouverture/SceneOuverture';

const RARETES: Rarity[] = ['1D', '1D', '2D', '3D', '1S'];

function cartesDePreuve(): Card[] {
  return RARETES.map((rarete) => {
    const carte = ALL_CARDS.find((candidate) => candidate.rarity === rarete);
    if (!carte) throw new Error(`Aucune carte de preuve pour la rareté ${rarete}`);
    return carte;
  });
}

/** Monte le composant réel, sur un tirage fixe, au-dessus de l'accueil déjà chargé. */
export function afficherArrivagePourPreuve(): void {
  if (document.querySelector('[data-fixture-arrivage]')) return;

  const hote = document.createElement('div');
  hote.className = 'pack-reveal';
  hote.dataset.fixtureArrivage = 'oui';
  Object.assign(hote.style, {
    height: '100dvh',
    inset: '0',
    position: 'fixed',
    width: '100vw',
    zIndex: '2147483647'
  });

  const fermeture = document.createElement('button');
  fermeture.type = 'button';
  fermeture.dataset.slot = 'dialog-close';
  fermeture.setAttribute('aria-label', 'Fermer l’Arrivage de preuve');
  fermeture.textContent = '×';
  Object.assign(fermeture.style, {
    background: 'var(--bg-raised)',
    border: '1px solid var(--line)',
    borderRadius: '50%',
    height: '44px',
    position: 'absolute',
    right: '12px',
    top: '12px',
    width: '44px',
    zIndex: '80'
  });

  const scene = document.createElement('div');
  Object.assign(scene.style, { height: '100%', inset: '0', position: 'absolute', width: '100%' });
  hote.append(fermeture, scene);
  document.body.append(hote);
  createRoot(scene).render(
    createElement(SceneOuverture, {
      cartes: cartesDePreuve(),
      neuves: new Set([0, 3]),
      onRanger: () => hote.remove()
    })
  );
}
