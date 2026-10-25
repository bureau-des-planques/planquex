import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../src/data/index';
import { FACTION_META } from '../src/data/factions';
import type { Faction } from '../src/data/types';

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

# Échecs simulés (#156) : les GFLOW_FAUX_ECHECS premières générations rendent
# GFLOW_FAUX_CODE, sans rien produire. Le compteur vit dans GFLOW_FAUX_COMPTEUR.
if [[ -n "$GFLOW_FAUX_ECHECS" ]]; then
  compte=$(cat "$GFLOW_FAUX_COMPTEUR" 2>/dev/null || echo 0)
  if (( compte < GFLOW_FAUX_ECHECS )); then
    printf '%s\n' $(( compte + 1 )) > "$GFLOW_FAUX_COMPTEUR"
    echo "TransportTimeoutError (simulé)" >&2
    exit "$GFLOW_FAUX_CODE"
  fi
fi

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
 * journal). Les tableaux ne couvrent que la planche **Portrait** — `direction-pdg`
 * n'est dans aucun des deux, c'est le cas des autres cartes.
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
  donnees = join(bac, 'donnees');
  readme = join(registre, 'README.md');
  mkdirSync(registre, { recursive: true });
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
 * données et README y sont — jamais dans le dépôt. Une seule copie (D-045). Les deux
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

/**
 * Le wizard lance des commandes de vérification dont les cibles par défaut sont des
 * **chemins** (`npm test -- <fichier>`). D-045 a supprimé un de ces fichiers, et rien
 * ne l'a vu : le wizard aurait échoué à sa dernière étape, sur un test disparu.
 * Cette garde relit les valeurs par défaut dans le script et exige que chaque chemin
 * existe. Elle mord : remettre un fichier supprimé la fait tomber.
 */
function cheminsDesCommandesParDefaut(): string[] {
  const source = readFileSync(join(racine, WIZARD), 'utf8');
  const defauts = [...source.matchAll(/GFLOW_ILLUSTRATION_(?:TEST|CHECK)_CMD:-([^}"]+)/g)].map((m) => m[1]);
  return defauts
    .flatMap((commande) => commande.split(/\s+/))
    .filter((mot) => mot.includes('/') && !mot.startsWith('-'));
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

  it('un abandon sort en erreur, jamais en succès', () => {
    // Les sept sorties anticipées — gflow absent, Pillow absent, pas
    // d'authentification Flow, carte inconnue, modèle invalide, génération
    // ratée, aucun fichier produit — renvoient 1. Constaté le 21/10/2026 :
    // elles renvoyaient **0**, donc un script qui appelle le wizard croyait
    // avoir réussi alors qu'il n'avait rien produit. Même classe de défaut que
    // « le message de succès affichait le bon nom de fichier ».
    const r = wizard([CARTE], `\n\ntruc\ntruc\ntruc\n`);
    expect(r.status, 'le wizard a abandonné mais annonce un succès').not.toBe(0);
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
 * Les étapes 4 à 6 — ranger dans les deux copies, consigner, câbler — n'étaient
 * exercées par **aucun** test : le faux gflow n'écrivait aucun fichier, donc le
 * wizard s'arrêtait avant « Choisir et ranger ». C'est ainsi qu'un bug réel a
 * échappé à la boucle (le nom du fichier rangé était vide). Ces tests regardent
 * donc **le disque**, pas la sortie.
 */
describe('Wizard d’illustration — de bout en bout, sur disque (#97)', () => {
  it('le contrôle mord : l’image atterrit au registre, et une seule fois (D-045)', () => {
    // Le bug historique : `local src="$1" id="$2" reg="$REGISTRE/$id.webp"` sur
    // une ligne — bash évalue toutes les expansions avant la moindre
    // affectation, donc le fichier s'appelait `.webp` et le message de succès
    // affichait le bon nom. Ce test le voit : il regarde le **nom** sur disque.
    const r = wizard([CARTE], stdinComplet());
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const auRegistre = join(registre, `${CARTE}.webp`);
    expect(existsSync(auRegistre), `pas d'image dans le registre : ${auRegistre}`).toBe(true);
    // **Une seule copie** (D-045) : le wizard ne doit plus rien écrire dans un `servi`,
    // sinon la duplication que la décision supprime revient par la porte de service.
    expect(existsSync(join(bac, 'servi')), 'le wizard a recréé une copie servie (D-045)').toBe(false);
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

  it('les commandes par défaut du wizard visent des fichiers qui existent', () => {
    const chemins = cheminsDesCommandesParDefaut();
    expect(chemins.length, 'aucun chemin trouvé dans les commandes par défaut').toBeGreaterThan(0);
    for (const chemin of chemins) {
      expect(existsSync(join(racine, chemin)), `le wizard vise un fichier disparu : ${chemin}`).toBe(true);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────────
 * Les deux tables de #121 — sujets et accents — et leur garde (Q10, Q14, D-046)
 *
 * La garde de la table des sujets remplace celle de #120 (Q14) : l'ancien test
 * comparait deux copies d'images, la source unique a supprimé la seconde. Le rôle
 * de `src/data/art.test.ts` est de dire « le fichier cité existe » ; **celui-ci**
 * dit « chaque carte de base a un sujet, et ce sujet est utilisable » — deux
 * gardes différentes, aucune ne remplace l'autre.
 *
 * **Elle doit pouvoir échouer** (#112) : chaque règle est confrontée plus bas à un
 * cas fautif fabriqué — une carte manquante, une ligne orpheline, un créneau en
 * trop, un couple objet+geste recopié, un accent qui ne dérive pas de la couleur.
 * Une garde qui passerait quoi qu'il arrive ne garderait rien.
 * ──────────────────────────────────────────────────────────────────────────────── */

const SUJETS_FICHIER = 'design/illustrations/SUJETS-flow.md';
const ACCENTS_FICHIER = 'design/illustrations/ACCENTS-flow.md';

/** Une ligne de `SUJETS-flow.md` : `| `id` | sujet |`, et rien d'autre. */
type LigneSujet = { id: string; sujet: string };

/**
 * Les lignes **hors bloc de code** d'une table. Un bloc ```text montre le *format*
 * (`| `FACTION` | accent |`) : le lire comme une donnée a déjà produit une faction
 * fantôme, donc les deux lecteurs sautent les blocs — comme `cartes()` et
 * `accent_de()` dans le wizard.
 */
function lignesDeTable(chemin: string): string[] {
  const lignes: string[] = [];
  let dansUnBloc = false;
  for (const brute of readFileSync(chemin, 'utf8').split('\n')) {
    if (/^\s*```/.test(brute)) {
      dansUnBloc = !dansUnBloc;
      continue;
    }
    if (!dansUnBloc) lignes.push(brute);
  }
  return lignes;
}

function lireSujets(chemin = join(racine, SUJETS_FICHIER)): LigneSujet[] {
  const lignes: LigneSujet[] = [];
  for (const brute of lignesDeTable(chemin)) {
    const m = /^\| `([a-z0-9-]+)` \| (.+?) \|$/.exec(brute.trim());
    if (m) lignes.push({ id: m[1], sujet: m[2] });
  }
  return lignes;
}

/** Une ligne de `ACCENTS-flow.md` : `| `FACTION` | accent |`, et rien d'autre. */
type LigneAccent = { faction: string; accent: string };

function lireAccents(chemin = join(racine, ACCENTS_FICHIER)): LigneAccent[] {
  const lignes: LigneAccent[] = [];
  for (const brute of lignesDeTable(chemin)) {
    const m = /^\| `([A-Z]+)` \| (.+?) \|$/.exec(brute.trim());
    if (m) lignes.push({ faction: m[1], accent: m[2] });
  }
  return lignes;
}

/** Les cinq créneaux du sujet (Q10, `docs/SPEC-ILLUSTRATIONS.md` §4). */
const SEGMENTS_DU_SUJET = 5;
const LONGUEUR_MAX = 200;

/**
 * Les mots de **tenue** admis. Une liste courte et lisible plutôt qu'un jugement :
 * le critère doit être **testable**, pas déclaratif. Elle couvre le vocabulaire
 * employé par la table et se complète quand la vague suivante en a besoin.
 */
const TENUES = [
  'apron',
  'blazer',
  'blouse',
  'boiler suit',
  'cap',
  'cardigan',
  'coat',
  'coveralls',
  'dungarees',
  'fleece',
  'gloves',
  'gown',
  'helmet',
  'hi-vis',
  'hoodie',
  'jacket',
  'jumpsuit',
  'overall',
  'overalls',
  'polo',
  'robe',
  'scrubs',
  'shirt',
  'skirt',
  'smock',
  'suit',
  'sweater',
  'sweatshirt',
  'tabard',
  'tie',
  'trousers',
  'tunic',
  'uniform',
  'vest',
  'waistcoat'
];

/** Les mots d'**expression** admis : le cinquième créneau doit dire un visage. */
const EXPRESSIONS = [
  'alarmed',
  'apologetic',
  'blank',
  'bored',
  'bright',
  'brisk',
  'calm',
  'cheerful',
  'confident',
  'content',
  'deadpan',
  'defiant',
  'detached',
  'determined',
  'distracted',
  'doubtful',
  'dry',
  'eager',
  'earnest',
  'encouraging',
  'exhausted',
  'flat',
  'focused',
  'glazed',
  'grave',
  'grim',
  'hopeful',
  'imperious',
  'impatient',
  'kind',
  'knowing',
  'late',
  'methodical',
  'mildly smug',
  'nervous',
  'overworked',
  'patient',
  'pained',
  'placid',
  'polite',
  'precise',
  'proud',
  'puzzled',
  'resigned',
  'sad',
  'serene',
  'severe',
  'sheepish',
  'sleepy',
  'smiling',
  'smug',
  'sour',
  'stern',
  'stoic',
  'suspicious',
  'sympathetic',
  'tired',
  'unbothered',
  'under pressure',
  'unimpressed',
  'unshockable',
  'vigilant',
  'watchful',
  'weary',
  'worried',
  'wry'
];

/** Un mot de la liste est présent, en mot entier (pas « retired » pour « tired »). */
function contientMot(texte: string, liste: readonly string[]): boolean {
  return liste.some((mot) => new RegExp(`(^|[^a-z-])${mot.replace(/-/g, '\\-')}([^a-z-]|$)`, 'i').test(texte));
}

/** Les problèmes d'**une** ligne ; vide = la ligne tient le critère. */
function problemesDunSujet(id: string, sujet: string, action: boolean): string[] {
  const problemes: string[] = [];
  if (sujet.length > LONGUEUR_MAX) problemes.push(`${id} : ${sujet.length} caractères (max ${LONGUEUR_MAX})`);

  if (action) {
    // Planche **Objet** (Q4′) : un objet symbolique unique, sans personne — donc
    // sans les cinq créneaux, et sans rien à tenir.
    if (!/^an? /i.test(sujet)) problemes.push(`${id} : un objet commence par un article`);
    if (/\bholding\b/i.test(sujet)) problemes.push(`${id} : un objet ne tient rien — pas de personne`);
    return problemes;
  }

  const segments = sujet.split(', ');
  if (segments.length !== SEGMENTS_DU_SUJET) {
    problemes.push(`${id} : ${segments.length} créneaux au lieu de ${SEGMENTS_DU_SUJET} — « ${sujet} »`);
    return problemes;
  }
  if (!/^(a|an|the) /i.test(segments[0])) problemes.push(`${id} : le rôle commence par un article`);
  if (!contientMot(segments[1], TENUES)) problemes.push(`${id} : aucune tenue — « ${segments[1]} »`);
  if (!segments[2].startsWith('holding ')) problemes.push(`${id} : l'objet s'écrit « holding … » — « ${segments[2]} »`);
  else if (segments[2].slice('holding '.length).trim() === '') problemes.push(`${id} : l'objet tenu est vide`);
  if (!segments[3].split(' ').some((mot) => /\w+ing$/.test(mot)))
    problemes.push(`${id} : le geste demande un verbe en -ing — « ${segments[3]} »`);
  if (!contientMot(segments[4], EXPRESSIONS)) problemes.push(`${id} : aucune expression — « ${segments[4]} »`);
  return problemes;
}

/**
 * Le contrôle complet de la table des sujets : une ligne par **carte de base**,
 * aucune orpheline, le critère du §4, et **l'accent jamais recopié**.
 */
function controlerSujets(lignes: LigneSujet[]): string[] {
  const problemes: string[] = [];
  const bases = ALL_CARDS.filter((carte) => !carte.variantOf);
  const parId = new Map(lignes.map((ligne) => [ligne.id, ligne.sujet]));
  if (parId.size !== lignes.length) problemes.push('une même carte a deux lignes de sujet');

  for (const carte of bases) {
    if (!parId.has(carte.id)) problemes.push(`${carte.id} : carte de base sans sujet`);
    else {
      problemes.push(...problemesDunSujet(carte.id, parId.get(carte.id) ?? '', carte.kind !== 'PLANQUE'));
      if (contientMot(parId.get(carte.id) ?? '', lireAccents().map((ligne) => ligne.accent)))
        problemes.push(`${carte.id} : l'accent est recopié sur la ligne de sujet (il vit dans ACCENTS-flow.md)`);
    }
  }
  const connues = new Set(bases.map((carte) => carte.id));
  for (const ligne of lignes) {
    if (!connues.has(ligne.id)) problemes.push(`${ligne.id} : ligne orpheline (aucune carte de base)`);
  }

  const vues = new Map<string, string>();
  for (const carte of bases) {
    if (carte.kind !== 'PLANQUE') continue;
    const segments = (parId.get(carte.id) ?? '').split(', ');
    if (segments.length !== SEGMENTS_DU_SUJET) continue;
    const paire = `${segments[2]} / ${segments[3]}`.toLowerCase();
    const deja = vues.get(paire);
    if (deja) problemes.push(`${carte.id} : couple objet + geste déjà pris par ${deja} — « ${paire} »`);
    else vues.set(paire, carte.id);
  }
  return problemes;
}

/** HSL d'une couleur de `FACTION_META` : la seule source de l'accent (D-046). */
function teinteEtSaturation(hex: string): { teinte: number; saturation: number } {
  const entier = Number.parseInt(hex.slice(1), 16);
  const r = ((entier >> 16) & 0xff) / 255;
  const g = ((entier >> 8) & 0xff) / 255;
  const b = (entier & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { teinte: 0, saturation: 0 };
  const saturation = delta / (1 - Math.abs(2 * l - 1));
  const brut =
    max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  return { teinte: (brut + 360) % 360, saturation };
}

/**
 * L'accent **ré-dérivé** de la couleur d'une faction : la teinte donne la famille,
 * la saturation sépare les deux oranges (`burnt orange` brûlant contre `rust
 * bronze` patiné) et `slate blue` (très désaturé) de `periwinkle blue`.
 *
 * C'est la **codification** de D-046 et de Q15 : les dix mots sont ceux de la
 * décision, et cette fonction est ce qui les rattache à `FACTION_META.color`.
 * Changer une couleur sans changer son mot fait donc échouer la garde — et c'est
 * tout l'objet de D-046.
 */
function accentDepuisCouleur(hex: string): string | undefined {
  const { teinte, saturation } = teinteEtSaturation(hex);
  if (teinte < 12 || teinte >= 345) return 'brick red';
  if (teinte < 24) return 'burnt orange';
  if (teinte < 36) return 'rust bronze';
  if (teinte >= 40 && teinte < 55) return 'electric yellow';
  if (teinte >= 150 && teinte < 175) return 'emerald green';
  if (teinte >= 175 && teinte < 192) return 'teal';
  if (teinte >= 192 && teinte < 205) return 'turquoise blue';
  if (teinte >= 205 && teinte < 228 && saturation < 0.35) return 'slate blue';
  if (teinte >= 228 && teinte < 250) return 'periwinkle blue';
  if (teinte >= 250 && teinte < 290) return 'violet purple';
  return undefined;
}

/** Le contrôle de la table des accents : dix factions, et elles seules (D-046). */
function controlerAccents(lignes: LigneAccent[]): string[] {
  const problemes: string[] = [];
  const factions = Object.keys(FACTION_META) as Faction[];
  const parFaction = new Map(lignes.map((ligne) => [ligne.faction, ligne.accent]));
  if (parFaction.size !== lignes.length) problemes.push('une même faction a deux accents');

  for (const faction of factions) {
    const accent = parFaction.get(faction);
    if (accent === undefined) {
      problemes.push(`${faction} : faction sans accent`);
      continue;
    }
    const attendu = accentDepuisCouleur(FACTION_META[faction].color);
    if (!attendu) problemes.push(`${faction} : la couleur ${FACTION_META[faction].color} ne donne aucun accent`);
    else if (accent !== attendu)
      problemes.push(`${faction} : « ${accent} » ne dérive pas de ${FACTION_META[faction].color} (attendu « ${attendu} »)`);
  }
  for (const ligne of lignes) {
    if (!(factions as string[]).includes(ligne.faction)) problemes.push(`${ligne.faction} : ligne orpheline`);
  }
  return problemes;
}

describe('Les tables de #121 — sujets et accents (Q10, Q14, D-046)', () => {
  it('une ligne par carte de base, aucune orpheline, et le critère du §4', () => {
    const problemes = controlerSujets(lireSujets());
    expect(problemes, problemes.join('\n')).toEqual([]);
  });

  it('les dix factions ont un accent, et il dérive de `FACTION_META.color`', () => {
    const problemes = controlerAccents(lireAccents());
    expect(problemes, problemes.join('\n')).toEqual([]);
  });

  it('le préfixe de l’id est la faction — c’est ce que le wizard lit pour l’accent', () => {
    // `faction_de()` (`scripts/illustration-vague.sh`) ne lit que le préfixe : si une
    // carte changeait de faction sans changer d'id, elle porterait l'accent d'une autre.
    const fautives = ALL_CARDS.filter((carte) => carte.id.split('-')[0].toUpperCase() !== carte.faction);
    expect(fautives.map((carte) => carte.id)).toEqual([]);
  });

  it('le contrôle mord : une carte de base sans sujet est refusée', () => {
    const sans = lireSujets().filter((ligne) => ligne.id !== 'atelier-cariste-salle-blanche');
    expect(controlerSujets(sans).join('\n')).toContain('atelier-cariste-salle-blanche');
  });

  it('le contrôle mord : une ligne orpheline est refusée', () => {
    const avec = [...lireSujets(), { id: 'sse-carte-fantome', sujet: 'a ghost, in a coat, holding a file, haunting a desk, blank and calm' }];
    expect(controlerSujets(avec).join('\n')).toContain('sse-carte-fantome');
  });

  it('le contrôle mord : un sujet à quatre ou six créneaux est refusé', () => {
    const sujets = lireSujets();
    const remplacer = (id: string, sujet: string) =>
      controlerSujets(sujets.map((ligne) => (ligne.id === id ? { id, sujet } : ligne))).join('\n');
    expect(remplacer('atelier-cariste-salle-blanche', 'a forklift driver, in a clean-room suit, cheerful')).toContain(
      'créneaux'
    );
    expect(
      remplacer('atelier-cariste-salle-blanche', 'a forklift driver, in a clean-room suit, holding a pallet list, steering through the door, cheerful, calm')
    ).toContain('créneaux');
  });

  it('le contrôle mord : un couple objet + geste recopié est refusé', () => {
    const sujets = lireSujets();
    const source = sujets.find((ligne) => ligne.id === 'direction-pdg');
    expect(source).toBeDefined();
    const copie = sujets.map((ligne) =>
      ligne.id === 'atelier-cariste-salle-blanche' ? { id: ligne.id, sujet: source?.sujet ?? '' } : ligne
    );
    expect(controlerSujets(copie).join('\n')).toContain('couple objet + geste');
  });

  it('le contrôle mord : un accent qui ne dérive pas de la couleur est refusé', () => {
    // « silver white » est l'ancien accent de SUPPORT : il ne se dérive pas de `#4f9d9d`.
    const accents = lireAccents().map((ligne) => (ligne.faction === 'SUPPORT' ? { faction: 'SUPPORT', accent: 'silver white' } : ligne));
    expect(controlerAccents(accents).join('\n')).toContain('SUPPORT');
  });

  it('le contrôle mord : une faction manquante ou une ligne de trop est refusée', () => {
    const sansSupport = lireAccents().filter((ligne) => ligne.faction !== 'SUPPORT');
    expect(controlerAccents(sansSupport).join('\n')).toContain('SUPPORT');
    const avec = [...lireAccents(), { faction: 'BUREAU', accent: 'grey' }];
    expect(controlerAccents(avec).join('\n')).toContain('BUREAU');
  });

  it('le wizard prend le sujet dans SUJETS-flow.md et l’accent dans ACCENTS-flow.md', () => {
    // Les deux chemins sont **paramétrables** : c'est ce qui rend le bac possible, et
    // ce qui prouve que le prompt ne vient pas d'une constante du script.
    const sujets = join(bac, 'sujets.md');
    writeFileSync(sujets, '| `direction-pdg` | a test subject, in a test coat, holding a test object, testing a test gesture, calm |\n');
    const accents = join(bac, 'accents.md');
    writeFileSync(accents, '| `DIRECTION` | test accent |\n');
    wizard([CARTE], stdinPour('nano2'), {
      GFLOW_ILLUSTRATION_SUJETS: sujets,
      GFLOW_ILLUSTRATION_ACCENTS: accents
    });
    const prompt = generation()?.[2] ?? '';
    expect(prompt).toContain('a test subject, in a test coat');
    expect(prompt).toContain('muted test accent accent.');
  }, DELAI);

  it('les tables livrées alimentent le prompt, sans recopie dans le script', () => {
    wizard([CARTE], stdinPour('nano2'));
    const prompt = generation()?.[2] ?? '';
    const sujet = lireSujets().find((ligne) => ligne.id === CARTE)?.sujet ?? '';
    const accent = lireAccents().find((ligne) => ligne.faction === 'DIRECTION')?.accent ?? '';
    expect(sujet, `${CARTE} doit avoir un sujet`).not.toBe('');
    expect(prompt).toContain(sujet);
    expect(prompt).toContain(`muted ${accent} accent.`);
  }, DELAI);
});

/**
 * Réessais sur échec de transport, mode direct, et prompt assemblé (#156).
 *
 * Le faux gflow échoue **N fois** (`GFLOW_FAUX_ECHECS`) avec un code donné
 * (`GFLOW_FAUX_CODE`), puis réussit. Chaque appel reçu est journalisé : c'est
 * le compte des `CALL` qui dit combien de tentatives ont eu lieu.
 */
describe('Wizard d’illustration — réessais, mode direct, prompt (#156)', () => {
  const generations = () => appels().filter((c) => c[0] === 'image' && c[1] === 't2i');
  const echecs = (n: number, code: number, extra: Record<string, string> = {}) => ({
    GFLOW_FAUX_ECHECS: String(n),
    GFLOW_FAUX_CODE: String(code),
    GFLOW_FAUX_COMPTEUR: join(bac, 'compteur'),
    GFLOW_ILLUSTRATION_TENTATIVES: '3',
    GFLOW_ILLUSTRATION_DELAI: '0',
    ...extra
  });

  it('le contrôle mord : un exit 9 est réessayé, et le succès au 3ᵉ essai est gardé', () => {
    // Deux timeouts puis une image : sans la boucle de réessai, le premier exit 9
    // arrête tout (exit 1) et le test échoue — c'est ce qu'on attend de lui.
    const r = wizard([CARTE], stdinComplet(), echecs(2, 9));
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(generations(), 'trois tentatives attendues : deux échecs puis un succès').toHaveLength(3);
    expect(existsSync(join(registre, `${CARTE}.webp`))).toBe(true);
  }, DELAI);

  it('chaque tentative est consignée, avec son code de sortie', () => {
    wizard([CARTE], stdinComplet(), echecs(2, 9));
    const log = readFileSync(join(scratch, CARTE, 'tentatives.log'), 'utf8').trim().split('\n');
    expect(log).toHaveLength(3);
    expect(log[0]).toMatch(/tentative 1\/3 · exit 9$/);
    expect(log[1]).toMatch(/tentative 2\/3 · exit 9$/);
    expect(log[2]).toMatch(/tentative 3\/3 · exit 0$/);
  }, DELAI);

  it('après le dernier essai raté, le wizard sort en erreur et le dit', () => {
    const r = wizard([CARTE], stdinComplet(), echecs(10, 9));
    expect(r.status, 'un échec de transport persistant doit sortir en erreur').not.toBe(0);
    expect(generations()).toHaveLength(3);
    expect(r.stdout + r.stderr).toContain('Échec de transport (exit 9');
    expect(r.stdout + r.stderr).not.toContain('commit les trois choses');
  }, DELAI);

  it('un exit 2 (usage) n’est jamais réessayé', () => {
    // Même avec des essais disponibles, un argument mal formé ne se corrige pas
    // en relançant la commande : une seule tentative, puis sortie.
    const r = wizard([CARTE], stdinComplet(), echecs(10, 2));
    expect(r.status).not.toBe(0);
    expect(generations(), 'un exit 2 ne doit produire qu’un seul appel').toHaveLength(1);
  }, DELAI);

  it('le nombre de tentatives se règle par l’environnement', () => {
    wizard([CARTE], stdinComplet(), echecs(10, 9, { GFLOW_ILLUSTRATION_TENTATIVES: '2' }));
    expect(generations()).toHaveLength(2);
  }, DELAI);

  it('le mode direct écrit le payload, sans rien ranger ni consigner', () => {
    const avant = readFileSync(readme, 'utf8');
    const r = wizard(['--direct', CARTE]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(option(generations()[0], '--model')).toBe('nano2');
    expect(existsSync(join(scratch, CARTE, 'payload.json')), 'le payload doit être écrit').toBe(true);
    expect(existsSync(join(registre, `${CARTE}.webp`)), 'le mode direct ne range rien').toBe(false);
    expect(readFileSync(readme, 'utf8')).toBe(avant);
  }, DELAI);

  it('le payload du mode direct se relit par --installe : la graine n’est pas touchée', () => {
    wizard(['--direct', CARTE]);
    const image = join(scratch, CARTE, 'fake_1.png');
    const r = wizard([CARTE, '--installe', image], stdinInstalle(), {
      GFLOW_ILLUSTRATION_DB: join(bac, 'gflow-absente.db')
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(readFileSync(readme, 'utf8')).toMatch(/graine `651010515`/);
  }, DELAI);

  it('le mode direct refuse une carte inconnue sans appeler gflow', () => {
    const r = wizard(['--direct', 'carte-qui-nexiste-pas']);
    expect(r.status).toBe(2);
    expect(generations()).toHaveLength(0);
  }, DELAI);

  it('le prompt de atelier-cariste-salle-blanche est celui du registre (772 caractères)', () => {
    // Golden : socle + sujet + accent, tels que la table les donne. Si le socle ou
    // la table bougent, ce test le dit — c'est voulu : le prompt envoyé à Flow a changé.
    // (D-095 : le cariste devient « cariste de salle blanche » ; l'ancien prompt, de 773
    // caractères, n'est plus généré.)
    const attendu =
      'Editorial trading-card illustration for a corporate-satire deck, semi-realistic painterly rendering, ' +
      'end-of-day office mood, satirical but never mean. Deep midnight-blue palette (#0b1220, #131c2e) with one ' +
      'muted saturated faction accent. A soft warm KEY light fully illuminates the FACE — well-exposed skin, ' +
      'clearly visible features, no shadow over the eyes; only a subtle gold (#e6b64c) rim light on the shoulders ' +
      'and hair. Matte surfaces, subtle film grain, subject centered and isolated on a darker background, ' +
      'occupying ~70% of the frame, waist-up, square 1:1. No text, no logo, no watermark, no brand, no real person. ' +
      'a forklift driver, in a clean-room suit, holding a pallet list, pushing a pallet trolley through an airlock door, ' +
      'cheerful, muted rust bronze accent.';
    expect([...attendu]).toHaveLength(772);
    const r = wizard(['--prompt', 'atelier-cariste-salle-blanche']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.replace(/\n$/, '')).toBe(attendu);
  });
});

/**
 * L'isolation du bac (#176) : **aucun chemin partagé**.
 *
 * Le wizard écrivait trois fichiers à côté du bac : `/tmp/illustration-check.log`,
 * `/tmp/illustration-test.log`, et le `stderr` de gflow dans
 * `/tmp/gflow-illustration.err`. Deux exécutions concurrentes — deux agents, ou
 * `npm test` et `npm run garde-fous` (qui relance ce fichier pour ses trois
 * mutations #97) — écrivaient donc les mêmes chemins, et un échec ne disait plus
 * laquelle des deux avait parlé. Les trois vivent maintenant sous `$SCRATCH`, que
 * le test pointe dans son bac : il n'y a plus rien de partagé à observer.
 */
describe('Wizard d’illustration — aucun chemin partagé (#176)', () => {
  it('les trois logs d’une exécution tombent dans le bac', () => {
    // Les overrides vides font retomber le wizard sur ses **défauts** : c'est
    // exactement ce que le test doit regarder, pas la valeur que le harnais impose.
    const r = wizard([CARTE], stdinComplet(), {
      GFLOW_ILLUSTRATION_CHECK_LOG: '',
      GFLOW_ILLUSTRATION_TEST_LOG: '',
      GFLOW_ILLUSTRATION_ERR: ''
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    for (const nom of ['gflow.err', 'check.log', 'test.log']) {
      expect(existsSync(join(scratch, nom)), `${nom} devrait vivre dans le bac : ${scratch}`).toBe(true);
    }
  }, DELAI);

  it('le contrôle mord : le script ne nomme aucun chemin en dur hors du dépôt', () => {
    // Les bibliothèques standard les écrivent dans un répertoire temporaire du
    // système ; les chemins `mktemp` sont uniques par construction. Ce qui est
    // interdit, c'est un chemin **fixe** — celui que deux exécutions se partagent.
    // Les commentaires sont sautés : ils citent les anciens chemins pour mémoire.
    const lignes = readFileSync(join(racine, WIZARD), 'utf8')
      .split('\n')
      .filter((ligne) => !/^\s*#/.test(ligne));
    const fixes = [...lignes.join('\n').matchAll(/\/tmp\/[^\s"'`)]+/g)].map((m) => m[0]);
    expect(fixes, `chemins partagés dans ${WIZARD}`).toEqual([]);
  });
});
