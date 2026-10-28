// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Battle } from './Battle';
import { setupTestStore } from '@/test/test-utils';
import { ALL_CARDS } from '@/data';
import type { BattleState } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { partieSauvegardee } from '@/store/partie';
import { useStore } from '@/store/useStore';

/**
 * La sortie du combat (#427) : `←` dans l'en-tête, qui quitte l'écran **sans** déclarer de
 * forfait, rend le testeur à l'endroit d'où il vient, et dit ce qui arrive à la partie.
 *
 * **Le contrôle mord** : la partie rangée doit survivre à la sortie. Un forfait l'aurait
 * terminée (`phase: 'ended'`), et `partieSauvegardee` ne range plus une partie finie : le
 * test échoue alors sur `partie`, et sur la question « Déclarer forfait ? ».
 */

function partieCommencee() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  let jouee: BattleState = createBattle(deck, deck, 31337);
  for (let i = 0; i < 200; i += 1) {
    const auTourDuJoueur = jouee.current === 'player' && jouee.pendingPromotion === null;
    if (i >= 20 && auTourDuJoueur) break;
    const action = legalActions(jouee).find((a) => a.type !== 'forfeit');
    if (!action) break;
    jouee = applyAction(jouee, action);
  }
  const partie = partieSauvegardee(jouee, null, { playerDeck: deck, aiDeck: deck });
  if (!partie) throw new Error('partie terminée : rien à rendre');
  return { partie, tour: jouee.turn };
}

let dernierChemin = '';
function Sonde() {
  dernierChemin = useLocation().pathname;
  return null;
}

/** Rend le combat **après** un écran d'accueil : la sortie a une page où revenir. */
function rendreDepuisAccueil(entrees: string[], indexCourant: number) {
  return render(
    <MemoryRouter initialEntries={entrees} initialIndex={indexCourant}>
      <Sonde />
      <Routes>
        <Route path="/" element={<p>Accueil ici</p>} />
        <Route path="/battle" element={<Battle />} />
        <Route path="/collection" element={<p>Collection ici</p>} />
        <Route path="/deck" element={<p>Deck ici</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const SORTIE = /Quitter le combat/;

describe('la sortie du combat (#427)', () => {
  afterEach(() => {
    cleanup();
    dernierChemin = '';
  });

  it('quitter depuis l’accueil revient à l’accueil, sans forfait et sans perdre la partie', () => {
    const { partie } = partieCommencee();
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, partie });
    rendreDepuisAccueil(['/', '/battle'], 1);

    fireEvent.click(screen.getByRole('link', { name: SORTIE }));

    expect(screen.getByText('Accueil ici')).toBeTruthy();
    expect(dernierChemin).toBe('/');
    // Le forfait aurait demandé confirmation : la question ne doit pas s’ouvrir.
    expect(screen.queryByText('Déclarer forfait ?')).toBeNull();
    // Et la partie reste rangée : un forfait l’aurait terminée, donc effacée du store.
    expect(useStore.getState().partie).not.toBeNull();
  });

  it('quitter depuis le Deck revient au Deck, pas à l’accueil', () => {
    const { partie } = partieCommencee();
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, partie });
    rendreDepuisAccueil(['/', '/deck', '/battle'], 2);

    fireEvent.click(screen.getByRole('link', { name: SORTIE }));

    expect(screen.getByText('Deck ici')).toBeTruthy();
    expect(dernierChemin).toBe('/deck');
  });

  it('entré directement (aucune page avant), la sortie va à l’accueil', () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
    rendreDepuisAccueil(['/battle'], 0);

    const lien = screen.getByRole('link', { name: SORTIE });
    expect(lien.getAttribute('href')).toBe('/');
    fireEvent.click(lien);
    expect(screen.getByText('Accueil ici')).toBeTruthy();
  });

  it('une partie rangée est reprise, et le dit au testeur', () => {
    const { partie, tour } = partieCommencee();
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, partie });
    rendreDepuisAccueil(['/battle'], 0);

    expect(screen.getByText(`Partie reprise au tour ${tour}, comme tu l’as laissée.`)).toBeTruthy();
  });

  it('une partie neuve ne se dit pas reprise', () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
    rendreDepuisAccueil(['/battle'], 0);

    expect(screen.queryByText(/Partie reprise/)).toBeNull();
  });

  it('le menu du combat mène aux autres écrans, sans forfait', () => {
    const { partie } = partieCommencee();
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, partie });
    rendreDepuisAccueil(['/', '/battle'], 1);

    fireEvent.click(screen.getByRole('button', { name: 'Menu du combat' }));
    const nav = screen.getByRole('navigation', { name: 'Aller à un autre écran' });
    fireEvent.click(within(nav).getByRole('link', { name: 'Collection' }));

    expect(screen.getByText('Collection ici')).toBeTruthy();
    expect(screen.queryByText('Déclarer forfait ?')).toBeNull();
    expect(useStore.getState().partie).not.toBeNull();
  });

  it('le forfait reste dans le menu, derrière sa confirmation', () => {
    const { partie } = partieCommencee();
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, partie });
    rendreDepuisAccueil(['/battle'], 0);

    fireEvent.click(screen.getByRole('button', { name: 'Menu du combat' }));
    fireEvent.click(screen.getByRole('button', { name: /Abandonner/ }));

    expect(screen.getByText('Déclarer forfait ?')).toBeTruthy();
  });
});
