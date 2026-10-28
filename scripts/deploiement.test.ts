import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contrôle du workflow de production par tag (#420, D-140).
 *
 * La production ne part que sur un tag `v*`, après une build, avec un jeton lu dans les secrets,
 * et le job échoue si le jeton manque. Le fichier YAML est lu comme du texte (même choix que
 * `src/ci.test.ts`, #52) : on ne recopie aucune version d'action, on garde des **invariants**.
 *
 * `manquements()` rend la liste des écarts d'un workflow. Le test applique cette liste au vrai
 * fichier (aucun écart) et à des **workflows fabriqués** qui publient sans builder, ou sans jeton :
 * sans eux, le contrôle pourrait passer vert sans rien garder.
 */
const WORKFLOW_PATH = fileURLToPath(new URL('../.github/workflows/deploiement.yml', import.meta.url));
const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

function manquements(yaml: string): string[] {
  const ecarts: string[] = [];
  if (!/^ {2}push:\n {4}tags: \['v\*'\]/m.test(yaml)) ecarts.push('pas de déclenchement sur un tag v*');
  if (/^ {2}push:\n {4}branches:/m.test(yaml)) ecarts.push('déclenchement sur une branche');
  if (!/^ {2}workflow_dispatch:/m.test(yaml)) ecarts.push('workflow_dispatch absent');
  if (!yaml.includes('refs/tags/v*)')) ecarts.push('la ref n’est pas vérifiée comme tag v*');
  if (/continue-on-error/.test(yaml)) ecarts.push('continue-on-error');
  if (!/^concurrency:/m.test(yaml)) ecarts.push('pas de concurrency (deux déploiements se chevaucheraient)');

  const avantBuild = yaml.indexOf('npm run build');
  const deploiement = yaml.search(/vercel(@\S+)? deploy/);
  if (deploiement === -1) ecarts.push('aucun `vercel deploy`');
  else if (avantBuild === -1 || avantBuild > deploiement) ecarts.push('build absent ou placé après le déploiement');
  if (!/^\s+npx --yes vercel@\S+ deploy[^\n]*--prod/m.test(yaml)) ecarts.push('le déploiement n’est pas en --prod');
  // Le CLI n'est pas une dépendance (AGENTS.md §1.7) : chaque appel le prend à une version exacte.
  for (const appel of yaml.match(/vercel@\S*/g) ?? []) {
    if (!/^vercel@\d+\.\d+\.\d+$/.test(appel)) ecarts.push(`CLI Vercel sans version exacte : ${appel}`);
  }
  if (/npm exec[^\n]*vercel|^\s+vercel /m.test(yaml)) ecarts.push('CLI Vercel appelé sans version épinglée');

  if (!yaml.includes('secrets.VERCEL_TOKEN')) ecarts.push('jeton non lu dans secrets.VERCEL_TOKEN');
  if (/VERCEL_TOKEN=\S|--token[ =]/.test(yaml)) ecarts.push('jeton écrit en clair ou sur la ligne de commande');
  if (!/-z "\$\{!nom:-\}"[\s\S]*?exit 1/.test(yaml)) ecarts.push('jeton manquant ne fait pas échouer le job');
  return ecarts;
}

describe('.github/workflows/deploiement.yml (#420, D-140)', () => {
  it('ne publie la production que sur un tag v*, et sans écart', () => {
    expect(manquements(workflow)).toEqual([]);
  });

  it('le contrôle mord : retirer la build du vrai fichier fait échouer le contrôle', () => {
    const sansBuild = workflow.replace('npm run build\n          ls -la dist/index.html dist/sw.js', 'echo ignore');
    expect(sansBuild).not.toBe(workflow);
    expect(manquements(sansBuild).join('\n')).toMatch(/build absent/);
  });

  it('le contrôle mord : un workflow fabriqué qui publie sans builder est refusé', () => {
    const fabrique = [
      'name: fabriqué',
      'on:',
      '  push:',
      "    tags: ['v*']",
      'concurrency:',
      '  group: x',
      'jobs:',
      '  p:',
      '    steps:',
      '      - env:',
      '          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}',
      '        run: npx --yes vercel@64.0.2 deploy --prod',
      ''
    ].join('\n');
    const ecarts = manquements(fabrique).join('\n');
    expect(ecarts).toMatch(/build absent/);
    expect(ecarts).toMatch(/jeton manquant ne fait pas échouer/);
  });

  it('le contrôle mord : un CLI Vercel sans version exacte est refusé', () => {
    const flottant = workflow.replaceAll('vercel@64.0.2', 'vercel@latest');
    expect(manquements(flottant).join('\n')).toMatch(/sans version exacte/);
  });

  it('le contrôle mord : un déclenchement sur les branches ou un jeton en clair sont refusés', () => {
    const branches = workflow.replace("    tags: ['v*']", "    branches: [main]\n    tags: ['v*']");
    expect(manquements(branches).join('\n')).toMatch(/déclenchement sur une branche/);
    const enClair = workflow.replace('--prod\n', '--prod --token abc123\n');
    expect(manquements(enClair).join('\n')).toMatch(/en clair/);
  });

  it('n’exige aucun secret hors de VERCEL_*, et ne masque aucun échec', () => {
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(workflow.match(/secrets\.\w+/g) ?? []).toEqual(
      expect.arrayContaining(['secrets.VERCEL_TOKEN', 'secrets.VERCEL_ORG_ID', 'secrets.VERCEL_PROJECT_ID'])
    );
    for (const secret of workflow.match(/secrets\.\w+/g) ?? []) {
      expect(secret.startsWith('secrets.VERCEL_')).toBe(true);
    }
  });
});
