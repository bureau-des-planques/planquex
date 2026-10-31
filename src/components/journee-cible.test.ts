import { describe, expect, it } from 'vitest';
import { cibleJournee, poserCibleJournee } from './journee-cible';

/**
 * **La cible de l'étape courante** (30/10/2026). Avant, toutes les pages s'allumaient dès que
 * la Journée n'était pas finie : à l'étape 1 sur `/deck`, le volet des Decks était cerclé d'or.
 * Une seule cible à la fois, et elle s'éteint quand la Journée se ferme.
 */
describe('la cible de la Journée', () => {
  it('n’a qu’une valeur à la fois', () => {
    poserCibleJournee('arrivage');
    expect(cibleJournee()).toBe('arrivage');
    poserCibleJournee('decks-proposes');
    expect(cibleJournee()).toBe('decks-proposes');
  });

  it('s’éteint quand la Journée se ferme', () => {
    poserCibleJournee('sauvegarde');
    poserCibleJournee(null);
    // **Le contrôle mord** : une cible qui resterait posée laisserait un halo orphelin.
    expect(cibleJournee()).toBeNull();
  });
});
