import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — module .mjs sans déclaration de types
import { STORAGE_KEY, analyserArguments, etatAmorce, htmlPlanche, nomFrame } from './filmer-animation.mjs';

/**
 * Le contrat de `scripts/filmer-animation.mjs`, sans navigateur. La prise réelle se vérifie à la
 * main (`BASE_URL=… node scripts/filmer-animation.mjs …`) ; ce test garde ce qui se casse en
 * silence : une planche vide parce que « Mouvement réduit » était actif, une clé de store périmée.
 */
describe('filmer-animation', () => {
  it('amorce le store sans « Mouvement réduit » (sinon la planche est vide)', () => {
    expect(etatAmorce().state).toMatchObject({ tutorielVu: true, reducedMotion: false });
    expect(etatAmorce({ combatDetaille: true }).state).toMatchObject({ combatDetaille: true, reducedMotion: false });
  });

  it('le contrôle mord : un supplément peut rallumer « Mouvement réduit », donc la planche en dépend', () => {
    expect(etatAmorce({ reducedMotion: true }).state.reducedMotion).toBe(true);
  });

  it('utilise la clé de store de l’application', () => {
    const store = readFileSync(new URL('../src/store/useStore.ts', import.meta.url), 'utf8');
    expect(store).toContain(`'${STORAGE_KEY}'`);
  });

  it('lit les options et refuse une option inconnue ou un entier invalide', () => {
    const config = analyserArguments(['--clic', 'a', '--clic', 'b', '--images', '10', '--stockage', '{"x":1}']);
    expect(config).toMatchObject({ clics: ['a', 'b'], images: 10, stockage: { x: 1 }, chemin: '/battle' });
    expect(() => analyserArguments(['--bidon', '1'])).toThrow(/inconnue/);
    expect(() => analyserArguments(['--images', 'zéro'])).toThrow(/entier/);
    expect(() => analyserArguments(['--images'])).toThrow(/valeur/);
  });

  it('numérote les frames dans l’ordre et légende la planche en millisecondes', () => {
    expect(nomFrame(3)).toBe('f03.png');
    const html = htmlPlanche(['f00.png', 'f01.png'], { colonnes: 2, intervalle: 70 });
    expect(html).toContain('0 ms');
    expect(html).toContain('70 ms');
    expect(html).toContain('repeat(2,auto)');
  });
});
