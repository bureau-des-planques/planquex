// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS, FACTION_META } from '@/data';
import type { BattleState, CafeSymbol } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { cafeLabel } from '@/data/vocabulaire';
import { partieSauvegardee } from '@/store/partie';

/**
 * **« Le café attaché change de place, et sa couleur ne se lit pas »** (OUF
 * `p-mvrome4s-f93mg6`, #399).
 *
 * La reproduction du moteur (`src/game/cafe-ordre.test.ts`) dit que `energy` ne fait que
 * s'allonger. Ce que le testeur a vu est donc **à l'écran** : deux pastilles voisines —
 * celle des cafés attachés et celle de la Machine à café — qui se ressemblent, avec une
 * pastille vide dans chacune. Un café en Machine se lit alors comme « le second café
 * attaché » ; l'attachement le fait passer à gauche et laisse un vide à droite : « il a
 * changé de place et le second a été retiré ». Ce fichier mesure les deux rangs **nommés**
 * et le panneau qui dit quel café attend.
 */
/** La couleur d'un café : `FACTION_META` dit les couleurs, jamais l'écran (§6). */
function couleurDe(cafe: CafeSymbol): string {
  if (cafe === 'INCOLORE') throw new Error('la Machine ne produit jamais l’incolore (D-034)');
  return FACTION_META[cafe].color;
}

function deckDeTest() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  return autoDeck(owned).deck;
}

interface CasCafe {
  etat: BattleState;
  deck: string[];
}

/**
 * Une partie où **mon tour** commence avec un café en Machine, rien d'attaché ce tour, et au
 * moins une cible possible : le cas exact du post-it.
 */
function partieAvecCafeEnMachine(): CasCafe {
  const deck = deckDeTest();
  for (let graine = 1; graine < 500; graine += 1) {
    let state = createBattle(deck, deck, graine);
    for (let i = 0; i < 400 && state.phase === 'playing'; i += 1) {
      const mien = state.players.player;
      const attache = legalActions(state).some((action) => action.type === 'attachEnergy');
      if (
        state.current === 'player' &&
        state.pendingPromotion === null &&
        state.pendingChoice === null &&
        mien.energyZone !== null &&
        !mien.energyAttached &&
        attache
      ) {
        return { etat: state, deck };
      }
      const legales = legalActions(state).filter((action) => action.type !== 'forfeit');
      const action =
        legales.find((entree) => entree.type === 'promoteActive') ??
        legales.find((entree) => entree.type === 'attack') ??
        legales.find((entree) => entree.type === 'endTurn');
      if (!action) break;
      state = applyAction(state, action);
    }
  }
  throw new Error('aucune partie avec un café en Machine : le test ne prouverait rien');
}

function rendre() {
  const { etat, deck } = partieAvecCafeEnMachine();
  const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
  if (!partie) throw new Error('partie terminée : rien à rendre');
  return {
    ...renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie }),
    etat
  };
}

/** La fiche de **mon** camp : le plateau porte `is-direction` sur celui de la Direction. */
function maFiche(container: HTMLElement): HTMLElement {
  const fiche = container.querySelector('.board__side:not(.is-direction) .poste__info');
  if (!fiche) throw new Error('la fiche de mon camp n’est pas rendue');
  return fiche as HTMLElement;
}

describe('le café attaché ne change pas de place — l’écran (#399)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nomme les deux rangs de pastilles : les cafés attachés d’un côté, la Machine de l’autre', () => {
    const { container } = rendre();
    const fiche = maFiche(container);

    const attaches = fiche.querySelector('[data-cafes="attaches"]');
    const machine = fiche.querySelector('[data-cafes="machine"]');
    expect(attaches, 'le rang des cafés attachés doit être nommé').not.toBeNull();
    expect(machine, 'le rang de la Machine doit être nommé').not.toBeNull();
    expect(machine).toHaveAttribute('aria-label', 'Machine à café');
    expect(attaches).toHaveAttribute('aria-label', 'Cafés attachés au Poste');
  });

  it('affiche le café de la Machine à sa couleur, et ne le laisse pas passer pour un café attaché', () => {
    const { container, etat } = rendre();
    const zone = etat.players.player.energyZone;
    if (!zone) throw new Error('le cas de test doit avoir un café en Machine');

    const fiche = maFiche(container);
    const attaches = fiche.querySelector('[data-cafes="attaches"]') as HTMLElement;
    const machine = fiche.querySelector('[data-cafes="machine"]') as HTMLElement;

    // Rien d'attaché : le rang des attachés ne porte **aucune** pastille colorée.
    expect(attaches.querySelectorAll('.pip--typed')).toHaveLength(0);
    // Le café attend dans la Machine, à la couleur de sa faction.
    const pastille = machine.querySelector('.pip--typed') as HTMLElement;
    expect(pastille).not.toBeNull();
    expect(pastille.style.getPropertyValue('--cafe')).toBe(couleurDe(zone));
    expect(machine.textContent).toMatch(new RegExp(cafeLabel(zone), 'i'));
  });

  it('après l’attachement, le café reste dans son rang et la Machine se vide nommément', () => {
    const { container, etat } = rendre();
    const zone = etat.players.player.energyZone;
    const bouton = screen.getAllByRole('button', { name: /Attacher 1 café/ })[0];
    if (!bouton) throw new Error('aucun bouton d’attachement rendu');
    fireEvent.click(bouton);

    const fiche = maFiche(container);
    const attaches = fiche.querySelector('[data-cafes="attaches"]') as HTMLElement;
    const machine = fiche.querySelector('[data-cafes="machine"]') as HTMLElement;
    const attachee = attaches.querySelector('.pip--typed') as HTMLElement;
    expect(attachee).not.toBeNull();
    expect(attachee.style.getPropertyValue('--cafe')).toBe(couleurDe(zone!));
    // Le rang de la Machine dit « vide » : ce n'est pas un café retiré, c'est un rang nommé.
    expect(machine.querySelectorAll('.pip--typed')).toHaveLength(0);
    expect(machine.textContent).toMatch(/vide/i);
  });
});

describe('le panneau d’attache dit quel café attend et ce qui est possible (#399)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('montre le café en Machine, à sa couleur et par son nom, avant le choix de la cible', () => {
    const { etat } = rendre();
    const zone = etat.players.player.energyZone;
    if (!zone) throw new Error('le cas de test doit avoir un café en Machine');

    const panneau = screen.getByRole('region', { name: /Café à attacher/i });
    expect(panneau.textContent).toMatch(new RegExp(cafeLabel(zone), 'i'));
    const pastille = panneau.querySelector('.pip--typed') as HTMLElement;
    expect(pastille).not.toBeNull();
    expect(pastille.style.getPropertyValue('--cafe')).toBe(couleurDe(zone));
    // Les cibles sont dans le panneau, sous le café : on choisit après avoir lu la couleur.
    expect(within(panneau).getAllByRole('button', { name: /Attacher 1 café/ }).length).toBeGreaterThan(0);
  });

  it('dit pourquoi l’attachement n’est pas offert quand le café est déjà posé ce tour', () => {
    const { etat, deck } = partieAvecCafeEnMachine();
    // Un attachement n'achève pas le tour : juste après, c'est toujours à moi, et un seul
    // café par tour. C'est l'état que la barre doit expliquer.
    const attache = legalActions(etat).find((action) => action.type === 'attachEnergy');
    if (!attache) throw new Error('le cas de test doit offrir un attachement');
    const suite = applyAction(etat, attache);
    expect(suite.players.player.energyAttached).toBe(true);

    const partie = partieSauvegardee(suite, null, { playerDeck: deck, aiDeck: deck });
    if (!partie) throw new Error('partie terminée : rien à rendre');
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });

    const attachements = screen.queryAllByRole('button', { name: /Attacher 1 café/ });
    expect(attachements).toHaveLength(0);
    // La raison vit sur la ligne du journal, là où la ligne de portée dit déjà ce qui manque.
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    expect(within(barre).getByText(/déjà attaché/i)).toBeInTheDocument();
  });
});
