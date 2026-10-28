// @vitest-environment jsdom
// Lent : chaque cas rend la Collection complète dans jsdom et filtre la grille du catalogue entier ; le coût est le rendu répété.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Collection } from './Collection';
import { renderWithStore } from '@/test/test-utils';
import { ALL_CARDS, isPlanque } from '@/data';

const base = { tutorielVu: true, pasAPasCombatVu: true };

/** Les ids des cartes de la grille, dans l'ordre affiché. */
function idsAffiches(conteneur: HTMLElement): string[] {
  return Array.from(conteneur.querySelectorAll<HTMLElement>('.card-slot')).map((slot) => slot.dataset.cardId ?? '');
}

const rareteDe = (id: string) => ALL_CARDS.find((c) => c.id === id)!.rarity;

describe('Collection — filtres de rareté, de coût et de possession (#365)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('le filtre rareté ne garde que la rareté choisie (le contrôle mord : les autres raretés disparaissent)', () => {
    const { container } = renderWithStore(<Collection />, base);
    const avant = idsAffiches(container);
    expect(new Set(avant.map(rareteDe)).size).toBeGreaterThan(1);

    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
    const apres = idsAffiches(container);
    expect(apres.length).toBeGreaterThan(0);
    expect(apres.length).toBeLessThan(avant.length);
    expect(apres.every((id) => rareteDe(id) === '1S')).toBe(true);
  });

  it('le filtre coût en café ne garde que les Planqués qui ont une Pression à ce coût', () => {
    const { container } = renderWithStore(<Collection />, base);
    const select = screen.getByLabelText(/Coût en café/i);
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    const valeur = options.find((v) => v !== 'ALL')!;
    fireEvent.change(select, { target: { value: valeur } });

    const apres = idsAffiches(container);
    expect(apres.length).toBeGreaterThan(0);
    for (const id of apres) {
      const card = ALL_CARDS.find((c) => c.id === id)!;
      expect(isPlanque(card) && card.attacks.some((a) => a.cost.length === Number(valeur))).toBe(true);
    }
  });

  it('« seulement ce que je possède » ne montre que les cartes possédées', () => {
    const owned = { 'sse-infirmier-site': 2 };
    const { container } = renderWithStore(<Collection />, { ...base, owned });
    fireEvent.click(screen.getByLabelText(/Seulement ce que je possède/i));
    expect(idsAffiches(container)).toEqual(['sse-infirmier-site']);
  });

  it('les filtres se combinent : rareté et possession ensemble', () => {
    const rare = ALL_CARDS.find((c) => c.rarity === '1S' && isPlanque(c))!;
    const commune = ALL_CARDS.find((c) => c.rarity === '1D')!;
    const owned = { [rare.id]: 1, [commune.id]: 1 };
    const { container } = renderWithStore(<Collection />, { ...base, owned });

    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
    fireEvent.click(screen.getByLabelText(/Seulement ce que je possède/i));
    expect(idsAffiches(container)).toEqual([rare.id]);
  });

  it('une combinaison sans résultat affiche son message, avec quoi faire', () => {
    const { container } = renderWithStore(<Collection />, { ...base, owned: {} });
    fireEvent.click(screen.getByLabelText(/Seulement ce que je possède/i));
    expect(idsAffiches(container)).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Aucune carte ne correspond à ces filtres.');
    expect(screen.getByText(/Retire un filtre, ou efface-les tous/)).toBeInTheDocument();
  });

  it('le compte de résultats reste affiché et suit le filtre', () => {
    renderWithStore(<Collection />, base);
    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
    const compte = ALL_CARDS.filter((c) => c.rarity === '1S').length;
    expect(screen.getByText(new RegExp(`^${compte} affichés`))).toBeInTheDocument();
  });

  it('les filtres actifs se comptent, et « Tout effacer » les retire tous, sans toucher au tri', () => {
    const { container } = renderWithStore(<Collection />, base);
    expect(screen.queryByRole('button', { name: 'Tout effacer' })).toBeNull();

    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'nom' } });
    expect(screen.getByText('1 filtre actif')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    expect(screen.getByLabelText(/Rareté/i)).toHaveValue('ALL');
    expect(screen.getByLabelText(/Trier par/i)).toHaveValue('nom');
    expect(idsAffiches(container)).toHaveLength(ALL_CARDS.length);
  });

  it('le tri fonctionne avec un filtre posé', () => {
    const { container } = renderWithStore(<Collection />, base);
    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'nom' } });
    const noms = idsAffiches(container).map((id) => ALL_CARDS.find((c) => c.id === id)!.name);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('les filtres survivent au démontage de l’écran (retour de fiche, de page) : ils sont dans l’adresse', () => {
    const first = renderWithStore(<Collection />, base);
    fireEvent.change(screen.getByLabelText(/Faction/i), { target: { value: 'SSE' } });
    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1D' } });
    first.unmount();

    const { container } = renderWithStore(<Collection />, base);
    expect(screen.getByLabelText(/Faction/i)).toHaveValue('SSE');
    expect(screen.getByLabelText(/Rareté/i)).toHaveValue('1D');
    expect(idsAffiches(container).every((id) => rareteDe(id) === '1D')).toBe(true);
  });

  it('une fiche ouverte puis fermée garde les filtres', () => {
    const { container } = renderWithStore(<Collection />, { ...base, owned: { 'sse-infirmier-site': 1 } });
    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1D' } });
    const avant = idsAffiches(container);
    fireEvent.click(screen.getAllByRole('button', { name: /Infirmier de site/i })[0]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByLabelText(/Rareté/i)).toHaveValue('1D');
    expect(idsAffiches(container)).toEqual(avant);
  });
});
