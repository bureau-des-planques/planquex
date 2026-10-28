#!/usr/bin/env node
/**
 * **Les fichiers de test les plus lents, publiés au lieu d'être trouvés par hasard** (#422,
 * D-143 (5)).
 *
 * Constaté le 28/10/2026 : trois lenteurs ont été corrigées dans la journée — #392 (une graine
 * d'horloge), #403 (un fuzz de 26 s), #408 (5 000 graines balayées, 33 s → 5,6 s) — et à chaque
 * fois **par hasard**, parce qu'un agent regardait la sortie. Un classement qu'on ne peut pas
 * régénérer ne se surveille pas ; une dérive de dix secondes ne se voit pas.
 *
 * ## Le contrat
 *
 * Une suite qui coûte **par nature** (PGlite, simulation, captures, écrans) reste : elle a
 * attrapé de vrais défauts (le plateau, la RLS, les 300 illustrations). Mais au-delà de
 * **5 s**, son fichier **dit pourquoi en tête** (`Lenteur justifiée`), et la durée se publie
 * ici pour qu'une dérive se voie. Un test qui ne sait pas se justifier se corrige.
 *
 * ## Usage
 *
 * ```
 * npm run tests:lents            # le classement, relu sur la dernière mesure (2 min de suite)
 * npm run tests:lents -- --ecrire  # réécrit docs/TESTS-LENTS.md
 * ```
 *
 * Le classement vient de la sortie **machine** de vitest (`--reporter=json`) : un décompte se
 * dérive, il ne se recopie pas (`scripts/compteurs.test.ts`, même principe).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RACINE = fileURLToPath(new URL('..', import.meta.url));

/** Au-delà, le fichier doit dire **pourquoi** il est lent (D-143 (5)). */
export const SEUIL_SECONDES = 5;

/** La marque, en tête du fichier : une ligne, pas un paragraphe. */
export const MARQUE = 'Lenteur justifiée';

/** Le document publié, que la garde relit. */
export const DOCUMENT = 'docs/TESTS-LENTS.md';

/** Le plafond de publication : au-delà, le document cesserait d'être lisible (mesuré : 33). */
export const TAILLE = 40;

/**
 * Un fichier de test postule-t-il sa lenteur ? La marque doit être **en tête** (le bloc de
 * commentaire d'ouverture), pas perdue au milieu : une justification qu'on ne lit pas en
 * ouvrant le fichier n'explique rien.
 */
export function justifie(source) {
  return source
    .split('\n')
    .slice(0, 40)
    .some((ligne) => ligne.includes(MARQUE));
}

/** Ce que le rapport `--reporter=json` de vitest dit, fichier par fichier. */
export function classement(rapport) {
  const fichiers = (rapport.testResults ?? []).map((suite) => ({
    fichier: relative(RACINE, suite.name).split('\\').join('/'),
    secondes: ((suite.endTime ?? 0) - (suite.startTime ?? 0)) / 1000,
    tests: (suite.assertionResults ?? []).length
  }));
  return fichiers.sort((a, b) => b.secondes - a.secondes);
}

/** Le fichier relu sur disque, ou `null` s'il n'existe pas (un fichier supprimé se signale). */
export function lire(racine, fichier) {
  try {
    return readFileSync(join(racine, fichier), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Les fichiers du classement au-delà du seuil, avec ce qui leur manque. C'est **le** contrôle :
 * un fichier publié comme lent sans justification est une lenteur qui s'installe sans témoin.
 */
export function sansJustification(racine, lignes, seuil = SEUIL_SECONDES) {
  return lignes
    .filter((ligne) => ligne.secondes > seuil)
    .map((ligne) => ({ ...ligne, source: lire(racine, ligne.fichier) }))
    .filter((ligne) => ligne.source === null || !justifie(ligne.source))
    .map((ligne) => ({
      fichier: ligne.fichier,
      secondes: ligne.secondes,
      raison: ligne.source === null ? 'fichier introuvable' : 'pas de ligne « Lenteur justifiée » en tête'
    }));
}

/** Le tableau markdown publié, avec la date de mesure : une durée sans date ne se compare à rien. */
export function rendre(lignes, { date, seuil = SEUIL_SECONDES } = {}) {
  const entete = [
    '# Les tests lents',
    '',
    '> **Document dérivé** — régénéré par `npm run tests:lents -- --ecrire`, gardé par',
    '> `scripts/tests-lents.test.ts` (#422, D-143 (5)). Ne pas le corriger à la main.',
    '',
    `Mesuré le **${date}** (\`vitest run --reporter=json\`, somme des durées d'assertion par`,
    'fichier ; les fichiers tournent en parallèle, donc le total dépasse le temps mural).',
    '',
    `**La règle** : au-delà de **${seuil} s**, un fichier de test dit **pourquoi** il est lent, en tête,`,
    `sur une ligne portant « ${MARQUE} ». Un test qui ne sait pas se justifier se corrige.`,
    '',
    '| Fichier | Durée | Tests | Justifié |',
    '|---|---|---|---|'
  ];
  const corps = lignes.map((ligne) => {
    const source = lire(RACINE, ligne.fichier);
    const ok = source !== null && justifie(source);
    const drapeau = ligne.secondes <= seuil ? '—' : ok ? 'oui' : '**NON**';
    return `| \`${ligne.fichier}\` | ${ligne.secondes.toFixed(1)} s | ${ligne.tests} | ${drapeau} |`;
  });
  return [...entete, ...corps, ''].join('\n');
}

/** Lance la suite et rend le classement. Rend `null` si vitest n'a pas produit de rapport. */
export function mesurer(racine = RACINE, args = []) {
  const sortie = join(mkdtempSync(join(tmpdir(), 'tests-lents-')), 'rapport.json');
  const { status } = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${sortie}`, ...args], {
    cwd: racine,
    stdio: 'inherit'
  });
  if (status !== 0 && status !== 1) return null;
  return classement(JSON.parse(readFileSync(sortie, 'utf8')));
}

const estLance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estLance) {
  const lignes = mesurer(
    RACINE,
    process.argv.slice(2).filter((a) => a.startsWith('--') && a !== '--ecrire')
  );
  if (!lignes) {
    console.error('tests:lents : vitest n’a pas produit de rapport — rien n’est publié.');
    process.exit(1);
  }
  // Tout fichier au-delà du seuil est publié : c'est la règle de D-143 (5), et le document est
  // ce que la garde relit. Publier les douze premiers laisserait les suivants sans témoin.
  const publiees = lignes.filter((ligne) => ligne.secondes > SEUIL_SECONDES).slice(0, TAILLE);
  const date = new Date().toISOString().slice(0, 10);
  if (process.argv.includes('--ecrire')) {
    writeFileSync(join(RACINE, DOCUMENT), rendre(publiees, { date }));
    console.log(`tests:lents : ${DOCUMENT} réécrit (${publiees.length} fichiers, ${date}).`);
  } else {
    console.log(rendre(publiees, { date }));
  }
  const detraquees = sansJustification(RACINE, publiees);
  if (detraquees.length > 0) {
    console.error(
      'tests:lents : sans justification en tête (D-143 (5)) —\n' +
        detraquees.map((l) => `  ${l.fichier} (${l.secondes.toFixed(1)} s) : ${l.raison}`).join('\n')
    );
    process.exit(1);
  }
}

/**
 * Le chemin inverse : les lignes publiées, relues dans le document. C'est ce que la garde lit,
 * et ce que `rendre()` réécrit — un aller-retour, pour que le document publié et le contrôle
 * ne puissent pas parler de deux classements différents.
 */
export function lignesPubliees(texte) {
  const lignes = [];
  for (const ligne of texte.split('\n')) {
    const trouve = /^\|\s*`([^`]+)`\s*\|\s*([\d.]+)\s*s\s*\|\s*(\d+)\s*\|/.exec(ligne);
    if (trouve) lignes.push({ fichier: trouve[1], secondes: Number(trouve[2]), tests: Number(trouve[3]) });
  }
  return lignes;
}
