import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * L'index des décisions — la porte d'entrée de `docs/DECISIONS.md`.
 *
 * Constaté le 26/10/2026 : `AGENTS.md` §1.1 demandait de **lire** `docs/DECISIONS.md` avant
 * toute modification. Le journal fait **113 décisions et 36 000 jetons** (une ligne de tableau
 * par décision, jusqu'à 3 900 caractères). Mesure sur trois jours de sessions : 5 sessions
 * l'ont lu puis ont écrit, **68 ont écrit sans le lire**, et 123 greps ciblés ont remplacé la
 * lecture. La règle était un no-op — on ne peut pas l'obéir.
 *
 * Cet index la rend tenable **sans toucher au journal** : une ligne par décision
 * (`| D-NNN | date | début de l'intitulé |`), puis on ouvre la ligne du tableau. Il vit dans
 * `docs/DECISIONS-INDEX.md`, **dérivé**, jamais écrit à la main, et `scripts/decisions.test.ts`
 * refuse un index qui ne couvre pas exactement les décisions du journal, dans l'ordre.
 *
 * Un fichier à part, et pas un bloc en tête du journal : le tableau de `DECISIONS.md` est lu
 * par un test qui exige **4 colonnes** et des identifiants **uniques** — un index inséré
 * dedans casse les deux (constaté en l'essayant le 26/10/2026).
 *
 * Usage : `npm run index:decisions` (réécrit), `-- --verifie` (sort 1 si divergence, sans rien
 * écrire : c'est ce que la CI demande).
 */

const RACINE = new URL('..', import.meta.url);
const JOURNAL = fileURLToPath(new URL('docs/DECISIONS.md', RACINE));
const INDEX = fileURLToPath(new URL('docs/DECISIONS-INDEX.md', RACINE));

/** Les décisions lues dans le journal, dans l'ordre où il les porte. */
export function decisions(texte) {
  const out = [];
  for (const ligne of texte.split('\n')) {
    const m = ligne.match(/^\|\s*(D-\d+)\s*\|\s*([0-9/]+)\s*\|\s*(.*?)\s*\|/);
    if (!m) continue;
    const resume = m[3]
      .replace(/^⚠️\s*/, '⚠ ')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\((?:Bastien|exécution)[^)]*\)/g, '')
      .replace(/\([^)]*#[0-9][^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const mots = resume.split(' ');
    out.push({
      id: m[1],
      date: m[2],
      court: mots.slice(0, 10).join(' ') + (mots.length > 10 ? '…' : ''),
    });
  }
  return out;
}

/** Le fichier d'index complet, prêt à écrire. */
export function rendre(liste) {
  return [
    '# Index des décisions',
    '',
    "> **Dérivé** de `docs/DECISIONS.md` par `npm run index:decisions` — ne pas éditer à la main.",
    `> ${liste.length} décisions. Le journal fait 36 000 jetons : cet index est la porte d'entrée,`,
    "> puis on ouvre la ligne du tableau.",
    '',
    '| ID | Date | Intitulé (début) |',
    '|---|---|---|',
    ...liste.map((d) => `| ${d.id} | ${d.date} | ${d.court} |`),
    '',
  ].join('\n');
}

const lance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (lance) {
  const attendu = rendre(decisions(readFileSync(JOURNAL, 'utf8')));
  let actuel = '';
  try {
    actuel = readFileSync(INDEX, 'utf8');
  } catch {
    /* premier passage */
  }
  const verifie = process.argv.includes('--verifie');
  if (actuel === attendu) {
    console.log('✔ docs/DECISIONS-INDEX.md : à jour');
  } else if (verifie) {
    console.error('✖ docs/DECISIONS-INDEX.md a divergé. Lancer `npm run index:decisions`.');
    process.exit(1);
  } else {
    writeFileSync(INDEX, attendu);
    console.log('✔ docs/DECISIONS-INDEX.md réécrit (' + decisions(actuel || '').length + ' → ' + (attendu.match(/^\| D-/gm) || []).length + ' décisions)');
  }
}
