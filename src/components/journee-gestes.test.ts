import { beforeEach, describe, expect, it } from 'vitest';
import { estGesteFait, marquerGeste, oublierGestes } from './journee-gestes';

/**
 * **Le geste de la Journée sans trace persistée** (30/10/2026) : ouvrir l’onglet Deck ne
 * laisse rien dans le store — seulement le fait, pour la session en cours.
 */
describe('les gestes de la Journée', () => {
  beforeEach(() => oublierGestes());

  it('un geste non marqué n’est pas fait', () => {
    expect(estGesteFait('deck')).toBe(false);
  });

  it('le marquer suffit, et le refaire ne casse rien', () => {
    marquerGeste('deck');
    expect(estGesteFait('deck')).toBe(true);
    // **Le contrôle mord** : marquer deux fois ne doit pas lever d'erreur (le bouton peut
    // être cliqué pendant que React redessine).
    expect(() => marquerGeste('deck')).not.toThrow();
  });

  it('oublier remet le parcours à zéro', () => {
    marquerGeste('deck');
    oublierGestes();
    expect(estGesteFait('deck')).toBe(false);
  });
});
