import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it("prend le maximum des journaux qu'on lui donne : origin/main peut être en avance", () => {
    const local = '| D-143 | 28/10/2026 | a |';
    const origin = '| D-143 | 28/10/2026 | a |\n| D-145 | 28/10/2026 | b |';
    expect(prochainNumero(local, origin)).toBe('D-146');
  });

  it('refuse un journal sans décision plutôt que de rendre D-001', () => {
    expect(() => prochainNumero('# Journal\n\nrien')).toThrow(/aucune décision/);
  });
});

describe('analyserArguments', () => {
  it('donne le worktree absolu et la branche par défaut', () => {
    const o = analyserArguments(['--ticket', '427'], { racine: '/depot/planquex' });
    expect(o.erreurs).toEqual([]);
    // Le foyer est celui de la machine : un chemin en dur casserait sur un runner de CI.
    expect(o.worktree).toBe(join(homedir(), '.local/share/opencode/worktree/planquex/427'));
    expect(o.branche).toBe('agent/427');
    expect(o.agent).toBe('codeur');
    expect(o.decision).toBe(false);
  });

  it('refuse un ticket manquant, un ticket non numérique, un agent inconnu', () => {
    expect(analyserArguments([], { racine: '/x' }).erreurs.join(' ')).toMatch(/ticket manquant/);
    expect(analyserArguments(['--ticket', 'abc'], { racine: '/x' }).erreurs.join(' ')).toMatch(/ticket invalide/);
    expect(analyserArguments(['--ticket', '1', '--agent', 'nimporte'], { racine: '/x' }).erreurs.join(' ')).toMatch(/agent inconnu/);
  });

  it('accepte --reprise', () => {
    const o = analyserArguments(['--ticket', '1', '--reprise'], { racine: '/x' });
    expect(o.erreurs).toEqual([]);
    expect(o.reprise).toBe(true);
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

  it("n'affirme pas qu'un worktree absent existe, et donne le geste qui le crée", () => {
    expect(composer(base)).toContain('Il existe déjà');
    const absent = composer({ ...base, worktreeExiste: false });
    expect(absent).not.toContain('Il existe déjà');
    expect(absent).toContain('worktree:nouveau -- 427 --branche agent/427');
  });

  it('rend un prompt de reprise court : le point de reprise, pas le ticket entier', () => {
    const p = composer({ ...base, reprise: true });
    expect(p).toContain('Reprends exactement où tu en étais');
    expect(p).toContain('`/wt/427`');
    expect(p).toContain('`agent/427`');
    expect(p).toContain('**fait**');
    expect(p).toContain('git status --short');
    // Le corps du ticket n'a pas à être recopié : la coupure ne l'a pas effacé.
    expect(p).not.toContain('Le corps du ticket.');
  });

  it("adapte le fini au métier de l'agent : un auditeur rend un rapport, il ne passe pas la suite", () => {
    const lecture = composer({ ...base, agent: 'auditeur' });
    expect(lecture).toContain('Un **rapport**');
    expect(lecture).not.toContain('npm run garde-fous');
    expect(composer({ ...base, agent: 'redacteur' })).toContain('format:check');
    expect(composer(base)).toContain('npm run garde-fous');
  });
});

/**
 * Le script **réel**, lancé dans un faux dépôt : une copie de `dispatch.mjs` sous
 * `scripts/ci/`, un `docs/DECISIONS.md` à la racine, et un faux `gh` sur le `PATH`.
 *
 * Le leurre `scripts/docs/DECISIONS.md` est le contrôle qui mord : avec l'ancien `..`,
 * le script lit ce journal-là (D-001) et rend D-002 au lieu du D-008 attendu (#688).
 */
const SOURCE = fileURLToPath(new URL('./dispatch.mjs', import.meta.url));

function fauxDepot({ avecJournal = true } = {}) {
  const bac = mkdtempSync(join(tmpdir(), 'dispatch-'));
  mkdirSync(join(bac, 'scripts', 'ci'), { recursive: true });
  copyFileSync(SOURCE, join(bac, 'scripts', 'ci', 'dispatch.mjs'));
  if (avecJournal) {
    mkdirSync(join(bac, 'docs'), { recursive: true });
    writeFileSync(join(bac, 'docs', 'DECISIONS.md'), '| D-007 | 04/11/2026 | la vraie |\n');
    mkdirSync(join(bac, 'scripts', 'docs'), { recursive: true });
    writeFileSync(join(bac, 'scripts', 'docs', 'DECISIONS.md'), '| D-001 | 01/01/2026 | le leurre |\n');
  }
  const bin = join(bac, 'bin');
  mkdirSync(bin, { recursive: true });
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/bin/sh\nprintf '%s' '{"number":1,"title":"T","body":"corps","labels":[]}'\n`);
  chmodSync(gh, 0o755);
  return bac;
}

function lancerDispatch(bac: string, args: string[]) {
  return spawnSync(process.execPath, [join(bac, 'scripts', 'ci', 'dispatch.mjs'), ...args], {
    cwd: bac,
    encoding: 'utf8',
    // `GIT_DIR` bidon : `git fetch origin main` échoue même si le bac temporaire se trouve
    // sous un dépôt git ; le script retombe alors sur le journal local, comme hors ligne.
    env: { ...process.env, GIT_DIR: join(bac, 'pas-un-depot'), PATH: `${join(bac, 'bin')}:${process.env.PATH ?? ''}` }
  });
}

describe('le script réel et son journal (#688)', () => {
  it('réserve le prochain numéro lu à la racine du dépôt, pas dans `scripts/docs`', () => {
    const bac = fauxDepot();
    const r = lancerDispatch(bac, ['--ticket', '1', '--decision', '--json']);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).decision).toBe('D-008');
    // Le leurre existe, et il n'a pas été lu : c'est bien la racine qui fait foi.
    expect(r.stdout).not.toContain('D-002');
  });

  it('refuse `--decision` quand le journal est introuvable, au lieu de se taire', () => {
    const bac = fauxDepot({ avecJournal: false });
    const r = lancerDispatch(bac, ['--ticket', '1', '--decision', '--json']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/journal introuvable/);
  });
});
