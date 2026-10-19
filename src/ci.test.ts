import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contrôle du workflow d'intégration continue (ticket #11).
 *
 * Le fichier YAML est lu comme du texte : les assertions portent sur les
 * déclencheurs, sur la version de Node et sur l'enchaînement des commandes de
 * `AGENTS.md` §7. Aucune dépendance d'analyse YAML n'est ajoutée pour ça.
 */
const WORKFLOW_PATH = fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url));
const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

const STEPS = ['npm ci', 'npm run check', 'npm test', 'npm run build'];

describe('.github/workflows/ci.yml', () => {
  it('se déclenche sur push et pull_request vers main', () => {
    expect(workflow).toMatch(/^on:/m);
    expect(workflow).toMatch(/^ {2}push:/m);
    expect(workflow).toMatch(/^ {2}pull_request:/m);
    // `[main]` apparaît une fois par déclencheur : push et pull_request.
    expect(workflow.match(/branches: \[main\]/g)).toHaveLength(2);
  });

  it('aligne Node sur la version du dépôt (v24, AGENTS.md §7)', () => {
    expect(workflow).toMatch(/node-version: 24\b/);
  });

  it('épingle la version majeure de chaque action (`@vN`) et nomme les deux attendues', () => {
    const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) expect(ref, ref).toMatch(/@v\d+$/);
    expect(uses).toContain('actions/checkout@v7');
    expect(uses).toContain('actions/setup-node@v7');
  });

  it('enchaîne npm ci, check, tests puis build, dans cet ordre', () => {
    const positions = STEPS.map((command) => workflow.indexOf(`run: ${command}`));
    for (const [index, position] of positions.entries()) {
      expect(position, `étape manquante : ${STEPS[index]}`).toBeGreaterThanOrEqual(0);
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('échoue si une étape échoue et n’exige aucun secret', () => {
    // Pas de `continue-on-error` : l'échec d'une étape fait échouer le job.
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).toMatch(/runs-on: ubuntu-latest/);
  });
});
