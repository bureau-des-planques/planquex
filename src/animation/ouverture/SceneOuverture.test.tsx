import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { SceneOuverture } from './SceneOuverture';
import { ANNONCES, SUSPENSE, TENUE } from './revelation';
import { useStore } from '@/store/useStore';

/**
 * **Le composant de l'ouverture** (#283). Les règles sont testées à part, en TypeScript pur
 * (`etats.test.ts`, `revelation.test.ts`) ; ici on garde ce que seul le composant peut casser :
 *
 *  - **les cartes et le badge existent dès le premier rendu** — « aucune information ne vit dans
 *    l'animation » (D-098) : un testeur qui n'attend pas, ou qui lit avec un lecteur d'écran, doit
 *    avoir le tirage ;
 *  - **le parcours entier** : déchirure, envol, cartes étalées face cachée, retournées une à une
 *    dans l'ordre choisi, annonce des rares, fiche d'une carte — au doigt, au bouton et au clavier ;
 *  - **un geste annulé se traite comme un relâchement** (spec Pointer Events §3.3) ;
 *  - **« Mouvement réduit » arrive directement aux cartes retournées** (D-098).
 *
 * jsdom ne calcule aucune mise en page : la scène retombe sur sa géométrie par défaut (un sachet de
 * 300 × 500, la ligne à 44 px), et c'est ce que les gestes visent.
 */
function une(rarete: Rarity): Card {
  const carte = ALL_CARDS.find((c) => c.rarity === rarete);
  if (!carte) throw new Error(`aucune carte ${rarete}`);
  return carte;
}

/** Un tirage comme `openPackCards` en donne : trois simples, une ◆◆◆, une étoile. */
const CARTES: Card[] = [une('1D'), une('1D'), une('2D'), une('3D'), une('1S')];
/** De quoi aller au bout de n'importe quelle révélation. */
const LONGTEMPS = Math.max(...Object.values(SUSPENSE)) + Math.max(...Object.values(TENUE)) + 1000;

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
  render(<SceneOuverture cartes={CARTES} neuves={new Set([0, 3])} onRanger={onRanger} />);
  return screen.getByTestId('ouverture');
}

function attendre(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function carte(scene: HTMLElement, i: number): HTMLElement {
  return scene.querySelectorAll<HTMLElement>('.ouverture__carte')[i] as HTMLElement;
}

/** Le geste complet : appui sur les pointillés, glissement jusqu'au bout, relâchement. */
function dechirer(scene: HTMLElement): void {
  const zone = scene.querySelector('[data-zone]') as HTMLElement;
  fireEvent.pointerDown(zone, { clientX: 10, clientY: 44, pointerId: 1 });
  fireEvent.pointerMove(zone, { clientX: 130, clientY: 46, pointerId: 1 });
  fireEvent.pointerMove(zone, { clientX: 260, clientY: 44, pointerId: 1 });
  fireEvent.pointerUp(zone, { clientX: 260, clientY: 44, pointerId: 1 });
}

/** Jusqu'aux cartes étalées face cachée, par le bouton « Ouvrir » — le chemin sans glissement. */
function jusquALaRevelation(scene: HTMLElement): void {
  fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
  attendre(800);
  expect(scene.dataset.etape).toBe('ouverture');
  attendre(3200);
  expect(scene.dataset.etape).toBe('revelation');
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

  it('au doigt : la déchirure ouvre, et les cartes sortent lentement avant de s’étaler face cachée', () => {
    const scene = monter();
    dechirer(scene);
    expect(scene.dataset.etape).toBe('ouverture');
    // Le contrôle mord : à 1,5 s, les cartes sortent encore — la révélation n'a pas commencé.
    attendre(1500);
    expect(scene.dataset.etape).toBe('ouverture');
    attendre(1600);
    expect(scene.dataset.etape).toBe('revelation');
    const faces = [...scene.querySelectorAll<HTMLElement>('.ouverture__carte')].map((c) => c.dataset.face);
    expect(faces).toEqual(['verso', 'verso', 'verso', 'verso', 'verso']);
  });

  it('une carte simple se retourne sur place, au toucher, sans annonce', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    fireEvent.click(carte(scene, 1));
    expect(carte(scene, 1).dataset.face).toBe('recto');
    // Les autres restent cachées : c'est le testeur qui choisit l'ordre.
    expect(carte(scene, 0).dataset.face).toBe('verso');
    expect(within(scene).queryByRole('status')).toBeNull();
  });

  it('une carte rare monte au centre, se fait attendre, puis se retourne avec son annonce', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    const etoile = carte(scene, 4);
    fireEvent.click(etoile);
    expect(etoile.dataset.tension).toBe('oui');
    // Le contrôle mord : elle n'est pas retournée avant la fin de son attente.
    attendre(SUSPENSE.secrete - 50);
    expect(etoile.dataset.face).toBe('verso');
    attendre(100);
    expect(etoile.dataset.face).toBe('recto');
    expect(etoile.dataset.fetee).toBe('oui');
    const statut = within(scene).getByRole('status');
    expect(ANNONCES.secrete.some((phrase) => statut.textContent?.includes(phrase))).toBe(true);
    // Un toucher la repose avant la fin de sa tenue.
    fireEvent.click(etoile);
    expect(etoile.dataset.fetee).toBeUndefined();
    expect(within(scene).queryByRole('status')).toBeNull();
  });

  it('toutes retournées, la révélation se termine et « Ranger » ferme', () => {
    const onRanger = vi.fn();
    const scene = monter(onRanger);
    jusquALaRevelation(scene);
    for (let i = 0; i < CARTES.length; i += 1) {
      fireEvent.click(carte(scene, i));
      attendre(LONGTEMPS);
    }
    // La dernière reposée, la scène laisse une demi-seconde avant de se dire finie.
    attendre(600);
    expect(scene.dataset.etape).toBe('ouvert');
    fireEvent.click(within(scene).getByRole('button', { name: /Ranger dans la Collection/ }));
    expect(onRanger).toHaveBeenCalledOnce();
  });

  it('le clavier retourne les cartes : la première a le focus, Entrée la retourne', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    expect(document.activeElement).toBe(carte(scene, 0));
    fireEvent.keyDown(carte(scene, 0), { key: 'Enter' });
    expect(carte(scene, 0).dataset.face).toBe('recto');
  });

  it('une carte retournée se touche pour voir sa fiche, avec tous ses textes', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));
    const etoile = CARTES[4] as Card;
    fireEvent.click(carte(scene, 4));
    expect(carte(scene, 4).dataset.fiche).toBe('oui');
    const fiche = within(scene).getByRole('region', { name: `Fiche : ${etoile.name}` });
    expect(within(fiche).getByText(`« ${etoile.flavor} »`)).toBeTruthy();
    // « Reposer » referme la fiche.
    fireEvent.click(within(fiche).getByRole('button', { name: 'Reposer' }));
    expect(carte(scene, 4).dataset.fiche).toBeUndefined();
    expect(within(scene).queryByRole('region')).toBeNull();
  });

  it('« Tout afficher » retourne tout, de n’importe quelle étape', () => {
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

  it('sous « Mouvement réduit », on arrive aux cartes retournées sans sachet ni geste', () => {
    useStore.setState({ reducedMotion: true });
    const scene = monter();
    expect(scene.dataset.etape).toBe('ouvert');
    expect(scene.querySelector('[data-zone]')).toBeNull();
    // Les cartes restent lisibles : c'est l'information, pas l'effet.
    expect(scene.querySelectorAll('.ouverture__carte[data-face="recto"]')).toHaveLength(5);
  });
});
