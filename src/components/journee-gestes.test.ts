import { beforeEach, describe, expect, it } from 'vitest';
import { estGesteFait, marquerGeste, oublierGestes } from './journee-gestes';

/**
 * **Le geste de la Journée sans trace persistée** (30/10/2026) : créer sa sauvegarde ne
 * laisse rien dans le store — seulement le fait, pour la session en cours.
 */
describe('les gestes de la Journée', () => {
  beforeEach(() => oublierGestes());

  it('un geste non marqué n’est pas fait', () => {
    expect(estGesteFait('sauvegarde')).toBe(false);
  });

  it('le marquer suffit, et le refaire ne casse rien', () => {
    marquerGeste('sauvegarde');
    expect(estGesteFait('sauvegarde')).toBe(true);
    // **Le contrôle mord** : marquer deux fois ne doit pas lever d'erreur (le bouton peut
    // être cliqué pendant que React redessine).
    expect(() => marquerGeste('sauvegarde')).not.toThrow();
  });

  it('oublier remet le parcours à zéro', () => {
    marquerGeste('sauvegarde');
    oublierGestes();
    expect(estGesteFait('sauvegarde')).toBe(false);
  });
});
