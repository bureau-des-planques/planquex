#!/usr/bin/env node
/**
 * **Le recensement des illustrations** — la commande (#499).
 *
 * La question du jalon bêta (critère 4 de D-048) : combien des **bases** du set ont
 * leur illustration ? Le compte ne se recopie pas d'un document — `docs/CARD-SPEC.md`
 * porte un instantané daté (D-005) et D-063 a remplacé le chiffre par « autour de 300 ».
 * Il se lit dans les données (`ALL_CARDS`) et dans le registre (`design/illustrations/`),
 * comme le fait déjà `src/data/art.test.ts`.
 *
 * Ce que le script mesure :
 *
 * - les **bases** (une carte sans `variantOf`) et les **variantes** ;
 * - une base est **illustrée** quand son `art` est déclaré, que le fichier existe et que
 *   Vite le résout (`artUrl`, le même chemin que l'écran) ;
 * - les `.webp` **du registre** (le glob de `@/art` ne regarde que la racine du dossier) ;
 * - les **orphelines** (un fichier que personne ne déclare) et les **manquantes** (un `art`
 *   déclaré sans fichier), qui sont deux défauts différents.
 *
 * Usage :
 *   npm run mesure:illustrations              # markdown, pour le document de mesure
 *   npm run mesure:illustrations -- --json    # le rapport complet
 *
 * La sortie est **déterministe** : aucun hasard, aucun horodatage dans le markdown.
 * Le calcul est une fonction pure (`recenser`), éprouvée sans Vite par
 * `mesure-illustrations.test.ts`.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SERVED = 'design/illustrations';

/**
 * Le rapport, à partir des cartes et d'un registre fabriqué ou réel.
 *
 * Les coutures sont injectées — `art` (`artFileOf` / `artUrl`), `fichiers` (les noms
 * présents) et `existe` — pour que le test n'ouvre ni Vite ni le disque.
 *
 * @param {readonly any[]} cartes
 * @param {{ art: { artFileOf: Function, artUrl: Function }, fichiers: readonly string[], existe: Function, libelle?: Function }} sources
 */
export function recenser(cartes, { art, fichiers, existe, libelle = (faction) => faction }) {
  const bases = cartes.filter((card) => !card.variantOf);
  const variantes = cartes.filter((card) => card.variantOf);

  /** Le fichier résolu par la lecture : `art` déclaré, sinon celui de la base (D-139). */
  const fichierDe = (card) => art.artFileOf(card);
  /** Une base est illustrée si son fichier existe **et** que Vite le sert. */
  const illustree = (card) => {
    const fichier = fichierDe(card);
    return fichier !== undefined && existe(fichier) && art.artUrl(fichier) !== undefined;
  };

  const basesIllustrees = bases.filter(illustree);
  const basesSans = bases.filter((card) => !illustree(card));
  // Une variante **déclare** sa planche, ou reprend celle de sa base à la lecture (D-139).
  // Ces deux nombres ne se mélangent pas : un repli n'ajoute aucun fichier au registre.
  const variantesAvecPlanche = variantes.filter((card) => card.art !== undefined);
  const variantesEnRepli = variantes.filter((card) => card.art === undefined);

  const surDisque = [...fichiers].filter((fichier) => fichier.endsWith('.webp')).sort();
  const declarees = [...new Set(cartes.map((card) => card.art).filter(Boolean))].sort();
  const orphelines = surDisque.filter((fichier) => !declarees.includes(fichier));
  const manquantes = declarees.filter((fichier) => !existe(fichier));

  /** Les bases sans illustration, par faction, dans l'ordre des factions du catalogue. */
  const factions = [...new Set(bases.map((card) => card.faction))];
  const parFaction = factions.map((faction) => {
    const deLaFaction = bases.filter((card) => card.faction === faction);
    const sans = deLaFaction.filter((card) => !illustree(card));
    return {
      faction,
      label: libelle(faction),
      bases: deLaFaction.length,
      illustrees: deLaFaction.length - sans.length,
      sans: sans.length,
      ids: sans.map((card) => card.id)
    };
  });

  return {
    cartes: cartes.length,
    bases: bases.length,
    basesIllustrees: basesIllustrees.length,
    basesSans: basesSans.length,
    variantes: variantes.length,
    variantesAvecPlanche: variantesAvecPlanche.length,
    variantesEnRepli: variantesEnRepli.length,
    webpSurDisque: surDisque.length,
    fichiersDeclares: declarees.length,
    orphelines,
    manquantes,
    parFaction,
    idsSansIllustration: basesSans.map((card) => card.id)
  };
}

/** Le markdown publié dans `docs/preuves/illustrations-2026-11-02/README.md`. */
export function rendreMarkdown(rapport) {
  const lignes = [];
  lignes.push('# Illustrations — recensement des bases (#499)');
  lignes.push('');
  lignes.push(
    `**${rapport.basesIllustrees} bases illustrées sur ${rapport.bases}**, ` +
      `**${rapport.basesSans} sans illustration**. ` +
      `${rapport.variantesAvecPlanche} variantes sur ${rapport.variantes} ont leur propre planche ; ` +
      `les ${rapport.variantesEnRepli} autres reprennent celle de leur base (D-139), ` +
      `sans ajouter de fichier au registre.`
  );
  lignes.push('');
  lignes.push('| Mesure | Nombre |');
  lignes.push('|---|---:|');
  lignes.push(`| Cartes au catalogue | ${rapport.cartes} |`);
  lignes.push(`| Bases | ${rapport.bases} |`);
  lignes.push(`| — dont illustrées | ${rapport.basesIllustrees} |`);
  lignes.push(`| — dont sans illustration | ${rapport.basesSans} |`);
  lignes.push(`| Variantes | ${rapport.variantes} |`);
  lignes.push(`| — dont avec leur propre planche | ${rapport.variantesAvecPlanche} |`);
  lignes.push(`| — dont en repli sur celle de leur base (D-139) | ${rapport.variantesEnRepli} |`);
  lignes.push(`| \`.webp\` dans \`${SERVED}/\` | ${rapport.webpSurDisque} |`);
  lignes.push(`| Fichiers déclarés par une carte | ${rapport.fichiersDeclares} |`);
  lignes.push('');
  lignes.push('## Bases sans illustration, par faction');
  lignes.push('');
  lignes.push('| Faction | Bases | Illustrées | Sans | Identifiants sans illustration |');
  lignes.push('|---|---:|---:|---:|---|');
  for (const ligne of rapport.parFaction) {
    lignes.push(
      `| ${ligne.label} | ${ligne.bases} | ${ligne.illustrees} | ${ligne.sans} | ` +
        `${ligne.ids.length === 0 ? '—' : ligne.ids.join(', ')} |`
    );
  }
  lignes.push('');
  lignes.push('## Écarts entre le registre et les cartes');
  lignes.push('');
  lignes.push(
    `- **Orphelines** (fichier que personne ne déclare) : ` +
      `${rapport.orphelines.length === 0 ? 'aucune' : rapport.orphelines.join(', ')}.`
  );
  lignes.push(
    `- **Manquantes** (un \`art\` déclaré sans fichier) : ` +
      `${rapport.manquantes.length === 0 ? 'aucune' : rapport.manquantes.join(', ')}.`
  );
  lignes.push('');
  lignes.push(
    `Le compte se referme : **${rapport.webpSurDisque} \`.webp\`** = ` +
      `**${rapport.basesIllustrees} bases illustrées** + **${rapport.variantesAvecPlanche} variantes** ` +
      `qui déclarent leur propre planche (D-126). Les ${rapport.variantesEnRepli} autres variantes ` +
      `reprennent celle de leur base sans ajouter de fichier, et les ${rapport.basesSans} bases ` +
      `sans illustration n'en ont pas — c'est pourquoi les ${rapport.bases} bases ne donnent que ` +
      `${rapport.basesIllustrees} planches.`
  );
  lignes.push('');
  return lignes.join('\n');
}

const USAGE = `Usage : npm run mesure:illustrations -- [options]

      --json   rapport JSON au lieu du markdown
  -h, --help   cette aide
`;

const estLance = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (estLance) {
  let json = false;
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(USAGE);
      process.exit(0);
    } else {
      process.stderr.write(`Option inconnue : ${arg}\n\n${USAGE}`);
      process.exit(2);
    }
  }

  const { createServer } = await import('vite');
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });

  try {
    const data = await server.ssrLoadModule('/src/data/index.ts');
    const art = await server.ssrLoadModule('/src/art.ts');
    const rapport = recenser(data.ALL_CARDS, {
      art,
      fichiers: readdirSync(SERVED),
      existe: (fichier) => existsSync(join(SERVED, fichier)),
      libelle: (faction) => data.FACTION_META[faction]?.label ?? faction
    });

    process.stdout.write(json ? `${JSON.stringify(rapport, null, 2)}\n` : rendreMarkdown(rapport));
  } finally {
    await server.close();
  }
}
