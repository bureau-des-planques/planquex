import { Profiler, act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { SceneOuverture } from './SceneOuverture';
import { SUSPENSE } from './revelation';
import { useStore } from '@/store/useStore';

/**
 * **Ce que le retournement re-rend — et ce qu'il ne re-rend plus** (#605).
 *
 * Le défaut mesuré n'était pas un état écrit à chaque image (le retournement est une transition
 * CSS) : c'était la scène entière qui se re-rendait à chaque retournement, à chaque envol d'éclat
 * et à l'ouverture de la fiche, et **les cinq `CardView` avec elle**. Sur un téléphone, la fiche
 * s'ouvre 560 ms après le retournement, pendant que la carte tourne encore : 56 ms de script sur
 * un CPU bridé ×6, et une image perdue au milieu du geste.
 *
 * Le contrôle mord : sans le `memo` de `VueCarte`, retourner une carte re-rend les cinq
 * `CardView` (5 entrées) — et l'ouverture automatique de la fiche les re-rend une seconde fois.
 */
const { rendus } = vi.hoisted(() => ({ rendus: [] as string[] }));

vi.mock('@/components/CardView', () => ({
  CardView: ({ card }: { card: Card }) => {
    rendus.push(card.id);
    return <div className="card-mock" />;
  }
}));

function une(rarete: Rarity): Card {
  const carte = ALL_CARDS.find((c) => c.rarity === rarete);
  if (!carte) throw new Error(`aucune carte ${rarete}`);
  return carte;
}

const CARTES: Card[] = [une('1D'), une('1D'), une('2D'), une('3D'), une('1S')];

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  rendus.length = 0;
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date']
  });
});

afterEach(() => {
  vi.useRealTimers();
  useStore.setState({ reducedMotion: false });
  cleanup();
});

function attendre(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function monter() {
  render(<SceneOuverture cartes={CARTES} neuves={new Set()} onRanger={() => undefined} />);
  return screen.getByTestId('ouverture');
}

function jusquALaRevelation(scene: HTMLElement): void {
  fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
  attendre(800);
  expect(scene.dataset.etape).toBe('ouverture');
  attendre(3200);
  expect(scene.dataset.etape).toBe('revelation');
}

function carte(scene: HTMLElement, i: number): HTMLElement {
  return scene.querySelectorAll<HTMLElement>('.ouverture__carte')[i] as HTMLElement;
}

describe('le retournement d’une carte ne re-rend pas les autres (#605)', () => {
  it('le montage rend bien les cinq cartes — le contrôle peut donc mordre', () => {
    monter();
    expect(rendus).toHaveLength(5);
  });

  it('retourner une carte simple ne re-rend aucun CardView, même quand sa fiche s’ouvre', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    rendus.length = 0;

    fireEvent.click(carte(scene, 0));
    // Le retournement est acquis, la fiche s'est ouverte (écran étroit) : deux rendus de la scène.
    attendre(1000);
    expect(carte(scene, 0).dataset.face).toBe('recto');
    expect(carte(scene, 0).dataset.fiche).toBe('oui');

    // Le contrôle mord : sans `memo`, ce sont les cinq cartes à chaque rendu de la scène (10 ici).
    expect(rendus).toHaveLength(0);
  });

  it('retourner une carte rare ne re-rend pas les cartes pendant son attente ni sa fête', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    rendus.length = 0;

    fireEvent.click(carte(scene, 4));
    attendre(SUSPENSE.secrete + 400);
    expect(carte(scene, 4).dataset.fetee).toBe('oui');
    expect(rendus).toHaveLength(0);
  });

  it('la fiche attend la fin du retournement, elle ne coupe pas la rotation (#605)', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    fireEvent.click(carte(scene, 0));
    // Le retournement dure jusqu'à 950 ms (le dos part en 430 ms, la face arrive à 950 ms).
    attendre(900);
    // Le contrôle mord : à 560 ms, la fiche s'insérait en pleine rotation, et sa mise en page
    // tombait dans la même image que la fin du geste.
    expect(carte(scene, 0).dataset.fiche).toBeUndefined();
    attendre(150);
    expect(carte(scene, 0).dataset.fiche).toBe('oui');
  });

  it('le retournement n’écrit pas d’état React à chaque image', () => {
    let commits = 0;
    render(
      <Profiler id="ouverture" onRender={() => (commits += 1)}>
        <SceneOuverture cartes={CARTES} neuves={new Set()} onRanger={() => undefined} />
      </Profiler>
    );
    const scene = screen.getByTestId('ouverture');
    jusquALaRevelation(scene);
    commits = 0;

    fireEvent.click(carte(scene, 1));
    const apresLeClic = commits;
    // 30 images d'affichage : si le retournement écrivait l'état à chaque image, le compteur
    // monterait avec elles. Il ne bouge pas (la fiche s'ouvre à 560 ms, après cette fenêtre).
    for (let i = 0; i < 30; i += 1) attendre(16);
    expect(commits).toBe(apresLeClic);
    // Le contrôle mord : le clic, lui, a bien commité une fois (le retournement est acquis).
    expect(apresLeClic).toBeGreaterThan(0);
  });
});
