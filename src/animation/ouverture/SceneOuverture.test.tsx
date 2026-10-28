import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS } from '@/data';
import { SceneOuverture } from './SceneOuverture';
import { useStore } from '@/store/useStore';

/**
 * **Le composant de l'ouverture** (#283). La machine est testée à part, en TypeScript pur
 * (`etats.test.ts`) ; ici on garde ce que seul le composant peut casser :
 *
 *  - **les cartes et le badge existent dès le premier rendu** — « aucune information ne vit dans
 *    l'animation » (D-098) : un testeur qui n'attend pas, ou qui lit avec un lecteur d'écran, doit
 *    avoir le tirage ;
 *  - **un geste annulé se traite comme un relâchement** (spec Pointer Events §3.3) : `pointercancel`
 *    ne doit pas laisser le sachet à moitié déchiré ;
 *  - **« Mouvement réduit » arrive directement à l'état final** (D-098).
 *
 * jsdom n'a ni `setPointerCapture`, ni `Element.animate`, ni WebGL : le creux ne se monte pas, et
 * c'est précisément ce que le composant doit supporter (repli).
 */
const CARTES = ALL_CARDS.slice(0, 5);

// `setPointerCapture` n'existe pas dans jsdom : un double suffit, la capture n'est pas le sujet.
beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  useStore.setState({ reducedMotion: false });
});

function monter() {
  render(<SceneOuverture cartes={CARTES} neuves={new Set([0, 1])} onRanger={() => undefined} />);
  return screen.getByTestId('ouverture');
}

describe('l’ouverture d’un Arrivage — le composant (#283)', () => {
  it('les cinq cartes et le badge « Nouvelle » sont là dès le premier rendu', () => {
    const scene = monter();
    const cartes = scene.querySelectorAll('.ouverture__carte');
    expect(cartes).toHaveLength(5);
    expect(within(scene as HTMLElement).getAllByText('Nouvelle')).toHaveLength(2);
    // Le contrôle mord : si les cartes n'étaient rendues qu'à l'ouverture, ce test tomberait.
    expect(scene.dataset.etape).toBe('ferme');
  });

  it('le bouton « Tout afficher » mène à l’état final — c’est le chemin sans glissement', () => {
    const scene = monter();
    fireEvent.click(within(scene as HTMLElement).getByRole('button', { name: /Tout afficher/i }));
    expect(scene.dataset.etape).toBe('ouvert');
  });

  it('un geste annulé revient à « ferme », il ne laisse pas le sachet entrouvert', () => {
    const scene = monter();
    const zone = scene.querySelector('[data-zone]') as HTMLElement;
    // On attrape l'étiquette, on tire un peu, puis le navigateur annule le geste.
    fireEvent.pointerDown(zone, { clientX: 120, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(zone, { clientX: 120, clientY: 30, pointerId: 1 });
    fireEvent.pointerCancel(zone, { pointerId: 1 });
    expect(scene.dataset.etape).toBe('ferme');
    expect(scene.dataset.etiquette).toBe('0.00');
  });

  it('sous « Mouvement réduit », on arrive à l’état final sans geste', () => {
    useStore.setState({ reducedMotion: true });
    const scene = monter();
    expect(scene.dataset.etape).toBe('ouvert');
    // Les cartes restent lisibles : c'est l'information, pas l'effet.
    expect(scene.querySelectorAll('.ouverture__carte')).toHaveLength(5);
  });
});
