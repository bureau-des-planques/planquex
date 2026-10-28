import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS } from '@/data';
import { SceneOuverture } from './SceneOuverture';
import { SUSPENSE } from './revelation';
import { useStore } from '@/store/useStore';

/**
 * **Le composant de l'ouverture** (#283). Les règles sont testées à part, en TypeScript pur
 * (`etats.test.ts`, `revelation.test.ts`) ; ici on garde ce que seul le composant peut casser :
 *
 *  - **les cartes et le badge existent dès le premier rendu** — « aucune information ne vit dans
 *    l'animation » (D-098) : un testeur qui n'attend pas, ou qui lit avec un lecteur d'écran, doit
 *    avoir le tirage ;
 *  - **le parcours entier** : déchirure, envol, révélation carte par carte, récapitulatif — au doigt,
 *    au bouton et au clavier ;
 *  - **un geste annulé se traite comme un relâchement** (spec Pointer Events §3.3) ;
 *  - **« Mouvement réduit » arrive directement au récapitulatif** (D-098).
 *
 * jsdom ne calcule aucune mise en page : la scène retombe sur sa géométrie par défaut (un sachet de
 * 300 × 500, la ligne à 44 px), et c'est ce que les gestes visent.
 */
const CARTES = ALL_CARDS.slice(0, 5);
/** La plus longue attente avant un retournement : de quoi retourner n'importe quelle carte. */
const ATTENTE_MAX = Math.max(...Object.values(SUSPENSE));

beforeEach(() => {
  // `setPointerCapture` n'existe pas dans jsdom : un double suffit, la capture n'est pas le sujet.
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date']
  });
});

afterEach(() => {
  vi.useRealTimers();
  useStore.setState({ reducedMotion: false });
});

function monter(onRanger = () => undefined) {
  render(<SceneOuverture cartes={CARTES} neuves={new Set([0, 1])} onRanger={onRanger} />);
  return screen.getByTestId('ouverture');
}

function attendre(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Le geste complet : appui sur les pointillés, glissement jusqu'au bout, relâchement. */
function dechirer(scene: HTMLElement): void {
  const zone = scene.querySelector('[data-zone]') as HTMLElement;
  fireEvent.pointerDown(zone, { clientX: 10, clientY: 44, pointerId: 1 });
  fireEvent.pointerMove(zone, { clientX: 130, clientY: 46, pointerId: 1 });
  fireEvent.pointerMove(zone, { clientX: 260, clientY: 44, pointerId: 1 });
  fireEvent.pointerUp(zone, { clientX: 260, clientY: 44, pointerId: 1 });
}

/** Fait passer toutes les cartes de la pile, d'un toucher chacune, une fois retournées. */
function toutPasser(scene: HTMLElement): void {
  for (let i = 0; i < CARTES.length; i += 1) {
    attendre(ATTENTE_MAX + 20);
    const carte = scene.querySelectorAll('.ouverture__carte')[i] as HTMLElement;
    expect(carte.dataset.face, `la carte ${i + 1} doit être retournée avant de passer`).toBe('recto');
    fireEvent.pointerDown(carte, { clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(carte, { clientX: 100, clientY: 100, pointerId: 2 });
  }
  attendre(600);
}

describe('l’ouverture d’un Arrivage — le composant (#283)', () => {
  it('les cinq cartes et le badge « Nouvelle » sont là dès le premier rendu', () => {
    const scene = monter();
    expect(scene.querySelectorAll('.ouverture__carte')).toHaveLength(5);
    expect(within(scene).getAllByText('Nouvelle')).toHaveLength(2);
    // Le contrôle mord : si les cartes n'étaient rendues qu'à l'ouverture, ce test tomberait.
    expect(scene.dataset.etape).toBe('ferme');
  });

  it('le titre compte les cartes neuves, il n’annonce pas « cinq nouvelles cartes »', () => {
    const scene = monter();
    const titre = scene.querySelector('.ouverture__titre') as HTMLElement;
    expect(titre.textContent).toContain('5 cartes');
    expect(titre.textContent).toContain('2 nouvelles');
    expect(titre.textContent).not.toMatch(/cinq nouvelles/i);
  });

  it('un appui hors des pointillés ne déchire rien : il presse le sachet', () => {
    const scene = monter();
    const zone = scene.querySelector('[data-zone]') as HTMLElement;
    fireEvent.pointerDown(zone, { clientX: 150, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(zone, { clientX: 290, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(zone, { clientX: 290, clientY: 300, pointerId: 1 });
    expect(scene.dataset.etape).toBe('ferme');
    expect(scene.dataset.dechirure).toBe('0.00');
  });

  it('un geste annulé referme le sachet, il ne le laisse pas entrouvert', () => {
    const scene = monter();
    const zone = scene.querySelector('[data-zone]') as HTMLElement;
    fireEvent.pointerDown(zone, { clientX: 10, clientY: 44, pointerId: 1 });
    fireEvent.pointerMove(zone, { clientX: 150, clientY: 44, pointerId: 1 });
    // Le contrôle mord : la déchirure a bien commencé avant l'annulation.
    expect(scene.dataset.etape).toBe('dechirure');
    expect(Number(scene.dataset.dechirure)).toBeGreaterThan(0.5);
    fireEvent.pointerCancel(zone, { pointerId: 1 });
    expect(scene.dataset.etape).toBe('ferme');
    expect(scene.dataset.dechirure).toBe('0.00');
  });

  it('le parcours au doigt : déchirure, envol, révélation carte par carte, récapitulatif', () => {
    const onRanger = vi.fn();
    const scene = monter(onRanger);
    dechirer(scene);
    expect(scene.dataset.etape).toBe('ouverture');
    attendre(1300);
    expect(scene.dataset.etape).toBe('revelation');
    // La carte du dessus est encore de dos : on ne la voit qu'après l'attente.
    const premiere = scene.querySelectorAll('.ouverture__carte')[0] as HTMLElement;
    expect(premiere.dataset.face).toBe('verso');
    toutPasser(scene);
    expect(scene.dataset.etape).toBe('ouvert');
    fireEvent.click(within(scene).getByRole('button', { name: /Ranger dans la Collection/ }));
    expect(onRanger).toHaveBeenCalledOnce();
  });

  it('« Ouvrir » joue la déchirure sans glissement (accès au pointeur)', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
    attendre(800);
    expect(scene.dataset.etape).toBe('ouverture');
    attendre(1300);
    expect(scene.dataset.etape).toBe('revelation');
  });

  it('le clavier fait passer les cartes', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
    attendre(2200);
    const zone = scene.querySelector('.ouverture__scene') as HTMLElement;
    for (let i = 0; i < CARTES.length; i += 1) {
      attendre(ATTENTE_MAX + 20);
      fireEvent.keyDown(zone, { key: 'Enter' });
    }
    attendre(600);
    expect(scene.dataset.etape).toBe('ouvert');
  });

  it('pendant la révélation, toucher à côté de la carte la fait passer aussi', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
    attendre(2200);
    attendre(ATTENTE_MAX + 20);
    const premiere = scene.querySelectorAll('.ouverture__carte')[0] as HTMLElement;
    expect(premiere.dataset.face).toBe('recto');
    fireEvent.click(scene.querySelector('.ouverture__scene') as HTMLElement);
    // Le contrôle mord : la deuxième carte est maintenant celle du dessus, la première est partie.
    const deuxieme = scene.querySelectorAll('.ouverture__carte')[1] as HTMLElement;
    expect(deuxieme.dataset.courante).toBe('oui');
    expect(premiere.dataset.courante).toBeUndefined();
  });

  it('« Tout afficher » mène au récapitulatif, de n’importe quelle étape', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));
    expect(scene.dataset.etape).toBe('ouvert');
    const faces = [...scene.querySelectorAll<HTMLElement>('.ouverture__carte')].map((c) => c.dataset.face);
    expect(faces).toEqual(['recto', 'recto', 'recto', 'recto', 'recto']);
  });

  it('rouvrir un Arrivage repart d’un sachet fermé', () => {
    const premier = monter();
    fireEvent.click(within(premier).getByRole('button', { name: /Tout afficher/ }));
    expect(premier.dataset.etape).toBe('ouvert');
    cleanup();
    const second = monter();
    expect(second.dataset.etape).toBe('ferme');
    expect(second.dataset.dechirure).toBe('0.00');
  });

  it('dans le récapitulatif, une carte touchée se montre en grand, puis se repose', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));
    const carte = scene.querySelectorAll('.ouverture__carte')[2] as HTMLElement;
    fireEvent.pointerUp(carte, { pointerId: 3 });
    expect(carte.dataset.zoom).toBe('oui');
    fireEvent.pointerUp(carte, { pointerId: 3 });
    expect(carte.dataset.zoom).toBeUndefined();
  });

  it('sous « Mouvement réduit », on arrive au récapitulatif sans sachet ni geste', () => {
    useStore.setState({ reducedMotion: true });
    const scene = monter();
    expect(scene.dataset.etape).toBe('ouvert');
    expect(scene.querySelector('[data-zone]')).toBeNull();
    // Les cartes restent lisibles : c'est l'information, pas l'effet.
    expect(scene.querySelectorAll('.ouverture__carte[data-face="recto"]')).toHaveLength(5);
  });
});
