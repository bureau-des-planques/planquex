import { act, Profiler } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ALL_CARDS, RARITY_META } from '@/data';
import type { Card, Rarity } from '@/data/types';
import { SceneOuverture } from './SceneOuverture';
import { ANNONCES, palier, SUSPENSE, TENUE } from './revelation';
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

/**
 * **Un écran d'une taille donnée** (D-170) : jsdom n'a pas de mise en page (`clientWidth` vaut 0),
 * donc la scène garde sa taille par défaut. On ment sur la mesure, ce qui est exactement ce que
 * la bascule lit : l'échelle des cartes étalées, et donc leur taille rendue.
 */
function ecranTaille(largeur: number, hauteur: number): () => void {
  const l = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => largeur });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => hauteur });
  return () => {
    if (l) Object.defineProperty(HTMLElement.prototype, 'clientWidth', l);
    if (h) Object.defineProperty(HTMLElement.prototype, 'clientHeight', h);
  };
}

/**
 * **Un pointeur donné** (#569) : jsdom n'a pas de périphérique, et son `matchMedia` simulé
 * répond toujours `false`. On dit donc explicitement si l'appareil a un doigt (`coarse`) ou une
 * souris (`fine`) : c'est ce que lit la consigne.
 */
function pointeur(type: 'coarse' | 'fine'): () => void {
  const initial = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('pointer: coarse') ? type === 'coarse' : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = initial;
  };
}

function attendre(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function carte(scene: HTMLElement, i: number): HTMLElement {
  return scene.querySelectorAll<HTMLElement>('.ouverture__carte')[i] as HTMLElement;
}

const TOUTES_LES_RARETES: Rarity[] = ['1D', '2D', '3D', '4D', '1S', '2S', '3S', 'COU'];

/** Même squelette de commandes = même silhouette, même si les coordonnées sont décalées. */
function signatureDuTrace(path: string): string {
  return (path.match(/[a-zA-Z]/g) ?? []).join('');
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

/**
 * **L'empilement de la scène** (#667). jsdom ne calcule ni `z-index` ni cascade : la feuille
 * est lue comme un texte, et le `z-index` d'un élément vient de son **style en ligne** d'abord
 * (`SceneOuverture` écrit `zIndex` sur chaque carte), puis de la **classe** qui l'empile.
 *
 * La feuille **sans ses commentaires** : une valeur d'avant le correctif a le droit d'être
 * nommée dans la prose.
 */
const CSS = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Les blocs `sélecteur { … }` de la feuille, dans l'ordre du fichier. */
function blocs(): Array<{ selecteur: string; corps: string }> {
  return [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selecteur: (m[1] as string).trim(),
    corps: m[2] as string
  }));
}

/**
 * Le `z-index` déclaré pour un élément : le style en ligne, sinon la **dernière** règle de
 * classe de la feuille qui le nomme (deux sélecteurs de classe de même spécificité : l'ordre
 * du fichier tranche, comme la cascade). `0` = `auto`, c'est-à-dire pas de plan propre.
 */
function zIndex(element: HTMLElement): number {
  const enLigne = Number.parseInt(element.style.zIndex, 10);
  if (Number.isFinite(enLigne)) return enLigne;
  let z = 0;
  for (const { selecteur, corps } of blocs()) {
    // Seuls les sélecteurs de classes simples sont lus : la scène n'empile ses cartes que par
    // une classe (`.ouverture__cartes`, `--dedans`, `--scene`, `--fiche`).
    if (!/^(\.[\w-]+)+$/.test(selecteur)) continue;
    const classes = (selecteur.match(/\.[\w-]+/g) ?? []).map((c) => c.slice(1));
    if (!classes.every((c) => element.classList.contains(c))) continue;
    const declaration = corps.match(/(?:^|;)\s*z-index:\s*(-?\d+)/);
    if (declaration) z = Number(declaration[1]);
  }
  return z;
}

/**
 * Le plan d'empilement d'un élément **dans la scène**, du plus lointain au plus proche : dans
 * cette scène, tout élément qui porte un `z-index` est positionné (`absolute`/`relative`), donc
 * crée un contexte, et un enfant **ne peut pas en sortir**, quel que soit son `z-index` en
 * ligne. C'est ce que la garde de #667 doit lire : une assertion limitée au style en ligne des
 * cartes ne voyait pas le plan de leur liste.
 */
function planDe(scene: HTMLElement, element: HTMLElement): number[] {
  const plan: number[] = [];
  for (let el: HTMLElement | null = element; el && el !== scene; el = el.parentElement) {
    const z = zIndex(el);
    if (z !== 0) plan.unshift(z);
  }
  return plan;
}

/** Le plan `a` est-il **devant** le plan `b` ? Contexte par contexte, du plus lointain au plus proche. */
function devant(a: number[], b: number[]): boolean {
  const longueur = Math.max(a.length, b.length);
  for (let i = 0; i < longueur; i += 1) {
    const da = a[i] ?? 0;
    const db = b[i] ?? 0;
    if (da !== db) return da > db;
  }
  return false;
}

describe('l’ouverture d’un Arrivage — le composant (#283)', () => {
  it('les cinq cartes et le badge « Nouvelle » sont là dès le premier rendu', () => {
    const scene = monter();
    expect(scene.querySelectorAll('.ouverture__carte')).toHaveLength(5);
    expect(within(scene).getAllByText('Nouvelle')).toHaveLength(2);
    // Le contrôle mord : si les cartes n'étaient rendues qu'à l'ouverture, ce test tomberait.
    expect(scene.dataset.etape).toBe('ferme');
  });

  it('la pochette est une navette de courrier avec texte SVG lisible, tampon et scellé', () => {
    const scene = monter();
    const pochette = scene.querySelector('.pochette');
    expect(pochette).not.toBeNull();
    expect(pochette?.querySelector('image')).toBeNull();

    const textes = [...(pochette?.querySelectorAll('text[data-pochette-texte]') ?? [])];
    const copie = textes.map((texte) => texte.textContent).join(' ');
    expect(copie).toContain('COURRIER INTERNE');
    expect(copie).toContain('REÇU');
    expect(copie).toContain('DESTINATAIRE');
    expect(copie).not.toMatch(/tasse|café/i);
    expect(pochette?.querySelector('[data-pochette-tampon]')).not.toBeNull();
    expect(pochette?.querySelector('[data-pochette-scellement]')).not.toBeNull();
    expect(pochette?.querySelector('[data-pochette-dos]')).not.toBeNull();
    expect(pochette?.querySelector('[data-pochette-tranche]')).not.toBeNull();
    expect(pochette?.querySelector('[data-pochette-levre]')).not.toBeNull();

    const surfaces = new Set(
      [...(pochette?.querySelectorAll('[data-pochette-surface]') ?? [])].map((surface) =>
        surface.getAttribute('data-pochette-surface')
      )
    );
    expect(textes.length).toBeGreaterThan(0);
    for (const texte of textes) expect(surfaces.has(texte.getAttribute('data-fond'))).toBe(true);
  });

  it('l’inclinaison ne s’hérite pas : le reflet porte --mx/--my, le sachet seulement --rx/--ry', () => {
    const scene = monter();
    const zone = scene.querySelector('[data-zone]') as HTMLElement;
    const sachet = scene.querySelector('.ouverture__sachet') as HTMLElement;
    const reflet = scene.querySelector('.ouverture__reflet-sachet') as HTMLElement;

    // Le doigt relance l'inclinaison : le ressort tourne dans la boucle d'affichage.
    fireEvent.pointerMove(zone, { clientX: 150, clientY: 300, pointerId: 1 });
    attendre(120);

    // `--rx`/`--ry` ne servent qu'à la transformation du sachet : elles restent sur lui.
    expect(sachet.style.getPropertyValue('--rx')).toMatch(/deg$/);
    expect(sachet.style.getPropertyValue('--ry')).toMatch(/deg$/);
    // `--mx`/`--my` n'ont qu'un consommateur, le reflet. Posées sur le sachet, elles s'héritaient
    // dans tout son sous-arbre à chaque image (0,79 s de recalcul de style sur 2,5 s, mesuré).
    // Le contrôle mord : remettre les deux `setProperty` sur `el` fait tomber ces deux assertions.
    expect(sachet.style.getPropertyValue('--mx')).toBe('');
    expect(reflet.style.getPropertyValue('--mx')).toMatch(/%$/);
    expect(reflet.style.getPropertyValue('--my')).toMatch(/%$/);
  });

  it('le glissement du doigt ne re-rend pas la scène : la déchirure avance par le style', () => {
    let rendus = 0;
    render(
      <Profiler id="ouverture" onRender={() => (rendus += 1)}>
        <SceneOuverture cartes={CARTES} neuves={new Set([0, 3])} onRanger={() => undefined} />
      </Profiler>
    );
    const scene = screen.getByTestId('ouverture');
    const zone = scene.querySelector('[data-zone]') as HTMLElement;
    const sachet = scene.querySelector('.ouverture__sachet') as HTMLElement;

    fireEvent.pointerDown(zone, { clientX: 10, clientY: 44, pointerId: 1 });
    attendre(50);
    const avant = rendus;
    for (let i = 1; i <= 40; i += 1) {
      fireEvent.pointerMove(zone, { clientX: 10 + i * 6, clientY: 44, pointerId: 1 });
    }

    // Le contrôle mord : sous l'état réactif d'avant, chaque `pointermove` écrivait `setEtat` et
    // commitait — ces deux assertions tombaient (plusieurs dizaines de rendus pour 40 mouvements).
    expect(rendus).toBe(avant);
    // La déchirure avance quand même : écrite sur ses trois consommateurs, en style en ligne.
    const bande = scene.querySelector('.ouverture__bande') as HTMLElement;
    const interieur = scene.querySelector('.ouverture__interieur') as HTMLElement;
    const fente = scene.querySelector('.ouverture__fente') as HTMLElement;
    expect(Number(bande.style.getPropertyValue('--p'))).toBeGreaterThan(0.4);
    expect(bande.style.getPropertyValue('--sens')).toBe('1');
    expect(interieur.style.getPropertyValue('--p')).toBe(bande.style.getPropertyValue('--p'));
    expect(fente.style.getPropertyValue('--p')).toBe(bande.style.getPropertyValue('--p'));
    // `--p`/`--sens` ne sont plus posées sur le sachet : elles s'y héritaient dans tout son
    // sous-arbre (les deux SVG de la Pochette) à chaque mouvement.
    expect(sachet.style.getPropertyValue('--p')).toBe('');
    expect(sachet.style.getPropertyValue('--sens')).toBe('');
    // Le relâchement, lui, change de phase : un rendu unique, et le sachet s'ouvre.
    fireEvent.pointerUp(zone, { clientX: 200, clientY: 44, pointerId: 1 });
    expect(rendus).toBeGreaterThan(avant);
    expect(scene.dataset.etape).toBe('ouverture');
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

  it('un geste annulé garde la déchirure acquise, le sachet ne se referme pas', () => {
    const scene = monter();
    const zone = scene.querySelector('[data-zone]') as HTMLElement;
    fireEvent.pointerDown(zone, { clientX: 10, clientY: 44, pointerId: 1 });
    fireEvent.pointerMove(zone, { clientX: 150, clientY: 44, pointerId: 1 });
    // Le contrôle mord : la déchirure a bien commencé avant l'annulation.
    expect(scene.dataset.etape).toBe('dechirure');
    expect(Number(scene.dataset.dechirure)).toBeGreaterThan(0.5);
    fireEvent.pointerCancel(zone, { pointerId: 1 });
    expect(scene.dataset.etape).toBe('ferme');
    // D-170 : sous le seuil, la déchirure reste où le doigt l'a laissée. Avant, elle revenait à
    // 0 sans un mot — un geste raté était perdu, et le test d'alors l'exigeait.
    expect(Number(scene.dataset.dechirure)).toBeGreaterThan(0.5);
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

  it('une carte simple montre son symbole au verso puis se retourne sur place, sans annonce de rare', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    fireEvent.click(carte(scene, 1));
    expect(carte(scene, 1).dataset.tension).toBe('oui');
    expect(carte(scene, 1).dataset.face).toBe('verso');
    expect(scene.querySelector('[data-consigne]')?.textContent).toContain('badge à pince');
    attendre(SUSPENSE.simple);
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

  it('pendant l’envol, la consigne dit l’attente : `aria-live` n’annonce plus du vide (#569)', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
    attendre(800);
    expect(scene.dataset.etape).toBe('ouverture');
    // Le contrôle mord : la consigne d'avant était la chaîne vide, et la ligne gardait sa
    // hauteur — un lecteur d'écran n'annonçait donc rien pendant les 2,9 s de montée.
    const consigne = scene.querySelector('[data-consigne]')?.textContent ?? '';
    expect(consigne.length).toBeGreaterThan(0);
    expect(consigne).toContain('ouvre');
  });

  it('la fin dit le compteur et le bilan, avant le bouton (#569)', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));
    attendre(100);
    expect(scene.dataset.etape).toBe('ouvert');
    // Le compteur ne disparaît plus quand tout est retourné.
    expect(scene.querySelector('[data-consigne]')?.textContent).toContain('5 / 5');
    // Le bouton or n'est plus seul : le bilan dit ce que l'Arrivage a donné.
    const bilan = scene.querySelector('.ouverture__bilan');
    expect(bilan?.textContent).toBe('5 cartes dans ta Collection · 2 nouvelles');
    expect(within(scene).getByRole('button', { name: /Ranger dans la Collection/ })).toBeTruthy();
  });

  it('« Tout afficher » ne pèse pas plus que « Ouvrir » (#569)', () => {
    const scene = monter();
    const ouvrir = scene.querySelector('[data-ouvrir]') as HTMLElement;
    const tout = scene.querySelector('[data-tout-afficher]') as HTMLElement;
    // Le contrôle mord : sans la classe de second plan, les deux boutons sont `.button` et rien
    // ne les distingue — c'était le défaut mesuré (même classe, même graisse, même dégradé).
    expect(ouvrir.className).not.toContain('ouverture__tout-afficher');
    expect(tout.className).toContain('ouverture__tout-afficher');
  });

  it('à la souris, la consigne ne parle ni du doigt ni du toucher (#569)', () => {
    const rendrePointeur = pointeur('fine');
    try {
      const scene = monter();
      expect(scene.querySelector('[data-consigne]')?.textContent).toBe('Glisse le long des pointillés');
      fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));
      attendre(100);
      expect(scene.querySelector('[data-consigne]')?.textContent).toContain('clique une carte pour la lire');
    } finally {
      rendrePointeur();
    }
  });

  it('le clavier retourne les cartes : la première a le focus, Entrée la retourne', () => {
    const scene = monter();
    jusquALaRevelation(scene);
    expect(document.activeElement).toBe(carte(scene, 0));
    fireEvent.keyDown(carte(scene, 0), { key: 'Enter' });
    attendre(SUSPENSE.simple);
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

  it('une carte n’est pas un bouton dans un bouton : un seul arrêt de tabulation par carte', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));

    // D-170 : `CardView` en `calme` rend un `div`. Avant, chaque carte portait un second bouton
    // dont le nom accessible était **tout le texte de la carte** (177 caractères mesurés) :
    // deux arrêts de tabulation par carte, et une structure ARIA invalide.
    expect(scene.querySelectorAll('.ouverture__carte[role="button"]')).toHaveLength(5);
    expect(scene.querySelectorAll('.ouverture__carte button')).toHaveLength(0);
  });

  it('sur une petite carte, le premier tap retourne la carte et ouvre sa fiche (D-170)', () => {
    const rendre = ecranTaille(390, 664);
    const rendrePointeur = pointeur('coarse');
    try {
      const scene = monter();
      jusquALaRevelation(scene);
      fireEvent.click(carte(scene, 0));
      attendre(LONGTEMPS);

      // La carte étalée fait 118 px et son texte 6 à 8 px : retourner, c'est lire.
      expect(carte(scene, 0).dataset.fiche).toBe('oui');
      expect(within(scene).getByRole('region', { name: `Fiche : ${(CARTES[0] as Card).name}` })).toBeTruthy();
      expect(scene.querySelector('[data-consigne]')?.textContent).toBe('Touche la carte pour la reposer');
      // La consigne annonce le geste qui a lieu, pas l'étape intermédiaire.
      expect(scene.querySelector('[data-consigne]')?.textContent).not.toMatch(/retourner/);
    } finally {
      rendrePointeur();
      rendre();
    }
  });

  it('sur une carte à sa taille pleine (1280), un tap retourne et le second ouvre la fiche', () => {
    const rendre = ecranTaille(1280, 800);
    try {
      const scene = monter();
      jusquALaRevelation(scene);
      fireEvent.click(carte(scene, 0));
      attendre(LONGTEMPS);
      // Le contrôle mord : à l'échelle 1, le premier tap ne doit **pas** ouvrir la fiche.
      expect(carte(scene, 0).dataset.fiche).toBeUndefined();

      fireEvent.click(carte(scene, 0));
      expect(carte(scene, 0).dataset.fiche).toBe('oui');
    } finally {
      rendre();
    }
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

  /**
   * **Les cartes passent devant le corps du sachet à la sortie** (#667).
   *
   * Le défaut mesuré : à l'envol, `.ouverture__cartes--dedans` pose la liste des cartes en
   * `z-index: 1`, sous la zone du sachet (`z-index: 2`) — et le `z-index` en ligne de chaque
   * carte (`30 - i`, écrit par `poseDe`) ne peut pas sortir du plan de sa liste. Les cartes
   * émergent donc **derrière** la pochette, que l'on voit seule.
   *
   * ⚠️ Ce test garde **l'ordre des plans**, il ne prouve pas le rendu : jsdom ne peint rien, et
   * une valeur de `z-index` ne dit pas ce que l'œil voit. La preuve visuelle est la planche de
   * frames de la phase de sortie (`scripts/preuves/filmer-animation.mjs`), exigée par #672.
   *
   * ⚠️ **Rouge avant le correctif #672**, et c'est voulu : il ne se fusionne pas seul.
   */
  it('à la sortie, les cartes passent devant le corps du sachet (#667)', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
    // 700 ms de déchirure jouée seule, puis l'envol : les cartes commencent à sortir.
    attendre(800);
    expect(scene.dataset.etape).toBe('ouverture');

    const premiere = carte(scene, 0);
    const corps = scene.querySelector('.ouverture__corps') as HTMLElement;
    // Le contrôle mord : le `z-index` en ligne est bien écrit par `poseDe` — s'il manquait, le
    // plan des cartes se réduirait à celui de leur liste et la garde ne lirait plus rien.
    expect(Number(premiere.style.zIndex)).toBeGreaterThan(0);

    const planCartes = planDe(scene, premiere);
    const planCorps = planDe(scene, corps);
    expect(
      devant(planCartes, planCorps),
      `les cartes (${planCartes.join(' → ')}) devraient être devant le corps du sachet (${planCorps.join(' → ')})`
    ).toBe(true);
  });

  it('le contrôle mord : l’ancien ordre (`--cartes--dedans`, z-index 1) est refusé (#667)', () => {
    // L'ordre d'avant le correctif, lu dans la feuille : la liste des cartes est en `z-index: 1`,
    // la zone du sachet en `z-index: 2`, et la carte porte son `z-index` en ligne (30).
    // Un contrôle qui ne comparerait que le `z-index` en ligne la dirait devant : il est faux,
    // la carte ne peut pas sortir du contexte d'empilement de sa liste.
    expect(devant([1, 30], [2])).toBe(false);
    // Et il n'est pas toujours faux : sans le contexte de la liste, la carte passe devant.
    expect(devant([30], [2])).toBe(true);
    // À plan égal, rien ne prouve qu'une carte est devant : le doute ne vaut pas preuve.
    expect(devant([2], [2])).toBe(false);
  });

  it('les cartes restent invisibles avant la fente et chaque bascule tient sous 800 ms', () => {
    const rendre = ecranTaille(420, 900);
    try {
      const scene = monter();
      fireEvent.click(within(scene).getByRole('button', { name: /^Ouvrir$/ }));
      attendre(800);

      const liste = scene.querySelector('.ouverture__cartes') as HTMLElement;
      const cartes = [...scene.querySelectorAll<HTMLElement>('.ouverture__carte')];
      // Le plan passe devant dès le départ, mais aucune carte ne perce avant sa sortie de la fente.
      expect(liste.classList.contains('ouverture__cartes--dedans')).toBe(false);
      expect(cartes.every((carte) => carte.style.opacity === '0')).toBe(true);

      attendre(250);
      expect(cartes.every((carte) => carte.style.opacity === '1')).toBe(true);
      for (const carte of cartes) {
        const bascule = /transform (\d+)ms(?: (\d+)ms)?/.exec(carte.style.transition);
        expect(bascule).not.toBeNull();
        expect(Number(bascule?.[1]) + Number(bascule?.[2] ?? 0)).toBeLessThanOrEqual(800);
      }

      // La sortie de la pochette est une seconde bascule ; elle garde la même borne.
      attendre(1350);
      for (const carte of cartes) {
        const bascule = /transform (\d+)ms(?: (\d+)ms)?/.exec(carte.style.transition);
        expect(bascule).not.toBeNull();
        expect(Number(bascule?.[1]) + Number(bascule?.[2] ?? 0)).toBeLessThanOrEqual(800);
      }
    } finally {
      rendre();
    }
  });

  it('annonce le symbole géométrique des huit raretés au dos, pendant la tension et avant le retournement', () => {
    const signatures = new Map<string, Rarity>();

    for (const rarete of TOUTES_LES_RARETES) {
      const rendu = render(<SceneOuverture cartes={[une(rarete)]} neuves={new Set()} onRanger={() => undefined} />);
      const scene = screen.getByTestId('ouverture');

      try {
        jusquALaRevelation(scene);
        const tiree = carte(scene, 0);
        fireEvent.click(tiree);

        expect(tiree.dataset.tension, rarete).toBe('oui');
        expect(tiree.dataset.face, rarete).toBe('verso');

        const meta = RARITY_META[rarete];
        const symbole = tiree.querySelector<SVGSVGElement>('.ouverture__dos [data-symbole-rarete]');
        expect(symbole, `${rarete} doit porter son symbole sur le dos`).not.toBeNull();
        expect(symbole?.getAttribute('data-symbole-rarete')).toBe(rarete);
        const trace = symbole?.querySelector('path')?.getAttribute('d');
        expect(trace, rarete).toBe(meta.symbol.path);
        expect(tiree.querySelector('.ouverture__dos-symbole-nom')?.textContent).toBe(meta.symbol.name);

        // Le lecteur d'écran reçoit le nom dès la tension, et non dans l'annonce après retournement.
        expect(scene.querySelector('[data-consigne]')?.textContent).toBe(`Symbole de rareté : ${meta.symbol.name}`);
        expect(tiree.getAttribute('aria-label')).toContain(meta.symbol.name);

        const attente = SUSPENSE[palier(rarete)];
        expect(attente, rarete).toBeGreaterThan(0);
        attendre(attente - 1);
        expect(tiree.dataset.face, `${rarete} reste au verso pendant sa tension`).toBe('verso');
        attendre(1);
        expect(tiree.dataset.face, `${rarete} ne se retourne qu'après l'annonce`).toBe('recto');

        const signature = signatureDuTrace(trace ?? '');
        expect(signatures.get(signature), `${rarete} a le même tracé que ${signatures.get(signature)}`).toBeUndefined();
        signatures.set(signature, rarete);
      } finally {
        rendu.unmount();
      }
    }

    expect(signatures.size).toBe(TOUTES_LES_RARETES.length);
  });

  it('la fiche agrandie nomme visiblement le symbole de rareté', () => {
    const scene = monter();
    fireEvent.click(within(scene).getByRole('button', { name: /Tout afficher/ }));
    const carteTiree = carte(scene, 4);
    const rarete = (CARTES[4] as Card).rarity;
    fireEvent.click(carteTiree);

    const fiche = within(scene).getByRole('region', { name: `Fiche : ${(CARTES[4] as Card).name}` });
    expect(within(fiche).getByText(RARITY_META[rarete].symbol.name)).toBeTruthy();
    expect(fiche.querySelector('[data-symbole-rarete]')?.getAttribute('data-symbole-rarete')).toBe(rarete);
  });
});
