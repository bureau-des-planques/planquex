import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/test-utils';
import { Home } from '@/pages/Home';
import { useStore } from '@/store/useStore';

/**
 * **Aucun son au montage** (#378, D-137). Le ticket l'exige noir sur blanc : « le jeu ne joue rien
 * au chargement ». Un écran qui créerait un contexte audio en se montant serait le début d'une
 * bande-son subie — et sur iOS, un contexte créé sans geste reste suspendu pour de bon.
 *
 * Ce test regarde la seule chose qui puisse le prouver sans oreille : **aucun contexte audio n'est
 * construit** quand l'écran s'affiche.
 */
class EspionContexte {
  static instances: EspionContexte[] = [];
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  constructor() {
    EspionContexte.instances.push(this);
  }
  resume = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer);
  createBufferSource = vi.fn();
}

beforeEach(() => {
  EspionContexte.instances = [];
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = EspionContexte;
});

afterEach(() => {
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
  vi.restoreAllMocks();
});

describe('aucun son ne part au chargement d’un écran (#378)', () => {
  it('afficher l’accueil ne crée aucun contexte audio', () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });
    expect(screen.getByRole('button', { name: /Ouvrir un Arrivage/i })).toBeInTheDocument();
    // Le contrôle mord : si un effet montait l'audio au rendu, cette liste ne serait pas vide.
    expect(EspionContexte.instances).toHaveLength(0);
  });

  it('le réglage coupé ne fait pas jouer l’Arrivage, même au clic', () => {
    renderWithStore(<Home />, { tutorielVu: true, pasAPasCombatVu: true });
    useStore.setState({ sons: false });
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir un Arrivage/i }));
    // Le clic ouvre bien l'Arrivage (le comportement du jeu ne dépend pas du son)…
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // …mais aucune source n'est créée : sans contexte, il n'y a rien à jouer.
    for (const ctx of EspionContexte.instances) {
      expect(ctx.createBufferSource).not.toHaveBeenCalled();
    }
    useStore.setState({ sons: true });
  });
});
