import { describe, expect, it } from 'vitest';
import { RARITY_META } from '@/data';
import type { Rarity } from '@/data/types';
import {
  annonce,
  ANNONCES,
  auMoins,
  CARTE,
  decoupes,
  lueur,
  meilleure,
  meilleurPalier,
  inclinaisonCachee,
  palier,
  poseFiche,
  poseRecap,
  SUSPENSE,
  TENUE,
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

  it('une carte rare reste au centre plus longtemps qu’elle ne s’est fait attendre, une simple pas du tout', () => {
    expect(SUSPENSE.simple).toBe(0);
    expect(TENUE.simple).toBe(0);
    for (const niveau of ['rare', 'brillante', 'secrete'] as const) {
      expect(TENUE[niveau], niveau).toBeGreaterThan(SUSPENSE[niveau]);
    }
  });

  it('une annonce pour chaque carte rare, aucune pour une simple, rejouable par sa graine', () => {
    expect(annonce('simple', 1)).toBeNull();
    for (const niveau of ['rare', 'brillante', 'secrete'] as const) {
      expect(ANNONCES[niveau].length, niveau).toBeGreaterThanOrEqual(3);
      const texte = annonce(niveau, 42);
      expect(ANNONCES[niveau]).toContain(texte);
      expect(annonce(niveau, 42)).toBe(texte);
    }
    // Plusieurs graines tirent plusieurs phrases : l'annonce n'est pas toujours la même.
    const tirees = new Set(Array.from({ length: 40 }, (_, g) => annonce('secrete', g)));
    expect(tirees.size).toBeGreaterThan(1);
  });

  it('les annonces restent dans le vocabulaire du jeu', () => {
    for (const texte of Object.values(ANNONCES).flat()) {
      // Le cas fautif : un mot de l'ancien univers ou du jeu de référence dans un texte du jeu.
      expect(texte).not.toMatch(/gal[eè]re|pok[eé]mon/i);
      expect(texte.length, texte).toBeLessThanOrEqual(42);
    }
  });

  it('les cartes face cachée sont posées de travers, chacune à sa façon', () => {
    const angles = [0, 1, 2, 3, 4].map(inclinaisonCachee);
    expect(new Set(angles).size).toBe(5);
    for (const a of angles) expect(Math.abs(a)).toBeLessThanOrEqual(4);
  });

  it('la fiche tient dans la scène : carte et texte côte à côte sur un écran large, superposés sur un téléphone', () => {
    for (const [largeur, hauteur, attendue] of [
      [358, 690, 'dessous'],
      [1334, 680, 'cote']
    ] as const) {
      const fiche = poseFiche(largeur, hauteur);
      expect(fiche.disposition).toBe(attendue);
      const l = (CARTE.largeur * fiche.carte.echelle) / 2;
      const h = (CARTE.hauteur * fiche.carte.echelle) / 2;
      expect(Math.abs(fiche.carte.x) + l).toBeLessThanOrEqual(largeur / 2 + 0.5);
      expect(Math.abs(fiche.carte.y) + h).toBeLessThanOrEqual(hauteur / 2 + 0.5);
      const { panneau } = fiche;
      expect(panneau.x + panneau.largeur).toBeLessThanOrEqual(largeur + 0.5);
      expect(panneau.y + panneau.hauteur).toBeLessThanOrEqual(hauteur + 0.5);
      // Le contrôle mord : la carte et le texte ne se recouvrent pas.
      if (attendue === 'cote') expect(largeur / 2 + fiche.carte.x + l).toBeLessThanOrEqual(panneau.x + 0.5);
      else expect(hauteur / 2 + fiche.carte.y + h).toBeLessThanOrEqual(panneau.y + 0.5);
    }
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
