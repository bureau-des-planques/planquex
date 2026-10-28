import { describe, expect, it } from 'vitest';
import { RARITY_META } from '@/data';
import type { Rarity } from '@/data/types';
import {
  auMoins,
  CARTE,
  decoupes,
  lueur,
  meilleure,
  meilleurPalier,
  palier,
  posePile,
  poseRecap,
  SUSPENSE,
  traceDechirure
} from './revelation';

/**
 * **La mise en scène de la révélation** (#283) : paliers, lueur, tracé, dispositions. Chaque règle
 * est confrontée à un cas qui la ferait tomber (AGENTS.md §6).
 */
const TOUTES = Object.keys(RARITY_META) as Rarity[];

describe('la révélation d’un Arrivage — la mise en scène (#283)', () => {
  it('chaque rareté a un palier, et le palier ne redescend jamais quand la rareté monte', () => {
    const ordre = [...TOUTES].sort((a, b) => RARITY_META[a].order - RARITY_META[b].order);
    for (let i = 1; i < ordre.length; i += 1) {
      const avant = ordre[i - 1] as Rarity;
      const apres = ordre[i] as Rarity;
      expect(auMoins(palier(apres), palier(avant)), `${apres} sous ${avant}`).toBe(true);
    }
    // Le contrôle mord : les deux bouts de l'échelle ne sont pas au même palier.
    expect(palier('1D')).toBe('simple');
    expect(palier('COU')).toBe('secrete');
  });

  it('l’attente avant le retournement croît avec le palier', () => {
    expect(SUSPENSE.simple).toBeLessThan(SUSPENSE.rare);
    expect(SUSPENSE.rare).toBeLessThan(SUSPENSE.brillante);
    expect(SUSPENSE.brillante).toBeLessThan(SUSPENSE.secrete);
  });

  it('la meilleure carte du tirage donne la lueur, et une lueur froide sans rien de notable', () => {
    expect(meilleure(['1D', '2S', '3D'])).toBe('2S');
    expect(meilleurPalier(['1D', '2S', '3D'])).toBe('secrete');
    expect(lueur(['1D', '2S', '3D'])).toBe(RARITY_META['2S'].color);
    expect(lueur(['1D', '2D'])).not.toBe(RARITY_META['2D'].color);
    expect(meilleure([])).toBeUndefined();
    expect(meilleurPalier([])).toBe('simple');
  });

  it('le tracé de la déchirure est rejouable par sa graine, et reste près de la ligne', () => {
    const a = traceDechirure(42, 8.8);
    expect(traceDechirure(42, 8.8)).toEqual(a);
    expect(traceDechirure(43, 8.8)).not.toEqual(a);
    expect(a[0]?.[0]).toBe(0);
    expect(a[a.length - 1]?.[0]).toBe(100);
    for (const [, y] of a) expect(Math.abs(y - 8.8)).toBeLessThan(1);
  });

  it('la bande et le corps découpent le même tracé', () => {
    const trace = traceDechirure(7, 8.8);
    const { bande, corps } = decoupes(trace);
    for (const [x, y] of trace) {
      expect(bande).toContain(`${x}% ${y}%`);
      expect(corps).toContain(`${x}% ${y}%`);
    }
  });

  it('dans la pile, la carte du dessus est droite et les suivantes débordent à peine', () => {
    const dessus = posePile(0, 390, 700);
    expect(dessus.rotation).toBe(0);
    expect(dessus.x).toBe(0);
    const dessous = posePile(2, 390, 700);
    expect(Math.abs(dessous.rotation)).toBeGreaterThan(0);
    expect(dessous.echelle).toBeLessThan(dessus.echelle);
  });

  it('le récapitulatif tient dans la scène, sans chevauchement', () => {
    for (const [largeur, hauteur] of [
      [358, 690],
      [1334, 680],
      [800, 600]
    ] as const) {
      const poses = Array.from({ length: 5 }, (_, i) => poseRecap(i, 5, largeur, hauteur));
      for (const p of poses) {
        const l = (CARTE.largeur * p.echelle) / 2;
        const h = (CARTE.hauteur * p.echelle) / 2;
        expect(Math.abs(p.x) + l, `débord horizontal à ${largeur}`).toBeLessThanOrEqual(largeur / 2 + 0.5);
        expect(Math.abs(p.y) + h, `débord vertical à ${hauteur}`).toBeLessThanOrEqual(hauteur / 2 + 0.5);
      }
      for (let i = 0; i < poses.length; i += 1) {
        for (let j = i + 1; j < poses.length; j += 1) {
          const a = poses[i]!;
          const b = poses[j]!;
          const separees =
            Math.abs(a.x - b.x) >= CARTE.largeur * a.echelle - 0.5 ||
            Math.abs(a.y - b.y) >= CARTE.hauteur * a.echelle - 0.5;
          expect(separees, `cartes ${i} et ${j} superposées à ${largeur} × ${hauteur}`).toBe(true);
        }
      }
    }
  });

  it('sur un téléphone en hauteur, le récapitulatif préfère deux colonnes (des cartes plus grandes)', () => {
    const deux = poseRecap(0, 5, 358, 690);
    const trois = poseRecap(0, 5, 358 * 3, 690);
    expect(deux.y).toBeLessThan(0);
    // Le contrôle mord : à trois colonnes forcées (écran large), l'échelle d'un téléphone serait ~0,5.
    expect(deux.echelle).toBeGreaterThan(0.6);
    expect(trois.echelle).toBeGreaterThan(0);
  });
});
