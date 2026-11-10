import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DECLARATION_CSS_TETE,
  TETE_DISCRETE_PX,
  TETE_LARGEUR_PART,
  TETE_MAX_PX,
  TETE_MIN_PX,
  TETE_PART,
  hauteurTete,
  partDeLaTete,
  teteDansLaBorne
} from './journee-tete';

const styles = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');

/**
 * **La tête fait un tiers de l'écran** (D-195 (1), #778, critère 1). jsdom ne mesure rien : la
 * mesure est la fonction `hauteurTete`, dont la feuille est le miroir ; le navigateur la confirme
 * (`getBoundingClientRect`, preuve du ticket : 297 px à 420 × 900, 264 px à 1280 × 800).
 */
describe('la tête du Chef de cabinet mesure un tiers de la fenêtre (D-195 (1))', () => {
  it('à 420 × 900 et à 1280 × 800, la tête tient dans 30 à 36 % de la fenêtre', () => {
    expect(hauteurTete(900)).toBe(297);
    expect(partDeLaTete(hauteurTete(900), 900)).toBeCloseTo(TETE_PART, 5);
    expect(teteDansLaBorne(hauteurTete(900), 900)).toBe(true);

    expect(hauteurTete(800)).toBe(264);
    expect(teteDansLaBorne(hauteurTete(800), 800)).toBe(true);
  });

  it('refuse la notice de D-187 : 72 px à 900 px de haut font 8 %, hors de la fourchette', () => {
    // **Le contrôle mord** : c'est le cas fautif du critère 1 — la tête d'avant.
    expect(teteDansLaBorne(72, 900)).toBe(false);
    expect(teteDansLaBorne(56, 900)).toBe(false);
    // Et le plein cadre que #754 évoquait est refusé aussi : 50 % cachent la cible.
    expect(teteDansLaBorne(450, 900)).toBe(false);
    // Les bornes exactes : 30 % passe, 36 % passe, au-delà non.
    expect(teteDansLaBorne(270, 900)).toBe(true);
    expect(teteDansLaBorne(324, 900)).toBe(true);
    expect(teteDansLaBorne(325, 900)).toBe(false);
  });

  it('les bornes en pixels tiennent le paysage et le bureau', () => {
    // Un téléphone en paysage (390 px) : 33 % feraient 129 px, la borne basse n'intervient pas ;
    // à 300 px de haut, elle tient le visage lisible.
    expect(hauteurTete(390)).toBeCloseTo(128.7, 1);
    expect(hauteurTete(300)).toBe(TETE_MIN_PX);
    // Un écran de 1 440 px : 33 % feraient 475 px, la borne haute garde la page.
    expect(hauteurTete(1440)).toBe(TETE_MAX_PX);
    expect(TETE_MIN_PX).toBeLessThan(TETE_MAX_PX);
    expect(TETE_DISCRETE_PX).toBe(56);
    expect(TETE_LARGEUR_PART).toBeGreaterThan(0.5);
    expect(TETE_LARGEUR_PART).toBeLessThan(1);
  });

  it('la feuille est le miroir du module : même clamp, même largeur, même tête discrète', () => {
    // **Le contrôle mord** : une tête remise à 72 px dans `src/styles.css` (`--journee-tete: 72px`)
    // ne contient plus cette déclaration.
    expect(styles).toContain(DECLARATION_CSS_TETE);
    expect(DECLARATION_CSS_TETE).toBe('--journee-tete: clamp(120px, 33dvh, 320px);');
    // Le repli `vh` précède `dvh` : un navigateur sans `dvh` garde la mesure.
    expect(styles).toContain(`--journee-tete: clamp(${TETE_MIN_PX}px, ${TETE_PART * 100}vh, ${TETE_MAX_PX}px);`);

    const portrait = styles.match(/\n\.journee__portrait \{([^}]*)\}/)?.[1] ?? '';
    expect(portrait).toMatch(/height: var\(--journee-tete\);/);
    expect(portrait).toContain(`width: calc(var(--journee-tete) * ${TETE_LARGEUR_PART});`);

    const scene = styles.match(/\n\.journee__scene \{([^}]*)\}/)?.[1] ?? '';
    // La bande est au ras du bas de l'écran : elle prend la place de la barre de navigation (D-194 (2)).
    expect(scene).toMatch(/bottom: 0;/);
    expect(scene).toMatch(/height: calc\(var\(--journee-tete\)/);

    const discrete = styles.match(/\n\.journee__scene--discrete \.journee__portrait \{([^}]*)\}/)?.[1] ?? '';
    expect(discrete).toContain(`height: ${TETE_DISCRETE_PX}px;`);
    expect(discrete).toContain(`width: ${TETE_DISCRETE_PX}px;`);

    // La page garde de quoi défiler sous la tête (D-187 (3)).
    expect(styles).toMatch(
      /\.app-shell:has\(\.journee__parole\) \{[^}]*padding-bottom: calc\(var\(--journee-tete\) \+ 1rem\);/
    );
  });
});
