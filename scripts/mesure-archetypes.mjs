#!/usr/bin/env node
/**
 * **La table des archétypes** — la commande (#360, D-134 (2)).
 *
 * La mesure vit dans `src/game/mesure-archetypes.ts`, donc type-checkée par `tsc -b` ; ce
 * script lit les arguments, joue la table et l'imprime — **markdown** par défaut, pour que
 * le document de mesure reçoive la table telle quelle, sans recopie à la main.
 *
 * Usage :
 *   npm run mesure:archetypes                       # 40 parties par paire, graine 20261029
 *   npm run mesure:archetypes -- --json             # le rapport complet
 *   npm run mesure:archetypes -- --parties 10       # une table plus courte (le chiffre bouge)
 *   npm run mesure:archetypes > docs/ia/360-table.md
 *
 * La table publiée dans `docs/ia/360-table-archetypes.md` vient de `--json` + la section
 * markdown ci-dessous, à la graine par défaut. Deux lancements à graine fixe donnent la
 * même table, octet pour octet.
 */
import { createServer } from 'vite';

const USAGE = `Usage : npm run mesure:archetypes -- [options]

  -n, --parties <N>     parties par paire, PAIR (défaut : 40 — 20 par siège)
  -s, --graine <entier> graine maîtresse (défaut : 20261029)
      --max-turns <N>   arrêt d'urgence d'une partie (défaut : 200)
      --factions <liste> factions à opposer, séparées par des virgules (défaut : les dix)
      --seuil <points>  seuil d'alerte en points de pourcentage (défaut : 15)
      --json            rapport JSON au lieu du markdown
  -h, --help            cette aide

Exemples :
  npm run mesure:archetypes
  npm run mesure:archetypes -- --json > table-archetypes.json
`;

function fail(message) {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exitCode = 2;
  return null;
}

function readNumber(raw, name) {
  const valeur = Number(raw);
  if (!Number.isFinite(valeur)) throw new Error(`${name} attend un nombre, reçu « ${raw ?? ''} ».`);
  return valeur;
}

function parseArgs(argv) {
  const options = {
    parties: null,
    graine: null,
    maxTurns: null,
    factions: null,
    seuil: null,
    json: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [name, inline] = arg.includes('=')
      ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };

    if (name === '--help' || name === '-h') options.help = true;
    else if (name === '--json') options.json = true;
    else if (name === '--parties' || name === '-n') options.parties = readNumber(value(), '--parties');
    else if (name === '--graine' || name === '-s') options.graine = readNumber(value(), '--graine');
    else if (name === '--max-turns') options.maxTurns = readNumber(value(), '--max-turns');
    else if (name === '--seuil') options.seuil = readNumber(value(), '--seuil');
    else if (name === '--factions') {
      options.factions = (value() ?? '')
        .split(',')
        .map((faction) => faction.trim().toUpperCase())
        .filter(Boolean);
    } else throw new Error(`Option inconnue : ${arg}`);
  }
  return options;
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  options = fail(error instanceof Error ? error.message : String(error));
}
if (!options) {
  // `fail` a déjà posé le code de sortie ; on sort sans charger Vite.
} else if (options.help) {
  process.stdout.write(USAGE);
} else if (options.parties !== null && (options.parties < 2 || !Number.isInteger(options.parties))) {
  fail('--parties doit être un entier ≥ 2.');
} else if (options.parties !== null && options.parties % 2 !== 0) {
  fail('--parties doit être PAIR : le miroir joue les deux sièges.');
} else {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  try {
    const mesure = await server.ssrLoadModule('/src/game/mesure-archetypes.ts');
    const simulation = await server.ssrLoadModule('/src/game/simulation.ts');

    if (options.factions) {
      const unknown = options.factions.filter((faction) => !simulation.FACTION_ORDER.includes(faction));
      if (unknown.length > 0) {
        fail(
          `Faction(s) inconnue(s) : ${unknown.join(', ')}. Valeurs acceptées : ${simulation.FACTION_ORDER.join(', ')}.`
        );
      }
    }

    if (process.exitCode !== 2) {
      const rapport = mesure.mesurerArchetypes({
        partiesParPaire: options.parties ?? undefined,
        graine: options.graine ?? undefined,
        maxTurns: options.maxTurns ?? undefined,
        factions: options.factions ?? undefined,
        seuilAlerte: options.seuil === null ? undefined : options.seuil / 100
      });
      process.stdout.write(
        options.json ? `${JSON.stringify(rapport, null, 2)}\n` : `${mesure.formatTableArchetypes(rapport)}\n`
      );
    }
  } finally {
    await server.close();
  }
}
