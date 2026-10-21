import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
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
 *
 * ## Et le faux gflow **produit des fichiers** (21/10/2026, revue adversariale)
 *
 * Le faux gflow n'écrivait rien : `find` ne trouvait donc aucun fichier, et le
 * wizard s'arrêtait **avant** « Choisir et ranger ». Les étapes 4 à 6 — `installer`,
 * `consigner`, `cabler` — n'étaient donc **jamais** exercées par la suite. C'est
 * précisément pour ça qu'un bug réel a échappé à la boucle : `installer()`
 * déclarait `local src="$1" id="$2" reg="$REGISTRE/$id.webp"` sur une ligne, bash
 * évalue toutes les expansions avant la moindre affectation, donc `$id` était vide,
 * l'image s'appelait `.webp`, et le message de succès affichait le bon nom.
 *
 * Le faux gflow dépose donc de **vrais fichiers** (des PNG, que `installer`
 * convertit en webp) et écrit sur `stdout` un payload `--json` de la **forme
 * réelle**. Et comme le wizard travaille sur des chemins en dur, ils sont
 * surchargeables par l'environnement : sans ça, le test écrirait dans le dépôt.
 */
const racine = fileURLToPath(new URL('..', import.meta.url));
const WIZARD = 'scripts/illustration-vague.sh';
const CARTE = 'direction-pdg';

/** Timeout des tests qui lancent le wizard : python3 + Pillow, ça ne va pas vite. */
const DELAI = 60_000;

let bac = '';
let journal = '';
let scratch = '';
let registre = '';
let servi = '';
let donnees = '';
let readme = '';

/**
 * Le faux `gflow` : il journalise ses arguments, **produit des images**, et rend
 * le `--json` **réel** (graine imbriquée sous `images[]`, `model_name_type` à
 * `null`, `local_path` qui relie chaque entrée à son fichier).
 */
const FAUX_GFLOW = `#!/usr/bin/env bash
printf 'CALL\\n' >> "$GFLOW_JOURNAL"
for a in "$@"; do printf 'ARG %s\\n' "$a" >> "$GFLOW_JOURNAL"; done

out=""; n=1; prev=""
for a in "$@"; do
  if [[ "$prev" == "--out" ]]; then out="$a"; fi
  if [[ "$prev" == "-n" ]]; then n="$a"; fi
  prev="$a"
done
# Pas de --out : ce n'est pas une génération (auth status, doctor…). Rien à faire.
if [[ -z "$out" ]]; then exit 0; fi

mkdir -p "$out"
python3 - "$out" "$n" <<'PY'
import json, os, sys
from PIL import Image

out, n = sys.argv[1], int(sys.argv[2])
images = []
for i in range(1, n + 1):
    chemin = os.path.join(out, "fake_%d.png" % i)
    Image.new("RGB", (64, 64), (12, 24, 48)).save(chemin, "PNG")
    images.append({
        "media_name": "fake%d" % i,
        "workflow_id": "w%d" % i,
        "seed": 651010515 + i - 1,
        "prompt": "prompt de test",
        "model_name_type": None,
        "aspect_ratio": "IMAGE_ASPECT_RATIO_SQUARE",
        "dimensions": {"width": 1024, "height": 1024},
        "fife_url": "https://example.invalid/fake",
        "is_signed_url": True,
        "local_path": chemin
    })
print(json.dumps({
    "status": "ok",
    "command": "image t2i",
    "project_id": "00000000-0000-4000-8000-000000000000",
    "model": "NARWHAL",
    "count": len(images),
    "images": images
}))
PY
exit 0
`;

/**
 * Le README du bac : la **forme** du registre réel (deux tableaux, puis le
 * journal). Les tableaux ne couvrent que la Planche 1 — `direction-pdg` n'est
 * dans aucun des deux, c'est le cas des 276 cartes suivantes.
 */
const README_BAC = `# Illustrations — bac de test

## Cartes produites

| Carte (\`id\`) | Faction | Sujet | Graine | Fichier |
|---|---|---|---|---|
| \`sse-medecin-travail\` | SSE | médecin du travail | \`1704499335\` | \`sse-medecin-travail.webp\` |

## Non produites — quota

| Carte (\`id\`) | Faction | Sujet | Accent | État |
|---|---|---|---|---|
| \`support-responsable-support\` | Support | responsable support | argenté | **à générer** |

## Journal des productions

> Tenu par \`scripts/illustration-vague.sh\`.

- 2026-10-20 · \`sse-medecin-travail\` · modèle \`NARWHAL\` · graine \`900000001\` · \`sse-medecin-travail.webp\`
`;

/** Un fichier de données, dans la forme d'un fichier de faction du dépôt. */
const DONNEES_BAC = `import type { PlanqueCard } from './types';

export const DIRECTION_CARDS: PlanqueCard[] = [
  base({
    id: 'direction-pdg',
    name: 'PDG',
    stage: 'N+2',
    rarity: '3D',
    hp: 140,
    retreat: 2,
    attacks: [
      { name: 'Plan de départ', cost: ['DIRECTION', 'INCOLORE'], damage: 60 }
    ],
    flavor: 'Il repart avec la prime. Tu restes avec le plan.'
  }),
  base({
    id: 'sse-medecin-travail',
    name: 'Médecin du travail',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [],
    flavor: 'Il a tout vu. Il ne dit rien.'
  }),
  base({
    id: 'support-responsable-support',
    name: 'Responsable support',
    stage: 'ENTRANT',
    rarity: '1D',
    hp: 60,
    retreat: 1,
    attacks: [],
    flavor: 'Le casque est neuf. Le reste aussi.'
  })
];
`;

beforeEach(() => {
  bac = mkdtempSync(join(tmpdir(), 'gflow-faux-'));
  journal = join(bac, 'journal.txt');
  scratch = join(bac, 'scratch');
  registre = join(bac, 'registre');
  servi = join(bac, 'servi');
  donnees = join(bac, 'donnees');
  readme = join(registre, 'README.md');
  mkdirSync(registre, { recursive: true });
  mkdirSync(servi, { recursive: true });
  mkdirSync(donnees, { recursive: true });
  writeFileSync(readme, README_BAC);
  writeFileSync(join(donnees, 'direction.ts'), DONNEES_BAC);
  writeFileSync(join(bac, 'gflow'), FAUX_GFLOW, { mode: 0o755 });
});

afterEach(() => {
  rmSync(bac, { recursive: true, force: true });
});

/**
 * Lance le wizard avec le faux gflow en tête de PATH, **dans le bac** : registre,
 * fichiers servis, données et README y sont — jamais dans le dépôt. Les deux
 * vérifications du dernier stage sont neutralisées (`true`) : le wizard les
 * déclenche ici, et y lancer `npm test` serait `vitest` dans `vitest`.
 */
function wizard(args: string[] = [], stdin = '', extra: Record<string, string> = {}) {
  return spawnSync('bash', [WIZARD, ...args], {
    cwd: racine,
    input: stdin,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bac}:${process.env.PATH ?? ''}`,
      GFLOW_JOURNAL: journal,
      GFLOW_ILLUSTRATION_SCRATCH: scratch,
      GFLOW_ILLUSTRATION_REGISTRE: registre,
      GFLOW_ILLUSTRATION_SERVI: servi,
      GFLOW_ILLUSTRATION_README: readme,
      GFLOW_ILLUSTRATION_DONNEES: donnees,
      GFLOW_ILLUSTRATION_CHECK_CMD: 'true',
      GFLOW_ILLUSTRATION_TEST_CMD: 'true',
      GFLOW_ILLUSTRATION_CHECK_LOG: join(bac, 'check.log'),
      GFLOW_ILLUSTRATION_TEST_LOG: join(bac, 'test.log'),
      // Par défaut, **aucune** base : la suite ne doit pas lire la base réelle de
      // la machine, elle dépendrait de l'état du poste de dev.
      GFLOW_ILLUSTRATION_DB: join(bac, 'gflow-absente.db'),
      ...extra
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

/**
 * Une session **complète**, jusqu'au bout : bannière, carte, modèle, nombre de
 * variantes, choix de la variante, consignation, câblage, puis la pause finale.
 * Huit lignes, dans cet ordre — la liste des invites du wizard.
 */
const stdinComplet = (modele = 'nano2', variantes = '1') =>
  `\n\n${modele}\n${variantes}\n\ny\ny\n\n`;

/** La session `--installe` : pas de modèle, pas de variantes, pas de choix. */
const stdinInstalle = () => `\n\ny\ny\n\n`;

/**
 * Une petite image **valide** (PNG 16×16), écrite sans dépendance : le wizard
 * la convertit en webp, et une image invalide ferait échouer `installer`.
 */
function png(): Buffer {
  const largeur = 16;
  const hauteur = 16;
  const brut = Buffer.alloc((largeur * 3 + 1) * hauteur);
  let o = 0;
  for (let y = 0; y < hauteur; y++) {
    brut[o++] = 0; // filtre « none »
    for (let x = 0; x < largeur; x++) {
      brut[o++] = (x * 15) & 0xff;
      brut[o++] = (y * 15) & 0xff;
      brut[o++] = 0x30;
    }
  }
  const morceau = (type: string, data: Buffer) => {
    const corps = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps) >>> 0);
    const taille = Buffer.alloc(4);
    taille.writeUInt32BE(data.length);
    return Buffer.concat([taille, corps, crc]);
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // profondeur
  entete[9] = 2; // couleur RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', entete),
    morceau('IDAT', deflateSync(brut)),
    morceau('IEND', Buffer.alloc(0))
  ]);
}

/**
 * La base locale de gflow, dans le **schéma réel** : `local_files` joint à
 * `assets`. C'est elle qui porte la graine d'une image produite par le MCP
 * gflow, qui ne rend pas de graine.
 */
function creerBase(chemin: string, lignes: { seed: number; path: string; model?: string | null }[]) {
  const script = `
import json, sqlite3, sys
db, lignes = sys.argv[1], json.loads(sys.argv[2])
con = sqlite3.connect(db)
con.execute("create table assets (id text primary key, seed integer, model text)")
con.execute("create table local_files (id integer primary key, asset_id text, path text)")
for i, l in enumerate(lignes):
    con.execute("insert into assets values (?,?,?)", (str(i), l["seed"], l.get("model")))
    con.execute("insert into local_files values (?,?,?)", (i, str(i), l["path"]))
con.commit()
`;
  const r = spawnSync('python3', ['-c', script, chemin, JSON.stringify(lignes)], {
    encoding: 'utf8'
  });
  if (r.status !== 0) throw new Error(`base de test impossible : ${r.stderr}`);
}

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
  }, DELAI);

  it('un nom humain est résolu vers l’alias gflow', () => {
    wizard([CARTE], stdinPour('Nano Banana 2.1'));
    expect(option(generation(), '--model')).toBe('nano2');
  }, DELAI);

  it('un alias est accepté tel quel', () => {
    wizard([CARTE], stdinPour('nano2'));
    expect(option(generation(), '--model')).toBe('nano2');
  }, DELAI);

  it('un modèle inconnu n’atteint jamais gflow', () => {
    wizard([CARTE], stdinPour('truc-qui-nexiste-pas'));
    expect(
      option(generation(), '--model'),
      'un modèle inconnu ne doit jamais atteindre gflow'
    ).not.toBe('truc-qui-nexiste-pas');
  }, DELAI);

  it('trois essais invalides abandonnent sans appeler gflow du tout', () => {
    const r = wizard([CARTE], `\n\ntruc\ntruc\ntruc\n`);
    expect(generation(), 'aucune génération ne doit partir').toBeUndefined();
    expect(r.stdout + r.stderr).toContain('nano2');
  }, DELAI);

  it('le prompt part sur une seule ligne', () => {
    // Le socle est un bloc de code multiligne ; `$(socle)` quoté garde ses
    // retours à la ligne. Un prompt d'une seule ligne reste comparable, se
    // journalise et se cherche.
    wizard([CARTE], stdinPour('nano2'));
    expect(generation()?.[2], 'le prompt doit être le 3ᵉ argument').not.toContain('\n');
  }, DELAI);

  it('l’aspect demandé est bien 1:1 — le gabarit de carte est carré', () => {
    wizard([CARTE], stdinPour('nano2'));
    expect(option(generation(), '--aspect')).toBe('1:1');
  }, DELAI);

  it('le scratch reste dans le bac du test, jamais dans le dépôt', () => {
    // Sans cet override, la boucle lit le vrai `.scratch/gflow/` : elle passe
    // tant que personne n'a généré, puis casse dès la première vraie génération
    // — quatre variantes réelles, un choix attendu, un EOF. Observé.
    wizard([CARTE], stdinPour('nano2'));
    const sortie = option(generation(), '--out');
    expect(
      sortie,
      `le wizard écrit dans ${sortie} — un test qui dépend de l'état du dépôt ne garde rien`
    ).toContain(scratch);
  }, DELAI);

  it('l’invite annonce les noms humains, pas seulement les alias', () => {
    const r = wizard([CARTE], stdinPour('nano2'));
    expect(r.stdout).toContain('Nano Banana 2.1');
  }, DELAI);

  it('un EOF à une invite ne tue pas le wizard en silence', () => {
    // `ask` renvoie 1 à EOF ; sous `set -e`, un `return 1` nu fait sortir le
    // script avec le code 1 et **aucun message**. Observé en vrai.
    const r = wizard([CARTE], '\n\n');
    expect(r.status, `sortie ${r.status} sans explication`).not.toBe(1);
  }, DELAI);

  it('--modele résout hors interaction, et sort 2 sur un inconnu', () => {
    const ok = wizard(['--modele', 'Nano Banana 2.1']);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout.trim()).toBe('nano2');

    const ko = wizard(['--modele', 'nano2.1-inconnu']);
    expect(ko.status).toBe(2);
    expect(ko.stderr).toContain('nano2');
  }, DELAI);
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

/**
 * **De bout en bout, sur disque** (#97, revue adversariale du 21/10/2026).
 *
 * Les étapes 4 à 6 — ranger dans les deux jeux, consigner, câbler — n'étaient
 * exercées par **aucun** test : le faux gflow n'écrivait aucun fichier, donc le
 * wizard s'arrêtait avant « Choisir et ranger ». C'est ainsi qu'un bug réel a
 * échappé à la boucle (le nom du fichier rangé était vide). Ces tests regardent
 * donc **le disque**, pas la sortie.
 */
describe('Wizard d’illustration — de bout en bout, sur disque (#97)', () => {
  it('le contrôle mord : l’image atterrit dans les DEUX jeux, identique octet pour octet', () => {
    // Le bug historique : `local src="$1" id="$2" reg="$REGISTRE/$id.webp"` sur
    // une ligne — bash évalue toutes les expansions avant la moindre
    // affectation, donc le fichier s'appelait `.webp` et le message de succès
    // affichait le bon nom. Ce test le voit : il regarde le **nom** sur disque.
    const r = wizard([CARTE], stdinComplet());
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const auRegistre = join(registre, `${CARTE}.webp`);
    const auServi = join(servi, `${CARTE}.webp`);
    expect(existsSync(auRegistre), `pas d'image dans le registre : ${auRegistre}`).toBe(true);
    expect(existsSync(auServi), `pas d'image dans le servi : ${auServi}`).toBe(true);
    expect(
      readFileSync(auRegistre).equals(readFileSync(auServi)),
      'les deux jeux doivent porter le même fichier, octet pour octet (règle #120)'
    ).toBe(true);
    // et c'est bien un webp : la conversion a eu lieu
    expect(readFileSync(auRegistre).subarray(8, 12).toString('latin1')).toBe('WEBP');
  }, DELAI);

  it('le README a gagné la ligne de journal attendue', () => {
    wizard([CARTE], stdinComplet());
    expect(readFileSync(readme, 'utf8')).toMatch(
      /- \d{4}-\d{2}-\d{2} · `direction-pdg` · modèle `NARWHAL` · graine `651010515` · `direction-pdg\.webp`/
    );
  }, DELAI);

  it('le message ne prétend pas ce qui n’a pas eu lieu : aucun tableau touché', () => {
    // `direction-pdg` n’est dans aucun des deux tableaux : le journal change,
    // les tableaux ne changent pas. L’ancien message annonçait quand même la
    // mise à jour des deux tableaux — un mensonge sur 276 des 286 cartes.
    const r = wizard([CARTE], stdinComplet());
    const sortie = r.stdout + r.stderr;
    expect(sortie).toContain('Ligne ajoutée au journal vivant');
    expect(sortie).not.toContain('la graine des tableaux est à jour');
    expect(sortie).toContain('Aucun tableau touché');
    // et le tableau n'a pas bougé : la graine de sse-medecin-travail est intacte
    expect(readFileSync(readme, 'utf8')).toContain('`1704499335`');
  }, DELAI);

  it('un tableau touché est nommé : « Cartes produites » est corrigé', () => {
    const r = wizard(['sse-medecin-travail'], stdinComplet());
    const sortie = r.stdout + r.stderr;
    expect(sortie).toContain('« Cartes produites » a été corrigé');
    const texte = readFileSync(readme, 'utf8');
    expect(texte).toContain('`651010515`');
    expect(texte).not.toContain('`1704499335`');
  }, DELAI);

  it('une carte produite est retirée de « Non produites »', () => {
    const r = wizard(['support-responsable-support'], stdinComplet());
    const sortie = r.stdout + r.stderr;
    expect(sortie).toContain('« Non produites »');
    const texte = readFileSync(readme, 'utf8');
    expect(texte).not.toContain('| `support-responsable-support` | Support |');
    // le journal, lui, garde la trace
    expect(texte).toMatch(/· `support-responsable-support` ·/);
  }, DELAI);

  it('la carte reçoit `art:` en dernière propriété, la virgule comprise', () => {
    wizard([CARTE], stdinComplet());
    const texte = readFileSync(join(donnees, 'direction.ts'), 'utf8');
    expect(texte).toContain(
      "    flavor: 'Il repart avec la prime. Tu restes avec le plan.',\n" +
        "    art: 'direction-pdg.webp'\n" +
        '  }),'
    );
  }, DELAI);

  it('un `npm run check` raté arrête le wizard : pas d’invitation à commiter', () => {
    // Le défaut trouvé en revue : le wizard **continuait** après l’échec, et
    // concluait « quand tout est vert, commit ». Il pouvait donc conduire à
    // commiter un état cassé.
    const r = wizard([CARTE], stdinComplet(), { GFLOW_ILLUSTRATION_CHECK_CMD: 'false' });
    expect(r.status, 'le wizard doit sortir en erreur, pas seulement avertir').not.toBe(0);
    const sortie = r.stdout + r.stderr;
    expect(sortie).not.toContain('commit les trois choses');
    expect(sortie).toContain('git checkout --');
  }, DELAI);

  it('un test raté arrête le wizard : pas d’invitation à commiter', () => {
    const r = wizard([CARTE], stdinComplet(), { GFLOW_ILLUSTRATION_TEST_CMD: 'false' });
    expect(r.status, 'le wizard doit sortir en erreur, pas seulement avertir').not.toBe(0);
    expect(r.stdout + r.stderr).not.toContain('commit les trois choses');
  }, DELAI);

  it('une exécution verte garde le code 0 et invite au commit', () => {
    const r = wizard([CARTE], stdinComplet());
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('commit les trois choses ENSEMBLE');
  }, DELAI);
});

/**
 * La graine quand le `--json` manque : la **base locale de gflow**.
 *
 * Le CLI rend la graine dans son `--json` ; le **MCP** gflow, non. Mais gflow
 * note chaque fichier qu'il produit dans sa base SQLite locale, avec sa graine.
 * Une image déjà produite se consigne donc quand même — c'est ce que le mode
 * `--installe` fait, et c'est ce que la base permet.
 */
describe('Wizard d’illustration — la graine retrouvée dans la base de gflow (#97)', () => {
  it('le contrôle mord : la graine trouvée est bien celle du bon fichier', () => {
    const a = join(bac, 'a.png');
    const b = join(bac, 'b.png');
    writeFileSync(a, png());
    writeFileSync(b, png());
    creerBase(join(bac, 'gflow.db'), [
      { seed: 111111, path: a },
      { seed: 222222, path: b }
    ]);
    const r = wizard(['--lit-base', a], '', { GFLOW_ILLUSTRATION_DB: join(bac, 'gflow.db') });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('111111');
    expect(r.stdout).not.toContain('222222');
  }, DELAI);

  it('une image installée sans payload est consignée avec la graine de la base', () => {
    const image = join(bac, 'mcp-01.png');
    writeFileSync(image, png());
    creerBase(join(bac, 'gflow.db'), [{ seed: 2119255853, path: image }]);
    const r = wizard([CARTE, '--installe', image], stdinInstalle(), {
      GFLOW_ILLUSTRATION_DB: join(bac, 'gflow.db')
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const sortie = r.stdout + r.stderr;
    expect(sortie).toContain('base locale de gflow');
    expect(sortie).toContain('2119255853');
    expect(readFileSync(readme, 'utf8')).toMatch(/graine `2119255853`/);
  }, DELAI);

  it('une graine introuvable reste « inconnue », sans faire tomber le wizard', () => {
    const image = join(bac, 'ailleurs.png');
    writeFileSync(image, png());
    const r = wizard([CARTE, '--installe', image], stdinInstalle(), {
      GFLOW_ILLUSTRATION_DB: join(bac, 'gflow-absente.db')
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(readFileSync(readme, 'utf8')).toMatch(/graine `inconnue`/);
  }, DELAI);

  it('une base illisible ne fait pas tomber le wizard, et n’invente pas de graine', () => {
    const image = join(bac, 'ailleurs.png');
    writeFileSync(image, png());
    const pourrie = join(bac, 'pas-une-base.db');
    writeFileSync(pourrie, 'ceci n’est pas une base SQLite');
    const r = wizard([CARTE, '--installe', image], stdinInstalle(), {
      GFLOW_ILLUSTRATION_DB: pourrie
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(readFileSync(readme, 'utf8')).toMatch(/graine `inconnue`/);
  }, DELAI);
});
