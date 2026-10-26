import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contrôle du workflow d'intégration continue (ticket #11).
 *
 * Le fichier YAML est lu comme du texte : les assertions portent sur les
 * déclencheurs, sur la version de Node et sur l'enchaînement des commandes de
 * `AGENTS.md` §7. Aucune dépendance d'analyse YAML n'est ajoutée pour ça.
 *
 * **Ce que ce test garde, et ce qu'il ne garde pas (ticket #52).** Lire un YAML
 * comme du texte rend un test fragile dès qu'il recopie une valeur d'implémentation :
 * chaque montée de version d'une action le faisait échouer sans régression. Les
 * assertions ci-dessous ne portent donc plus que sur des **invariants du dépôt** :
 * les déclencheurs, `runs-on`, l'absence de `continue-on-error`/`secrets.`, la
 * présence de `checkout` et `setup-node` **épinglées par version majeure** (quel que
 * soit le numéro), et l'ordre des commandes de `AGENTS.md` §7. La version de Node
 * (`24`) reste en dur : elle est actée dans `AGENTS.md` §7, ce n'est pas un détail
 * du workflow. Ce qui n'est plus testé : le numéro exact d'une action et la mise en
 * forme du YAML — un relecteur les voit dans le diff.
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
    // Les numéros majeurs ne sont pas figés : seule la présence compte (#52).
    const names = uses.map((ref) => ref.split('@')[0]);
    expect(names).toContain('actions/checkout');
    expect(names).toContain('actions/setup-node');
  });

  it('enchaîne npm ci, check, tests puis build, dans cet ordre', () => {
    const positions = STEPS.map((command) => workflow.indexOf(`run: ${command}`));
    for (const [index, position] of positions.entries()) {
      expect(position, `étape manquante : ${STEPS[index]}`).toBeGreaterThanOrEqual(0);
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('ne vérifie PAS les fichiers générés : une PR ne dépend pas de l’état vivant de GitHub (D-113)', () => {
    // `plan-dev.ts` liste les issues ouvertes : fermer une issue le périme. La CI des PR est
    // tombée rouge trois fois le 26/10/2026 sans rien de cassé. Ce contrôle vit ailleurs.
    expect(workflow).not.toContain('plan:dev');
    expect(workflow).not.toContain('notes:versions');
    expect(workflow).not.toMatch(/issues: read/);
  });

  it('contrôle les écrans dans un navigateur, après le build et sans saut possible (#234)', () => {
    // Le contrôle visuel en navigateur (#205) est branché depuis #234. Cette assertion
    // garde ce qui se casse en silence : **retirer l'étape** rendrait la CI verte alors
    // qu'aucun écran ne serait mesuré. `detect:ui` (regex sur les sources) la remplacerait
    // en apparence — il sous-compte, et c'est précisément pour ça que #205 existe.
    const debut = workflow.indexOf('Contrôler les écrans dans un navigateur');
    expect(debut, 'étape « contrôle visuel en navigateur » absente').toBeGreaterThanOrEqual(0);
    const bloc = workflow.slice(debut);
    expect(bloc).toContain('npm run detect:ui:page');
    // Il lui faut un navigateur, et l'étape le nomme (Chromium de l'image du runner).
    expect(bloc).toContain('IMPECCABLE_BROWSER');
    // Pas de saut : sans navigateur, elle échoue explicitement.
    expect(bloc).not.toMatch(/^\s*if:/m);
    expect(bloc).toMatch(/exit 1/);
    // Elle lit `dist/` : le build doit avoir tourné avant.
    expect(workflow.indexOf('run: npm run build')).toBeLessThan(debut);
  });

  it('échoue si une étape échoue et n’exige aucun secret', () => {
    // Pas de `continue-on-error` : l'échec d'une étape fait échouer le job.
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).toMatch(/runs-on: ubuntu-latest/);
  });
});

describe('.github/workflows/fichiers-generes.yml (#231, D-113)', () => {
  const generes = readFileSync(
    fileURLToPath(new URL('../.github/workflows/fichiers-generes.yml', import.meta.url)),
    'utf8'
  );

  it('se lance sur un tag de version ou à la demande, jamais sur une pull request', () => {
    expect(generes).toMatch(/tags: \['v\*'\]/);
    expect(generes).toMatch(/^ {2}workflow_dispatch:/m);
    expect(generes).not.toMatch(/pull_request/);
  });

  it('vérifie les deux fichiers avec le jeton du workflow, sans jamais se sauter', () => {
    // Sans cette assertion, **retirer l'étape** rendrait le contrôle vert sans rien comparer.
    expect(generes).toContain('npm run plan:dev -- --verifie');
    expect(generes).toContain('npm run notes:versions -- --verifie');
    expect(generes).toContain('GH_TOKEN: ${{ github.token }}');
    expect(generes).toMatch(/issues: read/);
    expect(generes).toMatch(/exit 1/);
    expect(generes).not.toMatch(/^\s*if:/m);
  });

  it('n’exige aucun secret et ne masque aucun échec', () => {
    expect(generes).not.toMatch(/secrets\./);
    expect(generes).not.toMatch(/continue-on-error/);
  });
});

describe('le formatage est vérifié, pas seulement souhaité (26/10/2026)', () => {
  it('la CI lance `prettier --check` sur le code, et Prettier est épinglé en devDependency', () => {
    // Sans cette assertion, retirer l'étape rendrait la CI verte alors que 537 lignes de plus
    // de 120 caractères et deux fichiers en guillemets doubles sont revenus (constat du 26/10).
    expect(workflow).toContain('npm run format:check');
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    // Épinglé **exactement** : `^3` laisserait une version mineure arriver sans revue.
    expect(pkg.devDependencies.prettier).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('dit ce que Prettier ne touche pas, et pourquoi', () => {
    // `src/data` porte un texte de carte par ligne : un repli changerait le texte affiché.
    const ignore = readFileSync(fileURLToPath(new URL('../.prettierignore', import.meta.url)), 'utf8');
    expect(ignore).toContain('src/data/**/*.ts');
    expect(ignore).toMatch(/texte de carte/);
  });
});
