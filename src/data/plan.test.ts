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

/**
 * **Les trois critères de sortie d'alpha, écrits en clair** — le contenu attendu, pas la
 * référence (#375).
 *
 * Le test affirmait `expect(alpha?.criteres).toEqual(CRITERES_ALPHA)` alors que `plan.ts`
 * pose `criteres: CRITERES_ALPHA` : la **même référence**, donc une valeur comparée à
 * elle-même. Il ne pouvait échouer que sur une copie littérale réintroduite, et laissait
 * passer la dérive réelle — un critère retiré de la liste, le (b) qui avait déjà disparu
 * de la page. La liste est donc recopiée ici **mot pour mot**, pour que la retirer ou
 * changer un mot la fasse échouer :
 *
 * - (a) « cinq testeurs réels… » — D-056 (a), reformulé par D-117 (1), **mesuré** par D-123 ;
 * - (b) « plus aucun bug qui casse la boucle… » — D-056, jamais amendé ;
 * - (c) « la Journée d'intégration est finie » — D-056, jamais amendé.
 *
 * Ce n'est pas une deuxième source : c'est l'**attendu** que la source doit satisfaire.
 * Changer la formulation d'un critère se fait dans D-117 ou D-056, puis ici.
 */
const CRITERES_ALPHA_ATTENDUS: ElementPlan[] = [
  {
    texte:
      'Cinq testeurs réels ont terminé une partie complète — mesuré dans les traces de combat, pas déclaré.',
    decision: 'D-123'
  },
  {
    texte: 'Plus aucun bug qui casse la boucle n’est ouvert.',
    decision: 'D-056'
  },
  {
    texte: 'La Journée d’intégration est finie.',
    decision: 'D-056'
  }
];

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
  it('sont ceux de la décision, mot pour mot et dans l’ordre', () => {
    // Les trois critères de D-056 (a) à (c), et pas un de plus : le (d) est sorti de
    // l'alpha le 27/10/2026 (D-117), et une liste qui gonfle repousse indéfiniment le
    // passage à la beta — c'est la raison d'être de la décision. Le contenu est comparé à
    // l'**attendu écrit en clair** (`CRITERES_ALPHA_ATTENDUS`), pas à la constante
    // elle-même : c'est ce qui fait mordre le test (#375).
    expect(CRITERES_ALPHA).toEqual(CRITERES_ALPHA_ATTENDUS);
    expect(sansDecision(CRITERES_ALPHA)).toEqual([]);
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

  it('le jalon alpha porte les trois critères de sortie, pas une copie partielle', () => {
    // Constat du 27/10/2026 : `JALONS` reprenait D-056 en oubliant le (b), donc la feuille
    // de route affichait **deux** critères là où la décision en pose **trois**. Le jalon
    // reprend `CRITERES_ALPHA`, et l'attendu est écrit **en clair** (#375) : une copie qui
    // prend du retard, ou un mot changé dans le jalon, échoue ici aussi.
    const alpha = JALONS.find((jalon) => jalon.etape === 'alpha');
    expect(alpha?.criteres).toEqual(CRITERES_ALPHA_ATTENDUS);
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
