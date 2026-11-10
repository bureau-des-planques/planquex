import { describe, expect, it } from 'vitest';
import {
  MOTS_MAX_REPLIQUE,
  MOTS_MIN_REPLIQUE,
  PHRASES_MAX_REPLIQUE,
  REPLIQUES_DIRECTION,
  type EvenementDirection
} from '@/data/repliques-direction';
import { choisirReplique, evenementDuJournal } from './repliques-direction';

/**
 * **Les répliques de la Direction** (30/10/2026 ; budget de D-195 (2) depuis le 10/11/2026) :
 * le ton, le budget, le déterminisme. Une vanne qui insulte, qui sort des 25 à 35 mots ou
 * qui change à chaque rejeu casse ce test. Le budget complet (mots, phrases, vocabulaire)
 * est celui de `src/data/direction-repliques.test.ts` ; ici, on garde la borne en vue du choix.
 */
const EVENEMENTS: EvenementDirection[] = ['ouverture', 'pression', 'craquage', 'victoire', 'defaite'];

describe('la Direction parle, dans le budget de D-195 (2)', () => {
  it('a au moins deux répliques par événement', () => {
    for (const evenement of EVENEMENTS) {
      expect(REPLIQUES_DIRECTION[evenement].length, evenement).toBeGreaterThanOrEqual(2);
    }
  });

  it('tient en 25 à 35 mots et 1 à 3 phrases : une idée et une chute, jamais un paragraphe', () => {
    for (const evenement of EVENEMENTS) {
      for (const ligne of REPLIQUES_DIRECTION[evenement]) {
        const mots = ligne.split(/\s+/).filter(Boolean).length;
        expect(mots, ligne).toBeGreaterThanOrEqual(MOTS_MIN_REPLIQUE);
        expect(mots, ligne).toBeLessThanOrEqual(MOTS_MAX_REPLIQUE);
        expect(ligne.split(/[.!?]/).filter((phrase) => phrase.trim()).length, ligne).toBeLessThanOrEqual(
          PHRASES_MAX_REPLIQUE
        );
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
