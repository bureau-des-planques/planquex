import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Wizard d'illustration — ce qui part vers `gflow` doit être **résolu** (#97).
 *
 * La classe de bug, observée le 21/10/2026 : à l'invite « Modèle », la personne
 * tape le nom qu'elle connaît — `Nano Banana 2.1` — et le wizard le transmet tel
 * quel à `gflow image t2i --model`. Click le refuse :
 *
 *     Error: Invalid value for '--model': 'nano2.1' is not one of
 *     'nano2', 'nano-pro', 'nano2-lite', 'image4', 'imagen4'.
 *
 * Le wizard annonçait alors « dérive de sélecteur (23) / interface classique
 * (28) » — deux causes qui n'ont rien à voir — et la personne cherchait au
 * mauvais endroit. Le nom humain et l'alias gflow sont **deux vocabulaires** :
 * `nano2` EST Nano Banana 2.1 sur `flow.google.com` (gflow, `docs/INDEX.md:174`,
 * #958). La résolution doit donc se faire **avant** l'appel, dans le wizard.
 *
 * Le faux `gflow` est le seam : il journalise ses arguments au lieu de piloter
 * un navigateur. La boucle est déterministe, sans réseau, et elle dit exactement
 * ce que le vrai CLI aurait reçu.
 *
 * **Le journal est non ambigu par construction** — un argument par ligne,
 * préfixé `ARG `. Une première version journalisait `"$*"` sur une ligne : le
 * prompt contenant des retours à la ligne, la lecture ne voyait que le premier
 * fragment, et le test « le contrôle mord » passait **vert** alors que le nom
 * humain partait bel et bien. Un journal qui perd de l'information rend une
 * boucle qui ment.
 */
const racine = fileURLToPath(new URL('..', import.meta.url));
const WIZARD = 'scripts/illustration-vague.sh';
const CARTE = 'direction-pdg';

let bac = '';
let journal = '';
let scratch = '';

beforeEach(() => {
  bac = mkdtempSync(join(tmpdir(), 'gflow-faux-'));
  journal = join(bac, 'journal.txt');
  scratch = join(bac, 'scratch');
  writeFileSync(
    join(bac, 'gflow'),
    [
      '#!/usr/bin/env bash',
      'printf \'CALL\\n\' >> "$GFLOW_JOURNAL"',
      'for a in "$@"; do printf \'ARG %s\\n\' "$a" >> "$GFLOW_JOURNAL"; done',
      'exit 0',
      ''
    ].join('\n'),
    { mode: 0o755 }
  );
});

afterEach(() => {
  rmSync(bac, { recursive: true, force: true });
});

/** Lance le wizard avec le faux gflow en tête de PATH. */
function wizard(args: string[] = [], stdin = '') {
  return spawnSync('bash', [WIZARD, ...args], {
    cwd: racine,
    input: stdin,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bac}:${process.env.PATH ?? ''}`,
      GFLOW_JOURNAL: journal,
      GFLOW_ILLUSTRATION_SCRATCH: scratch
    }
  });
}

/** Chaque appel reçu par gflow, ses arguments tels quels — retours à la ligne compris. */
function appels(): string[][] {
  if (!existsSync(journal)) return [];
  const lignes = readFileSync(journal, 'utf8').replace(/\n$/, '').split('\n');
  const tous: string[][] = [];
  let courant: string[] | null = null;
  for (const ligne of lignes) {
    if (ligne === 'CALL') {
      courant = [];
      tous.push(courant);
      continue;
    }
    if (courant === null) continue;
    if (ligne.startsWith('ARG ')) courant.push(ligne.slice(4));
    else if (courant.length) courant[courant.length - 1] += `\n${ligne}`;
  }
  return tous;
}

/** L'appel de génération, s'il a eu lieu. */
const generation = () => appels().find((c) => c[0] === 'image' && c[1] === 't2i');

/** La valeur qui suit `--model` (ou `--aspect`, …) dans un appel. */
function option(args: string[] | undefined, nom: string) {
  if (!args) return undefined;
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
}

/**
 * L'entrée d'une session, dans l'ordre exact où le wizard la consomme :
 * la pause de la bannière, celle du stage 2, puis le modèle et le nombre de
 * variantes. S'en tromper d'une ligne fait lire le modèle à une pause — c'est
 * arrivé, et ça rendait la boucle verte pour de mauvaises raisons.
 */
const stdinPour = (modele: string, variantes = '') => `\n\n${modele}\n${variantes}\n`;

describe('Wizard d’illustration — ce qui part vers gflow (#97)', () => {
  it('le contrôle mord : un nom humain non résolu atteindrait gflow', () => {
    // Décrit ce qui NE DOIT PAS arriver. Échoue si le nom brut part tel quel.
    const r = wizard([CARTE], stdinPour('Nano Banana 2.1'));
    expect(r.status, r.stderr).toBe(0);
    const gen = generation();
    expect(gen, 'aucun appel à `gflow image t2i` — la boucle ne teste rien').toBeDefined();
    expect(
      option(gen, '--model'),
      'le nom humain est parti tel quel : gflow le refusera (exit 2)'
    ).not.toBe('Nano Banana 2.1');
  });

  it('un nom humain est résolu vers l’alias gflow', () => {
    wizard([CARTE], stdinPour('Nano Banana 2.1'));
    expect(option(generation(), '--model')).toBe('nano2');
  });

  it('un alias est accepté tel quel', () => {
    wizard([CARTE], stdinPour('nano2'));
    expect(option(generation(), '--model')).toBe('nano2');
  });

  it('un modèle inconnu n’atteint jamais gflow', () => {
    wizard([CARTE], stdinPour('truc-qui-nexiste-pas'));
    expect(
      option(generation(), '--model'),
      'un modèle inconnu ne doit jamais atteindre gflow'
    ).not.toBe('truc-qui-nexiste-pas');
  });

  it('trois essais invalides abandonnent sans appeler gflow du tout', () => {
    const r = wizard([CARTE], `\n\ntruc\ntruc\ntruc\n`);
    expect(generation(), 'aucune génération ne doit partir').toBeUndefined();
    expect(r.stdout + r.stderr).toContain('nano2');
  });

  it('le prompt part sur une seule ligne', () => {
    // Le socle est un bloc de code multiligne ; `$(socle)` quoté garde ses
    // retours à la ligne. Un prompt d'une seule ligne reste comparable, se
    // journalise et se cherche.
    wizard([CARTE], stdinPour('nano2'));
    expect(generation()?.[2], 'le prompt doit être le 3ᵉ argument').not.toContain('\n');
  });

  it('l’aspect demandé est bien 1:1 — le gabarit de carte est carré', () => {
    wizard([CARTE], stdinPour('nano2'));
    expect(option(generation(), '--aspect')).toBe('1:1');
  });

  it('l’invite annonce les noms humains, pas seulement les alias', () => {
    const r = wizard([CARTE], stdinPour('nano2'));
    expect(r.stdout).toContain('Nano Banana 2.1');
  });

  it('un EOF à une invite ne tue pas le wizard en silence', () => {
    // `ask` renvoie 1 à EOF ; sous `set -e`, un `return 1` nu fait sortir le
    // script avec le code 1 et **aucun message**. Observé en vrai.
    const r = wizard([CARTE], '\n\n');
    expect(r.status, `sortie ${r.status} sans explication`).not.toBe(1);
  });

  it('--modele résout hors interaction, et sort 2 sur un inconnu', () => {
    const ok = wizard(['--modele', 'Nano Banana 2.1']);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout.trim()).toBe('nano2');

    const ko = wizard(['--modele', 'nano2.1-inconnu']);
    expect(ko.status).toBe(2);
    expect(ko.stderr).toContain('nano2');
  });
});
