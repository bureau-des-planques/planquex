import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { APP_STAGE, APP_VERSION, APP_VERSION_LABEL, stageOf } from './version';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Le paquet lu sur le disque : c'est lui la source, pas la constante injectée. */
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

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
    expect(APP_VERSION_LABEL).toBe(`v${pkg.version}`);
  });

  it('déduit l’étape du numéro, elle ne se saisit pas', () => {
    expect(stageOf('0.2.0-alpha.1')).toBe('alpha');
    expect(stageOf('0.2.0-beta.12')).toBe('beta');
    expect(stageOf('0.2.0')).toBe('release');
    expect(stageOf('1.0.0')).toBe('release');
    expect(APP_STAGE).toBe(stageOf(pkg.version));
  });

  it('n’a aucun numéro de version écrit à la main dans src/', () => {
    expect(versionsEnDurDansSrc()).toEqual([]);
  });

  // Le contrôle doit pouvoir échouer : sans ce cas, la garde du dessus ne garde rien.
  it('le contrôle mord : un numéro en dur est bien détecté', () => {
    expect(versionsEnDur('faux.ts', 'const affichee = "9.9.9";')).toEqual([
      'faux.ts : 9.9.9',
    ]);
    expect(versionsEnDur('faux.tsx', '<span>v1.2.3-beta.4</span>')).toEqual([
      'faux.tsx : v1.2.3-beta.4',
    ]);
  });
});
