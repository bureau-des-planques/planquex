// @vitest-environment node
/**
 * La logique pure du rafraîchissement (#184).
 *
 * Chaque contrôle **mord** : le premier chargement ne crie pas, une baisse ne crie pas, une
 * hausse crie — et `scripts/ci/garde-fous.mjs` mute la ligne de la hausse en `Math.abs(...)`
 * pour vérifier que le cas « la baisse crie » fait bien échouer ce fichier.
 */
import { describe, expect, it } from 'vitest';
import {
  libelleFraicheur,
  libelleNouveaux,
  nouveauxEnAttente,
  titreOnglet,
} from './lib/suivi.mjs';

describe('le calcul du nouveau (#184)', () => {
  it('ne crie pas au premier chargement, quel que soit le nombre en attente', () => {
    expect(nouveauxEnAttente(null, 0)).toBe(0);
    expect(nouveauxEnAttente(null, 3)).toBe(0);
    expect(nouveauxEnAttente(undefined, 42)).toBe(0);
  });

  it('crie quand le nombre monte, du plus petit écart au plus grand', () => {
    expect(nouveauxEnAttente(0, 1)).toBe(1);
    expect(nouveauxEnAttente(2, 3)).toBe(1);
    expect(nouveauxEnAttente(2, 6)).toBe(4);
  });

  it('ne crie pas quand le nombre baisse ou ne bouge pas', () => {
    expect(nouveauxEnAttente(3, 2)).toBe(0);
    expect(nouveauxEnAttente(2, 0)).toBe(0);
    expect(nouveauxEnAttente(2, 2)).toBe(0);
  });

  it('ne crie pas sur un état illisible', () => {
    expect(nouveauxEnAttente('beaucoup', 3)).toBe(0);
    expect(nouveauxEnAttente(2, 'trois')).toBe(0);
  });

  it('met le bandeau au singulier, au pluriel, et le tait à zéro', () => {
    expect(libelleNouveaux(0)).toBe('');
    expect(libelleNouveaux(-1)).toBe('');
    expect(libelleNouveaux(1)).toBe('1 nouvelle inscription en attente');
    expect(libelleNouveaux(3)).toBe('3 nouvelles inscriptions en attente');
  });

  it('n’ajoute le nombre au titre de l’onglet que s’il y a des attentes', () => {
    expect(titreOnglet(0, 'Poste de pilotage')).toBe('Poste de pilotage');
    expect(titreOnglet(-2, 'Poste de pilotage')).toBe('Poste de pilotage');
    expect(titreOnglet(2, 'Poste de pilotage')).toBe('(2) Poste de pilotage');
  });

  it('dit l’âge de la dernière relecture sans mentir sous la seconde', () => {
    expect(libelleFraicheur(0)).toBe('à jour à l’instant');
    expect(libelleFraicheur(999)).toBe('à jour à l’instant');
    expect(libelleFraicheur(1000)).toBe('à jour il y a 1 s');
    expect(libelleFraicheur(59_000)).toBe('à jour il y a 59 s');
    expect(libelleFraicheur(60_000)).toBe('à jour il y a 1 min');
    expect(libelleFraicheur(3_600_000)).toBe('à jour il y a 1 h');
  });
});
