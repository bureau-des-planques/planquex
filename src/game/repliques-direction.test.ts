import { describe, expect, it } from 'vitest';
import {
  choisirReplique,
  evenementDuJournal,
  REPLIQUES_DIRECTION,
  type EvenementDirection
} from './repliques-direction';

/**
 * **Les répliques de la Direction** (30/10/2026) : le ton, la brièveté, le déterminisme.
 * Une vanne qui insulte, qui dépasse une ligne ou qui change à chaque rejeu casse ce test.
 */
const EVENEMENTS: EvenementDirection[] = ['ouverture', 'pression', 'craquage', 'victoire', 'defaite'];

describe('la Direction parle, mais court', () => {
  it('a au moins deux répliques par événement', () => {
    for (const evenement of EVENEMENTS) {
      expect(REPLIQUES_DIRECTION[evenement].length, evenement).toBeGreaterThanOrEqual(2);
    }
  });

  it('tient en une phrase courte', () => {
    for (const evenement of EVENEMENTS) {
      for (const ligne of REPLIQUES_DIRECTION[evenement]) {
        expect(ligne.length, ligne).toBeLessThanOrEqual(60);
        // Une phrase, ou une phrase et son entame (« Bon. ») : jamais un paragraphe.
        expect(ligne.split(/[.!?]/).filter((phrase) => phrase.trim()).length, ligne).toBeLessThanOrEqual(2);
      }
    }
  });

  it('n’emploie aucun mot interdit, et ne s’en prend à personne', () => {
    // Même liste que `journee-etapes.test.ts`, écrite coupée : le mot banni ne doit pas
    // apparaître dans `src/`, tests compris (`AGENTS.md` §8.4).
    const interdits = ['Gal' + 'ère', 'Gal' + 'èreMon', 'Pokémon', 'Gal' + 'érodex', 'HP', 'PV'];
    for (const evenement of EVENEMENTS) {
      for (const ligne of REPLIQUES_DIRECTION[evenement]) {
        for (const mot of interdits) expect(ligne).not.toContain(mot);
        // **Provocante, et une petite injure de temps en temps** (30/10/2026) : « bras
        // cassé » passe, comme dans un vrai couloir. Ce qui reste interdit, c'est ce qui
        // s'en prend à la personne et non à son travail : l'insulte gratuite, l'ableisme,
        // la vulgarité.
        expect(ligne).not.toMatch(/idiot|imbécile|débile|abruti|incompétent|crétin|mongol|connard|salope|putain/i);
      }
    }
  });
});

describe('la réplique est déterministe, comme le moteur', () => {
  it('le même tour dit la même phrase', () => {
    expect(choisirReplique('pression', 6)).toBe(choisirReplique('pression', 6));
  });

  it('deux tours différents ne disent pas toujours la même', () => {
    const lignes = new Set([0, 1, 2, 3].map((tour) => choisirReplique('pression', tour)));
    expect(lignes.size).toBeGreaterThan(1);
  });

  it('un tour négatif ne sort pas de la liste', () => {
    expect(REPLIQUES_DIRECTION.pression).toContain(choisirReplique('pression', -7));
  });
});

describe('le journal nomme l’événement', () => {
  it('reconnaît un craquage et une Pression', () => {
    expect(evenementDuJournal('Le Planqué adverse craque : 1 Intervention.')).toBe('craquage');
    expect(evenementDuJournal('Pression « Redémarrage à froid » : 50 de Stress.')).toBe('pression');
  });

  it('se tait quand il n’y a rien à dire', () => {
    expect(evenementDuJournal('Lancer de tampon : tu ouvres.')).toBeNull();
    expect(evenementDuJournal('')).toBeNull();
  });
});
