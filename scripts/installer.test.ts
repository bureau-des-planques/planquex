import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — module .mjs sans déclaration de types
import { verdict } from './installer.mjs';

/**
 * `npm run installer` — 26/10/2026 : un `npm ci` lancé dans le dépôt principal par un sous-agent
 * a vidé `node_modules/` pendant que la session d'infra y testait. Le contrôle est confronté à
 * ses cas fautifs, pas seulement au cas qui passe.
 */
const racine = fileURLToPath(new URL('..', import.meta.url));

describe('installer — le contrôle mord', () => {
  it('refuse le dépôt principal (git-dir = git-common-dir)', () => {
    const v = verdict({ gitDir: '/repo/.git', communDir: '/repo/.git', nodeModulesEstLien: false });
    expect(v.ok).toBe(false);
    expect(v.raison).toMatch(/Dépôt principal/);
  });

  it('accepte un worktree (git-dir distinct du git-common-dir)', () => {
    expect(verdict({ gitDir: '/repo/.git/worktrees/x', communDir: '/repo/.git', nodeModulesEstLien: false }).ok).toBe(true);
  });

  it('refuse un `node_modules` lien symbolique, même dans un worktree', () => {
    const v = verdict({ gitDir: '/repo/.git/worktrees/x', communDir: '/repo/.git', nodeModulesEstLien: true });
    expect(v.ok).toBe(false);
    expect(v.raison).toMatch(/lien symbolique/);
  });

  it('laisse une personne installer le dépôt principal, mais jamais via un lien', () => {
    expect(verdict({ gitDir: '/r/.git', communDir: '/r/.git', nodeModulesEstLien: false, principalVoulu: true }).ok).toBe(true);
    expect(verdict({ gitDir: '/r/.git', communDir: '/r/.git', nodeModulesEstLien: true, principalVoulu: true }).ok).toBe(false);
  });
});

describe('installer — câblage', () => {
  it('est déclaré dans package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.installer).toBe('node scripts/installer.mjs');
  });

  it('refuse bien dans un vrai dépôt principal, sans rien installer', () => {
    // Un dépôt jetable : `git init` crée un dépôt principal, sans `node_modules`.
    const dossier = mkdtempSync(join(tmpdir(), 'installer-'));
    execFileSync('git', ['init', '-q', dossier]);
    let code = 0;
    let stderr = '';
    try {
      execFileSync('node', [`${racine}scripts/installer.mjs`], { cwd: dossier, encoding: 'utf8', stdio: 'pipe' });
    } catch (erreur) {
      const e = erreur as { status: number; stderr: string };
      code = e.status;
      stderr = e.stderr;
    }
    rmSync(dossier, { recursive: true, force: true });
    expect(code).toBe(1);
    expect(stderr).toMatch(/refus/);
  });
});
