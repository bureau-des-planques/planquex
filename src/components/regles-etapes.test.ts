import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ETAPES_REGLES, cheminImageRegle, imageManquante, motsDeLEtapeRegle } from './regles-etapes';
import { BENCH_SIZE, HAND_LIMIT, POINTS_TO_WIN, STARTING_HAND, WEAKNESS_BONUS } from '@/game/rules';
import { DECK_SIZE, MAX_COPIES_PER_NAME } from '@/game/deck';

/**
 * **Les chiffres des règles ne se recopient pas** (#270, #248).
 *
 * Chaque volume montré à un nouvel inscrit vient d'une constante : `@/game/rules` ou
 * `@/game/deck`. Ce fichier refuse un **nombre écrit à la main** dans les étapes — c'est le
 * contrôle qui mord : ajouter « 4 Interventions » sans toucher `POINTS_TO_WIN` fait échouer
 * le test, là où une relecture ne verrait rien.
 */
const FIGURES = new Set(
  [BENCH_SIZE, HAND_LIMIT, POINTS_TO_WIN, STARTING_HAND, WEAKNESS_BONUS, DECK_SIZE, MAX_COPIES_PER_NAME].map(String)
);

describe('les étapes des règles (#270)', () => {
  it('couvre les lignes d’docs/JEU.md §4 qu’un nouvel inscrit doit connaître', () => {
    const titres = ETAPES_REGLES.map((etape) => etape.titre);
    expect(titres).toHaveLength(6);
    expect(titres.join(' · ')).toMatch(/Seuil/);
    expect(titres.join(' · ')).toMatch(/plateau/);
    expect(titres.join(' · ')).toMatch(/Deck/);
    expect(titres.join(' · ')).toMatch(/Pression/);
    expect(titres.join(' · ')).toMatch(/Conditions/);
    expect(titres.join(' · ')).toMatch(/fin/);
  });

  it('se lit en une minute au plus', () => {
    // Une minute à 200 mots par minute : le plafond de la présentation, mesuré et non cru.
    const total = ETAPES_REGLES.reduce((mots, etape) => mots + motsDeLEtapeRegle(etape), 0);
    expect(total).toBeLessThanOrEqual(200);
  });

  it('n’écrit aucun nombre qui ne vienne pas d’une constante', () => {
    for (const etape of ETAPES_REGLES) {
      const nombres = `${etape.titre} ${etape.texte}`.match(/\d+/g) ?? [];
      for (const nombre of nombres) {
        expect(FIGURES.has(nombre), `« ${nombre} » dans « ${etape.titre} » ne vient d’aucune constante`).toBe(true);
      }
    }
  });

  it('le contrôle mord : un chiffre inventé est refusé', () => {
    const fautive = { titre: 'Essai', texte: 'Le premier à 4 Interventions gagne.' };
    const nombres = `${fautive.titre} ${fautive.texte}`.match(/\d+/g) ?? [];
    expect(nombres.length).toBeGreaterThan(0);
    expect(nombres.every((nombre) => FIGURES.has(nombre))).toBe(false);
  });

  it('chaque étape qui déclare une image a son fichier, et un alt qui dit ce qu’elle montre (#415)', () => {
    const racine = fileURLToPath(new URL('../../public', import.meta.url));
    const avecImage = ETAPES_REGLES.filter((etape) => etape.image);
    expect(avecImage.length).toBeGreaterThan(0);
    for (const etape of avecImage) {
      expect(imageManquante(etape, existsSync, racine), `image absente pour « ${etape.titre} »`).toBe(false);
      expect(etape.image?.alt.trim().length ?? 0).toBeGreaterThan(20);
      expect(cheminImageRegle(etape)).toMatch(/^\/regles\/[a-z-]+\.webp$/);
    }
  });

  it('le contrôle mord : une image déclarée absente fait échouer la garde (#415)', () => {
    const fantome = {
      titre: 'Essai',
      texte: 'Un texte.',
      image: { fichier: 'regles/fantome.webp', alt: 'Une image qui n’existe pas du tout.' }
    };
    expect(imageManquante(fantome, () => false, '/racine')).toBe(true);
    expect(imageManquante(fantome, () => true, '/racine')).toBe(false);
  });
});
