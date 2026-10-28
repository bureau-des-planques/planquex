// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Battle } from './Battle';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS, getCard } from '@/data';
import type { BattleState } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { partieSauvegardee } from '@/store/partie';

/**
 * **La Rotation tient en une entrée** (#455, D-147). La barre d'action ne porte pas une cible par
 * Planqué du Banc : une seule entrée « Rotation » ouvre le panneau du Poste, qui liste ces cibles.
 * La règle ne change pas — chaque cible est un `retreat` de la liste du moteur.
 */

function deckDeTest() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  return autoDeck(owned).deck;
}

interface CasRotation {
  etat: BattleState;
  deck: string[];
}

/**
 * Une partie où **mon tour** est ouvert, avec au moins deux Rotations légales : deux Planqués au
 * Banc et de quoi payer. On remplit le Banc et on attache d'abord, puis on s'arrête.
 */
function partieAvecRotations(): CasRotation {
  const deck = deckDeTest();
  for (let graine = 1; graine < 800; graine += 1) {
    let state = createBattle(deck, deck, graine);
    for (let i = 0; i < 400 && state.phase === 'playing'; i += 1) {
      const mon_tour = state.current === 'player' && state.pendingPromotion === null && state.pendingChoice === null;
      const legales = legalActions(state).filter((action) => action.type !== 'forfeit');
      if (mon_tour && legales.filter((action) => action.type === 'retreat').length >= 2) {
        return { etat: state, deck };
      }
      const action =
        (mon_tour ? legales.find((entree) => entree.type === 'playBasic') : undefined) ??
        (mon_tour ? legales.find((entree) => entree.type === 'attachEnergy') : undefined) ??
        legales.find((entree) => entree.type === 'promoteActive') ??
        legales.find((entree) => entree.type === 'attack') ??
        legales.find((entree) => entree.type === 'endTurn');
      if (!action) break;
      state = applyAction(state, action);
    }
  }
  throw new Error('aucune partie avec deux Rotations : le test ne prouverait rien');
}

function rendre() {
  const { etat, deck } = partieAvecRotations();
  const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
  if (!partie) throw new Error('partie terminée : rien à rendre');
  return { ...renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie }), etat };
}

type Action = ReturnType<typeof legalActions>[number];

function rotationsLegales(etat: BattleState): Extract<Action, { type: 'retreat' }>[] {
  return legalActions(etat).filter(
    (action): action is Extract<Action, { type: 'retreat' }> => action.type === 'retreat'
  );
}

function nomDu(carte: { cardId: string } | null | undefined): string {
  if (!carte) throw new Error('carte absente du Banc : le test ment');
  const definition = getCard(carte.cardId);
  if (!definition) throw new Error(`carte inconnue : ${carte.cardId}`);
  return definition.name;
}

describe('la Rotation tient en une entrée dans la barre (#455, D-147)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('la barre porte une seule entrée « Rotation », quel que soit le nombre de cibles', () => {
    const { etat } = rendre();
    expect(rotationsLegales(etat).length).toBeGreaterThanOrEqual(2);
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    const entrees = within(barre).getAllByRole('button', { name: /^Rotation/ });
    expect(entrees).toHaveLength(1);
    // Aucune cible par Planqué du Banc dans la barre.
    expect(within(barre).queryAllByRole('button', { name: /^Rotation vers/ })).toHaveLength(0);
  });

  it('l’entrée ouvre le panneau du Poste : une cible par Planqué du Banc, nommant le Planqué et le coût', () => {
    const { etat } = rendre();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Actions du tour' })).getByRole('button', { name: /^Rotation/ })
    );

    const panneau = screen.getByRole('dialog');
    expect(panneau.querySelector('.inspecteur__titre')?.textContent).toBe(nomDu(etat.players.player.active));
    const cibles = within(panneau).getAllByRole('button', { name: /^Rotation vers/ });
    const attendues = rotationsLegales(etat);
    expect(cibles).toHaveLength(attendues.length);
    attendues.forEach((action, i) => {
      const nom = nomDu(etat.players.player.bench[action.benchIndex]);
      expect(cibles[i]?.textContent).toContain(`vers ${nom}`);
      expect(cibles[i]?.textContent).toMatch(/coût /);
    });
  });

  it('une Rotation jouée depuis le panneau est appliquée : l’entrée disparaît (une fois par tour)', () => {
    const { etat } = rendre();
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    fireEvent.click(within(barre).getByRole('button', { name: /^Rotation/ }));
    const panneau = screen.getByRole('dialog');
    fireEvent.click(within(panneau).getAllByRole('button', { name: /^Rotation vers/ })[0]!);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rotationsLegales(applyAction(etat, rotationsLegales(etat)[0]!))).toHaveLength(0);
    expect(within(barre).queryAllByRole('button', { name: /^Rotation/ })).toHaveLength(0);
  });

  it('au clavier : Entrée sur l’entrée ouvre le panneau, Entrée sur une cible joue la Rotation', async () => {
    rendre();
    const barre = screen.getByRole('region', { name: 'Actions du tour' });
    const entree = within(barre).getByRole('button', { name: /^Rotation/ });
    expect(entree.tagName).toBe('BUTTON');

    entree.focus();
    await userEvent.keyboard('{Enter}');
    const panneau = screen.getByRole('dialog');
    const premiere = within(panneau).getAllByRole('button', { name: /^Rotation vers/ })[0]!;
    premiere.focus();
    await userEvent.keyboard('{Enter}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(barre).queryAllByRole('button', { name: /^Rotation/ })).toHaveLength(0);
  });

  it('le panneau d’un Planqué du Banc n’offre pas la Rotation : elle se joue depuis le Poste', () => {
    const { container, etat } = rendre();
    const uid = etat.players.player.bench.find((carte) => carte !== null)?.uid;
    if (!uid) throw new Error('aucun Planqué au Banc : le test ne prouverait rien');
    const carte = container.querySelector(`.board__side:not(.is-direction) [data-uid="${uid}"]`) as HTMLElement;
    fireEvent.click(carte);
    const panneau = screen.getByRole('dialog');
    expect(within(panneau).queryAllByRole('button', { name: /^Rotation/ })).toHaveLength(0);
  });
});
