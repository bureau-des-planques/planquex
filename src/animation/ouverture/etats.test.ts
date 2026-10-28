import { describe, expect, it } from 'vitest';
import {
  avancer,
  COURSE_DECHIRURE,
  creer,
  demarrer,
  moments,
  relacher,
  SEUIL_DECHIRURE,
  surLaLigne,
  type EtatOuverture,
  type Geometrie
} from './etats';

/**
 * **La déchirure d'un Arrivage** (#283, `docs/SPEC-OUVERTURE-ARRIVAGE.md`).
 *
 * Chaque règle est confrontée à un **cas fautif** (AGENTS.md §6) : un test qui ne peut pas échouer
 * ne garde rien. Les seuils sont lus sur les constantes, jamais recopiés ici — un réglage change
 * dans `etats.ts` et ces tests le suivent.
 */
const GEO: Geometrie = { largeur: 300, ligne: 44, tolerance: 30 };
const COURSE = GEO.largeur * COURSE_DECHIRURE;

/** Un geste complet depuis le bord gauche, jusqu'à une fraction `p` de la course. */
function glisser(p: number, depuis: EtatOuverture = creer()): EtatOuverture {
  return avancer(demarrer(depuis, 10, GEO), COURSE * p, GEO);
}

describe('l’ouverture d’un Arrivage — la déchirure (#283)', () => {
  it('la ligne ne se prend que près des pointillés (le contrôle mord)', () => {
    expect(surLaLigne(creer(), GEO.ligne, GEO)).toBe(true);
    expect(surLaLigne(creer(), GEO.ligne + GEO.tolerance, GEO)).toBe(true);
    // Le cas fautif : un appui au milieu du sachet ne doit rien déchirer.
    expect(surLaLigne(creer(), GEO.ligne + GEO.tolerance + 1, GEO)).toBe(false);
    expect(surLaLigne(creer(), 300, GEO)).toBe(false);
  });

  it('un sachet ouvert ne se reprend plus', () => {
    const ouvert: EtatOuverture = { phase: 'ouvert', dechirure: 1, sens: 1 };
    expect(surLaLigne(ouvert, GEO.ligne, GEO)).toBe(false);
    expect(demarrer(ouvert, 10, GEO)).toBe(ouvert);
  });

  it('la déchirure part du bord le plus proche de l’appui', () => {
    expect(demarrer(creer(), 20, GEO).sens).toBe(1);
    expect(demarrer(creer(), 280, GEO).sens).toBe(-1);
  });

  it('elle suit le doigt dans son sens, et un glissement à rebours ne déchire rien', () => {
    expect(glisser(0.5).dechirure).toBeCloseTo(0.5);
    const aRebours = avancer(demarrer(creer(), 10, GEO), -COURSE, GEO);
    expect(aRebours.dechirure).toBe(0);
    // Depuis la droite, c'est l'inverse : le doigt va vers la gauche.
    const depuisDroite = avancer(demarrer(creer(), 290, GEO), -COURSE * 0.5, GEO);
    expect(depuisDroite.dechirure).toBeCloseTo(0.5);
  });

  it('elle suit le doigt dans les deux sens : revenir en arrière la referme', () => {
    let etat = glisser(0.8);
    etat = avancer(etat, COURSE * 0.3, GEO);
    expect(etat.dechirure).toBeCloseTo(0.3);
  });

  it('elle est bornée à [0, 1], même si le doigt sort du sachet', () => {
    expect(glisser(3).dechirure).toBe(1);
  });

  it('lâchée juste sous le seuil, elle se referme', () => {
    const etat = relacher(glisser(SEUIL_DECHIRURE - 0.01));
    expect(etat.phase).toBe('ferme');
    expect(etat.dechirure).toBe(0);
  });

  it('lâchée au seuil exact, le sachet s’ouvre', () => {
    const etat = relacher(glisser(SEUIL_DECHIRURE));
    expect(etat.phase).toBe('ouvert');
    expect(etat.dechirure).toBe(1);
  });

  it('`ouvert` n’est atteignable que par la déchirure : relâcher un sachet fermé ne fait rien', () => {
    expect(relacher(creer())).toEqual(creer());
    // Avancer sans avoir démarré ne déchire rien non plus.
    expect(avancer(creer(), COURSE, GEO).dechirure).toBe(0);
  });

  it('les moments sonores suivent les phases franchies', () => {
    const debut = demarrer(creer(), 10, GEO);
    expect(moments(creer(), debut)).toEqual(['contact']);
    expect(moments(debut, relacher(glisser(1)))).toEqual(['ouverture']);
    // Le cas fautif : une déchirure qui avance n'est pas un nouveau contact.
    expect(moments(debut, glisser(0.4))).toEqual([]);
  });
});
