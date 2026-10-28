import { describe, expect, it } from 'vitest';
import {
  avancer,
  COURSE_DECHIRURE,
  COURSE_ETIQUETTE,
  creer,
  demarrer,
  moments,
  relacher,
  SEUIL_DECHIRURE,
  SEUIL_ETIQUETTE,
  zone,
  type EtatOuverture,
  type Geometrie
} from './etats';

/**
 * **Les quatre temps de l'ouverture d'un Arrivage** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Chaque règle est confrontée à un **cas fautif** (AGENTS.md §6) : un test qui ne peut pas échouer
 * ne garde rien. Les seuils sont lus sur les constantes, jamais recopiés ici — un réglage change
 * dans `etats.ts` et ces tests le suivent.
 */
const GEO: Geometrie = { largeur: 315, ligne: 42, tolerance: 25 };
const BOITE_ETIQUETTE = { x: 90, y: 56, w: 135, h: 62 };

/** Un appui au centre de l'étiquette, et le chemin jusqu'à la détacher. */
function detacher(depuis: EtatOuverture): EtatOuverture {
  let etat = demarrer(depuis, zone(depuis, 150, 80, BOITE_ETIQUETTE, GEO));
  etat = avancer(etat, 0, -COURSE_ETIQUETTE * 0.8, GEO);
  return relacher(etat);
}

describe('l’ouverture d’un Arrivage — la machine des quatre temps (#283)', () => {
  it('un appui hors de l’étiquette et loin de la ligne ne prend rien (le contrôle mord)', () => {
    // Sans ce cas, `demarrer` serait « vrai » sur n'importe quel appui et le test suivant ne
    // prouverait rien.
    expect(zone(creer(), 150, 300, BOITE_ETIQUETTE, GEO)).toBeNull();
    expect(demarrer(creer(), null).phase).toBe('ferme');
  });

  it('l’étiquette s’attrape sur sa boîte, et seulement sachet fermé', () => {
    expect(zone(creer(), 150, 80, BOITE_ETIQUETTE, GEO)).toBe('etiquette');
    const dechire: EtatOuverture = { phase: 'dechirure', etiquette: 1, dechirure: 0 };
    expect(zone(dechire, 150, 80, BOITE_ETIQUETTE, GEO)).toBeNull();
  });

  it('lâchée sous le seuil, l’étiquette se recolle et le sachet redevient fermé', () => {
    let etat = demarrer(creer(), 'etiquette');
    etat = avancer(etat, 0, -(COURSE_ETIQUETTE * (SEUIL_ETIQUETTE - 0.1)), GEO);
    etat = relacher(etat);
    expect(etat.phase).toBe('ferme');
    expect(etat.etiquette).toBe(0);
  });

  it('lâchée au-delà du seuil, elle se détache et ouvre le temps de la déchirure', () => {
    const etat = detacher(creer());
    expect(etat.phase).toBe('dechirure');
    expect(etat.etiquette).toBe(1);
  });

  it('l’étiquette ne redescend pas pendant le glissement, même si le doigt revient', () => {
    let etat = demarrer(creer(), 'etiquette');
    etat = avancer(etat, 0, -COURSE_ETIQUETTE * 0.7, GEO);
    const haut = etat.etiquette;
    etat = avancer(etat, 0, -4, GEO);
    expect(etat.etiquette).toBe(haut);
  });

  it('la déchirure, elle, suit le doigt dans les deux sens : c’est ce qui la rend annulable', () => {
    let etat = detacher(creer());
    etat = demarrer(etat, 'dechirure');
    etat = avancer(etat, GEO.largeur * COURSE_DECHIRURE * 0.4, 0, GEO);
    const milieu = etat.dechirure;
    etat = avancer(etat, GEO.largeur * COURSE_DECHIRURE * 0.2, 0, GEO);
    expect(etat.dechirure).toBeLessThan(milieu);
  });

  it('lâchée avant la fin, la déchirure revient à zéro et le sachet reste fermé', () => {
    let etat = detacher(creer());
    etat = demarrer(etat, 'dechirure');
    etat = avancer(etat, GEO.largeur * COURSE_DECHIRURE * (SEUIL_DECHIRURE - 0.15), 0, GEO);
    etat = relacher(etat);
    expect(etat.phase).toBe('dechirure');
    expect(etat.dechirure).toBe(0);
  });

  it('la ligne parcourue en entier ouvre le sachet', () => {
    let etat = detacher(creer());
    etat = demarrer(etat, 'dechirure');
    etat = avancer(etat, GEO.largeur * COURSE_DECHIRURE, 0, GEO);
    etat = relacher(etat);
    expect(etat.phase).toBe('ouvert');
  });

  it('aucun chemin ne mène à « ouvert » sans passer par la déchirure', () => {
    // Deux tentatives fautives : relâcher une étiquette, et relâcher un sachet fermé.
    const apresEtiquette = relacher(demarrer(creer(), 'etiquette'));
    expect(apresEtiquette.phase).not.toBe('ouvert');
    expect(relacher(creer()).phase).toBe('ferme');
    // Et un appui près de la ligne, sachet fermé, ne prend rien : rien à déchirer.
    expect(zone(creer(), 150, GEO.ligne, BOITE_ETIQUETTE, GEO)).toBeNull();
  });

  it('les moments sonorisés racontent le geste, et ne se répètent pas', () => {
    const ferme = creer();
    const etiquette = demarrer(ferme, 'etiquette');
    expect(moments(ferme, etiquette)).toEqual(['contact']);
    const dechire = detacher(ferme);
    expect(moments(etiquette, dechire)).toEqual(['dechirure']);
    let ouvert = demarrer(dechire, 'dechirure');
    ouvert = relacher(avancer(ouvert, GEO.largeur * COURSE_DECHIRURE, 0, GEO));
    expect(moments(dechire, ouvert)).toEqual(['ouverture']);
    // Une fois ouvert, plus rien : un second relâchement ne rejoue pas le son.
    expect(moments(ouvert, relacher(ouvert))).toEqual([]);
  });
});
