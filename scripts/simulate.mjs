#!/usr/bin/env node
/**
 * Simulateur headless seedé — ticket #34.
 *
 * Lance N parties **sans navigateur** et affiche un rapport lisible (console par
 * défaut, JSON avec `--json`). Le cœur est dans `src/game/simulation.ts`, donc
 * type-checké par `tsc -b` : ce script ne fait que lire les arguments et charger
 * le module. Vite sert de chargeur TypeScript, comme `scripts/status.mjs`.
 *
 * Usage :
 *   npm run simulate -- --games 100 --seed 42
 *   npm run simulate -- --games 10 --seed 42 --json > rapport.json
 *
 * Reproductibilité : deux exécutions avec les mêmes arguments impriment le même
 * rapport, octet pour octet. Le rapport ne contient aucun horodatage.
 */
import { createServer } from 'vite';

const USAGE = `Usage : npm run simulate -- [options]

  -n, --games <N>       nombre de parties à jouer (défaut : 20)
  -s, --seed <entier>   graine maîtresse (défaut : 1)
      --max-turns <N>   arrêt d'urgence d'une partie, comptée nulle (défaut : 200)
      --factions <liste> factions à opposer, séparées par des virgules
      --json            rapport JSON au lieu du tableau console
  -h, --help            cette aide

Exemples :
  npm run simulate -- --games 100 --seed 42
  npm run simulate -- --games 10 --seed 42 --json
`;

function fail(message) {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exitCode = 2;
  return null;
}

function readInteger(raw, name) {
  if (!/^-?\d+$/.test(raw ?? '')) throw new Error(`${name} attend un entier, reçu « ${raw ?? ''} ».`);
  return Number(raw);
}

function parseArgs(argv) {
  const options = { games: 20, seed: 1, maxTurns: 200, factions: null, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [name, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };

    if (name === '--help' || name === '-h') options.help = true;
    else if (name === '--json') options.json = true;
    else if (name === '--games' || name === '-n') options.games = readInteger(value(), '--games');
    else if (name === '--seed' || name === '-s') options.seed = readInteger(value(), '--seed');
    else if (name === '--max-turns') options.maxTurns = readInteger(value(), '--max-turns');
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
} else if (options.games < 1 || !Number.isInteger(options.games)) {
  fail('--games doit être un entier ≥ 1.');
} else if (options.maxTurns < 1) {
  fail('--max-turns doit être un entier ≥ 1.');
} else {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  try {
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
      const report = simulation.simulate({
        games: options.games,
        seed: options.seed,
        maxTurns: options.maxTurns,
        factions: options.factions ?? undefined
      });
      process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${simulation.formatReport(report)}\n`);
    }
  } finally {
    await server.close();
  }
}
