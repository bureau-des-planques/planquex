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
    // Un geste de glissement se décrit par deux points **en fractions** de la boîte : des pixels
    // absolus casseraient à la première zone qui bouge ou qui change de taille.
    const geste = analyserArguments(['--glisser', '.zone:0.5,0.16>0.5,-0.1']);
    expect(geste.etapes).toEqual([{ type: 'glisser', selecteur: '.zone', x0: 0.5, y0: 0.16, x1: 0.5, y1: -0.1 }]);
    expect(geste.glissers).toEqual(['.zone:0.5,0.16>0.5,-0.1']);
    expect(() => analyserArguments(['--glisser', '.zone:gauche'])).toThrow(/sélecteur:x0,y0>x1,y1/);
    expect(() => analyserArguments(['--images'])).toThrow(/valeur/);
  });

  it('lit --survol, répétable, et le garde distinct des clics (#294 : la carte de main soulevée)', () => {
    const config = analyserArguments(['--clic', 'a', '--survol', '.hand > li', '--survol', 'b']);
    expect(config).toMatchObject({ clics: ['a'], survols: ['.hand > li', 'b'] });
    expect(analyserArguments([]).survols).toEqual([]);
    expect(() => analyserArguments(['--survol'])).toThrow(/valeur/);
  });

  it('numérote les frames dans l’ordre et légende la planche en millisecondes', () => {
    expect(nomFrame(3)).toBe('f03.png');
    const html = htmlPlanche(['f00.png', 'f01.png'], { colonnes: 2, intervalle: 70 });
    expect(html).toContain('0 ms');
    expect(html).toContain('70 ms');
    expect(html).toContain('repeat(2,auto)');
  });

  it('garde l’ordre des étapes (clic, attente, pause) tel qu’écrit sur la ligne de commande', () => {
    const config = analyserArguments(['--clic', 'a', '--attendre', 'b', '--pause', '400', '--clic', 'c']);
    expect(config.etapes).toEqual([
      { type: 'clic', selecteur: 'a' },
      { type: 'attendre', selecteur: 'b' },
      { type: 'pause', ms: 400 },
      { type: 'clic', selecteur: 'c' }
    ]);
    // `clics` reste la liste des seuls clics : l'ancien contrat ne bouge pas.
    expect(config.clics).toEqual(['a', 'c']);
  });

  it('lit l’horloge figée, la marge et le sélecteur compté — et refuse les valeurs fausses', () => {
    const config = analyserArguments(['--horloge', '2026-10-22T09:00:00Z', '--marge', '48', '--compter', '.x']);
    expect(config).toMatchObject({ horloge: '2026-10-22T09:00:00Z', marge: 48, compter: '.x' });
    expect(() => analyserArguments(['--horloge', 'hier'])).toThrow(/date ISO/);
    expect(() => analyserArguments(['--marge', '-3'])).toThrow(/entier ≥ 0/);
    expect(() => analyserArguments(['--pause', '0'])).toThrow(/entier ≥ 1/);
  });

  it('légende la planche avec l’instant mesuré et le compte du DOM — de quoi prouver un retrait', () => {
    const html = htmlPlanche(
      [
        { src: 'f00.png', t: 12.4, compte: 1 },
        { src: 'f01.png', t: 508.7, compte: 0 }
      ],
      { colonnes: 2, intervalle: 70 }
    );
    expect(html).toContain('12 ms · DOM : 1');
    expect(html).toContain('509 ms · DOM : 0');
    // Le contrôle mord : sans `compte`, la légende ne ment pas en inventant un « DOM : 0 ».
    expect(htmlPlanche([{ src: 'f00.png', t: 5 }], { colonnes: 1, intervalle: 70 })).not.toContain('DOM');
  });
});
