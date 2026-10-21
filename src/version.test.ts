import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { APP_LABEL, APP_STAGE, APP_VERSION, asStage } from './version';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Le paquet lu sur le disque : c'est lui la source, pas la constante injectée. */
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string; stage: string };

/** Tous les fichiers source, hors tests. */
function fichiersSource(dossier = SRC): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return fichiersSource(chemin);
    if (!/\.(ts|tsx)$/.test(entree)) return [];
    if (/\.test\.(ts|tsx)$/.test(entree)) return [];
    return [chemin];
  });
}

/**
 * Cherche un numéro de version écrit à la main dans une source.
 *
 * Prend le **texte**, pas le chemin : c'est ce qui permet d'éprouver le contrôle
 * sur un cas fautif fabriqué (voir le dernier test).
 */
function versionsEnDur(nom: string, source: string): string[] {
  const semver = /\bv?\d+\.\d+\.\d+(?:-[a-z0-9.]+)?\b/g;
  return (source.match(semver) ?? []).map((trouve) => `${nom} : ${trouve}`);
}

/**
 * `version.ts` est le seul fichier autorisé à manipuler la version, et il ne la
 * contient jamais en dur : il la reçoit au build. Tout le reste doit passer par lui.
 */
function versionsEnDurDansSrc(): string[] {
  return fichiersSource().flatMap((fichier) => {
    const nom = fichier.slice(SRC.length);
    if (nom === 'version.ts') return [];
    return versionsEnDur(nom, readFileSync(fichier, 'utf8'));
  });
}

describe('version de l’application', () => {
  it('vient de package.json, et de nulle part ailleurs', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_LABEL).toBe(`${APP_STAGE === 'alpha' ? 'Alpha' : APP_STAGE === 'beta' ? 'Bêta' : 'Version finale'} · ${pkg.version}`);
  });

  it('porte l’étape en clair, à côté du numéro (D-050)', () => {
    // Le numéro reste une version ordinaire : aucun `-alpha.N` dedans.
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(['alpha', 'beta', 'release']).toContain(APP_STAGE);
    expect(APP_STAGE).toBe(pkg.stage);
  });

  it('retombe sur l’étape la plus prudente si le mot est inconnu', () => {
    expect(asStage('alpha')).toBe('alpha');
    expect(asStage('beta')).toBe('beta');
    expect(asStage('release')).toBe('release');
    // Un mot inventé ne doit jamais faire croire à une version finale.
    expect(asStage('gamma')).toBe('alpha');
    expect(asStage('')).toBe('alpha');
  });

  it('n’a aucun numéro de version écrit à la main dans src/', () => {
    expect(versionsEnDurDansSrc()).toEqual([]);
  });

  // Le contrôle doit pouvoir échouer : sans ce cas, la garde du dessus ne garde rien.
  it('le contrôle mord : un numéro en dur est bien détecté', () => {
    expect(versionsEnDur('faux.ts', 'const affichee = "9.9.9";')).toEqual([
      'faux.ts : 9.9.9',
    ]);
    expect(versionsEnDur('faux.tsx', '<span>v1.2.3</span>')).toEqual([
      'faux.tsx : v1.2.3',
    ]);
  });
});
