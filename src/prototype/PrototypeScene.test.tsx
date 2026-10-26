/*
 * **Le banc d'essai des saynètes se rend** (#219, D-101).
 *
 * Il ne rendait rien : ses cartes étaient nommées **par id**, et D-095 a renommé
 * `atelier-chef-atelier` en `atelier-responsable-process`. Le premier rendu levait
 * « Carte introuvable », sans bouton ni `canvas`. Le banc choisit désormais ses cartes
 * **par critère** (faction, stade, rareté) : ce fichier en est la preuve exécutable.
 *
 * Ce n'est pas un écran de l'application — le banc est DEV, hors bundle (D-101) : le
 * monter sous `jsdom` est un garde-fou, pas une promesse de produit. Le moteur de la
 * scène s'y tait (pas de `canvas` 2D), et c'est le repli prévu par `SceneAttaque`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PrototypeScene } from './PrototypeScene';

const SOURCE = readFileSync(join(process.cwd(), 'src/prototype/PrototypeScene.tsx'), 'utf8');

/**
 * Un **id de carte** nommé en dur : `'atelier-chef-atelier'`, `"sse-preventeur"`…
 * `AGENTS.md` §5 veut qu'un id suive le nom, donc un id écrit dans un banc est un piège
 * qui se referme au renommage suivant.
 */
const ID_DE_CARTE =
  /(['"])(sse|management|qvt|amelioration|rh|atelier|direction|syndicat|interim|support)-[a-z0-9-]+\1/g;

/** Les ids de carte nommés dans une source, tels qu'écrits. */
function idsNommes(source: string): string[] {
  return [...source.matchAll(ID_DE_CARTE)].map((m) => m[0]);
}

describe('banc d’essai des saynètes (#219, D-101)', () => {
  it('se rend : trois scénarios, les deux canvas de la scène, les deux Bancs remplis', () => {
    const { container } = render(<PrototypeScene />);

    expect(container.querySelectorAll('[data-preset]')).toHaveLength(3);
    expect(container.querySelectorAll('canvas.scene-attaque')).toHaveLength(2);
    // Deux Bancs de trois places, remplis de cartes réelles : c'est là que le banc nommait
    // `atelier-chef-atelier`, renommé par D-095 — il levait au premier rendu.
    expect(container.querySelectorAll('li.bench__slot')).toHaveLength(6);
  });

  it('le scénario retenu porte sa cinématique, et le coup de grâce coche sa case', () => {
    const { container } = render(<PrototypeScene />);

    // La cinématique est réservée à la Pression la plus chère d'un COU, 3 étoiles ou COMEX
    // (D-098) : le scénario « COMEX » doit en trouver une dans le catalogue, sans la nommer.
    fireEvent.click(container.querySelector('[data-preset="comex"]')!);
    expect(window.__scene?.info()).toMatchObject({ cinematique: true });

    fireEvent.click(container.querySelector('[data-preset="grace"]')!);
    expect((screen.getByLabelText(/la cible craque/i) as HTMLInputElement).checked).toBe(true);
  });

  it('ne nomme aucun id de carte : il choisit ses cartes par critère', () => {
    expect(idsNommes(SOURCE)).toEqual([]);
  });

  it('le contrôle mord : un id réintroduit est trouvé', () => {
    expect(idsNommes("const piège = 'atelier-chef-atelier';")).toEqual(["'atelier-chef-atelier'"]);
  });
});
