// @vitest-environment jsdom
// Lent : l'application entière est rendue, coquille comprise (D-143 (5)).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { attendreEcran, rendreApplication } from '@/test/test-utils';
import { useStore } from '@/store/useStore';
import { deckLegal } from '@/game/deck';
import { DECKS_PROPOSES } from '@/data/decks-proposes';

/**
 * **Un écran, deux onglets** (#545) : la Collection et le Deck sont deux métiers, servis par
 * une seule page. Ce que ce fichier garde, c'est ce que la fusion pourrait casser :
 *
 * - chaque route ouvre **son** onglet (`/collection` ne montre pas le Deck, et l'inverse) ;
 * - la barre du bas passe à **quatre** entrées (cinq depuis D-190), celle des Cartes restant l'onglet courant sur
 *   les deux adresses ;
 * - l'écran **Deck vide** propose toujours les Decks proposés, ouverts d'emblée — c'est là
 *   qu'un nouveau venu arrive.
 *
 * Ces trois contrôles **mordent** : un shell qui ignorerait la route, une barre restée à cinq
 * entrées, ou un volet refermé les font tomber.
 */
describe('Collection et Deck — un seul écran, deux onglets (#545)', () => {
  afterEach(cleanup);

  const onglets = () => screen.getByRole('navigation', { name: 'Collection et Deck' });
  const barre = () => screen.getByRole('navigation', { name: 'Navigation principale' });

  it('/collection ouvre l’onglet Collection, et pas celui du Deck', async () => {
    await rendreApplication({ chemin: '/collection' });
    await attendreEcran(/cartes tirables/);

    expect(within(onglets()).getByRole('link', { name: 'Collection' })).toHaveAttribute('aria-current', 'page');
    expect(within(onglets()).getByRole('link', { name: 'Deck' })).not.toHaveAttribute('aria-current');

    // Le contenu est celui de la Collection : sa jauge, et jamais les contraintes du Deck.
    expect(screen.getByRole('heading', { name: /cartes tirables/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Ce que le Deck doit respecter/i })).toBeNull();
  });

  it('/deck ouvre l’onglet Deck, et pas celui de la Collection', async () => {
    await rendreApplication({ chemin: '/deck' });
    await attendreEcran(/Ce que le Deck doit respecter/);

    expect(within(onglets()).getByRole('link', { name: 'Deck' })).toHaveAttribute('aria-current', 'page');
    expect(within(onglets()).getByRole('link', { name: 'Collection' })).not.toHaveAttribute('aria-current');

    // Le contenu est celui du Deck : ses contraintes, et jamais la jauge de la Collection.
    expect(screen.getByRole('heading', { name: /Ce que le Deck doit respecter/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cartes tirables/ })).toBeNull();
  });

  it('la barre du bas a cinq entrées (D-190), et garde les Cartes allumées sur les deux routes', async () => {
    const collection = await rendreApplication({ chemin: '/collection' });
    expect(
      within(barre())
        .getAllByRole('link')
        .map((lien) => lien.textContent)
    ).toEqual(['Accueil', 'Cartes', 'Combat', 'Pause café', 'Comité']);
    expect(within(barre()).getByRole('link', { name: 'Cartes' })).toHaveAttribute('aria-current', 'page');
    collection.unmount();
    cleanup();

    await rendreApplication({ chemin: '/deck' });
    expect(
      within(barre())
        .getAllByRole('link')
        .map((lien) => lien.textContent)
    ).toEqual(['Accueil', 'Cartes', 'Combat', 'Pause café', 'Comité']);
    expect(within(barre()).getByRole('link', { name: 'Cartes' })).toHaveAttribute('aria-current', 'page');
  });

  it('l’écran Deck vide propose toujours les Decks, volet ouvert, et les charge', async () => {
    await rendreApplication({ chemin: '/deck', storeState: { deck: [], owned: {} } });
    await attendreEcran(/Decks proposés/);

    const volet = screen.getByRole('heading', { name: /Decks proposés/i }).closest('details') as HTMLDetailsElement;
    // Ouvert **d'emblée** : c'est le départ d'un nouveau venu, pas un panneau à déplier.
    expect(volet.open).toBe(true);

    const premier = DECKS_PROPOSES[0];
    const item = screen.getByText(premier.name).closest('li') as HTMLElement;
    await userEvent.click(within(item).getByRole('button', { name: /Charger/i }));

    // La règle de jeu ne bouge pas (#545) : vingt cartes, et un Deck légal.
    const { deck, cafeTypes } = useStore.getState();
    expect(deck).toEqual([...premier.cartes]);
    expect(deck).toHaveLength(20);
    expect(deckLegal(deck).ok).toBe(true);
    expect(cafeTypes).toEqual([...premier.cafeTypes]);
  });
});
