// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { setupTestStore } from '@/test/test-utils';
import { ALL_CARDS } from '@/data';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { partieSauvegardee } from '@/store/partie';

/**
 * **L'accueil dit qu'une partie attend** (#553, reste de #427).
 *
 * La sortie du combat range la partie (`#126`) et l'écran de combat le dit au retour
 * (`Battle.sortie.test.tsx`). L'accueil, lui, menait à `/battle` sans un mot : le testeur
 * ne l'apprenait qu'en rouvrant l'écran de combat. La ligne d'état vit donc ici, et elle
 * **n'existe pas** quand rien n'attend — une phrase vide apprendrait au testeur à la lire.
 */

/** Une partie rangée, un tour jouable atteint : ce que l'accueil doit annoncer. */
function partieRangee() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  let etat = createBattle(deck, deck, 4242);
  for (let i = 0; i < 200; i += 1) {
    const auTourDuJoueur = etat.current === 'player' && etat.pendingPromotion === null;
    if (i >= 20 && auTourDuJoueur) break;
    const action = legalActions(etat).find((a) => a.type !== 'forfeit');
    if (!action) break;
    etat = applyAction(etat, action);
  }
  const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
  if (!partie) throw new Error('partie terminée : rien à ranger');
  return { partie, tour: etat.turn };
}

function rendreAccueil() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Home />
    </MemoryRouter>
  );
}

describe('Home — la partie qui attend (#553)', () => {
  afterEach(() => {
    cleanup();
  });

  it('dit qu’une partie attend, et à quel tour', () => {
    const { partie, tour } = partieRangee();
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true, partie });
    rendreAccueil();

    expect(screen.getByText(`Une partie t’attend au tour ${tour}.`)).toBeInTheDocument();
  });

  it('ne dit rien quand aucune partie n’attend', () => {
    setupTestStore({ tutorielVu: true, pasAPasCombatVu: true });
    rendreAccueil();

    // Le contrôle mord : la ligne est le seul objet de ce test — absente, il n'y a rien à lire.
    expect(screen.queryByText(/Une partie t’attend/)).toBeNull();
  });
});
