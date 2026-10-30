import { describe, expect, it } from 'vitest';
import { INTITULES, SERVICES, graineDe, phraseProfil, serviceDe, tirerIntitule } from './intitule';

/**
 * Le parcours de première connexion : services, intitulés tirés (#325, D-148).
 *
 * Ce que ces tests gardent : le tirage est **seedé** (même entrée, même sortie), une relance
 * donne un autre tirage pour le même compte, chaque intitulé vient du catalogue, la phrase du
 * profil suit le gabarit du ticket, et aucun intitulé ne porte le vocabulaire interdit.
 */
describe('services du parcours', () => {
  it('compte les cinq groupes du ticket, dans son ordre', () => {
    expect(SERVICES.map((service) => service.code)).toEqual(['rez-de-chaussee', '1er', '2e', '3e', '4e']);
  });

  it('retrouve un service par son code, et rien pour un code inconnu', () => {
    expect(serviceDe('2e')?.libelle).toBe('2ème');
    expect(serviceDe('sous-sol')).toBeUndefined();
    expect(serviceDe(null)).toBeUndefined();
  });
});

describe('tirage de l’intitulé', () => {
  it('est déterministe : même compte, même nombre de relances, même intitulé', () => {
    expect(tirerIntitule('compte-a', 0)).toBe(tirerIntitule('compte-a', 0));
    expect(tirerIntitule('compte-a', 1)).toBe(tirerIntitule('compte-a', 1));
  });

  it('tire toujours dans le catalogue', () => {
    for (const compte of ['a', 'b', 'c', '11111111-1111-4111-8111-111111111111']) {
      for (const relances of [0, 1]) {
        expect(INTITULES).toContain(tirerIntitule(compte, relances));
      }
    }
  });

  it('une relance change le tirage pour un même compte, au moins pour une partie des comptes', () => {
    // Le hachage est fixe : on ne compte pas sur un comptage exact, seulement sur le fait
    // qu'une relance **peut** changer le tirage (sinon elle ne servirait à rien).
    const comptes = Array.from({ length: 40 }, (_, i) => `compte-${i}`);
    const changes = comptes.filter((compte) => tirerIntitule(compte, 0) !== tirerIntitule(compte, 1));
    expect(changes.length).toBeGreaterThan(0);
  });

  it('le hachage de la graine reste dans 32 bits et ne tombe pas sur la même valeur pour deux textes proches', () => {
    expect(graineDe('compte-a|0')).toBeGreaterThanOrEqual(0);
    expect(graineDe('compte-a|0')).toBeLessThan(2 ** 32);
    expect(graineDe('compte-a|0')).not.toBe(graineDe('compte-a|1'));
  });

  it('le catalogue ne porte aucun mot interdit (AGENTS.md §3.1)', () => {
    for (const intitule of INTITULES) {
      expect(intitule).not.toMatch(/galère|pokémon|galerodex/i);
      expect(intitule.length).toBeGreaterThan(0);
      expect(intitule.length).toBeLessThanOrEqual(80);
    }
  });
});

describe('phrase du profil', () => {
  it('suit le gabarit du ticket', () => {
    expect(phraseProfil({ pseudo: 'Anaïs', service: '2e', intitule: 'sculpteur de fumée' })).toBe(
      'Anaïs / planqué du 2ème — sculpteur de fumée'
    );
  });

  it('accorde le groupe du rez-de-chaussée', () => {
    expect(phraseProfil({ pseudo: 'Léo', service: 'rez-de-chaussee', intitule: 'gardien du café froid' })).toBe(
      'Léo / planqué du rez-de-chaussée — gardien du café froid'
    );
  });
});
