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
 * des sorties d'`impeccable` fabriquées, il ne relit pas une chaîne du source.
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

function sonde(sortieImpeccable: string): { compte: number | null; echec: boolean; message: string | null } {
  try {
    const resultat = execFileSync(
      process.execPath,
      ['scripts/detect-ui-pages.mjs', '--controle', sortieImpeccable],
      { cwd: root, encoding: 'utf8' }
    );
    return JSON.parse(resultat) as { compte: number | null; echec: boolean; message: string | null };
  } catch (erreur) {
    // La sonde sort 1 quand elle refuse : la sortie reste sur `stdout`.
    const e = erreur as { stdout?: string };
    return JSON.parse(e.stdout ?? '{}') as { compte: number | null; echec: boolean; message: string | null };
  }
}

describe('le contrôle visuel en CI (#205)', () => {
  it('contrôle les cinq écrans qui existent, sur un port qui n’est pas celui des captures', () => {
    const { ecrans, port, seuil } = plan();
    expect(ecrans).toEqual(['/', '/collection', '/deck', '/battle', '/reglages']);
    expect(port).not.toBe(4180);
    expect(seuil).toBe(0);
    expect(plan().baseline).toEqual({ '/': null, '/collection': 32, '/deck': 11, '/battle': 0, '/reglages': null });
  });

  it('ne refuse pas une page propre', () => {
    const verdict = sonde('✔ http://127.0.0.1:4179/battle\n\n0 anti-patterns found.\n');
    expect(verdict.compte).toBe(0);
    expect(verdict.echec).toBe(false);
    expect(verdict.message).toBeNull();
  });

  it('refuse une page qui porte un anti-pattern, et le dit', () => {
    const verdict = sonde('2 anti-patterns found.\n\n── Advisory (not counted as failures) ──\n[flat-type-hierarchy]\n');
    expect(verdict.compte).toBe(2);
    expect(verdict.echec).toBe(true);
    expect(verdict.message).toContain('2 anti-patterns');
  });

  it('ne compte pas les avis', () => {
    const verdict = sonde('0 anti-patterns found.\n\n── Advisory (not counted as failures) ──\n[repeating-stripes-gradient]\n');
    expect(verdict.compte).toBe(0);
    expect(verdict.echec).toBe(false);
  });

  it('refuse une sortie qui ne dit rien : un contrôle qui n’a pas tourné n’est pas un contrôle vert', () => {
    const verdict = sonde('Error: net::ERR_CONNECTION_REFUSED\n');
    expect(verdict.compte).toBeNull();
    expect(verdict.echec).toBe(true);
  });
});
