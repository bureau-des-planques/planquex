// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Collection } from './Collection';
import { renderWithStore } from '@/test/test-utils';
import { causeDuVide } from '@/components/cause-du-vide';
import { HORS_ARRIVAGE, PLAFOND_TIRABLE } from '@/components/plafond-collection';

const base = { tutorielVu: true, pasAPasCombatVu: true };

/** La passe de finition de l'alpha (#131, D-060) : Collection. */
describe('Collection — finition', () => {
  it('le vide n’accuse que ce qui est en cause : la recherche', () => {
    renderWithStore(<Collection />, base);
    fireEvent.change(screen.getByPlaceholderText(/Chercher une carte/i), { target: { value: 'zzzz-aucune' } });
    expect(screen.getByText('Aucune carte ne correspond à cette recherche.')).toBeInTheDocument();
  });

  it('…ou le filtre, quand rien n’a été tapé : ce n’est pas la recherche qu’on accuse', () => {
    // Le catalogue croise aujourd'hui toutes les factions et tous les stades : un filtre seul
    // ne peut pas vider la grille à l'écran. La cause est donc testée là où elle se décide.
    expect(causeDuVide('', true)).toBe('ces filtres');
    expect(causeDuVide('   ', true)).toBe('ces filtres');
    expect(causeDuVide('dir', false)).toBe('cette recherche');
    expect(causeDuVide('dir', true)).toBe('cette recherche et ces filtres');
  });

  it('recherche et filtre ensemble : les deux sont nommés, et « Tout effacer » rend la grille', () => {
    renderWithStore(<Collection />, base);
    fireEvent.change(screen.getByPlaceholderText(/Chercher une carte/i), { target: { value: 'zzzz-aucune' } });
    fireEvent.change(screen.getByLabelText(/Faction/i), { target: { value: 'SSE' } });
    expect(screen.getByText('Aucune carte ne correspond à cette recherche et ces filtres.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    expect(screen.queryByText(/Aucune carte ne correspond/)).toBeNull();
    expect(screen.getByPlaceholderText(/Chercher une carte/i)).toHaveValue('');
    expect(screen.getByLabelText(/Faction/i)).toHaveValue('ALL');
  });

  it('la grille d’un filtre sans résultat est un statut annoncé', () => {
    renderWithStore(<Collection />, base);
    fireEvent.change(screen.getByPlaceholderText(/Chercher une carte/i), { target: { value: 'zzzz-aucune' } });
    expect(screen.getByRole('status')).toHaveTextContent('Aucune carte ne correspond');
  });

  it('la Collection vide le dit, au lieu de montrer une grille de cartes grisées sans un mot', () => {
    renderWithStore(<Collection />, { ...base, owned: {} });
    expect(screen.getByText(/Ta Collection est vide : ouvre un Arrivage/)).toBeInTheDocument();
  });

  it('une Collection qui a des cartes n’affiche pas ce message', () => {
    renderWithStore(<Collection />, { ...base, owned: { 'sse-infirmier-site': 1 } });
    expect(screen.queryByText(/Ta Collection est vide/)).toBeNull();
  });

  it('le plafond réel est écrit : sept cartes ne sortent d’aucun Arrivage', () => {
    renderWithStore(<Collection />, base);
    expect(
      screen.getByText(
        new RegExp(`${HORS_ARRIVAGE} cartes ne sortent d’aucun Arrivage : le maximum à tirer est ${PLAFOND_TIRABLE}`)
      )
    ).toBeInTheDocument();
  });
});
