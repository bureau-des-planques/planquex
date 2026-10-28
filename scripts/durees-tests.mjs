#!/usr/bin/env node
/**
 * **Les tests les plus lents, publiés** — D-143 (5), #422.
 *
 * Une suite qui grossit dérive sans qu'on le voie : on trouvait les lents « par hasard ». Cette
 * commande lit le rapport JSON de `vitest` et fait deux choses :
 *
 * 1. elle **classe** les fichiers de test par durée et imprime les **dix plus lents** (c'est la
 *    table publiée dans `docs/COMMANDES.md`) ;
 * 2. elle **refuse** un fichier au-delà de **5 s** qui ne dit pas, dans ses vingt-cinq
 *    premières lignes, **pourquoi** il est lent (une ligne `Lent :` en commentaire). Un test
 *    qui ne sait pas se justifier se corrige ; un test qui se justifie reste.
 *
 * Usage :
 *   npm run tests:lents                      lance la suite (les deux projets) et relit le rapport
 *   node scripts/durees-tests.mjs [rapport]  relit un rapport déjà écrit, sans relancer la suite
 *
 * Sortie : 0 si chaque fichier au-delà de 5 s est justifié, 1 sinon. Le rapport par défaut est
 * `node_modules/.durees-tests.json` (ignoré par git, produit par `npm run tests:lents`).
 *
 * Les fonctions sont pures (un rapport et un lecteur de fichiers en entrée) : `durees-tests.test.ts`
 * les confronte à des cas fautifs.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));

/** Au-delà de ce seuil, un fichier doit se justifier en tête. */
export const SEUIL_SECONDES = 5;

/** Le nombre de lignes publiées. */
export const TOP = 10;

/** La justification : une ligne `Lent :` dans les premières lignes du fichier. */
export const MARQUEUR = /\bLent\s*:/;

/** Jusqu'où le marqueur doit apparaître pour compter comme « en tête ». */
export const LIGNES_EN_TETE = 25;

/**
 * Classe les fichiers du rapport vitest, du plus lent au plus rapide. La durée est celle du
 * fichier entier (montage, `beforeAll` et cas compris), pas la somme des cas.
 * @param {{ testResults: { name: string, startTime: number, endTime: number }[] }} rapport
 * @param {string} base dossier dont les chemins sont relatifs
 * @returns {{ fichier: string, duree: number }[]}
 */
export function classer(rapport, base = racine) {
  return rapport.testResults
    .map((t) => ({
      fichier: relative(base, t.name).split('\\').join('/'),
      duree: (t.endTime - t.startTime) / 1000
    }))
    .sort((a, b) => b.duree - a.duree || a.fichier.localeCompare(b.fichier));
}

/**
 * Les fichiers au-delà du seuil dont la tête ne porte pas de justification.
 * @param {{ fichier: string, duree: number }[]} lignes
 * @param {(fichier: string) => string} lireFichier renvoie le texte du fichier
 */
export function sansJustification(lignes, lireFichier) {
  return lignes.filter((l) => {
    if (l.duree <= SEUIL_SECONDES) return false;
    const tete = lireFichier(l.fichier).split('\n').slice(0, LIGNES_EN_TETE).join('\n');
    return !MARQUEUR.test(tete);
  });
}

/**
 * La table publiée : les `n` premiers, en markdown.
 * @param {{ fichier: string, duree: number }[]} lignes
 */
export function tableau(lignes, n = TOP) {
  const corps = lignes.slice(0, n).map((l) => `| \`${l.fichier}\` | ${l.duree.toFixed(1).replace('.', ',')} |`);
  return ['| Fichier | Durée (s) |', '|---|---|', ...corps].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const chemin = process.argv[2] ?? join(racine, 'node_modules', '.durees-tests.json');
  const rapport = JSON.parse(readFileSync(chemin, 'utf8'));
  const lignes = classer(rapport);
  console.log(tableau(lignes));
  const au_dela = lignes.filter((l) => l.duree > SEUIL_SECONDES).length;
  console.log(`\n${lignes.length} fichiers, ${au_dela} au-delà de ${SEUIL_SECONDES} s.`);
  const fautifs = sansJustification(lignes, (f) => readFileSync(join(racine, f), 'utf8'));
  if (fautifs.length > 0) {
    for (const l of fautifs) {
      console.error(`Sans justification (ligne « Lent : » en tête requise) : ${l.fichier} (${l.duree.toFixed(1)} s)`);
    }
    process.exit(1);
  }
}
