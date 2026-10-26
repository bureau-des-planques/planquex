#!/usr/bin/env node
/**
 * Isolation — **le travail d'un agent est-il dans SON worktree ?**
 *
 * ## Le défaut, constaté deux fois
 *
 * Un sous-agent résout le **répertoire de projet** depuis sa session, pas depuis le répertoire
 * qu'on lui annonce dans son brief. Conséquence : un agent à qui l'on donne le chemin d'un
 * worktree peut écrire ses fichiers **dans le dépôt principal**, sans le moindre signal — son
 * propre worktree reste alors **propre**, et son rapport annonce un travail qu'on ne trouverait
 * pas là où on l'attend.
 *
 * Deux incidents, deux formes :
 *
 * - `art-96` (20/10/2026) : **11 fichiers modifiés**, 8 illustrations et un test, commités
 *   **sur `main`** au lieu de sa branche — `main` est resté rouge quelques minutes ;
 * - `arbitrages-infra` (21/10/2026) : un dossier de 115 lignes déposé dans `main`, worktree
 *   intact. Circonstance aggravante : un agent **sans shell** n'a aucun `git -C` pour s'ancrer.
 *
 * Une consigne dans le brief ne suffit pas — elle a été donnée aux deux. Ce script rend le
 * contrôle **exécutable**, donc **non contournable par distraction**.
 *
 * ## Usage
 *
 * ```bash
 * npm run isolation                 # l'état de main et de TOUS les worktrees
 * npm run isolation -- --attendu art-120   # exige que seul ce worktree porte du travail
 * ```
 *
 * Sort **1** si le dépôt principal n'est pas propre (fuite, ou travail non commité à moi), ou si
 * un worktree est en **HEAD détaché** (un commit y serait perdu pour toute branche).
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

const git = (args, cwd = racine) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const attendu = (() => {
  const index = process.argv.indexOf('--attendu');
  return index === -1 ? null : process.argv[index + 1];
})();

/** Les worktrees, d'après `git worktree list --porcelain`. */
function worktrees() {
  const sortie = git(['worktree', 'list', '--porcelain']);
  const blocs = sortie.split('\n\n').filter(Boolean);
  return blocs
    .map((bloc) => {
      const lignes = bloc.split('\n');
      const chemin = lignes.find((l) => l.startsWith('worktree '))?.slice('worktree '.length) ?? '';
      const branche = lignes.find((l) => l.startsWith('branch '))?.slice('branch refs/heads/'.length);
      const detache = lignes.some((l) => l === 'detached');
      return { chemin, branche: branche ?? (detache ? '(HEAD détaché)' : '?'), detache, principal: chemin === racine };
    })
    .filter((entree) => entree.chemin);
}

const entrees = worktrees();
const principal = entrees.find((entree) => entree.principal);
const autres = entrees.filter((entree) => !entree.principal);

const statut = (chemin) => {
  try {
    return git(['status', '--porcelain'], chemin);
  } catch (erreur) {
    return `(illisible : ${String(erreur.message).split('\n')[0]})`;
  }
};

console.log(`Dépôt principal : ${racine}`);
const statutPrincipal = statut(racine);
if (statutPrincipal === '') {
  console.log('  ✔ propre');
} else {
  console.log('  ✖ NON PROPRE — du travail a peut-être été déposé ici par un agent :');
  for (const ligne of statutPrincipal.split('\n')) console.log(`      ${ligne}`);
}

console.log(`\nWorktrees (${autres.length}) :`);
let detache = 0;
let avecTravail = 0;
for (const entree of autres) {
  const nom = entree.chemin.slice(entree.chemin.lastIndexOf('/') + 1);
  const etat = statut(entree.chemin);
  const lignes = etat === '' ? 0 : etat.split('\n').length;
  if (lignes > 0) avecTravail += 1;
  if (entree.detache) detache += 1;
  const marque = entree.detache ? '✖ HEAD détaché' : lignes > 0 ? '•' : ' ✔';
  console.log(
    `  ${marque} ${nom.padEnd(24)} ${String(entree.branche).padEnd(28)} ${lignes === 0 ? '(propre)' : `${lignes} fichier(s)`}`
  );
}

const problemes = [];
if (statutPrincipal !== '') {
  problemes.push(
    'le dépôt principal n’est pas propre : soit une fuite d’agent (voir docs/agents/parallelisme.md §4), soit du travail à moi non commité'
  );
}
if (detache > 0) {
  problemes.push(`${detache} worktree(s) en HEAD détaché : un commit y serait perdu pour toute branche`);
}
if (attendu) {
  const coupables = autres.filter((entree) => {
    const nom = entree.chemin.slice(entree.chemin.lastIndexOf('/') + 1);
    return nom !== attendu && statut(entree.chemin) !== '';
  });
  if (coupables.length > 0) {
    problemes.push(
      `--attendu ${attendu} : ${coupables.map((e) => e.chemin.slice(e.chemin.lastIndexOf('/') + 1)).join(', ')} porte(nt) aussi du travail`
    );
  }
}

console.log('');
if (problemes.length > 0) {
  console.error('✖ Isolation à vérifier :');
  for (const probleme of problemes) console.error(`  - ${probleme}`);
  process.exit(1);
}
console.log(
  `✔ Isolation saine : le dépôt principal est propre, aucun HEAD détaché, ${avecTravail} worktree(s) porte(nt) du travail.`
);
