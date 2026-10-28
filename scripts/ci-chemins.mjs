#!/usr/bin/env node
/**
 * **Ce qu'une PR peut casser** — le chemin rapide de la CI (D-143, #422).
 *
 * Une PR qui ne touche que de la documentation ne rejoue pas toute la suite : elle joue les
 * **tests qui lisent un document** (les gardes de cohérence de D-143 (1), et tous les autres
 * fichiers de test qui lisent un `.md` — `capturer.test.ts` relit D-142, `docs-commandes.test.ts`
 * relit `docs/COMMANDES.md`…). Les écrans, `detect:ui:page`, le moteur, les données, `build` et
 * `garde-fous` ne tournent pas : une PR de doc ne peut pas les casser.
 *
 * **Les jobs tournent toujours** (D-143 (3)) : ce script ne décide que des étapes. Un job non
 * déclenché ne reporterait jamais son statut, et le ruleset de `main` attend les trois.
 *
 * La liste des tests qui lisent les docs est **calculée**, pas recopiée : un test qui se met à
 * lire un document entre seul dans le chemin rapide.
 *
 * Usage (CI) :
 *   node scripts/ci-chemins.mjs --base <sha>   écrit dans $GITHUB_OUTPUT (ou sur stdout)
 *     doc_seulement=true|false
 *     tests_node=<fichiers du projet node qui lisent un document>
 *     tests_ui=<fichiers du projet ui qui lisent un document>
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));

/**
 * Un chemin de **documentation** au sens de D-143 (1) : `docs/**` (preuves comprises), ou un
 * `*.md` ailleurs — **sauf** sous `design/` (que `src/data/art.test.ts` lit, D-143 (2)) et sous
 * `src/` ou `supabase/` (du code, même en Markdown).
 */
export function estCheminDoc(chemin) {
  if (chemin.startsWith('docs/')) return true;
  if (!chemin.endsWith('.md')) return false;
  return !['design/', 'src/', 'supabase/', 'public/'].some((dossier) => chemin.startsWith(dossier));
}

/** Le chemin rapide : **au moins un** fichier, et **tous** des chemins de doc. Une PR mixte prend tout. */
export function docSeulement(chemins) {
  return chemins.length > 0 && chemins.every(estCheminDoc);
}

/**
 * Un fichier de test **lit un document** s'il lit le disque et cite un chemin de doc dans une
 * chaîne : `docs/…`, un `.md`, ou un des documents de la racine.
 */
export function litUnDocument(source) {
  if (!/readFileSync|readdirSync/.test(source)) return false;
  return /['`"][^'`"\n]*(docs\/|\.md['`"])/.test(source);
}

/** Les fichiers de test du dépôt, par projet de `vitest.config.ts` : `.test.tsx` = ui, `.test.ts` = node. */
function fichiersDeTest() {
  const trouves = [];
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      if (nom === 'node_modules' || nom.startsWith('.')) continue;
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.test\.tsx?$/.test(nom)) trouves.push(relative(racine, chemin));
    }
  };
  for (const dossier of ['src', 'scripts', 'supabase', 'tools']) {
    try {
      parcourir(join(racine, dossier));
    } catch {
      // Un dossier absent n'a pas de test.
    }
  }
  return trouves.sort();
}

export function testsQuiLisentLesDocs() {
  const lisent = fichiersDeTest().filter((chemin) => litUnDocument(readFileSync(join(racine, chemin), 'utf8')));
  return {
    node: lisent.filter((chemin) => chemin.endsWith('.test.ts')),
    ui: lisent.filter((chemin) => chemin.endsWith('.test.tsx'))
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--base');
  const base = index === -1 ? '' : process.argv[index + 1];
  // Sans base (un push sur `main`), rien n'est sauté : la suite complète tourne.
  const chemins = base
    ? execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { cwd: racine, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    : [];
  const rapide = docSeulement(chemins);
  const { node, ui } = testsQuiLisentLesDocs();
  const sortie = [`doc_seulement=${rapide}`, `tests_node=${node.join(' ')}`, `tests_ui=${ui.join(' ')}`].join('\n');
  console.log(`${chemins.length} fichier(s) changé(s) ; chemin rapide : ${rapide ? 'oui' : 'non'}`);
  for (const chemin of chemins) console.log(`  ${estCheminDoc(chemin) ? 'doc ' : 'code'}  ${chemin}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${sortie}\n`);
  else console.log(sortie);
}
