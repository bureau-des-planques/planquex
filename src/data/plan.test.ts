import { describe, expect, it } from 'vitest';
import {
  CRITERES_ALPHA,
  DECIDE_PLUS_TARD,
  ETAPE_EN_COURS,
  FIGE_PENDANT_ALPHA,
  JALONS,
  PAS_MAINTENANT,
  type ElementPlan
} from './plan';

/**
 * **La feuille de route écrite à la main** (`src/data/plan.ts`, D-097 (3), #214).
 *
 * La page `/feuille-de-route` montre trois choses qui ne se génèrent pas : l'**étape en
 * cours**, les **critères de sortie d'alpha** (D-056) et les **jalons** (D-048). Ce test
 * garde ce qui fait leur valeur — chacun **cite la décision** qui le fonde — et ce qui
 * fait leur limite : les modes parkés de D-019 n'y entrent **jamais**.
 *
 * Chaque assertion peut échouer : un critère sans source est un avis, pas une règle.
 */

/** Une décision citée : `D-019`, `D-056`… trois chiffres, préfixés par `D-`. */
const DECISION = /^D-\d{3}$/;

/** Les entrées dont la décision manque — extrait pour pouvoir le confronter à un cas fautif. */
function sansDecision(entrees: ElementPlan[]): string[] {
  return entrees.filter((entree) => !DECISION.test(entree.decision)).map((entree) => entree.texte);
}

describe('plan — l’étape en cours', () => {
  it('est nommée et dit ce qu’on y cherche', () => {
    expect(ETAPE_EN_COURS.nom).toBe('alpha');
    expect(ETAPE_EN_COURS.texte.trim()).not.toBe('');
    // L'étape vient de D-048 : on ne l'invente pas dans la page.
    expect(ETAPE_EN_COURS.decision).toBe('D-048');
  });
});

describe('plan — les critères de sortie d’alpha (D-056)', () => {
  it('sont ceux de la décision, chacun avec sa source', () => {
    // Les trois critères de D-056 (a) à (c), et pas un de plus : le (d) est sorti de
    // l'alpha le 27/10/2026 (D-117), et une liste qui gonfle repousse indéfiniment le
    // passage à la beta — c'est la raison d'être de la décision.
    expect(CRITERES_ALPHA).toHaveLength(3);
    expect(sansDecision(CRITERES_ALPHA)).toEqual([]);
    for (const critere of CRITERES_ALPHA) {
      // (a) est reformulé par D-117 ; (b) et (c) restent ceux de D-056.
      expect(['D-056', 'D-117'], critere.texte).toContain(critere.decision);
      expect(critere.texte.trim()).not.toBe('');
    }
  });

  it('le contrôle mord : un critère sans décision est signalé', () => {
    expect(sansDecision([{ texte: 'Une envie', decision: 'parce que' }])).toEqual(['Une envie']);
  });
});

describe('plan — les jalons (D-048)', () => {
  it('suivent alpha, beta, release, dans cet ordre', () => {
    expect(JALONS.map((jalon) => jalon.etape)).toEqual(['alpha', 'beta', 'release']);
    for (const jalon of JALONS) {
      expect(jalon.texte.trim(), `texte de ${jalon.etape}`).not.toBe('');
      expect(jalon.criteres.length, `critères de ${jalon.etape}`).toBeGreaterThan(0);
      expect(sansDecision(jalon.criteres), `sources de ${jalon.etape}`).toEqual([]);
    }
  });

  it('n’écrit aucun numéro de version : la version vit dans package.json', () => {
    // `src/version.test.ts` refuse déjà un numéro en dur dans `src/` ; on le dit ici pour
    // que la raison soit lisible au bon endroit — un jalon se nomme « beta », jamais « 0.2.x ».
    const texte = JSON.stringify([ETAPE_EN_COURS, CRITERES_ALPHA, JALONS, DECIDE_PLUS_TARD]);
    expect(texte).not.toMatch(/\b\d+\.\d+\.\d+\b/);
  });
});

describe('plan — ce qui est décidé pour plus tard (D-061)', () => {
  it('porte les quatre contenus renvoyés à la release, avec leur source', () => {
    const textes = DECIDE_PLUS_TARD.map((element) => element.texte).join(' ');
    for (const mot of ['Pause café', 'Boutique du CSE', 'Missions', 'Succès']) {
      expect(textes, `${mot} manque`).toContain(mot);
    }
    expect(sansDecision(DECIDE_PLUS_TARD)).toEqual([]);
  });

  it('garde la réserve écrite sur la Pause café', () => {
    // C'est le seul des quatre qui donne des cartes : D-061 en fait le candidat à remonter
    // en beta. La page qui l'annonce doit dire pourquoi, sinon la réserve se perd.
    const pause = DECIDE_PLUS_TARD.find((element) => element.texte.includes('Pause café'));
    expect(pause?.note).toMatch(/cartes/);
  });
});

describe('plan — « pas maintenant » (D-056)', () => {
  it('liste ce qui ne bouge pas pendant l’alpha', () => {
    // La liste est explicite dans D-056 : sans elle, le backlog se remplit tout seul
    // pendant qu'on écoute les retours.
    for (const mot of ['Économie', 'Boutique du CSE', 'Missions', 'Classement']) {
      expect(PAS_MAINTENANT, `${mot} manque`).toContain(mot);
    }
    // Ce qui ne bouge pas pendant l'alpha a sa propre liste, avec sa raison.
    expect(FIGE_PENDANT_ALPHA.length).toBeGreaterThan(0);
    expect(sansDecision(FIGE_PENDANT_ALPHA)).toEqual([]);
  });
});

describe('plan — les modes parkés n’entrent pas (D-019)', () => {
  it('ne cite ni les règles maison ni les modes futurs', () => {
    // D-019 range `RULES-4b` et les modes parkés hors du standard : la feuille de route
    // est publique, donc elle ne les annonce pas — ce serait promettre un mode que
    // personne n'a acté.
    const texte = JSON.stringify([
      ETAPE_EN_COURS,
      CRITERES_ALPHA,
      JALONS,
      DECIDE_PLUS_TARD,
      PAS_MAINTENANT,
      FIGE_PENDANT_ALPHA
    ]);
    expect(texte).not.toMatch(/RULES-4b|MODES-FUTURS|mode parké/i);
  });
});
