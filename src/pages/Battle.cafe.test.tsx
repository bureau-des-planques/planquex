// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    const bouton = screen.getAllByRole('button', { name: /Attacher le café à/ })[0];
    if (!bouton) throw new Error('aucun Planqué qui reçoive le café (#454)');
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
    // Le panneau n'offre aucune cible : le café se touche sur le Planqué qui le reçoit (#454).
    expect(within(panneau).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /Attacher le café à/ }).length).toBeGreaterThan(0);
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

    const attachements = screen.queryAllByRole('button', { name: /Attacher le café à/ });
    expect(attachements).toHaveLength(0);
    // La raison vit sur la ligne du journal, là où la ligne de portée dit déjà ce qui manque.
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    expect(within(barre).getByText(/déjà attaché/i)).toBeInTheDocument();
  });
});

/** Les contrôles d'action, hors scène d'attaque (son clone est `aria-hidden`, D-098). */
function controles(racine: ParentNode): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>('button, [role="button"]')].filter(
    (el) => !el.closest('[aria-hidden="true"]')
  );
}

describe('le café se touche sur le Planqué (#454, D-145)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chaque Planqué qui reçoit le café porte son nom d’action, et seulement eux', () => {
    const { container, etat } = rendre();
    // Les cibles sont celles du moteur : un `attachEnergy` par Planqué à moi (Poste et Banc).
    const attendues = legalActions(etat).filter((action) => action.type === 'attachEnergy');
    const cibles = screen.getAllByRole('button', { name: /Attacher le café à/ });
    expect(cibles).toHaveLength(attendues.length);
    const attachables = [...container.querySelectorAll('.is-attachable')];
    expect(attachables).toHaveLength(attendues.length);
    expect(attachables.every((el) => cibles.includes(el as HTMLElement))).toBe(true);
  });

  it('toucher le Planqué attache le café : la Machine se vide, le café reste au rang', () => {
    const { container, etat } = rendre();
    const zone = etat.players.player.energyZone;
    fireEvent.click(screen.getAllByRole('button', { name: /Attacher le café à/ })[0]!);

    const fiche = container.querySelector('.board__side:not(.is-direction) .poste__info') as HTMLElement;
    expect(fiche.querySelector('[data-cafes="attaches"] .pip--typed')).not.toBeNull();
    expect(fiche.querySelector('[data-cafes="machine"]')?.textContent).toMatch(/vide/i);
    expect(zone).not.toBeNull();
    // Un seul attachement par tour : plus aucune cible, et le Planqué n'est plus marqué.
    expect(screen.queryAllByRole('button', { name: /Attacher le café à/ })).toHaveLength(0);
    expect(container.querySelectorAll('.is-attachable')).toHaveLength(0);
  });

  it('au clavier, Entrée attache le café comme le toucher', () => {
    rendre();
    const cible = screen.getAllByRole('button', { name: /Attacher le café à/ })[0]!;
    fireEvent.keyDown(cible, { key: 'Enter' });
    expect(screen.queryAllByRole('button', { name: /Attacher le café à/ })).toHaveLength(0);
  });

  it('la barre n’a plus de cibles de café et garde « Café en Machine »', () => {
    const { container } = rendre();
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    expect(container.querySelector('.combat-barre__cafe-cibles')).toBeNull();
    expect(within(barre).queryAllByRole('button', { name: /Attacher/ })).toHaveLength(0);
    expect(screen.getByRole('region', { name: /Café à attacher/i }).textContent).toMatch(/Café en Machine/);
  });
});

/**
 * **Le contrôle mord** (#454, #455) : une cible d'action du combat ne doit pas être atteignable
 * seulement en faisant défiler une rangée sans barre (`overflow-x: auto; scrollbar-width: none`,
 * ce que D-103 interdit). Le test lit les règles de `styles.css`, en retient les rangées qui
 * défilent cachées, et refuse qu'un contrôle d'action y vive. Aucune exemption : la rangée de
 * Rotation n'en a plus (#455, D-147).
 */
function rangeesSansBarre(css: string): string[] {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selecteurs: string[] = [];
  for (const [, selecteur, corps] of sansCommentaires.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/scrollbar-width\s*:\s*none/.test(corps) && /overflow-x\s*:\s*(auto|scroll)/.test(corps)) {
      selecteurs.push(
        ...selecteur
          .split(',')
          .map((morceau) => morceau.trim())
          .filter(Boolean)
      );
    }
  }
  return selecteurs;
}

function controlesCaches(racine: ParentNode, selecteurs: string[]): HTMLElement[] {
  return controles(racine).filter((el) => selecteurs.some((selecteur) => el.closest(selecteur) !== null));
}

describe('le contrôle mord : pas de cible d’action dans une rangée qui défile cachée (#454)', () => {
  it('mord sur un cas fautif fabriqué : un contrôle dans une rangée cachée est signalé', () => {
    const css = '.faux-rangee { overflow-x: auto; scrollbar-width: none; }';
    const racine = document.createElement('div');
    racine.innerHTML = '<div class="faux-rangee"><button type="button">Attacher le café à Faux</button></div>';
    expect(controlesCaches(racine, rangeesSansBarre(css))).toHaveLength(1);
  });

  it('ne mord pas sur un contrôle hors rangée cachée', () => {
    const css = '.faux-rangee { overflow-x: auto; scrollbar-width: none; }';
    const racine = document.createElement('div');
    racine.innerHTML = '<div class="rangee"><button type="button">Fin du tour</button></div>';
    expect(controlesCaches(racine, rangeesSansBarre(css))).toHaveLength(0);
  });

  it('aucune rangée de la barre ne défile plus cachée, et le plateau n’a aucun contrôle caché', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    // #455, D-147 : la rangée de Rotation n'a plus d'exemption, et aucune rangée de la barre défile.
    expect(rangeesSansBarre(css).filter((selecteur) => selecteur.includes('combat-barre'))).toEqual([]);
    const { container } = rendre();
    expect(controlesCaches(container, rangeesSansBarre(css))).toEqual([]);
  });
});
