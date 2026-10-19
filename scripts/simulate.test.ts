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
});
