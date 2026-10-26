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
const root = resolve(import.meta.dirname, '..');

function plan(): { ecrans: string[]; port: number; seuil: number; baseline: Record<string, number | null> } {
  const sortie = execFileSync(process.execPath, ['scripts/detect-ui-pages.mjs', '--plan'], {
    cwd: root,
    encoding: 'utf8'
  });
  return JSON.parse(sortie) as {
    ecrans: string[];
    port: number;
    seuil: number;
    baseline: Record<string, number | null>;
  };
}

function sonde(
  sortieImpeccable: string,
  code = 0
): { compte: number | null; echec: boolean; message: string | null } {
  try {
    const resultat = execFileSync(
      process.execPath,
      ['scripts/detect-ui-pages.mjs', '--controle', sortieImpeccable, '--code', String(code)],
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

describe('le contrôle visuel en CI (#205, #208)', () => {
  it('contrôle les cinq écrans qui existent, sur un port qui n’est pas celui des captures', () => {
    const { ecrans, port, seuil } = plan();
    // `/settings` est la route réelle : `/reglages` rendait l'écran 404 (#208).
    expect(ecrans).toEqual(['/', '/collection', '/deck', '/battle', '/settings']);
    expect(port).not.toBe(4180);
    expect(seuil).toBe(0);
  });

  it('ne gèle plus aucun écran derrière un `null` (#208)', () => {
    const { baseline } = plan();
    expect(baseline).toEqual({ '/': 0, '/collection': 32, '/deck': 11, '/battle': 0, '/settings': 1 });
    expect(Object.values(baseline).every((plafond) => typeof plafond === 'number')).toBe(true);
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
