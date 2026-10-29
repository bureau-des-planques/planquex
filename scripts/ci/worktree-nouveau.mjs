#!/usr/bin/env node
// worktree:nouveau — un worktree prêt à travailler : branche, dossier, dépendances.
//
// Pourquoi il existe (rétro du 28/10/2026) : la règle « installer par `npm run installer`
// dans le worktree » est écrite (`docs/agents/parallelisme.md` §4.10), mais elle se perd.
// Mesuré du 26 au 28/10 : 14 sorties d'erreur citent `node_modules/prettier` ou `vitest`
// manquants, et chaque oubli coûte un aller-retour (`npm ci` refait à la main, ou un test
// qui ne démarre pas). Ce geste fait les trois étapes ensemble, ou n'en fait aucune.
//
// Usage :
//   npm run worktree:nouveau -- 427-sortie-combat
//   npm run worktree:nouveau -- 427-sortie-combat --branche feat/427 --depuis origin/main
//
// Le dossier par défaut : ~/.local/share/opencode/worktree/<dépôt>/<nom>, en chemin absolu.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';

const NOM_VALIDE = /^[a-z0-9][a-z0-9-]*$/;

/** Lit les arguments. Rend `{ nom, branche, depuis, racine, erreurs }`. */
export function analyserArguments(argv, { home = homedir(), depot = basename(process.cwd()) } = {}) {
  const erreurs = [];
  let nom = null;
  let branche = null;
  let depuis = 'origin/main';
  let racine = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--branche') branche = argv[++i] ?? null;
    else if (a.startsWith('--branche=')) branche = a.slice('--branche='.length);
    else if (a === '--depuis') depuis = argv[++i] ?? depuis;
    else if (a.startsWith('--depuis=')) depuis = a.slice('--depuis='.length);
    else if (a === '--racine') racine = argv[++i] ?? null;
    else if (a.startsWith('--racine=')) racine = a.slice('--racine='.length);
    else if (a.startsWith('-')) erreurs.push(`option inconnue : ${a}`);
    else if (nom === null) nom = a;
    else erreurs.push(`argument en trop : ${a}`);
  }
  if (!nom) erreurs.push('nom manquant — `npm run worktree:nouveau -- <nom>`');
  else if (!NOM_VALIDE.test(nom)) erreurs.push(`nom invalide « ${nom} » : minuscules, chiffres et tirets seulement`);
  if (branche !== null && !branche.trim()) erreurs.push('branche vide');
  if (!depuis.trim()) erreurs.push('référence de départ vide');
  if (racine !== null && !racine.trim()) erreurs.push('racine vide');

  const cible = nom ? resolve(racine ?? join(home, '.local/share/opencode/worktree', depot), nom) : null;
  if (cible && !isAbsolute(cible)) erreurs.push('la cible doit être un chemin absolu');
  return { nom, branche: branche ?? (nom ? `agent/${nom}` : ''), depuis, cible: cible ?? '', erreurs };
}

/** Refuse une cible déjà prise, un worktree déjà enregistré ou une branche existante. */
export function verifier(plan, { existe = () => false, brancheExiste = () => false } = {}) {
  const erreurs = [];
  if (!plan.cible) return ['aucune cible'];
  if (existe(plan.cible)) erreurs.push(`le dossier existe déjà : ${plan.cible}`);
  if (brancheExiste(plan.branche)) erreurs.push(`la branche existe déjà : ${plan.branche}`);
  return erreurs;
}

/**
 * Les trois gestes, dans l'ordre. `lancer(argv, cwd)` est injectable : les tests
 * vérifient la séquence sans toucher au dépôt ni au disque.
 */
export function executer(
  plan,
  {
    cwd = process.cwd(),
    lancer = (argv, ou) => execFileSync(argv[0], argv.slice(1), { cwd: ou, stdio: 'inherit' })
  } = {}
) {
  lancer(['git', 'fetch', 'origin', '--prune'], cwd);
  lancer(['git', 'worktree', 'add', '-b', plan.branche, plan.cible, plan.depuis], cwd);
  lancer(['npm', 'run', 'installer'], plan.cible);
  return { cible: plan.cible, branche: plan.branche, depuis: plan.depuis };
}

const estLance = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (estLance) {
  const plan = analyserArguments(process.argv.slice(2));
  const erreurs = plan.erreurs.length
    ? plan.erreurs
    : verifier(plan, {
        existe: (chemin) => existsSync(chemin),
        brancheExiste: (nom) => {
          try {
            execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${nom}`], { stdio: 'ignore' });
            return true;
          } catch {
            return false;
          }
        }
      });
  if (erreurs.length) {
    console.error(`worktree:nouveau : refus\n  - ${erreurs.join('\n  - ')}`);
    process.exit(1);
  }
  const r = executer(plan);
  console.log(`worktree prêt : ${r.cible}`);
  console.log(`  branche ${r.branche}, depuis ${r.depuis}, dépendances installées`);
}
