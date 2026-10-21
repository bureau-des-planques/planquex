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

  it('le scratch reste dans le bac du test, jamais dans le dépôt', () => {
    // Sans cet override, la boucle lit le vrai `.scratch/gflow/` : elle passe
    // tant que personne n'a généré, puis casse dès la première vraie génération
    // — quatre variantes réelles, un choix attendu, un EOF. Observé.
    wizard([CARTE], stdinPour('nano2'));
    const sortie = option(generation(), '--out');
    expect(
      sortie,
      `le wizard écrit dans ${sortie} — un test qui dépend de l’état du dépôt ne garde rien`
    ).toContain(scratch);
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

/**
 * Le payload **réel** de `gflow image t2i --json`, capturé le 21/10/2026 sur
 * cette machine (`.scratch/gflow/essais/quatre.json`).
 *
 * Il n'a pas la forme que la doc laissait croire : la graine est **imbriquée
 * sous `images[]`**, pas au premier niveau, et `model_name_type` y est `null`
 * alors que le modèle est dans le `model` du haut. Le premier jet du wizard
 * lisait `seed` à la racine : il aurait consigné « inconnue » à chaque fois, en
 * silence. Ce rejeu est là pour ça.
 *
 * `fife_url` est **caviardée** : c'est une URL signée (donc un identifiant
 * temporaire), et elle n'a rien à faire dans un fichier versionné.
 */
const PAYLOAD_REEL = {
  status: 'ok',
  command: 'image t2i',
  project_id: '05e51d9b-5455-4a00-b530-b246a9e29c6d',
  model: 'NARWHAL',
  count: 4,
  images: [
    { media_name: '13c378c5', workflow_id: 'w1', seed: 2058712127, model_name_type: null,
      aspect_ratio: 'IMAGE_ASPECT_RATIO_SQUARE', fife_url: '<caviardée>',
      local_path: '.scratch/gflow/essais/quatre/13c378c5-3725-4b64-94dc-63575a2df797_1.jpg' },
    { media_name: '59cbf1a2', workflow_id: 'w2', seed: 909051980, model_name_type: null,
      aspect_ratio: 'IMAGE_ASPECT_RATIO_SQUARE', fife_url: '<caviardée>',
      local_path: '.scratch/gflow/essais/quatre/59cbf1a2-0ccc-4973-b691-6e7415155343_2.jpg' },
    { media_name: '50f230f2', workflow_id: 'w3', seed: 463352196, model_name_type: null,
      aspect_ratio: 'IMAGE_ASPECT_RATIO_SQUARE', fife_url: '<caviardée>',
      local_path: '.scratch/gflow/essais/quatre/50f230f2-32a8-4441-bd40-80f5c93054a0_3.jpg' },
    { media_name: 'd4f5bd59', workflow_id: 'w4', seed: 131842193, model_name_type: null,
      aspect_ratio: 'IMAGE_ASPECT_RATIO_SQUARE', fife_url: '<caviardée>',
      local_path: '.scratch/gflow/essais/quatre/d4f5bd59-9da4-4183-a05d-14a0283e6369_4.jpg' }
  ]
};

/** Rejoue un payload par le seam `--lit-json` et rend ses lignes `clé<TAB>…`. */
function lireJson(payload: unknown) {
  const fichier = join(bac, 'payload.json');
  writeFileSync(fichier, typeof payload === 'string' ? payload : JSON.stringify(payload));
  const r = wizard(['--lit-json', fichier]);
  expect(r.status, r.stderr).toBe(0);
  return r.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
}

describe('Wizard d’illustration — rejeu du payload réel (#97)', () => {
  it('le modèle vient du `model` du haut, pas de `model_name_type`', () => {
    const lignes = lireJson(PAYLOAD_REEL);
    expect(lignes.find(([cle]) => cle === 'modele')?.[1]).toBe('NARWHAL');
  });

  it('chaque image porte SA graine, reliée par son chemin', () => {
    const graines = lireJson(PAYLOAD_REEL).filter(([cle]) => cle === 'graine');
    expect(graines).toHaveLength(4);
    expect(graines.map(([, , g]) => g)).toEqual(['2058712127', '909051980', '463352196', '131842193']);
  });

  it('la graine ne se prend PAS à l’indice : l’ordre disque diffère de `images[]`', () => {
    // Le piège : `_3` est le 2ᵉ fichier par ordre alphabétique, mais la 3ᵉ entrée
    // de `images[]`. Indexer la liste triée donnerait à `_3` la graine de `_2` —
    // un registre qui ment sur la reproductibilité.
    const graines = lireJson(PAYLOAD_REEL).filter(([cle]) => cle === 'graine');
    const parChemin = new Map(graines.map(([, chemin, g]) => [chemin.split('/').pop(), g]));
    expect(parChemin.get('50f230f2-32a8-4441-bd40-80f5c93054a0_3.jpg')).toBe('463352196');
    expect(parChemin.get('50f230f2-32a8-4441-bd40-80f5c93054a0_3.jpg')).not.toBe('909051980');
  });

  it('une graine absente est dite absente, jamais inventée', () => {
    const sansGraine = { ...PAYLOAD_REEL, images: [{ ...PAYLOAD_REEL.images[0], seed: null }] };
    expect(lireJson(sansGraine).find(([cle]) => cle === 'graine')?.[2]).toBe('inconnue');
  });

  it('un payload illisible ne fait pas mourir le wizard', () => {
    const r = wizard(['--lit-json', join(bac, 'payload.json')]);
    // (fichier absent : on écrit d'abord un contenu qui n'est pas du JSON)
    writeFileSync(join(bac, 'payload.json'), 'pas du json du tout');
    const ko = wizard(['--lit-json', join(bac, 'payload.json')]);
    expect(ko.status).toBe(0);
    expect(ko.stdout).not.toContain('graine');
    void r;
  });
});
