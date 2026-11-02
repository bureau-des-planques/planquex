import { describe, expect, it } from 'vitest';
// @ts-expect-error — module .mjs sans déclaration de types
import { BRANCHE, CHEMIN_WORKFLOW, codeDuVerdict, executer, numeroDe, verdict } from './ci-etat.mjs';

/**
 * **Le verdict du dernier run de CI sur `main`** (`npm run ci:etat`, #258, #585).
 *
 * Le diagnostic : `main` est restée rouge **8 runs d'affilée pendant 6 h 36**, et rien ne le
 * signalait. Ce test **doit** pouvoir échouer — la règle du dépôt (§6) vaut ici comme partout.
 *
 * « Le contrôle mord » : chaque branche de logique est confrontée à un cas **fautif** puis au
 * cas **correct** — jamais seulement au vrai dernier run, qui est green depuis le 26/10 (#255,
 * #259). Un test qui ne lirait que GitHub ne prouverait rien les jours où GitHub va bien.
 *
 * Les réponses fabriquées portent la **forme réelle** de l'API d'Actions (`run_number`, `id`,
 * `status`, `conclusion`, `created_at`, `event`, `path`) : la première version du script lisait
 * `number` et affichait `run #undefined` sans qu'aucun test ne bronche, parce que les données
 * fabriquées portaient `number`. C'est le défaut que la dernière assertion garde.
 *
 * #585 a ajouté un second piège : le 02/11/2026, un run **Dependabot** en échec était plus
 * récent que le run **CI** vert du même commit (`79491fc`), et `ci:etat` criait au loup. Le
 * script ne lit plus que le workflow `CI`, `push`, `main` — les tests le confrontent au mélange.
 */

/** L'identité d'un run du workflow `CI` sur `main`, telle que l'API la rend. */
const CI = { name: 'CI', path: CHEMIN_WORKFLOW, event: 'push' };

/** Un run de Dependabot : un autre workflow, un autre événement — jamais une rouge de `main`. */
const DEPENDABOT = {
  name: 'npm_and_yarn in /. for minimatch - Update',
  path: 'dynamic/dependabot/dependabot-updates',
  event: 'dynamic'
};

/** Une réponse d'`actions/runs?branch=main`, réduite à ce qu'on lit. */
const reponse = (run: Record<string, unknown>) => ({ workflow_runs: [{ ...CI, ...run }] });

describe('ci:etat — le verdict du dernier run de CI sur `main` (#258)', () => {
  it('accepte un dernier run **complété et green**', () => {
    expect(
      verdict(
        reponse({
          run_number: 207,
          status: 'completed',
          conclusion: 'success',
          created_at: '2026-10-26T20:36:00Z',
          head_sha: '79491fcfbedf0b30237db24518c07ae9bb51e97a'
        })
      )
    ).toMatchObject({
      ok: true,
      numero: 207,
      conclusion: 'success',
      date: '2026-10-26T20:36:00Z',
      sha: '79491fcfbedf0b30237db24518c07ae9bb51e97a'
    });
  });

  it('refuse un dernier run **en échec** — le cas qui a duré 6 h 36 sans être vu', () => {
    const v = verdict(reponse({ run_number: 204, status: 'completed', conclusion: 'failure' }));
    expect(v.ok).toBe(false);
    expect(v.numero).toBe(204);
    expect(v.raison).toContain('failure');
    expect(codeDuVerdict(v)).toBe(1);
  });

  it('refuse un dernier run **encore en cours** — on ne fusionne pas sur une base « in_progress »', () => {
    const v = verdict(reponse({ run_number: 203, status: 'in_progress', conclusion: null }));
    expect(v.ok).toBe(false);
    expect(v.raison).toContain('in_progress');
    expect(codeDuVerdict(v)).toBe(1);
  });

  it('lit le numéro **de l’API réelle** — `run_number`, à défaut `id`, jamais `number`', () => {
    // Le bug du 26/10/2026, dans une assertion : l'API rend `run_number`, pas `number`.
    expect(numeroDe({ run_number: 207, id: 40395203605 })).toBe(207);
    expect(numeroDe({ id: 40395203605 })).toBe(40395203605);
    expect(numeroDe({ number: 42 })).toBeNull();
    // Un run sans numéro lisible n'est pas vert pour autant : le verdict reste bon, mais
    // `numero` vaut `null` plutôt que `undefined`, qui s'imprimerait tel quel.
    expect(verdict(reponse({ status: 'completed', conclusion: 'success' })).numero).toBeNull();
  });
});

describe('ci:etat — ne lit que le workflow `CI` de `main` (#585)', () => {
  it('retient le run `CI` vert, pas le run Dependabot rouge plus récent', () => {
    // Le cas réel du 02/11/2026 : le run Dependabot #5 (failure) est en tête de liste, le
    // run CI #621 (success) le suit sur le même commit.
    const v = verdict({
      workflow_runs: [
        {
          ...DEPENDABOT,
          run_number: 5,
          status: 'completed',
          conclusion: 'failure',
          head_sha: '79491fcfbedf0b30237db24518c07ae9bb51e97a'
        },
        {
          ...CI,
          run_number: 621,
          status: 'completed',
          conclusion: 'success',
          head_sha: '79491fcfbedf0b30237db24518c07ae9bb51e97a'
        }
      ]
    });
    expect(v.ok).toBe(true);
    expect(v.numero).toBe(621);
    expect(codeDuVerdict(v)).toBe(0);
  });

  it('sort non-zéro et nomme le run quand le `CI` lui-même est rouge', () => {
    const v = verdict({
      workflow_runs: [
        {
          ...CI,
          run_number: 622,
          status: 'completed',
          conclusion: 'failure',
          head_sha: '79491fcfbedf0b30237db24518c07ae9bb51e97a'
        },
        {
          ...DEPENDABOT,
          run_number: 6,
          status: 'completed',
          conclusion: 'success'
        }
      ]
    });
    expect(v.ok).toBe(false);
    expect(v.numero).toBe(622);
    expect(v.raison).toContain('622');
    expect(v.raison).toContain('failure');
    expect(codeDuVerdict(v)).toBe(1);
  });

  it('ignore un run `CI` d’un autre événement — `main` se juge sur `push`', () => {
    const v = verdict({
      workflow_runs: [
        { ...CI, event: 'pull_request', run_number: 900, status: 'completed', conclusion: 'failure' },
        { ...CI, run_number: 621, status: 'completed', conclusion: 'success' }
      ]
    });
    expect(v.ok).toBe(true);
    expect(v.numero).toBe(621);
  });

  it('distingue « aucun run CI sur le dernier commit » de « pas green »', () => {
    const sha = '79491fcfbedf0b30237db24518c07ae9bb51e97a';
    const v = verdict({ workflow_runs: [], shaMain: sha });
    expect(v.ok).toBe(false);
    expect(v.absent).toBe(true);
    expect(v.raison).toContain('79491fc');
    expect(v.raison).toContain('run CI');

    const lignes: string[] = [];
    const code = executer(
      () => ({ workflow_runs: [], shaMain: sha }),
      (l: string) => lignes.push(l),
      (l: string) => lignes.push(l)
    );
    expect(code).toBe(1);
    expect(lignes.join('\n')).toContain('n’a pas encore de run CI');
    expect(lignes.join('\n')).not.toContain('n’est pas green');
  });
});

describe('ci:etat — le geste, pas seulement le calcul (#258)', () => {
  const muet = () => {};

  it('sort 0 et nomme **le workflow, le run et le sha** quand `main` est green', () => {
    const lignes: string[] = [];
    const code = executer(
      () =>
        reponse({
          run_number: 621,
          status: 'completed',
          conclusion: 'success',
          created_at: '2026-11-02T10:00:00Z',
          head_sha: '79491fcfbedf0b30237db24518c07ae9bb51e97a'
        }),
      (l: string) => lignes.push(l),
      muet
    );
    expect(code).toBe(0);
    expect(lignes.join('\n')).toContain('green');
    expect(lignes.join('\n')).toContain('CI');
    expect(lignes.join('\n')).toContain('621');
    expect(lignes.join('\n')).toContain('79491fc');
  });

  it('sort 1 et **écrit sur la sortie d’erreur** quand `main` est rouge', () => {
    // Sans cette assertion, un script qui imprimerait « rouge » sur stdout sortirait 1 sans
    // qu'on sache où lire — et la panne se perdrait dans la sortie normale.
    const fautes: string[] = [];
    const code = executer(
      () => reponse({ run_number: 204, status: 'completed', conclusion: 'failure' }),
      muet,
      (l: string) => fautes.push(l)
    );
    expect(code).toBe(1);
    expect(fautes.join('\n')).toContain('✖');
    expect(fautes.join('\n')).toContain('204');
  });

  it('ne crie pas au loup sur un job Dependabot rouge (#585)', () => {
    const fautes: string[] = [];
    const lignes: string[] = [];
    const code = executer(
      () => ({
        workflow_runs: [
          { ...DEPENDABOT, run_number: 5, status: 'completed', conclusion: 'failure' },
          { ...CI, run_number: 621, status: 'completed', conclusion: 'success' }
        ]
      }),
      (l: string) => lignes.push(l),
      (l: string) => fautes.push(l)
    );
    expect(code).toBe(0);
    expect(fautes).toEqual([]);
    expect(lignes.join('\n')).toContain('621');
  });
});
