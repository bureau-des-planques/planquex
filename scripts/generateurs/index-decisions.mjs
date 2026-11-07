import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * L'index des décisions — la porte d'entrée de `docs/DECISIONS.md`.
 *
 * Constaté le 26/10/2026 : `AGENTS.md` §1.1 demandait de **lire** `docs/DECISIONS.md` avant
 * toute modification. Le journal faisait alors **113 décisions** (une ligne de tableau par
 * décision, jusqu'à 3 900 caractères) ; le 06/11/2026, à 187 décisions, il pèse ~320 000 caractères. Mesure sur trois jours de sessions : 5 sessions
 * l'ont lu puis ont écrit, **68 ont écrit sans le lire**, et 123 greps ciblés ont remplacé la
 * lecture. La règle était un no-op — on ne peut pas l'obéir.
 *
 * Cet index la rend tenable **sans toucher au journal** : une ligne par décision
 * (`| D-NNN | date | début de l'intitulé |`), puis on ouvre la ligne du tableau. Il vit dans
 * `docs/DECISIONS-INDEX.md`, **dérivé**, jamais écrit à la main, et `scripts/gardes/decisions.test.ts`
 * refuse un index qui ne couvre pas exactement les décisions du journal, dans l'ordre.
 *
 * Un fichier à part, et pas un bloc en tête du journal : le tableau de `DECISIONS.md` est lu
 * par un test qui exige **4 colonnes** et des identifiants **uniques** — un index inséré
 * dedans casse les deux (constaté en l'essayant le 26/10/2026).
 *
 * La colonne « Amendée par » (07/11/2026) dit, sans ouvrir le journal, qu'une décision n'est plus
 * à lire seule : elle liste les D-NNN qui l'amendent ou la remplacent. Deux sources, car le
 * journal écrit le lien dans les deux sens : la ligne qui amende (« amende D-181 (3) »,
 * « remplace D-087 ») et la ligne amendée (« ⚠️ **amendée par D-017** »). « Précise » n'y entre pas :
 * une précision ne change pas ce que la décision dit.
 *
 * Usage : `npm run index:decisions` (réécrit), `-- --verifie` (sort 1 si divergence, sans rien
 * écrire : c'est ce que la CI demande).
 */

const RACINE = new URL('../..', import.meta.url);
const JOURNAL = fileURLToPath(new URL('docs/DECISIONS.md', RACINE));
const INDEX = fileURLToPath(new URL('docs/DECISIONS-INDEX.md', RACINE));

/**
 * Les identifiants cités juste après chaque verbe du motif : « amende D-048 (2) et D-056 »
 * rend D-048 et D-056. La chaîne s'arrête au premier mot qui n'est pas un D-NNN, un renvoi
 * entre parenthèses, une virgule ou « et ».
 */
function citesApres(texte, verbe) {
  const ids = [];
  const chaine =
    /^(?:\*\*)?D-\d+(?:\s*\([^)]*\))*(?:\*\*)?(?:(?:\s*,\s*|\s+et\s+)(?:\*\*)?D-\d+(?:\s*\([^)]*\))*(?:\*\*)?)*/;
  for (const m of texte.matchAll(verbe)) {
    const suite = texte.slice(m.index + m[0].length).match(chaine);
    if (suite) ids.push(...suite[0].match(/D-\d+/g));
  }
  return ids;
}

const AMENDE = /\b(?:amendent|amende|remplacent|remplace)\s+/gi;
/**
 * Le passif ne compte qu'en **gras** : c'est la forme de l'avertissement que le journal pose en
 * tête d'une décision amendée (« ⚠️ **Amendée par D-182** », « ⚠️ **Remplacée le 22/10/2026 —
 * voir D-063** »). En texte courant, « remplacé par D-003 » ou « (8)(c), amendé par D-185 »
 * parlent d'un autre objet que la ligne qui les porte (D-016 et D-187, constaté le 07/11/2026).
 */
const AMENDEE_PAR = /\*\*(?:amendée?s?|remplacée?s?)\s+(?:par|le\s+[0-9/]+\s+—\s+voir)\s+/gi;

/** Les décisions lues dans le journal, dans l'ordre où il les porte. */
export function decisions(texte) {
  const out = [];
  const lignes = [];
  for (const ligne of texte.split('\n')) {
    const m = ligne.match(/^\|\s*(D-\d+)\s*\|\s*([0-9/]+)\s*\|\s*(.*?)\s*\|/);
    if (m) lignes.push({ m, ligne });
  }
  const connus = new Set(lignes.map(({ m }) => m[1]));
  const amendeePar = new Map([...connus].map((id) => [id, new Set()]));
  for (const { m, ligne } of lignes) {
    const id = m[1];
    for (const cible of citesApres(ligne, AMENDE)) {
      if (cible !== id && connus.has(cible)) amendeePar.get(cible).add(id);
    }
    for (const auteur of citesApres(ligne, AMENDEE_PAR)) {
      if (auteur !== id && connus.has(auteur)) amendeePar.get(id).add(auteur);
    }
  }
  for (const { m } of lignes) {
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
      amendeePar: [...amendeePar.get(m[1])].sort()
    });
  }
  return out;
}

/** Le fichier d'index complet, prêt à écrire. */
export function rendre(liste) {
  return [
    '# Index des décisions',
    '',
    '> **Dérivé** de `docs/DECISIONS.md` par `npm run index:decisions` — ne pas éditer à la main.',
    `> ${liste.length} décisions. Le journal est trop long pour se lire d'un bloc : cet index est la porte d'entrée,`,
    '> puis on ouvre la ligne du tableau.',
    '',
    '| ID | Date | Intitulé (début) | Amendée par |',
    '|---|---|---|---|',
    ...liste.map((d) => `| ${d.id} | ${d.date} | ${d.court} | ${(d.amendeePar ?? []).join(', ')} |`),
    ''
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
    console.log(
      '✔ docs/DECISIONS-INDEX.md réécrit (' +
        decisions(actuel || '').length +
        ' → ' +
        (attendu.match(/^\| D-/gm) || []).length +
        ' décisions)'
    );
  }
}
