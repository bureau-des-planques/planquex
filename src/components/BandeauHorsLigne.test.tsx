// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { BandeauHorsLigne } from './BandeauHorsLigne';

/** `navigator.onLine` est en lecture seule : on la pilote par un espion sur le getter. */
function reseau(enLigne: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(enLigne);
}

describe('BandeauHorsLigne (#131)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('en ligne, il n’y a rien à dire', () => {
    reseau(true);
    render(<BandeauHorsLigne />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hors ligne, il le dit — et dit ce qui continue et ce qui attend', () => {
    reseau(false);
    render(<BandeauHorsLigne />);
    const bandeau = screen.getByRole('status');
    expect(bandeau).toHaveTextContent('Hors ligne');
    expect(bandeau).toHaveTextContent(/combats, Collection et Deck/);
    expect(bandeau).toHaveTextContent(/attendent le retour de la connexion/);
  });

  it('suit le réseau : il apparaît à la coupure, disparaît au retour', () => {
    reseau(true);
    render(<BandeauHorsLigne />);
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      reseau(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      reseau(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
