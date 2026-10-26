// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Battle } from '@/pages/Battle';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS } from '@/data';
import type { BattleState } from '@/data/types';
import { autoDeck } from '@/game/deck';
import { applyAction, createBattle, legalActions } from '@/game/engine';
import { nextAiAction } from '@/game/ia';
import { partieSauvegardee } from '@/store/partie';
import { useStore } from '@/store/useStore';

/**
 * **L'inspecteur du combat** (SPEC-COMBAT-UI §3, §6.4 ; ticket #188).
 *
 * Deux surfaces, un contenu : l'infobulle au survol et au focus (lecture, **aucun bouton**), le
 * panneau au clic (non modal, avec les gestes de la carte). Les tests passent par le plateau réel :
 * c'est la carte du plateau qui se désigne, et le panneau qui se règle sur elle.
 */

/** Une partie où le joueur peut attacher un café : elle donne au panneau un geste à montrer. */
function partieAvecCafe() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  for (let seed = 1; seed < 300; seed += 1) {
    let s: BattleState = createBattle(deck, deck, seed);
    for (let i = 0; i < 60 && s.phase === 'playing'; i += 1) {
      const auTour = s.current === 'player' && s.pendingPromotion === null;
      if (auTour && legalActions(s).some((a) => a.type === 'attachEnergy')) {
        const partie = partieSauvegardee(s, null, { playerDeck: deck, aiDeck: deck });
        if (partie) return { partie, etat: s };
      }
      const legales = legalActions(s).filter((a) => a.type !== 'forfeit');
      const action =
        s.current === 'ai' && !s.pendingPromotion
          ? nextAiAction(s, 'scripte')
          : (legales.find((a) => a.type === 'attachEnergy') ?? legales.find((a) => a.type === 'endTurn'));
      if (!action) break;
      s = applyAction(s, action);
    }
  }
  throw new Error('aucune partie ne propose de café au joueur');
}

/** Une partie neuve : le Poste du joueur et celui de la Direction, tous deux sur le plateau. */
function partieNeuve() {
  const owned = Object.fromEntries(ALL_CARDS.map((card) => [card.id, 2]));
  const deck = autoDeck(owned).deck;
  const etat = createBattle(deck, deck, 42);
  const partie = partieSauvegardee(etat, null, { playerDeck: deck, aiDeck: deck });
  if (!partie) throw new Error('partie terminée : rien à rendre');
  return { partie, etat };
}

/** La carte du plateau d'un `uid`, telle que l'écran la pose (`data-uid`). */
function carteDuPlateau(uid: string): HTMLElement {
  const carte = document.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
  if (!carte) throw new Error(`la carte ${uid} n’est pas sur le plateau`);
  return carte;
}

describe('Inspecteur du combat — l’infobulle de lecture (survol et focus)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('au survol, une infobulle role="tooltip" sans aucun bouton, reliée à la carte', async () => {
    const { partie, etat } = partieNeuve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    // Rien avant le délai de survol : l'infobulle n'apparaît pas au premier pixel.
    await userEvent.hover(carte);
    expect(screen.queryByRole('tooltip')).toBeNull();

    const infobulle = await screen.findByRole('tooltip');
    expect(within(infobulle).queryAllByRole('button')).toHaveLength(0);
    expect(carte).toHaveAttribute('aria-describedby', infobulle.id);
    // Le Stress est chiffré, et le nom est entier.
    expect(infobulle).toHaveTextContent(/\d+\/\d+ de Stress/);
    expect(infobulle).toHaveTextContent(cardNameOf(etat, 'player'));
  });

  it('l’infobulle reste ouverte quand le pointeur entre dedans (SC 1.4.13 : survolable)', async () => {
    const { partie, etat } = partieNeuve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    await userEvent.hover(carte);
    const infobulle = await screen.findByRole('tooltip');
    await userEvent.hover(infobulle);
    expect(screen.getByRole('tooltip')).toBe(infobulle);
  });

  it('Échap la ferme, sans que le pointeur ait à bouger', async () => {
    const { partie, etat } = partieNeuve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    await userEvent.hover(carte);
    await screen.findByRole('tooltip');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('au focus clavier, la même infobulle ; elle se ferme au blur', async () => {
    const { partie, etat } = partieNeuve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    act(() => carte.focus());
    const infobulle = await screen.findByRole('tooltip');
    expect(carte).toHaveAttribute('aria-describedby', infobulle.id);

    act(() => carte.blur());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Inspecteur du combat — le panneau d’action (clic, tap, Entrée)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('au clic, un dialogue non modal : ni voile, ni aria-modal, et les gestes de la carte', async () => {
    const { partie, etat } = partieAvecCafe();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    fireEvent.click(carte);

    const panneau = await screen.findByRole('dialog');
    expect(panneau).not.toHaveAttribute('aria-modal');
    // Pas de voile : le plateau reste lisible et cliquable.
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(panneau).toHaveAccessibleName(cardNameOf(etat, 'player'));
    // Au moins un geste, et c'est un bouton tiré de la liste du moteur.
    const gestes = within(panneau).getByRole('region', { name: 'Gestes de cette carte' });
    expect(within(gestes).getByRole('button', { name: /Attacher 1 café/ })).toBeInTheDocument();
  });

  it('un geste du panneau est joué, et le panneau se ferme', async () => {
    const { partie, etat } = partieAvecCafe();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    fireEvent.click(carte);
    const panneau = await screen.findByRole('dialog');
    fireEvent.click(within(panneau).getByRole('button', { name: /Attacher 1 café/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useStore.getState().partie?.actions.length ?? 0).toBeGreaterThan(0);
  });

  it('Échap ferme le panneau et rend le focus à la carte', async () => {
    const { partie, etat } = partieAvecCafe();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    fireEvent.click(carte);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(carte).toHaveFocus();
  });

  it('une carte adverse s’ouvre en lecture seule : aucune section de gestes', async () => {
    const { partie, etat } = partieNeuve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const adverse = etat.players.ai.active?.uid ?? '';

    fireEvent.click(carteDuPlateau(adverse));

    const panneau = await screen.findByRole('dialog');
    expect(within(panneau).queryByRole('region', { name: 'Gestes de cette carte' })).toBeNull();
    expect(within(panneau).queryAllByRole('button')).toHaveLength(1); // « Fermer », seul.
  });

  it('le clavier ouvre le panneau avec Entrée, comme le clic', async () => {
    const { partie, etat } = partieNeuve();
    renderWithStore(<Battle />, { tutorielVu: true, pasAPasCombatVu: true, partie });
    const carte = carteDuPlateau(etat.players.player.active?.uid ?? '');

    act(() => carte.focus());
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('dialog')).toHaveAccessibleName(cardNameOf(etat, 'player'));
  });
});

/** Le nom de la carte active d'un camp, tel que le plateau l'écrit. */
function cardNameOf(state: BattleState, camp: 'player' | 'ai'): string {
  const active = state.players[camp].active;
  const definition = ALL_CARDS.find((carte) => carte.id === active?.cardId);
  return definition?.name ?? '';
}
