import { describe, expect, it } from 'vitest';
// @ts-expect-error — module .mjs sans déclaration de types
import { BRANCHE, codeDuVerdict, executer, numeroDe, verdict } from './ci-etat.mjs';

/**
 * **Le verdict du dernier run de CI sur `main`** (`npm run ci:etat`, #258).
 *
 * Le diagnostic : `main` est restée rouge **8 runs d'affilée pendant 6 h 36**, et rien ne le
 * signalait. Ce test **doit** pouvoir échouer — la règle du dépôt (§6) vaut ici comme partout.
 *
 * « Le contrôle mord » : chaque branche de logique est confrontée à un cas **fautif** puis au
 * cas **correct** — jamais seulement au vrai dernier run, qui est green depuis le 26/10 (#255,
 * #259). Un test qui ne lirait que GitHub ne prouverait rien les jours où GitHub va bien.
 *
 * Les réponses fabriquées portent la **forme réelle** de l'API d'Actions (`run_number`, `id`,
 * `status`, `conclusion`, `created_at`) : la première version du script lisait `number` et
 * affichait `run #undefined` sans qu'aucun test ne bronche, parce que les données fabriquées
 * portaient `number`. C'est le défaut que la dernière assertion garde.
 */

/** Une réponse d'`actions/runs?branch=main&per_page=1`, réduite à ce qu'on lit. */
const reponse = (run: Record<string, unknown>) => ({ workflow_runs: [run] });

describe('ci:etat — le verdict du dernier run de CI sur `main` (#258)', () => {
  it('accepte un dernier run **complété et green**', () => {
    expect(
      verdict(reponse({ run_number: 207, status: 'completed', conclusion: 'success', created_at: '2026-10-26T20:36:00Z' }))
    ).toEqual({ ok: true, numero: 207, conclusion: 'success', date: '2026-10-26T20:36:00Z' });
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

  it('refuse qu’il n’y ait **aucun** run', () => {
    expect(verdict({ workflow_runs: [] })).toEqual({
      ok: false,
      numero: null,
      raison: `aucun run d’Actions trouvé pour \`${BRANCHE}\``
    });
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

describe('ci:etat — le geste, pas seulement le calcul (#258)', () => {
  const muet = () => {};

  it('sort 0 et le dit quand `main` est green', () => {
    const lignes: string[] = [];
    const code = executer(
      () => reponse({ run_number: 207, status: 'completed', conclusion: 'success', created_at: '2026-10-26T20:36:00Z' }),
      (l: string) => lignes.push(l),
      muet
    );
    expect(code).toBe(0);
    expect(lignes.join('\n')).toContain('green');
    expect(lignes.join('\n')).toContain('207');
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
});
