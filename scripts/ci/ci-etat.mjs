#!/usr/bin/env node
/**
 * **L'état du dernier run de CI sur `main`** — ticket #258 (rétro du 26/10/2026).
 *
 * Constat : `main` est restée rouge **8 runs consécutifs pendant 6 h 36** (11:40 → 18:16 le
 * 26/10). La seule chose qui l'a dit, c'est une session qui a interrogé `gh run list` par
 * hasard. La CI ne dit pas « il faut regarder » : elle dit « le job est vert ou il ne l'est
 * pas ». Le pont manquait entre les deux.
 *
 * Ce script est ce pont : il lit le dernier run de la branche et **sort 1 si ce run n'est pas
 * green**. Il ne remplace pas la CI — il rend son résultat **visible au bon moment**, avant de
 * fusionner une PR vers `main`, et au moment de la clôture d'une session.
 *
 * Usage :
 *   npm run ci:etat
 *
 * Il n'est **pas** un artefact de build : c'est un outil de poste de pilotage, comme le CLI
 * `gh` — le dépôt étant privé, l'API répond `404` sans jeton, d'où le passage par le CLI et
 * non par un jeton embarqué (même contrainte que pour `plan:dev`, #214, D-097).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** La branche surveillée : le tronc unique du dépôt (D-113). */
export const BRANCHE = 'main';

const REPOS = process.env.GITHUB_REPOSITORY ?? 'bureau-des-planques/planquex';

/** Le dernier run de la branche, ou `null` si l'API n'en rend aucun. Pur. */
export function runDernier(reponse) {
  return reponse?.workflow_runs?.[0] ?? null;
}

/**
 * Le numéro **lisible** d'un run.
 *
 * L'API d'Actions rend `run_number` (le compteur par workflow) et `id` (l'identifiant long) —
 * **pas** `number`. Constaté le 26/10/2026 : la première version lisait `number` et affichait
 * `run #undefined` alors que le verdict était bon. Les données fabriquées du test portaient
 * `number` et ne le voyaient pas ; le test lit donc désormais la forme réelle de l'API.
 */
export function numeroDe(run) {
  return run?.run_number ?? run?.id ?? null;
}

/**
 * Le verdict, **pur** : une réponse fabriquée suffit à le prouver.
 *
 * Un run ne vaut pour **vert** que s'il est **complété** et **green**. Un run `in_progress`
 * vaut pour rouge ici : on ne fusionne pas sur une base dont on ignore où elle en est.
 */
export function verdict(reponse) {
  const run = runDernier(reponse);
  if (!run) return { ok: false, numero: null, raison: `aucun run d’Actions trouvé pour \`${BRANCHE}\`` };
  const numero = numeroDe(run);
  if (run.status && run.status !== 'completed')
    return { ok: false, numero, raison: `le run #${numero} n’est pas terminé (${run.status})` };
  if (run.conclusion && run.conclusion !== 'success')
    return { ok: false, numero, raison: `le run #${numero} conclut ${run.conclusion}` };
  return { ok: true, numero, conclusion: run.conclusion, date: run.created_at };
}

/** Lit le dernier run de la branche via le CLI `gh`. Le réseau n'est pas testé, la pure l'est. */
export function lire() {
  const sortie = execFileSync('gh', ['api', `repos/${REPOS}/actions/runs?branch=${BRANCHE}&per_page=1`], {
    encoding: 'utf8'
  });
  return JSON.parse(sortie);
}

/** 0 si `main` est green, 1 sinon. L'appelant décide de ce qu'il en fait. */
export function codeDuVerdict(v) {
  return v.ok ? 0 : 1;
}

/**
 * Point d'entrée : imprime le verdict et pose le code de sortie.
 *
 * `lire` est injecté pour que le test puisse l'appeler sans réseau — même patron que
 * `ouvrirNavigateur(url, lancer)` (`AGENTS.md` §6).
 */
export function executer(lecture = lire, log = console.log, erreur = console.error) {
  const v = verdict(lecture());
  if (v.ok) log(`✔ main est green — run #${v.numero} (${v.date}).`);
  else erreur(`✖ main n’est pas green : ${v.raison}. Ne pas fusionner sans savoir pourquoi.`);
  return codeDuVerdict(v);
}

const lance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (lance) process.exitCode = executer();
