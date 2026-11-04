import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const VITEST_PATH = fileURLToPath(new URL('../vitest.config.ts', import.meta.url));
const vitestConfig = readFileSync(VITEST_PATH, 'utf8');

/**
 * Le bloc YAML d'un job, découpé **par indentation** : de `  <nom>:` jusqu'à la ligne suivante
 * qui commence un autre job. Pas d'analyseur YAML ajouté pour ça (même choix que pour le
 * fichier entier, #52) — l'indentation de deux espaces est stable et lisible.
 */
function blocJob(nom: string, source = workflow): string {
  const entete = new RegExp(`^ {2}${nom}:$`, 'm').exec(source);
  if (!entete) return '';
  const reste = source.slice(entete.index + entete[0].length);
  const fin = reste.search(/^ {2}[a-zA-Z][\w-]*:$/m);
  return fin === -1 ? reste : reste.slice(0, fin);
}

/** Le bloc d'une étape, de `- name:` jusqu'au `- name:` suivant (ou la fin du job). */
function blocEtape(bloc: string, nom: string): string {
  const debut = bloc.indexOf(`- name: ${nom}`);
  if (debut < 0) return '';
  const suite = bloc.slice(debut + 1);
  const fin = suite.search(/^ {6}- name:/m);
  return fin === -1 ? bloc.slice(debut) : bloc.slice(debut, debut + 1 + fin);
}

/** Le script d'une étape `run: |`, désindenté, pour le jouer dans `bash` depuis un test. */
function scriptEtape(bloc: string, nom: string): string {
  const etape = blocEtape(bloc, nom);
  const debut = etape.indexOf('run: |');
  if (debut < 0) return '';
  const lignes = etape.slice(debut + 'run: |'.length).split('\n');
  const nonVides = lignes.filter((ligne) => ligne.trim() !== '');
  const indentation = Math.min(...nonVides.map((ligne) => ligne.match(/^ */)![0].length));
  return nonVides.map((ligne) => ligne.slice(indentation)).join('\n');
}

/**
 * **Le build précède les deux navigateurs** (#707). Une fonction pure sur le texte du
 * workflow, pour que le contrôle puisse **mordre** sur un YAML fabriqué : sans ce cas
 * fautif, déplacer le build après les captures laisserait le test vert.
 */
function ordreDesEcrans(source: string): string[] {
  const bloc = blocJob('tests-ecrans', source);
  if (!bloc) return ['job « tests-ecrans » absent'];
  const build = bloc.indexOf('run: npm run build');
  const capture = bloc.indexOf('npm run capturer');
  const detect = bloc.indexOf('npm run detect:ui:page');
  const problemes: string[] = [];
  if (build < 0) problemes.push('build absent de tests-ecrans');
  if (capture < 0) problemes.push('capturer absent de tests-ecrans');
  if (detect < 0) problemes.push('detect:ui:page absent de tests-ecrans');
  if (build >= 0 && capture >= 0 && build > capture) problemes.push('le build doit précéder les captures');
  if (build >= 0 && detect >= 0 && build > detect) problemes.push('le build doit précéder le contrôle visuel');
  return problemes;
}

/** Les projets qui existent vraiment, lus dans `vitest.config.ts`. */
const PROJETS_DECLARES = [...vitestConfig.matchAll(/^ +name: '([\w-]+)'/gm)].map((m) => m[1]).sort();

/** Les projets que la CI exécute, lus dans le workflow. */
const PROJETS_CI = [...workflow.matchAll(/--project=([\w-]+)/g)].map((m) => m[1]).sort();

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

  it('sépare les contrôles des deux projets de test, pour que le temps mural soit un maximum (#257)', () => {
    // Le défaut mesuré le 26/10/2026 : un job unique, 11 min 41 s pour un timeout de 15, et
    // **287 s de tests sur une PR contre 525 s sur `main` pour le même code**. En somme, cette
    // variance décidait du rouge ; en maximum, elle ne mange que la marge du job le plus lourd.
    // Sans cette assertion, refusionner les trois jobs en un seul rendrait la CI verte tout en
    // ramenant la panne — c'est exactement ce que le ticket #257 interdit.
    for (const nom of ['controles', 'tests-noyau', 'tests-ecrans']) {
      expect(blocJob(nom), `job « ${nom} » absent`).not.toBe('');
      expect(blocJob(nom)).toMatch(/timeout-minutes: \d+/);
      expect(blocJob(nom)).toContain('run: npm ci');
    }
    // Le job des écrans porte le contrôle visuel ET son build : il doit rester seul à le faire.
    expect(blocJob('tests-ecrans')).toContain('npm run detect:ui:page');
    expect(workflow.match(/npm run detect:ui:page/g)).toHaveLength(1);
  });

  it('exécute **exactement** les projets déclarés dans `vitest.config.ts`, sans trou ni doublon', () => {
    // La garde du découpage : ajouter un projet à `vitest.config.ts` sans l'appeler dans la CI
    // doit rougir. Un projet oublié, ce serait des tests qui ne tournent plus nulle part — une
    // suite verte avec moins de couverture, pire qu'un échec (leçon du `include` de #145).
    expect(PROJETS_DECLARES.length).toBeGreaterThanOrEqual(2);
    expect(PROJETS_CI).toEqual(PROJETS_DECLARES);
  });

  it('enchaîne dans `controles` : npm ci, types, format, garde-fous, puis build', () => {
    const bloc = blocJob('controles');
    const etapes = ['npm ci', 'npm run check', 'npm run format:check', 'npm run garde-fous', 'npm run build'];
    const positions = etapes.map((commande) => bloc.indexOf(`run: ${commande}`));
    for (const [index, position] of positions.entries()) {
      expect(position, `étape manquante dans « controles » : ${etapes[index]}`).toBeGreaterThanOrEqual(0);
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

  it('contrôle les deux navigateurs après le build, dans une seule étape et sans saut possible (#205, #234, #513)', () => {
    // Le contrôle visuel en navigateur (#205, #234) et la hauteur du combat (#513) gardent ce
    // qui se casse en silence : **retirer l'un des deux** rendrait la CI verte alors qu'un
    // écran ne serait plus mesuré. `detect:ui` (regex sur les sources) ne remplacerait pas
    // `detect:ui:page` — il sous-compte, et c'est précisément pour ça que #205 existe.
    const bloc = blocJob('tests-ecrans');
    const etape = blocEtape(bloc, 'Contrôler la hauteur du combat et les écrans dans un navigateur (#205, #234, #513)');
    expect(etape, 'étape « deux navigateurs » absente de tests-ecrans').not.toBe('');
    expect(etape).toContain('npm run capturer');
    expect(etape).toContain('npm run detect:ui:page');
    // Les deux lisent le Chrome de l'image, sous les noms que lisent les scripts.
    expect(etape).toContain('CHROME_PATH: /usr/bin/google-chrome');
    expect(etape).toContain('IMPECCABLE_BROWSER: /usr/bin/google-chrome');
    // Pas de saut : sans navigateur, elle échoue explicitement. **Une seule condition est
    // admise** : le chemin rapide d'une PR de documentation seule (D-143 (1), #422).
    expect(etape.match(/^\s*if:.*$/gm) ?? []).toEqual(["        if: steps.chemins.outputs.doc_seulement != 'true'"]);
    expect(etape).toMatch(/exit 1/);
    // Les deux sont **lancés en parallèle** (#707), **les deux codes sont attendus**, et
    // l'autre processus est fermé dès qu'un échec est connu.
    expect(etape).toMatch(/npm run capturer >[^\n]*&\s*\n\s*capture=\$!/);
    expect(etape).toMatch(/npm run detect:ui:page >[^\n]*&\s*\n\s*detect=\$!/);
    expect(etape).toContain('wait -n -p fini "$capture" "$detect"');
    expect(etape).toContain('wait "$capture"');
    expect(etape).toContain('wait "$detect"');
    expect(etape).toContain('kill -- -"$capture" -"$detect"');
    // Une seule occurrence de chaque commande dans le workflow : une seconde (dans
    // `controles`, par exemple) doublerait le coût sans rien garder de plus.
    expect(workflow.match(/^\s*npm run capturer >/gm) ?? []).toHaveLength(1);
    expect(workflow.match(/^\s*npm run detect:ui:page >/gm) ?? []).toHaveLength(1);
    // Les deux lisent `dist/` : le build doit avoir tourné avant, **dans le même job**.
    expect(ordreDesEcrans(workflow)).toEqual([]);
  });

  it('le contrôle mord : un build après les navigateurs est refusé (#707)', () => {
    // Le cas fautif que `ordreDesEcrans` doit refuser : un YAML où les deux lecteurs de
    // `dist/` passent avant le build. Sans ce test, inverser l'ordre laisserait la garde
    // verte — une assertion qui ne peut pas échouer ne garde rien (AGENTS.md §6).
    const faux = [
      'jobs:',
      '  tests-ecrans:',
      '    steps:',
      '      - name: Navigateurs',
      '        run: |',
      '          npm run capturer',
      '          npm run detect:ui:page',
      '      - name: Build',
      '        run: npm run build',
      ''
    ].join('\n');
    expect(ordreDesEcrans(faux)).toContain('le build doit précéder les captures');
    expect(ordreDesEcrans(faux)).toContain('le build doit précéder le contrôle visuel');
  });

  /**
   * Joue le script **réel** de l'étape des deux navigateurs avec un faux `npm` en tête de
   * `PATH`. C'est ce qui prouve le comportement du shell (échec propagé, processus fermé),
   * pas seulement la présence d'une chaîne dans le YAML.
   */
  function jouerEtapeDesEcrans(fauxNpm: string): { code: number; dossier: string; duree: number } {
    const dossier = mkdtempSync(join(tmpdir(), 'planquex-ecrans-'));
    const npm = join(dossier, 'npm');
    writeFileSync(npm, fauxNpm);
    chmodSync(npm, 0o755);
    const script = scriptEtape(
      blocJob('tests-ecrans'),
      'Contrôler la hauteur du combat et les écrans dans un navigateur (#205, #234, #513)'
    );
    expect(script, 'script de l’étape des deux navigateurs illisible').toContain('wait -n');
    let code = 0;
    const debut = Date.now();
    try {
      execFileSync('bash', ['-c', script], {
        env: {
          ...process.env,
          PATH: `${dossier}:${process.env.PATH}`,
          RUNNER_TEMP: dossier,
          IMPECCABLE_BROWSER: '/bin/true',
          CHROME_PATH: '/bin/true'
        },
        stdio: 'pipe',
        timeout: 10_000
      });
    } catch (erreur) {
      code = (erreur as { status?: number }).status ?? 1;
    }
    return { code, dossier, duree: Date.now() - debut };
  }

  it('un échec de l’un des deux navigateurs fait échouer le job (#707)', () => {
    const fauxNpm = [
      '#!/bin/sh',
      'case "$*" in',
      '  *capturer*) exit 1 ;;',
      '  *detect:ui:page*) exit 0 ;;',
      'esac',
      'exit 0',
      ''
    ].join('\n');
    const { code, dossier } = jouerEtapeDesEcrans(fauxNpm);
    try {
      expect(code, 'un « capturer » qui sort 1 doit faire échouer le job').toBe(1);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it('ferme l’autre navigateur dès qu’un des deux échoue (#707)', () => {
    // La capture est longue ; le détecteur échoue tout de suite. Sans le `kill`, le job
    // attendrait la capture jusqu'au bout et laisserait son groupe de processus vivant.
    const fauxNpm = [
      '#!/bin/sh',
      'case "$*" in',
      '  *detect:ui:page*) exit 1 ;;',
      '  *capturer*) sleep 2; echo oui > "$RUNNER_TEMP/marqueur"; exit 0 ;;',
      'esac',
      'exit 0',
      ''
    ].join('\n');
    const { code, dossier, duree } = jouerEtapeDesEcrans(fauxNpm);
    try {
      expect(code, 'le détecteur qui sort 1 doit faire échouer le job').toBe(1);
      // Le marqueur ne doit pas exister : la capture a été interrompue avant sa fin.
      expect(() => readFileSync(join(dossier, 'marqueur'), 'utf8')).toThrow();
      // Et le job n'a pas attendu les 2 s de la capture : l'autre processus a été fermé.
      expect(duree, `l’étape a attendu ${duree} ms au lieu de fermer la capture`).toBeLessThan(1500);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it('le chemin rapide ne saute rien d’autre que ce que D-143 (1) nomme (#422)', () => {
    // Chaque job calcule les chemins changés, et **tourne toujours** : pas de `paths-ignore`.
    expect(workflow).not.toMatch(/^\s+paths(-ignore)?:/m);
    for (const nom of ['controles', 'tests-noyau', 'tests-ecrans']) {
      expect(blocJob(nom), nom).toContain('node scripts/ci/ci-chemins.mjs');
    }
    // Une condition ne porte que sur le chemin rapide : ni secret, ni branche, ni autre drapeau.
    for (const condition of workflow.match(/^\s*if:.*$/gm) ?? []) {
      expect(condition.trim()).toMatch(/^if: steps\.chemins\.outputs\.doc_seulement [!=]= 'true'$/);
    }
    // Le chemin rapide joue des tests dans les deux jobs de tests : il ne remplace pas la preuve par rien.
    expect(blocJob('tests-noyau')).toContain('steps.chemins.outputs.tests_node');
    expect(blocJob('tests-ecrans')).toContain('steps.chemins.outputs.tests_ui');
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
