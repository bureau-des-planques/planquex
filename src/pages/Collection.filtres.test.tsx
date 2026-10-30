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

  it('les filtres actifs sont nommés, retirables un par un, et « Tout effacer » les retire tous', () => {
    const { container } = renderWithStore(<Collection />, base);
    expect(screen.queryByRole('button', { name: 'Tout effacer' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Filtres actifs' })).toBeNull();

    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
    fireEvent.change(screen.getByLabelText(/Trier par/i), { target: { value: 'nom' } });
    expect(screen.getByRole('button', { name: /Retirer Rareté : ★ \(1S\)/ })).toBeInTheDocument();
    // Pas de compteur nu : le nom du filtre est écrit, il n'y a rien à rouvrir.
    expect(screen.queryByText(/filtre(s)? actif/)).toBeNull();

    // Un jeton retiré ne retire que **son** filtre ; le tri, lui, ne bouge pas.
    const avant = idsAffiches(container).length;
    fireEvent.click(screen.getByRole('button', { name: /Retirer Rareté/ }));
    expect(idsAffiches(container).length).toBeGreaterThan(avant);
    expect(screen.getByLabelText(/Rareté/i)).toHaveValue('ALL');
    expect(screen.getByLabelText(/Trier par/i)).toHaveValue('nom');

    fireEvent.change(screen.getByLabelText(/Rareté/i), { target: { value: '1S' } });
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
    // `combobox` : le jeton « Retirer Faction : SSE » porte aussi le mot Faction.
    fireEvent.change(screen.getByRole('combobox', { name: /Faction/i }), { target: { value: 'SSE' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Rareté/i }), { target: { value: '1D' } });
    first.unmount();

    const { container } = renderWithStore(<Collection />, base);
    expect(screen.getByRole('combobox', { name: /Faction/i })).toHaveValue('SSE');
    expect(screen.getByRole('combobox', { name: /Rareté/i })).toHaveValue('1D');
    expect(idsAffiches(container).every((id) => rareteDe(id) === '1D')).toBe(true);
  });

  it('une fiche ouverte puis fermée garde les filtres', () => {
    const { container } = renderWithStore(<Collection />, { ...base, owned: { 'sse-infirmier-site': 1 } });
    fireEvent.change(screen.getByRole('combobox', { name: /Rareté/i }), { target: { value: '1D' } });
    const avant = idsAffiches(container);
    fireEvent.click(screen.getAllByRole('button', { name: /Infirmier de site/i })[0]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('combobox', { name: /Rareté/i })).toHaveValue('1D');
    expect(idsAffiches(container)).toEqual(avant);
  });
});

describe('Collection — le volet des filtres', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('est replié sans filtre : la recherche et le tri restent visibles, le reste attend derrière « Filtres »', () => {
    const { container } = renderWithStore(<Collection />, base);
    const volet = container.querySelector<HTMLDetailsElement>('details.filtres-volet');
    expect(volet).not.toBeNull();
    expect(volet!.open).toBe(false);
    // Les champs repliés vivent **dans** le volet ; la recherche, non.
    expect(volet!.contains(screen.getByLabelText(/Rareté/i))).toBe(true);
    expect(volet!.contains(screen.getByPlaceholderText('Chercher une carte'))).toBe(false);
  });

  it('s’ouvre d’emblée si l’adresse porte un filtre, et son bouton en dit le nombre (le contrôle mord : la recherche seule ne l’ouvre pas)', () => {
    window.history.replaceState(null, '', '/?q=chef');
    const { container, unmount } = renderWithStore(<Collection />, base);
    expect(container.querySelector<HTMLDetailsElement>('details.filtres-volet')!.open).toBe(false);
    unmount();

    window.history.replaceState(null, '', '/?rarete=1S&possedees=1&q=chef');
    const rendu = renderWithStore(<Collection />, base);
    const volet = rendu.container.querySelector<HTMLDetailsElement>('details.filtres-volet')!;
    expect(volet.open).toBe(true);
    expect(volet.querySelector('.filtres-volet__compte')).toHaveTextContent('2');
  });
});
