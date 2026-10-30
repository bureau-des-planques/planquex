// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JourneeIntegration } from './JourneeIntegration';
import { ETAPES_JOURNEE } from './journee-etapes';
import { setupTestStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';

/**
 * La « Journée d'intégration » **jouée** (30/10/2026) — le rendu, pas la source.
 *
 * Ce que `journee-etapes.test.ts` ne peut pas prouver : que les étapes **s'enchaînent**
 * dans le panneau, que la dernière referme la Journée en menant à son écran, et que le
 * saut mène au même état que la fin. Les trois se voient ici, dans un panneau réel.
 */
function monter() {
  // Les deux gestes de la Journée sont faits : ce fichier éprouve l'enchaînement, et le
  // test dédié ci-dessous éprouve la garde du geste.
  setupTestStore({
    tutorielVu: false,
    pasAPasCombatVu: true,
    packsOpened: 1,
    deck: ['atelier-joueur-de-flute']
  });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <JourneeIntegration />
      <Routes>
        <Route path="*" element={<p>l’écran ouvert</p>} />
      </Routes>
    </MemoryRouter>
  );
}

/** Le bouton qui mène au geste de l'étape courante. */
function action(nom: RegExp) {
  return screen.getByRole('button', { name: nom });
}

describe('la Journée d’intégration se joue (D-160)', () => {
  it('« Suivant » attend les gestes : un Arrivage ouvert, un Deck chargé', async () => {
    setupTestStore({ tutorielVu: false, pasAPasCombatVu: true, packsOpened: 0, deck: [] });
    render(
      <MemoryRouter initialEntries={['/']}>
        <JourneeIntegration />
      </MemoryRouter>
    );
    const suivant = () => screen.getByRole('button', { name: /^Suivant$/i });

    // **Le contrôle mord** : sans le geste, on ne traverse pas la Journée en lecture.
    expect(suivant()).toBeDisabled();
    act(() => {
      useStore.getState().openPack();
    });
    await waitFor(() => expect(suivant()).toBeEnabled());

    await userEvent.click(suivant());
    expect(screen.getByRole('heading', { name: 'La Collection et le Deck' })).toBeInTheDocument();
    expect(suivant()).toBeDisabled();
    act(() => {
      useStore.getState().setDeck(['atelier-joueur-de-flute']);
    });
    await waitFor(() => expect(suivant()).toBeEnabled());
  });

  it('annonce cinq étapes, et les fait défiler jusqu’au comité', async () => {
    monter();
    expect(screen.getByText('Journée d’intégration — étape 1 sur 5')).toBeInTheDocument();

    for (let index = 1; index < ETAPES_JOURNEE.length; index += 1) {
      await userEvent.click(action(/^Suivant$/i));
    }
    expect(screen.getByRole('heading', { name: 'Le comité' })).toBeInTheDocument();
    expect(screen.getByText('Journée d’intégration — étape 5 sur 5')).toBeInTheDocument();
  });

  it('le dernier geste ouvre son écran et referme la Journée', async () => {
    monter();
    for (let index = 1; index < ETAPES_JOURNEE.length; index += 1) {
      await userEvent.click(action(/^Suivant$/i));
    }

    await userEvent.click(action(/Voir le comité/i));
    // **Le contrôle mord** : sans écriture du drapeau, la Journée se remonterait sur le
    // comité — c'est l'exclusion `surLeMur` qui le ferait, et le test tomberait ici.
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('l’écran ouvert')).toBeInTheDocument();
  });

  it('le saut dit ce qu’il coûte, et mène au même état que la fin', async () => {
    const saut = monter();
    const bouton = screen.getByRole('button', { name: /passer : tu ne verras pas le combat/i });
    await userEvent.click(bouton);
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    saut.unmount();

    // La fin, par le même panneau : même drapeau, même état de store.
    monter();
    for (let index = 1; index < ETAPES_JOURNEE.length; index += 1) {
      await userEvent.click(action(/^Suivant$/i));
    }
    await userEvent.click(action(/Voir le comité/i));
    expect(useStore.getState().tutorielVu).toBe(true);
  });

  it('l’appel à participer n’apparaît qu’à la fin, et son lien comité referme la Journée (#271)', async () => {
    monter();
    const appel = /Envie d’aider/;
    // **Le contrôle mord** : une ligne posée à une étape intermédiaire se verrait ici.
    for (let index = 0; index < ETAPES_JOURNEE.length - 1; index += 1) {
      expect(screen.queryByText(appel), `étape ${index + 1}`).toBeNull();
      await userEvent.click(action(/^Suivant$/i));
    }
    expect(screen.getByText(appel)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'le comité' }));
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
