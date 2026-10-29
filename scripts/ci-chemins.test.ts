import { describe, expect, it } from 'vitest';
import { docSeulement, estCheminDoc, litUnDocument, testsQuiLisentLesDocs } from './ci-chemins.mjs';

/**
 * Le chemin rapide de la CI (D-143, #422) : ce qu'une PR de documentation peut casser, et rien
 * de plus. Chaque règle de D-143 (1) et (2) est confrontée à un **cas fautif** : sans elle, une
 * illustration orpheline (`design/`) ou une PR mixte passerait par le chemin rapide.
 */
describe('scripts/ci-chemins.mjs — le chemin rapide (D-143, #422)', () => {
  it('reconnaît la documentation : docs/**, preuves comprises, et les *.md de la racine', () => {
    for (const chemin of ['docs/DECISIONS.md', 'docs/preuves/x/planche.png', 'AGENTS.md', 'README.md']) {
      expect(estCheminDoc(chemin), chemin).toBe(true);
    }
  });

  it('le contrôle mord : design/**, src/** et le code ne sont jamais de la documentation (D-143 (2))', () => {
    for (const chemin of [
      'design/illustrations/README.md',
      'src/x/README.md',
      'src/App.tsx',
      '.github/workflows/ci.yml',
      'package.json'
    ]) {
      expect(estCheminDoc(chemin), chemin).toBe(false);
    }
  });

  it('une PR mixte prend la suite complète, et une PR vide aussi', () => {
    expect(docSeulement(['docs/COMMANDES.md', 'AGENTS.md'])).toBe(true);
    expect(docSeulement(['docs/COMMANDES.md', 'src/App.tsx'])).toBe(false);
    expect(docSeulement(['design/illustrations/README.md'])).toBe(false);
    expect(docSeulement([])).toBe(false);
  });

  it('repère un test qui lit un document, et pas un test qui ne fait que le citer', () => {
    expect(litUnDocument("const t = readFileSync(new URL('../docs/DECISIONS.md', import.meta.url), 'utf8');")).toBe(
      true
    );
    expect(litUnDocument("readFileSync(chemin('AGENTS.md'))")).toBe(true);
    // Un commentaire ou une chaîne sans lecture du disque ne lit rien.
    expect(litUnDocument('// voir docs/DECISIONS.md\nexpect(1).toBe(1);')).toBe(false);
    expect(litUnDocument("readFileSync('src/styles.css')")).toBe(false);
  });

  it('les gardes de cohérence de D-143 (1) sont dans le chemin rapide, et les deux projets y ont leurs tests', () => {
    const { node, ui } = testsQuiLisentLesDocs();
    for (const garde of ['coherence-docs', 'compteurs', 'coherence-generateurs', 'decisions', 'renommages']) {
      expect(
        node.some((chemin) => chemin.includes(`${garde}.test.ts`)),
        garde
      ).toBe(true);
    }
    expect(node).toContain('scripts/preuves/capturer.test.ts');
    expect(ui.length).toBeGreaterThan(0);
    for (const chemin of ui) expect(chemin).toMatch(/\.test\.tsx$/);
  });
});
