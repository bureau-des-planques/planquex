// Lent : chaque cas lance `scripts/simulate.mjs` en sous-processus, qui joue des parties complètes ; le délai de 30 s est posé par cas.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Ticket #34 — la **commande** du simulateur, pas seulement le module.
 *
 * C'est `npm run simulate -- …` que le ticket demande : lancer N parties sans
 * navigateur, avec une graine. Ce test exécute le script tel quel et compare deux
 * sorties, ce qui vérifie la reproductibilité de bout en bout (arguments, chargement
 * Vite, rapport).
 */
const root = fileURLToPath(new URL('..', import.meta.url));

function run(args: string[]) {
  return spawnSync(process.execPath, ['scripts/simulate.mjs', ...args], {
    cwd: root,
    encoding: 'utf8'
  });
}

describe('scripts/simulate.mjs — commande headless', () => {
  it(
    'lance N parties et imprime le même rapport pour la même graine',
    { timeout: 30_000 },
    () => {
      const args = ['--games', '3', '--seed', '42'];
      const first = run(args);
      const second = run(args);

      expect(first.status).toBe(0);
      expect(second.status).toBe(0);
      expect(first.stderr).toBe('');
      expect(first.stdout).toContain('Simulation — 3 partie(s), graine 42');
      expect(second.stdout).toBe(first.stdout);
    }
  );

  it(
    'produit un JSON exploitable avec --json',
    { timeout: 30_000 },
    () => {
      const result = run(['--games', '2', '--seed', '42', '--json']);

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        seed: number;
        games: number;
        results: { winner: string | null; turns: number }[];
      };
      expect(report.seed).toBe(42);
      expect(report.games).toBe(2);
      expect(report.results).toHaveLength(2);
      for (const game of report.results) {
        expect(['player', 'ai', null]).toContain(game.winner);
        expect(game.turns).toBeGreaterThan(0);
      }
    }
  );

  it(
    'refuse des arguments invalides avec le code 2',
    { timeout: 30_000 },
    () => {
      const result = run(['--games', '0']);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('--games doit être un entier ≥ 1');
    }
  );

  it('accepte --player-level 1 et 2 et le propage dans le rapport', { timeout: 30_000 }, () => {
    for (const level of [1, 2]) {
      const result = run(['--games', '1', '--seed', '42', '--json', '--player-level', String(level)]);
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.playerLevel).toBe(level);
    }
  });

  it('accepte --ai-level 1 et 2 et le propage dans le rapport', { timeout: 30_000 }, () => {
    for (const level of [1, 2]) {
      const result = run(['--games', '1', '--seed', '42', '--json', '--ai-level', String(level)]);
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.aiLevel).toBe(level);
    }
  });

  it('refuse un niveau invalide (3) avec le code 2 et un message clair', { timeout: 30_000 }, () => {
    for (const flag of ['--player-level', '--ai-level']) {
      const result = run(['--games', '1', '--seed', '42', flag, '3']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain(`${flag} attend 1 ou 2, reçu 3.`);
    }
  });

  it('refuse --player-level 0, non-entier, et valeur manquante', { timeout: 30_000 }, () => {
    // 0 : entier valide mais hors bornes → "attend 1 ou 2"
    const resultZero = run(['--games', '1', '--seed', '42', '--player-level', '0']);
    expect(resultZero.status).toBe(2);
    expect(resultZero.stderr).toContain('--player-level attend 1 ou 2');

    // Non-entier (1.5, abc) : échoue à readInteger → "attend un entier"
    for (const bad of ['1.5', 'abc']) {
      const result = run(['--games', '1', '--seed', '42', '--player-level', bad]);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('--player-level attend un entier');
    }

    // Valeur manquante : le parseur lit l'argument suivant (vide) → "attend un entier"
    const resultMissing = run(['--games', '1', '--seed', '42', '--player-level']);
    expect(resultMissing.status).toBe(2);
    expect(resultMissing.stderr).toContain('--player-level attend un entier');
  });

  it('refuse --ai-level 0, non-entier, et valeur manquante', { timeout: 30_000 }, () => {
    const resultZero = run(['--games', '1', '--seed', '42', '--ai-level', '0']);
    expect(resultZero.status).toBe(2);
    expect(resultZero.stderr).toContain('--ai-level attend 1 ou 2');

    for (const bad of ['1.5', 'abc']) {
      const result = run(['--games', '1', '--seed', '42', '--ai-level', bad]);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('--ai-level attend un entier');
    }

    const resultMissing = run(['--games', '1', '--seed', '42', '--ai-level']);
    expect(resultMissing.status).toBe(2);
    expect(resultMissing.stderr).toContain('--ai-level attend un entier');
  });
});
