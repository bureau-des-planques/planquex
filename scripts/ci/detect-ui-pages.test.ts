// Lenteur justifiée (D-143 (5)) — les cas exercent le cliquet d'écrans sur des sorties fabriquées
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Le **contrôle visuel en CI** (#205) : `impeccable detect` sur de vraies pages.
 *
 * `npm run detect:ui` ne fait que du regex sur les sources — son propre message dit
 * « findings are an undercount » — et il a laissé passer deux `nested-cards` que le détecteur
 * en navigateur voyait. Ce contrôle-là doit donc **mordre** : un anti-pattern échoue, un avis
 * ne fait que parler.
 *
 * Le test joue la sonde `--controle`, sans navigateur ni réseau : il confronte le vrai code à
 * des sorties `--json` fabriquées, il ne relit pas une chaîne du source.
 *
 * **#208** : la mesure vient du **JSON** et du **code de sortie**. Le détecteur ne dit rien
 * d'une page propre, donc une sortie vide n'est pas une panne — et `[]` avec le code 1 en est
 * une. Les deux cas sont testés ici, parce que les confondre est exactement le défaut d'origine.
 */
const root = resolve(import.meta.dirname, '..', '..');

/**
 * Les écrans que le ticket **#234** exige : publics, et de compte. Le contrôle peut en
 * mesurer d'autres, il ne peut pas en **perdre** un en silence — c'est le cliquet de
 * couverture, distinct de celui des comptes.
 */
const ECRANS_EXIGES = [
  '/',
  '/collection',
  '/deck',
  '/battle',
  '/settings',
  '/comite',
  '/comite/suivi',
  '/feuille-de-route',
  // `/installation` est sorti de la mesure d'écran servi (D-155, #514) : hors du jeu, il se
  // vérifie à la main sur téléphone avant fusion. La couverture ne le perd donc pas en silence.
  '/connexion',
  '/attente',
  '/confidentialite',
  '/administration'
];

interface Plan {
  ecrans: string[];
  port: number;
  seuil: number;
  baseline: Record<string, number | null>;
  sansPlafond: string[];
}

function plan(): Plan {
  const sortie = execFileSync(process.execPath, ['scripts/ci/detect-ui-pages.mjs', '--plan'], {
    cwd: root,
    encoding: 'utf8'
  });
  return JSON.parse(sortie) as Plan;
}

/**
 * La sonde du **contrôle des plafonds** (#234) : joue la règle sur un plan fourni, sans
 * navigateur. C'est ce qui permet au test de **mordre** avec un écran fautif, au lieu de
 * relire une chaîne du source.
 */
function sondePlan(
  ecrans: string[],
  baseline: Record<string, number | null>
): { sansPlafond: string[]; echec: boolean } {
  try {
    const sortie = execFileSync(
      process.execPath,
      ['scripts/ci/detect-ui-pages.mjs', '--controle-plan', JSON.stringify({ ecrans, baseline })],
      { cwd: root, encoding: 'utf8' }
    );
    return JSON.parse(sortie) as { sansPlafond: string[]; echec: boolean };
  } catch (erreur) {
    // La sonde sort 1 quand elle refuse : la sortie reste sur `stdout`.
    return JSON.parse((erreur as { stdout?: string }).stdout ?? '{}') as {
      sansPlafond: string[];
      echec: boolean;
    };
  }
}

function sonde(sortieImpeccable: string, code = 0): { compte: number | null; echec: boolean; message: string | null } {
  try {
    const resultat = execFileSync(
      process.execPath,
      ['scripts/ci/detect-ui-pages.mjs', '--controle', sortieImpeccable, '--code', String(code)],
      { cwd: root, encoding: 'utf8' }
    );
    return JSON.parse(resultat) as { compte: number | null; echec: boolean; message: string | null };
  } catch (erreur) {
    // La sonde sort 1 quand elle refuse : la sortie reste sur `stdout`.
    const e = erreur as { stdout?: string };
    return JSON.parse(e.stdout ?? '{}') as { compte: number | null; echec: boolean; message: string | null };
  }
}

/** Un constat d'`impeccable detect --json`, réduit à ce que le comptage regarde. */
function constat(antipattern: string, advisory = false): Record<string, unknown> {
  return advisory ? { antipattern, severity: 'advisory', advisory: true } : { antipattern, severity: 'warning' };
}

describe('le contrôle visuel en CI (#205, #208, #234)', () => {
  it('contrôle les écrans publics et de compte, sur un port qui n’est pas celui des captures', () => {
    const { ecrans, port, seuil } = plan();
    // Chaque écran nommé par #234 est mesuré : une page qu'un invité voit sans être
    // regardée par le détecteur est une régression visuelle qui passe au vert.
    for (const ecran of ECRANS_EXIGES) expect(ecrans, ecran).toContain(ecran);
    // `/settings` est la route réelle : `/reglages` rendait l'écran 404 (#208).
    expect(ecrans).toContain('/settings');
    expect(port).not.toBe(4180);
    expect(seuil).toBe(0);
  });

  it('donne un plafond **mesuré** à chaque écran, et jamais `null` (#208)', () => {
    const { ecrans, baseline, sansPlafond } = plan();
    // Un écran mesuré sans plafond est refusé plus bas ; ici, aucun n'est dans ce cas.
    expect(sansPlafond).toEqual([]);
    for (const ecran of ecrans) expect(typeof baseline[ecran], ecran).toBe('number');
  });

  it('refuse un écran sans plafond : le contrôle mord (#234)', () => {
    const { ecrans, baseline } = plan();
    // Le cas fautif : un écran ajouté à la mesure sans son compte.
    const fautif = sondePlan([...ecrans, '/ecran-sans-plafond'], baseline);
    expect(fautif.echec).toBe(true);
    expect(fautif.sansPlafond).toEqual(['/ecran-sans-plafond']);
    // Et un plafond `null` n'est pas un plafond : c'est le défaut corrigé par #208.
    expect(sondePlan(['/a'], { '/a': null }).echec).toBe(true);
    // Un plan complet passe : la sonde ne refuse pas tout.
    expect(sondePlan(['/a'], { '/a': 0 }).echec).toBe(false);
  });

  it('exige une capture pour chaque écran mesuré (AGENTS.md §6, D-060)', () => {
    // `npm run capturer` photographie des routes : un écran mesuré mais jamais photographié
    // n'est pas *regardé*, et D-060 demande justement qu'on regarde les captures.
    const photos = JSON.parse(
      execFileSync(process.execPath, ['scripts/preuves/capturer.mjs', '--plan'], {
        cwd: root,
        encoding: 'utf8',
        // Vitest exporte `BASE_URL` (Vite aussi) : le script des captures exige une URL
        // absolue et refuse `/`. On lui donne la sienne, sans démarrer de serveur.
        env: { ...process.env, BASE_URL: 'http://localhost:4180' }
      })
    ) as { captures: { route: string }[] };
    const routes = new Set(photos.captures.map((capture) => capture.route));
    for (const ecran of plan().ecrans) expect(routes.has(ecran), ecran).toBe(true);
  });

  it('lit une page propre : un tableau vide est un résultat, pas un silence', () => {
    const verdict = sonde('[]\n');
    expect(verdict.compte).toBe(0);
    expect(verdict.echec).toBe(false);
    expect(verdict.message).toBeNull();
  });

  it('refuse une page qui porte un anti-pattern, et le dit', () => {
    const verdict = sonde(JSON.stringify([constat('nested-cards'), constat('line-length')]));
    expect(verdict.compte).toBe(2);
    expect(verdict.echec).toBe(true);
    expect(verdict.message).toContain('2 anti-patterns');
  });

  it('ne compte pas les avis', () => {
    const verdict = sonde(JSON.stringify([constat('repeating-stripes-gradient', true)]));
    expect(verdict.compte).toBe(0);
    expect(verdict.echec).toBe(false);
  });

  it('refuse une sortie qui ne dit rien : un contrôle qui n’a pas tourné n’est pas un contrôle vert', () => {
    const verdict = sonde('Error: net::ERR_CONNECTION_REFUSED\n', 1);
    expect(verdict.compte).toBeNull();
    expect(verdict.echec).toBe(true);
  });

  it('refuse un `[]` accompagné du code 1 : la cible n’a pas été scannée (#208)', () => {
    const verdict = sonde('[]\n', 1);
    expect(verdict.compte).toBeNull();
    expect(verdict.echec).toBe(true);
    expect(verdict.message).toContain('code de sortie 1');
  });
});
