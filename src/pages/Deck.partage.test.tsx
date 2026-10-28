// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Deck } from './Deck';
import { renderWithStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { DECKS_PROPOSES } from '@/data/decks-proposes';
import { encodeDeckCode } from '@/game/codec';

/**
 * **Partage du Deck à l'écran** — ticket #363. Ce que le testeur voit : le code de son Deck,
 * un Deck reçu qui se charge avec ses cartes manquantes **grisées et comptées**, un code
 * refusé qui dit pourquoi, et un Deck illégal qui s'exporte avec un avertissement.
 */

const DECK_LEGAL = [...DECKS_PROPOSES[0].cartes];
const CAFES = [...DECKS_PROPOSES[0].cafeTypes];

describe('Deck — partage par code à l’écran (#363)', () => {
  it('affiche le code du Deck courant, qui se relit à l’identique', () => {
    renderWithStore(<Deck />, {
      deck: DECK_LEGAL,
      cafeTypes: CAFES,
      owned: {},
      tutorielVu: true,
      pasAPasCombatVu: true
    });

    const zone = screen.getByLabelText('Code du Deck à partager') as HTMLTextAreaElement;
    expect(zone.value).toBe(encodeDeckCode(DECK_LEGAL, CAFES));
    expect(zone.value.startsWith('PLQ1.')).toBe(true);
  });

  it('avertit un Deck illégal sans bloquer son export', () => {
    renderWithStore(<Deck />, { deck: DECK_LEGAL.slice(0, 5), owned: {}, tutorielVu: true, pasAPasCombatVu: true });

    expect(screen.getByText(/Ce code porte un Deck illégal/)).toBeInTheDocument();
    const zone = screen.getByLabelText('Code du Deck à partager') as HTMLTextAreaElement;
    expect(zone.value).toBe(encodeDeckCode(DECK_LEGAL.slice(0, 5), []));
  });

  it('importe un Deck reçu : ses cartes non possédées sont grisées et comptées, jamais retirées', () => {
    const recu = encodeDeckCode(DECK_LEGAL, CAFES);
    renderWithStore(<Deck />, { deck: [], owned: {}, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.change(screen.getByLabelText(/Coller un code reçu/), { target: { value: recu } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer ce Deck' }));

    expect(useStore.getState().deck).toEqual(DECK_LEGAL);
    expect(useStore.getState().cafeTypes).toEqual(CAFES);
    expect(screen.getByText(/Deck importé : 20 cartes, dont 20 que tu ne possèdes pas/)).toBeInTheDocument();
    expect(screen.getAllByText('Non possédée').length).toBeGreaterThan(0);
  });

  it('refuse un code illisible en disant pourquoi, et ne touche pas au Deck', () => {
    renderWithStore(<Deck />, { deck: DECK_LEGAL.slice(0, 2), owned: {}, tutorielVu: true, pasAPasCombatVu: true });

    fireEvent.change(screen.getByLabelText(/Coller un code reçu/), { target: { value: 'PLQ9.abc.def' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer ce Deck' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/version inconnue/);
    expect(useStore.getState().deck).toEqual(DECK_LEGAL.slice(0, 2));
  });
});
