import { describe, expect, it } from 'vitest';
import { analyserArguments, executer, verifier } from './worktree-nouveau.mjs';

/**
 * Rétro du 28/10/2026 : la règle « `npm run installer` dans le worktree » est écrite
 * (`docs/agents/parallelisme.md` §4.10) mais se perd — 14 sorties d'erreur citent
 * `node_modules/prettier` ou `vitest` manquants. Le geste les fait ensemble.
 *
 * **Le contrôle mord** : un nom invalide, une cible occupée et une branche existante
 * sont refusés ; la séquence des trois gestes est vérifiée sur un lanceur injecté.
 */

const HOME = '/home/test';
const DEFAUTS = { home: HOME, depot: 'planquex' };

describe('analyserArguments', () => {
  it('donne le dossier et la branche par défaut', () => {
    const p = analyserArguments(['427-sortie-combat'], DEFAUTS);
    expect(p.erreurs).toEqual([]);
    expect(p.cible).toBe('/home/test/.local/share/opencode/worktree/planquex/427-sortie-combat');
    expect(p.branche).toBe('agent/427-sortie-combat');
    expect(p.depuis).toBe('origin/main');
  });

  it('accepte les formes --x=v et --x v', () => {
    const a = analyserArguments(['t1', '--branche', 'feat/t1', '--depuis=origin/main'], DEFAUTS);
    const b = analyserArguments(['t1', '--branche=feat/t1', '--depuis', 'origin/main'], DEFAUTS);
    expect(a.branche).toBe('feat/t1');
    expect(b.branche).toBe('feat/t1');
    expect(a.cible).toBe(b.cible);
  });

  it('refuse un nom invalide et un nom manquant', () => {
    expect(analyserArguments([], DEFAUTS).erreurs.join(' ')).toMatch(/nom manquant/);
    for (const nom of ['427/Sortie', 'A_b', '-x', '']) {
      expect(analyserArguments([nom], DEFAUTS).erreurs.join(' '), nom).toMatch(/nom invalide|nom manquant/);
    }
  });

  it('refuse une option inconnue plutôt que de l’ignorer', () => {
    expect(analyserArguments(['t1', '--force'], DEFAUTS).erreurs.join(' ')).toMatch(/option inconnue/);
  });

  it('rend une cible absolue même avec une racine relative', () => {
    const p = analyserArguments(['t1', '--racine', 'wt'], DEFAUTS);
    expect(p.cible?.startsWith('/')).toBe(true);
  });
});

describe('verifier', () => {
  it('refuse une cible occupée et une branche existante', () => {
    const p = analyserArguments(['t1'], DEFAUTS);
    const erreurs = verifier(p, { existe: () => true, brancheExiste: () => true });
    expect(erreurs.join(' ')).toMatch(/existe déjà : .*t1/);
    expect(erreurs.join(' ')).toMatch(/branche existe déjà/);
  });

  it('laisse passer une cible libre', () => {
    const p = analyserArguments(['t1'], DEFAUTS);
    expect(verifier(p, { existe: () => false, brancheExiste: () => false })).toEqual([]);
  });
});

describe('executer', () => {
  it('fetch, worktree add, puis installer — dans cet ordre, et dans la cible', () => {
    const appels: Array<{ argv: string[]; cwd: string }> = [];
    const plan = analyserArguments(['t1'], DEFAUTS);
    executer(plan, {
      cwd: '/depot',
      lancer: (argv, cwd) => {
        appels.push({ argv, cwd });
      },
    });
    expect(appels.map((a) => a.argv.slice(0, 3).join(' '))).toEqual([
      'git fetch origin',
      'git worktree add',
      'npm run installer',
    ]);
    expect(appels[0].cwd).toBe('/depot');
    expect(appels[1].argv).toEqual(['git', 'worktree', 'add', '-b', 'agent/t1', plan.cible, 'origin/main']);
    expect(appels[2].cwd).toBe(plan.cible);
  });
});
