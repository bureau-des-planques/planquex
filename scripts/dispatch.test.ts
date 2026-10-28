import { describe, expect, it } from 'vitest';
import { analyserArguments, composer, prochainNumero } from './dispatch.mjs';

/**
 * Rétro du 28/10/2026 : 74 dispatchs de sous-agents, 226 000 caractères de prompts écrits
 * à la main. Les oublis (worktree absolu, installation, définition de fini, numéro de
 * décision) se payaient en messages de rattrapage.
 *
 * **Le contrôle mord** : un ticket manquant, un agent inconnu et un journal sans décision
 * sont refusés.
 */

describe('prochainNumero', () => {
  it('prend le maximum + 1, sur trois chiffres', () => {
    const journal = ['| D-140 | 28/10/2026 | a |', '| D-143 | 28/10/2026 | b |', '| D-141 | 28/10/2026 | c |'].join('\n');
    expect(prochainNumero(journal)).toBe('D-144');
  });

  it('refuse un journal sans décision plutôt que de rendre D-001', () => {
    expect(() => prochainNumero('# Journal\n\nrien')).toThrow(/aucune décision/);
  });
});

describe('analyserArguments', () => {
  it('donne le worktree absolu et la branche par défaut', () => {
    const o = analyserArguments(['--ticket', '427'], { racine: '/depot/planquex' });
    expect(o.erreurs).toEqual([]);
    expect(o.worktree).toBe('/home/chapax/.local/share/opencode/worktree/planquex/427');
    expect(o.branche).toBe('agent/427');
    expect(o.agent).toBe('codeur');
    expect(o.decision).toBe(false);
  });

  it('refuse un ticket manquant, un ticket non numérique, un agent inconnu', () => {
    expect(analyserArguments([], { racine: '/x' }).erreurs.join(' ')).toMatch(/ticket manquant/);
    expect(analyserArguments(['--ticket', 'abc'], { racine: '/x' }).erreurs.join(' ')).toMatch(/ticket invalide/);
    expect(analyserArguments(['--ticket', '1', '--agent', 'nimporte'], { racine: '/x' }).erreurs.join(' ')).toMatch(/agent inconnu/);
  });

  it('rend un worktree absolu même fourni en relatif', () => {
    const o = analyserArguments(['--ticket', '1', '--worktree', 'wt'], { racine: '/depot' });
    expect(o.worktree).toBe('/depot/wt');
  });
});

describe('composer', () => {
  const ticket = { number: 427, title: 'Sortir en un geste', body: 'Le corps du ticket.', labels: [{ name: 'enhancement' }] };
  const base = { ticket, agent: 'codeur', branche: 'agent/427', worktree: '/wt/427', decision: null };

  it('porte le ticket, le chemin absolu, la branche et la définition de fini', () => {
    const p = composer(base);
    expect(p).toContain('#427 « Sortir en un geste »');
    expect(p).toContain('`/wt/427`');
    expect(p).toContain('`agent/427`');
    expect(p).toContain('npm run check');
    expect(p).toContain('garde-fous');
    expect(p).toContain('jamais en parallèle');
    expect(p).toContain('Le corps du ticket.');
    expect(p).toContain('enhancement');
  });

  it('ne cite une décision que si elle est demandée', () => {
    expect(composer(base)).not.toContain('D-144');
    expect(composer({ ...base, decision: 'D-144' })).toContain('**D-144**');
  });

  it('dit quoi faire quand le corps du ticket est vide', () => {
    const p = composer({ ...base, ticket: { number: 1, title: 'Vide', body: '  ', labels: [] } });
    expect(p).toContain('gh issue view 1 --json');
  });
});
