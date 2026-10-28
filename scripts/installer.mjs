#!/usr/bin/env node
/**
 * Installer les dépendances **dans un worktree**, jamais sous les pieds des autres sessions.
 *
 * ## Le défaut, constaté le 26/10/2026
 *
 * `npm ci` **vide `node_modules/` avant de le reconstruire**. Un sous-agent (#220) dont le shell
 * s'ouvrait dans le dépôt principal — le même défaut que `art-96` et `arbitrages-infra`
 * (`docs/agents/parallelisme.md` §4) — y a lancé `npm ci` quatre fois entre 09:44 et 09:45.
 * La session d'infra, qui testait dans ce dépôt, a eu `vitest: not found` puis des modules
 * absents pendant cinq minutes. Un brief qui dit « chemins absolus » ne suffit pas : `npm ci`
 * ne se lit pas dans un `git status`.
 *
 * ## Contrat
 *
 * - `npm run installer` lance `npm ci` **dans le dossier courant**, sauf si c'est le dépôt
 *   principal (refus, exit 1) ou si `node_modules` y est un **lien symbolique** — `npm ci`
 *   suivrait le lien et viderait sa cible (les worktrees de comparaison en font un vers le
 *   dépôt principal).
 * - Le dépôt principal reste installable à la main, par une personne : `npm run installer --
 *   --principal`.
 * - Les autres arguments partent à `npm ci` tels quels (`--offline`, `--silent`…).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { binairePrettier, messageAbsent, versionDemandee } from './format-check.mjs';

/** Décide si `npm ci` peut partir. Pur : testé sans git ni disque. */
export function verdict({ gitDir, communDir, nodeModulesEstLien, principalVoulu = false }) {
  if (nodeModulesEstLien) {
    return {
      ok: false,
      raison:
        '`node_modules` est un lien symbolique : `npm ci` viderait sa cible (souvent le dépôt principal). ' +
        'Retirer le lien (`rm node_modules`, sans slash final), puis relancer.'
    };
  }
  const principal = resolve(gitDir) === resolve(communDir);
  if (principal && !principalVoulu) {
    return {
      ok: false,
      raison:
        'Dépôt principal : `npm ci` y vide `node_modules/` sous les pieds des autres sessions. ' +
        'Travailler dans un worktree (`git worktree add`), ou, si une personne le veut ici, `npm run installer -- --principal`.'
    };
  }
  return { ok: true };
}

function lien(chemin) {
  try {
    return lstatSync(chemin).isSymbolicLink();
  } catch {
    return false;
  }
}

const estLance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estLance) {
  const git = (...args) =>
    execFileSync('git', ['rev-parse', '--path-format=absolute', ...args], { encoding: 'utf8' }).trim();
  const args = process.argv.slice(2);
  const principalVoulu = args.includes('--principal');
  const decision = verdict({
    gitDir: git('--git-dir'),
    communDir: git('--git-common-dir'),
    nodeModulesEstLien: lien(resolve('node_modules')),
    principalVoulu
  });
  if (!decision.ok) {
    console.error(`installer : refus — ${decision.raison}`);
    process.exit(1);
  }
  console.log(`installer : npm ci dans ${process.cwd()}`);
  const { status } = spawnSync('npm', ['ci', ...args.filter((a) => a !== '--principal')], { stdio: 'inherit' });
  if ((status ?? 1) !== 0) process.exit(status ?? 1);

  // **Le formateur, vérifié et non supposé** (#422). Une installation qui laisse `prettier`
  // dehors rend `npm run format:check` menteur — c'est ce qui a fait tomber deux PR le
  // 28/10/2026. On le dit ici, une fois, plutôt que de le découvrir au premier contrôle.
  if (!binairePrettier()) {
    console.error(messageAbsent());
    process.exit(1);
  }
  console.log(`installer : prettier ${versionDemandee()} présent dans node_modules`);
  process.exit(0);
}
