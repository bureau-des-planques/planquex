#!/usr/bin/env node
/**
 * **L'état du dernier run de CI sur `main`** — ticket #258 (rétro du 26/10/2026), #585.
 *
 * Constat : `main` est restée rouge **8 runs consécutifs pendant 6 h 36** (11:40 → 18:16 le
 * 26/10). La seule chose qui l'a dit, c'est une session qui a interrogé `gh run list` par
 * hasard. La CI ne dit pas « il faut regarder » : elle dit « le job est vert ou il ne l'est
 * pas ». Le pont manquait entre les deux.
 *
 * Ce script est ce pont : il lit le dernier run **du workflow `CI`** (`ci.yml`) sur `main` et
 * **sort 1 si ce run n'est pas green**. Il ne remplace pas la CI — il rend son résultat
 * **visible au bon moment**, avant de fusionner une PR vers `main`, et au moment de la clôture
 * d'une session.
 *
 * #585 : le 02/11/2026, il a pris un run **Dependabot** en échec — plus récent que le run `CI`
 * vert du même commit `79491fc` — pour une rouge de `main`. Une porte de fusion qui crie au
 * loup sur un job sans rapport pousse à la contourner, et c'est ainsi qu'une vraie rouge
 * passera. Le script ne lit donc plus que le workflow que la protection de `main` exige
 * (D-118) : même porte, même lecture.
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

/** Le workflow surveillé : les trois checks que la protection de `main` exige (D-118). */
export const WORKFLOW = 'CI';

/** Le fichier de ce workflow — l'identité stable d'un run, celle que `path` porte. */
export const CHEMIN_WORKFLOW = '.github/workflows/ci.yml';

/** Ce que l'API accepte comme identifiant de workflow : le nom du fichier, pas son chemin. */
const ID_WORKFLOW = 'ci.yml';

/** `main` se juge sur les runs `push` : un run de PR ne dit rien du tronc. */
export const EVENEMENT = 'push';

const REPOS = process.env.GITHUB_REPOSITORY ?? 'bureau-des-planques/planquex';

/**
 * Ce run appartient-il au workflow `CI` sur un `push` ? **Pur.**
 *
 * L'API rend `path` (`.github/workflows/ci.yml`) et `event`. Un run Dependabot porte un `path`
 * `dynamic/dependabot/…` et l'événement `dynamic` : il n'a rien à voir avec le code livré.
 * Le nom ne sert que de repli si l'API omet le chemin (données fabriquées, vieux runs).
 */
export function estRunCI(run) {
  if (!run) return false;
  const duWorkflow = run.path ? run.path === CHEMIN_WORKFLOW : run.name === WORKFLOW;
  return duWorkflow && run.event === EVENEMENT;
}

/**
 * Le dernier run **CI** de la réponse, ou `null`. **Pur** — c'est la fonction que #585 garde.
 *
 * La réponse d'`actions/runs` mêle tous les workflows, triés du plus récent au plus ancien :
 * prendre `workflow_runs[0]` revient à laisser un job Dependabot juger `main`.
 */
export function runCI(reponse) {
  const runs = reponse?.workflow_runs ?? [];
  return runs.find(estRunCI) ?? null;
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

/** Les sept premiers caractères d'un sha, pour nommer un commit sans noyer la sortie. */
export function shaCourt(sha) {
  return typeof sha === 'string' && sha.length > 0 ? sha.slice(0, 7) : null;
}

/**
 * Le verdict, **pur** : une réponse fabriquée suffit à le prouver.
 *
 * Un run ne vaut pour **vert** que s'il est **complété** et **green**. Un run `in_progress`
 * vaut pour rouge ici : on ne fusionne pas sur une base dont on ignore où elle en est.
 *
 * Trois états distincts (#585) : green, pas green, et **aucun run CI** — ce dernier ne dit pas
 * que `main` est rouge, il dit qu'il n'y a rien à juger encore (`absent`).
 */
export function verdict(reponse) {
  const run = runCI(reponse);
  if (!run) {
    const sha = reponse?.shaMain ?? null;
    return {
      ok: false,
      absent: true,
      numero: null,
      sha,
      raison: sha
        ? `main n’a pas encore de run CI sur ${shaCourt(sha)} (aucun run \`${WORKFLOW}\` sur un \`${EVENEMENT}\`)`
        : `aucun run \`${WORKFLOW}\` (${EVENEMENT}) trouvé pour \`${BRANCHE}\``
    };
  }
  const numero = numeroDe(run);
  const sha = run.head_sha ?? reponse?.shaMain ?? null;
  if (run.status && run.status !== 'completed')
    return { ok: false, numero, sha, raison: `le run ${WORKFLOW} #${numero} n’est pas terminé (${run.status})` };
  if (run.conclusion && run.conclusion !== 'success')
    return { ok: false, numero, sha, raison: `le run ${WORKFLOW} #${numero} conclut ${run.conclusion}` };
  return { ok: true, numero, conclusion: run.conclusion, date: run.created_at, sha };
}

/** Le sha de `main`, ou `null` si le CLI ne le rend pas. Ne jette pas : le sha n'est qu'un nom. */
function lireShaMain(gh) {
  try {
    const sha = gh('gh', ['api', `repos/${REPOS}/commits/${BRANCHE}`, '--jq', '.sha'], { encoding: 'utf8' });
    return sha.trim() || null;
  } catch {
    // Le message générique suffit ; un sha absent ne doit pas casser la porte de fusion.
    return null;
  }
}

/**
 * Lit les derniers runs **du workflow `CI`** sur `main` via le CLI `gh`. Le réseau n'est pas
 * testé, la pure l'est.
 *
 * L'API accepte le nom de fichier comme identifiant de workflow : on ne demande donc que les
 * runs de `ci.yml`, sur `push`, et `runCI` revérifie la forme. Le sha de `main` n'est lu
 * qu'en l'absence de run CI — c'est le seul cas où il sert (nommer le commit sans run).
 */
export function lire({ gh = execFileSync } = {}) {
  const sortie = gh(
    'gh',
    ['api', `repos/${REPOS}/actions/workflows/${ID_WORKFLOW}/runs?branch=${BRANCHE}&event=${EVENEMENT}&per_page=10`],
    { encoding: 'utf8' }
  );
  const reponse = JSON.parse(sortie);
  if (!runCI(reponse)) reponse.shaMain = lireShaMain(gh);
  return reponse;
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
  if (v.ok) {
    const sha = shaCourt(v.sha);
    log(`✔ main est green — ${WORKFLOW} · run #${v.numero}${sha ? ` · ${sha}` : ''}.`);
  } else if (v.absent) {
    const sha = shaCourt(v.sha);
    erreur(
      `✖ main n’a pas encore de run CI sur ${sha ?? 'son dernier commit'} : rien à juger, ne pas conclure au vert.`
    );
  } else {
    erreur(`✖ main n’est pas green : ${v.raison}. Ne pas fusionner sans savoir pourquoi.`);
  }
  return codeDuVerdict(v);
}

const lance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (lance) process.exitCode = executer();
