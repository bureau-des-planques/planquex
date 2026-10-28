#!/usr/bin/env node
/**
 * **La Direction contre un joueur de référence** — la commande (#354, D-134).
 *
 * Le protocole et les calculs vivent dans `src/game/mesure-direction.ts`, donc
 * type-checkés par `tsc -b` : ce script ne fait que lire les arguments, charger le module
 * et imprimer. Vite sert de chargeur TypeScript, comme `scripts/simulate.mjs`.
 *
 * Usage :
 *   npm run mesure:direction                       # 1 000 parties, graine 20261028
 *   npm run mesure:direction -- --json             # le rapport complet, pour un script
 *   npm run mesure:direction -- --parties 200      # une mesure plus courte (le chiffre bouge)
 *   npm run mesure:direction -- --bande 0.50:0.51  # le contrôle mord : la bande fausse
 *   npm run mesure:direction -- --politique glouton  # la variante mesurée (#411) : la Direction
 *                                                   # joue le glouton, la référence ne bouge pas
 *
 * Le chiffre publié est celui du premier appel, dans `docs/ia/354-mesure-direction.md`.
 * Les **durées** de décision varient d'un poste à l'autre (une mesure, pas une règle) ;
 * le **taux**, lui, se rejoue à l'identique à graine fixe.
 */
import { createServer } from 'vite';

const USAGE = `Usage : npm run mesure:direction -- [options]

  -n, --parties <N>     nombre de parties, PAIR (défaut : 1000 — le miroir joue 2 fois
                        chaque paire)
  -s, --graine <entier> graine maîtresse (défaut : 20261028, disjointe du pesage #111)
      --max-turns <N>   arrêt d'urgence d'une partie (défaut : 200)
      --factions <liste> factions à opposer, séparées par des virgules (défaut : les dix)
      --bande <bas:haut> bande du verdict, en taux (défaut : 0.40:0.60 — D-134)
      --politique <nom> politique de la Direction : scripte, glouton, recherche (défaut),
                        expectiminimax. La référence reste scriptée : c'est la Direction
                        qu'on fait varier (#411)
      --json            rapport JSON au lieu du texte
  -h, --help            cette aide

Exemples :
  npm run mesure:direction
  npm run mesure:direction -- --json > rapport-direction.json
  npm run mesure:direction -- --bande 0.50:0.51   # doit sortir HORS de la bande
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

/** `0.40:0.60` → `{ bas: 0.4, haut: 0.6 }`. Une bande illisible est refusée, pas devinée. */
function readBande(raw) {
  const [bas, haut] = String(raw ?? '').split(':');
  const b = Number(bas);
  const h = Number(haut);
  if (!Number.isFinite(b) || !Number.isFinite(h) || b < 0 || h > 1 || b > h) {
    throw new Error(`--bande attend « bas:haut » entre 0 et 1, reçu « ${raw ?? ''} ».`);
  }
  return { bas: b, haut: h };
}

/** Les politiques nommables de la Direction (`Politique`, `src/game/ia.ts`). */
const POLITIQUES = ['scripte', 'glouton', 'recherche', 'expectiminimax'];

function parseArgs(argv) {
  const options = {
    parties: null,
    graine: null,
    maxTurns: null,
    factions: null,
    bande: null,
    politique: null,
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
    else if (name === '--parties' || name === '-n') options.parties = readInteger(value(), '--parties');
    else if (name === '--graine' || name === '-s') options.graine = readInteger(value(), '--graine');
    else if (name === '--max-turns') options.maxTurns = readInteger(value(), '--max-turns');
    else if (name === '--bande') options.bande = readBande(value());
    else if (name === '--politique')
      options.politique = String(value() ?? '')
        .trim()
        .toLowerCase();
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
} else if (options.parties !== null && (options.parties < 1 || !Number.isInteger(options.parties))) {
  fail('--parties doit être un entier ≥ 1.');
} else if (options.parties !== null && options.parties % 2 !== 0) {
  fail('--parties doit être PAIR : le miroir joue deux fois chaque paire.');
} else if (options.politique !== null && !POLITIQUES.includes(options.politique)) {
  fail(`--politique inconnue : « ${options.politique} ». Valeurs acceptées : ${POLITIQUES.join(', ')}.`);
} else {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  try {
    const mesure = await server.ssrLoadModule('/src/game/mesure-direction.ts');
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
      const rapport = mesure.mesurerDirection({
        parties: options.parties ?? undefined,
        graine: options.graine ?? undefined,
        maxTurns: options.maxTurns ?? undefined,
        factions: options.factions ?? undefined,
        politique: options.politique ?? undefined,
        bande: options.bande ?? undefined
      });
      process.stdout.write(
        options.json ? `${JSON.stringify(rapport, null, 2)}\n` : `${mesure.formatRapportDirection(rapport)}\n`
      );
    }
  } finally {
    await server.close();
  }
}
