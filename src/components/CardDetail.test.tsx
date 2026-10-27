// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ALL_CARDS } from '@/data';
import { CardDetail } from './CardDetail';

const carte = ALL_CARDS[0];

describe('CardDetail — la fiche est un dialogue (#131)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('porte le rôle dialogue, nommé par la carte', () => {
    render(<CardDetail card={carte} owned={1} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: carte.name })).toBeInTheDocument();
  });

  it('Échap la ferme', async () => {
    const onClose = vi.fn();
    render(<CardDetail card={carte} owned={1} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('la croix la ferme', () => {
    const onClose = vi.fn();
    render(<CardDetail card={carte} owned={1} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('en développement, le bouton de test existe ; dans le build, un testeur ne le voit pas', () => {
    const onAddCard = vi.fn();

    vi.stubEnv('DEV', true);
    const dev = render(<CardDetail card={carte} owned={1} onClose={() => {}} onAddCard={onAddCard} />);
    expect(screen.getByRole('button', { name: /Ajouter un exemplaire \(test\)/ })).toBeInTheDocument();
    dev.unmount();

    vi.stubEnv('DEV', false);
    render(<CardDetail card={carte} owned={1} onClose={() => {}} onAddCard={onAddCard} />);
    expect(screen.queryByRole('button', { name: /Ajouter un exemplaire/ })).toBeNull();
    expect(screen.queryByText(/\(test\)/)).toBeNull();
  });

  it('« Ajouter au Deck » reste offert au testeur', () => {
    vi.stubEnv('DEV', false);
    render(<CardDetail card={carte} owned={1} onClose={() => {}} onAddDeck={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ajouter au Deck' })).toBeInTheDocument();
  });
});
