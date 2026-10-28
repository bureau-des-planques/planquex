// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from './Home';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS } from '@/data';
import { CARTES_TIRABLES, HORS_ARRIVAGE, PLAFOND_TIRABLE } from '@/components/plafond-collection';
import { PACK_COMPOSITION } from '@/game/pack';
import { useStore } from '@/store/useStore';

const tout = (cartes: readonly { id: string }[]) => Object.fromEntries(cartes.map((c) => [c.id, 1]));

/** La passe de finition de l'alpha (#131, D-060) : Accueil. */
describe('Home — finition', () => {
  it('le plafond vient de la table de tirage : il ne compte que ce qu’un Arrivage peut donner', () => {
    const tirable = (rarete: string) =>
      PACK_COMPOSITION.some((ligne) => (ligne.rarities as readonly string[]).includes(rarete));
    expect(PLAFOND_TIRABLE).toBe(ALL_CARDS.filter((c) => tirable(c.rarity)).length);
    // Il y a bien des cartes hors Arrivage (3S, COU) : sans elles ce garde ne garderait rien.
    expect(HORS_ARRIVAGE).toBeGreaterThan(0);
    expect(PLAFOND_TIRABLE).toBeLessThan(ALL_CARDS.length);
  });

  it('tout ce qui sort d’un Arrivage = 100 %, pas 98 %', () => {
    renderWithStore(<Home />, { owned: tout(CARTES_TIRABLES), tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`plafond ${PLAFOND_TIRABLE} par Arrivage`))).toBeInTheDocument();
  });

  it('tout le catalogue reste à 100 % (jamais au-delà)', () => {
    renderWithStore(<Home />, { owned: tout(ALL_CARDS), tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('l’Arrivage est un dialogue, Échap le ferme', async () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/ }));

    // Le titre ne dit plus « cinq nouvelles cartes » : le dialogue annonce le tirage, et le
    // nombre de cartes neuves vient du badge (#283). Le nom accessible reste « Arrivage ».
    const dialogue = await screen.findByRole('dialog', { name: /Arrivage/ });
    expect(dialogue.querySelectorAll('.card')).toHaveLength(5);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('une carte que le testeur n’avait pas est signalée « Nouvelle », une carte déjà possédée non', async () => {
    // Collection vide : tout ce que l'Arrivage donne est neuf, une seule fois par carte.
    renderWithStore(<Home />, { owned: {}, tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/ }));
    const dialogue = await screen.findByRole('dialog');
    const neuves = within(dialogue).getAllByText('Nouvelle');
    // Collection vide au départ : après l'Arrivage, elle contient exactement les cartes
    // **distinctes** tirées — c'est autant de « Nouvelle » (une carte tirée deux fois ne l'est qu'une).
    const distinctes = Object.keys(useStore.getState().owned).filter((id) => (useStore.getState().owned[id] ?? 0) > 0);
    expect(neuves).toHaveLength(distinctes.length);
    expect(dialogue.querySelectorAll('.ouverture__carte')).toHaveLength(5);
  });

  it('avec tout le catalogue en main, aucune carte de l’Arrivage n’est « Nouvelle »', async () => {
    renderWithStore(<Home />, { owned: tout(ALL_CARDS), tutorielVu: true, pasAPasCombatVu: true });
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/ }));
    const dialogue = await screen.findByRole('dialog');
    expect(within(dialogue).queryByText('Nouvelle')).toBeNull();
  });
});
