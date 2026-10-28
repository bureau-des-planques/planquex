// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { BandeauNouvelleVersion } from './BandeauNouvelleVersion';

/**
 * Le bandeau « une nouvelle version est prête » (#355).
 *
 * **Aucun rechargement automatique** : c'est la règle, et c'est elle que ces tests tiennent.
 * L'abonnement au service worker est une **couture** (`abonner`), le rechargement aussi
 * (`recharger`) : le test n'attend aucun service worker réel et ne recharge aucune page.
 *
 * **Le contrôle mord** : si le composant n'écoutait pas le service worker, `declencher()`
 * n'aurait personne à prévenir, le bandeau ne s'afficherait jamais, et le second test tombe.
 */

/** Un abonnement factice : on garde le signal sous la main pour le déclencher. */
function abonnement() {
  let signaler: (() => void) | undefined;
  const abonner = vi.fn((signale: () => void) => {
    signaler = signale;
    return Promise.resolve(() => {});
  });
  return {
    abonner,
    declencher: () =>
      act(() => {
        signaler?.();
      })
  };
}

function monter(chemin: string, ab = abonnement(), recharger = vi.fn()) {
  const rendu = render(
    <MemoryRouter initialEntries={[chemin]}>
      <BandeauNouvelleVersion abonner={ab.abonner} recharger={recharger} />
      <Routes>
        <Route
          path="*"
          element={
            <nav>
              <Link to="/">Le bureau</Link>
              <Link to="/battle">Le combat</Link>
            </nav>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  return { ...rendu, ...ab, recharger };
}

describe('BandeauNouvelleVersion (#355)', () => {
  it('sans nouvelle version, il n’y a rien : ni texte, ni espace, ni rechargement', async () => {
    const { recharger } = monter('/');
    // La promesse d'abonnement se résout sans jamais signaler.
    await act(async () => {});
    expect(screen.queryByText(/nouvelle version est prête/i)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(recharger).not.toHaveBeenCalled();
  });

  it('une nouvelle version prête s’annonce, et ne recharge pas d’elle-même', async () => {
    const { abonner, declencher, recharger } = monter('/');
    await act(async () => {});

    declencher();
    expect(screen.getByRole('status')).toHaveTextContent(/Une nouvelle version est prête/i);
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    // **Le cœur du ticket** : l'annonce ne recharge pas. Le geste, lui, le fera.
    expect(recharger).not.toHaveBeenCalled();
    expect(abonner).toHaveBeenCalledTimes(1);
  });

  it('le bouton Recharger demande le rechargement, une fois, puis le bandeau disparaît', async () => {
    const { declencher, recharger } = monter('/');
    await act(async () => {});
    declencher();

    await userEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/nouvelle version est prête/i)).toBeNull();
  });

  it('la fermeture fait disparaître le bandeau sans recharger', async () => {
    const { declencher, recharger } = monter('/');
    await act(async () => {});
    declencher();

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByText(/nouvelle version est prête/i)).toBeNull();
    expect(recharger).not.toHaveBeenCalled();
  });

  it('pas de bandeau pendant un combat, et il revient après (#355)', async () => {
    const { declencher } = monter('/battle');
    await act(async () => {});
    declencher();

    // On ne coupe pas une partie en cours : rien à l'écran.
    expect(screen.queryByText(/nouvelle version est prête/i)).toBeNull();

    // Quitter le combat : la mise à jour est toujours là, le bandeau revient.
    await userEvent.click(screen.getByRole('link', { name: 'Le bureau' }));
    expect(screen.getByText(/une nouvelle version est prête/i)).toBeInTheDocument();
  });
});
