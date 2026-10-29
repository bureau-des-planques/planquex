// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { rendreApplication } from './test-utils';
import { App } from '@/App';

/**
 * Ce test valide que `rendreApplication` attend bien une microtâche avant de rendre
 * la main au test — ce qui permet de voir les écrans chargés à la demande (prochain ticket).
 *
 * Le contrôle mord en deux temps :
 * 1. Un `render` nu ne voit PAS le contenu qui n'apparaît qu'après une microtâche.
 * 2. `rendreApplication` VOIT ce même contenu grâce à son `waitFor(() => {})`.
 */

// Composant de test qui n'affiche son contenu qu'après une microtâche
function ComposantApresMicrotache() {
  const [pret, setPret] = React.useState(false);
  React.useEffect(() => {
    // Ce setState se fait dans une microtâche (après le premier rendu)
    Promise.resolve().then(() => setPret(true));
  }, []);
  return <div data-testid="contenu">{pret ? 'visible' : 'pas encore'}</div>;
}

// Wrapper qui inclut notre composant de test dans l'application
function AppAvecTest() {
  return (
    <>
      <App />
      <ComposantApresMicrotache />
    </>
  );
}

afterEach(cleanup);

describe('rendreApplication — le contrôle mord', () => {
  it('un render nu ne voit pas le contenu qui apparaît après une microtâche', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppAvecTest />
      </MemoryRouter>
    );
    // Sans attendre, le contenu n'est pas encore là
    expect(screen.getByTestId('contenu')).toHaveTextContent('pas encore');
  });

  it('rendreApplication voit le contenu qui apparaît après une microtâche', async () => {
    // On utilise l'option `extra` pour injecter notre composant de test
    const { container } = await rendreApplication({
      chemin: '/',
      extra: <ComposantApresMicrotache />
    });
    // Grâce au waitFor(() => {}), la microtâche a eu le temps de s'exécuter
    expect(container.querySelector('[data-testid="contenu"]')).toHaveTextContent('visible');
  });
});
