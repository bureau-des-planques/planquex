#!/usr/bin/env node
/**
 * Le formateur, lancé **par le binaire du dépôt** — et qui refuse de mentir quand il manque
 * (#422, D-143).
 *
 * ## Le défaut, constaté le 28/10/2026
 *
 * `format:check` était `prettier --check …` tout court. Quand `prettier` n'est pas dans
 * `node_modules`, le shell répond **127** (« command not found ») : un code de sortie que
 * personne ne lit comme « le contrôle n'a pas tourné ». Les agents de la journée ont donc
 * contourné avec `~/.npm/_npx/…`, et **deux PR sont tombées en CI** sur un formatage que le
 * contrôle local n'avait jamais vérifié. Un contrôle local qui ne mesure pas la même chose que
 * la CI ne vaut pas mieux que pas de contrôle.
 *
 * ## Ce que ce script fait
 *
 * 1. Il **résout** le binaire dans `node_modules/prettier` (jamais le `PATH`, jamais `npx` : le
 *    formateur de la CI est celui de `package-lock.json`, point).
 * 2. S'il manque, il **échoue avec la marche à suivre** — exit 1, un message qui nomme la
 *    version attendue (lue dans `package.json`, jamais recopiée) et la commande qui
 *    l'installe. Pas de 127, pas de silence.
 * 3. Il passe les motifs tels quels (prettier les développe lui-même) : `--write` pour
 *    `npm run format`, `--check` sinon (ce que la CI lance).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RACINE = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Ce que le formateur touche. `src/data/`, les docs et `dist/` n'y sont pas : `.prettierignore`
 * dit pourquoi, ligne à ligne (un texte de carte tient sur une ligne, un repli le changerait).
 */
export const MOTIFS = ['src/**/*.{ts,tsx}', 'scripts/**/*.mjs', 'tools/**/*.mjs', 'supabase/**/*.ts', '*.json', '*.ts'];

/** Le binaire de prettier d'un dossier, ou `null` s'il n'est pas installé. */
export function binairePrettier(racine = RACINE) {
  const chemin = join(racine, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  return existsSync(chemin) ? chemin : null;
}

/** La version **demandée** par `package.json` : une seule source, jamais recopiée ici. */
export function versionDemandee(racine = RACINE) {
  try {
    const pkg = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
    return pkg.devDependencies?.prettier ?? pkg.dependencies?.prettier ?? null;
  } catch {
    return null;
  }
}

/** Ce qu'on dit à quelqu'un dont le formateur manque. Il doit pouvoir agir sans chercher. */
export function messageAbsent(racine = RACINE, version = versionDemandee(racine)) {
  return [
    'formatage : prettier est ABSENT de node_modules — le contrôle ne peut pas tourner.',
    `  attendu   : prettier ${version ?? '(devDependencies de package.json)'} dans ${join(racine, 'node_modules', 'prettier')}`,
    '  installer : npm run installer   (depuis un worktree ; jamais `npm ci` dans le dépôt principal)',
    '  ne pas contourner par `npx prettier` : ce n’est pas le binaire de package-lock.json,',
    '  et c’est ainsi que deux PR sont tombées en CI le 28/10/2026 (#422).'
  ].join('\n');
}

const estLance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estLance) {
  const binaire = binairePrettier();
  if (!binaire) {
    console.error(messageAbsent());
    process.exit(1);
  }
  const mode = process.argv.includes('--write') ? '--write' : '--check';
  const { status, error } = spawnSync(process.execPath, [binaire, mode, ...MOTIFS], {
    cwd: RACINE,
    stdio: 'inherit'
  });
  if (error) {
    console.error(`formatage : le binaire ${binaire} n’a pas pu être lancé — ${error.message}`);
    process.exit(1);
  }
  process.exit(status ?? 1);
}
