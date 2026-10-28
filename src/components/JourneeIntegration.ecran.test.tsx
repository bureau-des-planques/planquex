// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JourneeIntegration } from './JourneeIntegration';
import { ETAPES_JOURNEE } from './journee-etapes';
import { setupTestStore } from '@/test/test-utils';
import { useStore } from '@/store/useStore';

/**
 * La « Journée d'intégration » **jouée** (#334, D-136) — le rendu, pas la source.
 *
 * Ce que `journee-etapes.test.ts` ne peut pas prouver : qu'une étape **consomme son geste**
 * avant de laisser passer, que le **saut** mène au même état que la fin, et que le libellé
 * du saut nomme ce qu'on perd. Les trois se voient ici, dans un dialogue réel.
 */
function monter() {
  setupTestStore({ tutorielVu: false, pasAPasCombatVu: true });
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

describe('la Journée d’intégration se joue (#334, D-136)', () => {
  it('annonce cinq étapes, et les fait défiler jusqu’au tour de jeu', async () => {
    monter();
    expect(screen.getByText('Journée d’intégration — étape 1 sur 5')).toBeInTheDocument();

    for (let index = 1; index < ETAPES_JOURNEE.length; index += 1) {
      await userEvent.click(action(/^Suivant$/i));
    }
    expect(screen.getByRole('heading', { name: 'Le tour de jeu' })).toBeInTheDocument();
    expect(screen.getByText('Journée d’intégration — étape 5 sur 5')).toBeInTheDocument();
  });

  it('le tour de jeu consomme ses deux gestes : café, puis Pression, et le Stress se lit', async () => {
    monter();
    for (let index = 1; index < ETAPES_JOURNEE.length; index += 1) {
      await userEvent.click(action(/^Suivant$/i));
    }

    const aller = action(/Jouer mon premier tour/i);
    // **Le contrôle mord** : sans le geste, on ne passe pas. Un bouton actif ici ferait
    // de l'étape une étape lue, exactement ce que D-136 refuse.
    expect(aller).toBeDisabled();

    await userEvent.click(action(/Attacher un café/i));
    expect(aller).toBeDisabled();

    await userEvent.click(action(/Lancer une Pression/i));
    expect(aller).toBeEnabled();
    // « lire le Stress » : il est à l'écran, et il monte.
    expect(screen.getByRole('status')).toHaveTextContent(/Stress 20 sur un Seuil de 60/);
  });

  it('le saut dit ce qu’il coûte, et mène au même état que la fin', async () => {
    const saut = monter();
    const bouton = screen.getByRole('button', { name: /passer : tu ne verras pas le tour de jeu/i });
    await userEvent.click(bouton);
    expect(useStore.getState().tutorielVu).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    saut.unmount();

    // La fin, par le même dialogue : mêmes drapeaux, même état de store.
    monter();
    for (let index = 1; index < ETAPES_JOURNEE.length; index += 1) {
      await userEvent.click(action(/^Suivant$/i));
    }
    await userEvent.click(action(/Attacher un café/i));
    await userEvent.click(action(/Lancer une Pression/i));
    await userEvent.click(action(/Jouer mon premier tour/i));

    expect(useStore.getState().tutorielVu).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Le geste de l'étape mène au combat : c'est lui qui referme la Journée.
    expect(screen.getByText('l’écran ouvert')).toBeInTheDocument();
  });
});
