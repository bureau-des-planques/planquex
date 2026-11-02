import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Lot d'illustrations — `scripts/ci/gflow-lot.sh`.
 *
 * Trois choses sont vérifiées ici, et ce sont exactement celles qui peuvent
 * mentir en silence :
 *
 * 1. **La carte d'une image se lit dans gflow**, pas dans l'ordre des fichiers.
 *    En passe groupée, gflow nomme ses sorties `prompt_<n>_0.jpg`, mais **saute
 *    les prompts en échec** : le n-ième fichier n'est pas le n-ième prompt.
 *    Le faux gflow saute donc volontairement un prompt (index 1), et le test
 *    exige que les cartes 0 et 2 reçoivent **leur** graine.
 * 2. **Une graine se lit ou s'écrit « inconnue », jamais inventée** (`AGENTS.md`
 *    §6). Sans ligne dans la base, le payload porte `seed: null`, et le journal
 *    dit `graine=inconnue` — il ne se rabat pas sur un numéro plausible.
 * 3. **Une carte déjà servie ne repart pas** : c'est ce qui rend le script
 *    reprenable, donc utilisable sur 200 cartes.
 *
 * Le faux `gflow` écrit de **vrais fichiers** et de **vraies lignes SQLite**
 * dans le schéma que lit le script (`local_files` → `assets` →
 * `operations`) : une doublure qui ne produirait rien laisserait passer un
 * script qui ne range rien — le piège déjà rencontré sur `illustration-vague`.
 */
const racine = fileURLToPath(new URL('../..', import.meta.url));
const SCRIPT = 'scripts/ci/gflow-lot.sh';
const delai = 30_000;

let bac = '';
let sujets = '';
let registre = '';
let donnees = '';
let sortie = '';
let db = '';
let fauxGflow = '';
let fauxWizard = '';
let journal = '';

const CARTES = ['atelier-un', 'atelier-deux', 'atelier-trois'];

/**
 * Le faux gflow : il journalise ses arguments, écrit une image par prompt hors
 * `FAUX_GFLOW_SAUTE`, et inscrit la graine et le prompt dans la base locale —
 * comme le vrai, qui les garde même en passe groupée.
 */
const GFLOW = `#!/usr/bin/env bash
set -euo pipefail
printf 'CALL\\n' >> "$GFLOW_JOURNAL"
for a in "$@"; do printf 'ARG %s\\n' "$a" >> "$GFLOW_JOURNAL"; done

prompts=""; out=""; prev=""
for a in "$@"; do
  [[ "$prev" == "--prompts-file" ]] && prompts="$a"
  [[ "$prev" == "--out" ]] && out="$a"
  prev="$a"
done
[[ -n "$out" ]] || exit 1
mkdir -p "$out"
i=0
while IFS= read -r ligne; do
  [ -z "$ligne" ] && continue
  if [ "$i" = "\${FAUX_GFLOW_SAUTE:-x}" ]; then i=$((i+1)); continue; fi
  f="$out/prompt_\${i}_0.jpg"
  printf 'jpeg' > "$f"
  if [ "\${FAUX_GFLOW_SANS_BASE:-0}" != "1" ]; then
    python3 - "$GFLOW_LOT_DB" "$f" "$ligne" "$((i * 7 + 11))" <<'PY'
import sqlite3, sys
db, chemin, prompt, graine = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
# Les identifiants se dérivent du **chemin** : deux paquets repartent tous deux de
# prompt_0_0, donc un identifiant fondé sur le rang entrerait en collision (et
# gflow, lui, identifie bien chaque média).
ident = chemin
con = sqlite3.connect(db)
con.executescript("""
create table if not exists assets(id text primary key, seed integer, model text);
create table if not exists local_files(id text primary key, asset_id text, path text);
create table if not exists operations(id text primary key, prompt text, model text);
create table if not exists operation_assets(asset_id text, operation_id text);
""")
con.execute("insert into operations values (?, ?, 'NARWHAL')", ('o' + ident, prompt))
con.execute("insert into assets values (?, ?, null)", ('a' + ident, graine))
con.execute("insert into local_files values (?, ?, ?)", ('l' + ident, 'a' + ident, chemin))
con.execute("insert into operation_assets values (?, ?)", ('a' + ident, 'o' + ident))
con.commit()
con.close()
PY
  fi
  i=$((i+1))
done < "$prompts"
exit 0
`;

/** Le faux wizard : il rend le prompt, génère en `--direct`, range en `--installe`. */
const WIZARD = `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  --modele)
    case "\${2:-}" in
      "Nano Banana 2.1"|nano2) printf 'nano2\\n'; exit 0 ;;
      *) exit 2 ;;
    esac ;;
  --prompt) printf 'PROMPT-%s\\n' "\${2:-}"; exit 0 ;;
esac
id="\${1:-}"; mode="\${2:-}"
case "$mode" in
  --direct)
    mkdir -p "$GFLOW_LOT_SORTIE/$id"
    printf 'jpeg' > "$GFLOW_LOT_SORTIE/$id/abc_1.jpg"
    printf '{"status":"ok","model":"NARWHAL","images":[{"seed":42,"local_path":"%s"}]}' \\
      "$GFLOW_LOT_SORTIE/$id/abc_1.jpg" > "$GFLOW_LOT_SORTIE/$id/payload.json" ;;
  --installe)
    mkdir -p "$GFLOW_LOT_REGISTRE"
    printf 'webp' > "$GFLOW_LOT_REGISTRE/$id.webp"
    printf "  art: '%s.webp'\\n" "$id" >> "$GFLOW_LOT_DONNEES/atelier.ts" ;;
esac
exit 0
`;

beforeEach(() => {
  bac = mkdtempSync(join(tmpdir(), 'gflow-lot-'));
  sujets = join(bac, 'SUJETS-flow.md');
  registre = join(bac, 'registre');
  donnees = join(bac, 'data');
  sortie = join(bac, 'sortie');
  db = join(bac, 'gflow.db');
  fauxGflow = join(bac, 'faux-gflow');
  fauxWizard = join(bac, 'faux-wizard');
  journal = join(bac, 'gflow.journal');
  mkdirSync(registre, { recursive: true });
  mkdirSync(donnees, { recursive: true });
  mkdirSync(sortie, { recursive: true });
  const lignes = CARTES.map((id) => `| \`${id}\` | un sujet pour ${id} |`).join('\n');
  writeFileSync(sujets, `## La table\n\n| Carte (\`id\`) | Sujet |\n|---|---|\n${lignes}\n`);
  writeFileSync(fauxGflow, GFLOW, { mode: 0o755 });
  writeFileSync(fauxWizard, WIZARD, { mode: 0o755 });
  writeFileSync(journal, '');
  writeFileSync(join(donnees, 'atelier.ts'), '// données de test\n');
});

afterEach(() => {
  if (bac) rmSync(bac, { recursive: true, force: true });
});

function lancer(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync('bash', [SCRIPT, ...args], {
    cwd: racine,
    encoding: 'utf8',
    env: {
      ...process.env,
      GFLOW_LOT_WIZARD: fauxWizard,
      GFLOW_LOT_GFLOW: fauxGflow,
      GFLOW_LOT_SUJETS: sujets,
      GFLOW_LOT_REGISTRE: registre,
      GFLOW_LOT_DONNEES: donnees,
      GFLOW_LOT_SORTIE: sortie,
      GFLOW_LOT_DB: db,
      GFLOW_JOURNAL: journal,
      GFLOW_LOT_CHECK_CMD: 'true',
      GFLOW_LOT_TEST_CMD: 'true',
      ...env,
    },
  });
  return { code: r.status ?? -1, sortie: `${r.stdout}${r.stderr}` };
}

const lirePayload = (id: string) =>
  JSON.parse(readFileSync(join(sortie, id, 'payload.json'), 'utf8')) as {
    model?: string;
    images: Array<{ seed: number | null; local_path: string }>;
  };

const lignesJournal = () => readFileSync(join(sortie, 'lot.log'), 'utf8').trim().split('\n');

describe('gflow-lot.sh — la passe groupée', () => {
  it(
    'associe chaque image à SA carte et à SA graine, même quand un prompt échoue',
    () => {
      // gflow saute le prompt d'index 1 : les fichiers sont prompt_0 et prompt_2.
      const { code } = lancer(['--toutes', '--force'], { FAUX_GFLOW_SAUTE: '1' });

      // Deux images sur trois : le lot se termine en le disant (exit 1), il ne
      // prétend pas avoir tout produit.
      expect(code).toBe(1);

      // carte 0 → prompt d'index 0 → graine 11 ; carte 2 → index 2 → graine 25.
      expect(lirePayload('atelier-un').images[0]?.seed).toBe(11);
      expect(lirePayload('atelier-trois').images[0]?.seed).toBe(25);
      // L'erreur qui se paierait cher : prendre le 2ᵉ fichier pour la 2ᵉ carte.
      expect(existsSync(join(sortie, 'atelier-deux', 'payload.json'))).toBe(false);

      expect(lirePayload('atelier-un').model).toBe('NARWHAL');
      expect(lignesJournal()).toContain('atelier-deux GEN-ECHEC');
      expect(lignesJournal()).toContain('atelier-trois GENERE graine=25');

      // Tous les prompts sont partis en UNE seule invocation (une fenêtre),
      // et sans pause anti-bot imposée par nous : gflow garde son défaut.
      const args = readFileSync(journal, 'utf8');
      expect(args.match(/^CALL$/gm)).toHaveLength(1);
      expect(args).not.toContain('--jitter');
    },
    delai,
  );

  it(
    'le contrôle mord : sans base, le nom du fichier se lit à l’endroit et la graine reste inconnue',
    () => {
      const { code } = lancer(['--toutes', '--force'], { FAUX_GFLOW_SANS_BASE: '1' });
      expect(code).toBe(0);

      // Le fichier `prompt_0_0.jpg` permet encore d'associer la carte : c'est la
      // graine qui manque, pas la carte. Et le **nom** se lit à l'endroit —
      // `prompt_1` est la deuxième ligne de `prompts.txt`, pas la troisième.
      const charge = lirePayload('atelier-un');
      expect(charge.images[0]?.seed).toBeNull();
      expect(charge.images[0]?.local_path).toMatch(/prompt_0_0\.jpg$/);
      expect(lirePayload('atelier-deux').images[0]?.local_path).toMatch(/prompt_1_0\.jpg$/);
      expect(lignesJournal().some((l) => l.includes('graine=inconnue'))).toBe(true);
    },
    delai,
  );

  it(
    "ne renvoie pas une carte déjà servie (le script est reprenable)",
    () => {
      writeFileSync(join(registre, 'atelier-un.webp'), 'webp');
      writeFileSync(join(donnees, 'atelier.ts'), "  art: 'atelier-un.webp'\n");

      const { code } = lancer(['--toutes', '--force']);
      expect(code).toBe(0);

      const prompts = readFileSync(join(sortie, 'prompts.txt'), 'utf8');
      expect(prompts).not.toContain('PROMPT-atelier-un');
      expect(prompts).toContain('PROMPT-atelier-deux');
      // Une seule invocation pour les deux cartes restantes.
      expect(readFileSync(journal, 'utf8').match(/^CALL$/gm)).toHaveLength(1);
      expect(existsSync(join(sortie, 'atelier-un', 'payload.json'))).toBe(false);
    },
    delai,
  );

  it(
    'range les images au registre quand --ranger est donné',
    () => {
      const { code } = lancer(['--toutes', '--ranger', '--force']);
      expect(code).toBe(0);
      expect(existsSync(join(registre, 'atelier-un.webp'))).toBe(true);
      expect(readFileSync(join(donnees, 'atelier.ts'), 'utf8')).toContain("art: 'atelier-un.webp'");
      expect(lignesJournal()).toContain('atelier-un RANGE');
    },
    delai,
  );
});

describe('gflow-lot.sh — ce qui ne doit rien lancer', () => {
  it(
    '--simuler n’appelle ni gflow ni le wizard de génération',
    () => {
      const { code } = lancer(['--toutes', '--simuler', '--force']);
      expect(code).toBe(0);
      expect(readFileSync(journal, 'utf8')).toBe('');
      expect(existsSync(join(sortie, 'images'))).toBe(false);
      // Les prompts, eux, sont bien construits (c'est le travail du wizard).
      expect(readFileSync(join(sortie, 'prompts.txt'), 'utf8')).toContain('PROMPT-atelier-un');
    },
    delai,
  );

  it(
    'passe --jitter à gflow quand on le demande (et rien sinon)',
    () => {
      lancer(['--toutes', '--force', '--jitter', '0']);
      expect(readFileSync(journal, 'utf8')).toMatch(/^ARG --jitter\nARG 0$/m);
    },
    delai,
  );

  it(
    'refuse un modèle inconnu au lieu de l’envoyer à gflow',
    () => {
      const { code, sortie: texte } = lancer(['--toutes', '--force'], { GFLOW_LOT_MODELE: 'Nano Banane 9' });
      expect(code).toBe(2);
      expect(texte).toContain('modèle inconnu');
      expect(readFileSync(journal, 'utf8')).toBe('');
    },
    delai,
  );

  it(
    'le mode --par-carte passe par le wizard, un appel par carte, graine du payload',
    () => {
      const { code } = lancer(['--toutes', '--par-carte', '--force']);
      expect(code).toBe(0);
      // Le faux wizard n'écrit pas dans la base : la graine vient de SON payload.
      expect(lirePayload('atelier-deux').images[0]?.seed).toBe(42);
      expect(lignesJournal()).toContain('atelier-deux GENERE');
    },
    delai,
  );
});

/**
 * **Le découpage en paquets** (02/11/2026, #609).
 *
 * gflow refuse **plus de 50 prompts par invocation** (`MAX_PROMPTS = 50` dans
 * `image_batch.py`, `_validate_prompt_count` → « Prompt source must contain
 * between 1 and 50 prompts », rendu en **exit 2**). Avant ce découpage, une file
 * de plus de cinquante cartes s'arrêtait au premier appel, sans une image.
 *
 * Le piège du découpage est le **rang** : gflow nomme ses sorties
 * `prompt_<i>_<k>` avec `<i>` = l'indice du prompt **dans l'invocation**, donc
 * le rang repart de 0 à chaque paquet. Lire ce rang dans la liste de départ, ou
 * écrire deux paquets dans le même dossier, et les images changent de carte sans
 * que rien ne casse.
 */
describe('gflow-lot.sh — le découpage en paquets de 50 (gflow refuse davantage)', () => {
  /** Soixante cartes connues : deux paquets (50 + 10), et un rang qui repart. */
  const N = 60;
  const ids = Array.from({ length: N }, (_, i) => `atelier-${String(i + 1).padStart(2, '0')}`);

  /** Le fichier des sujets du bac, remplacé par soixante cartes. */
  const sujetsDe60 = () => {
    const chemin = join(bac, 'sujets-60.md');
    const lignes = ids.map((id) => `| \`${id}\` | un sujet pour ${id} |`).join('\n');
    writeFileSync(chemin, `## La table\n\n| Carte (\`id\`) | Sujet |\n|---|---|\n${lignes}\n`);
    return chemin;
  };

  /** Chaque appel reçu par gflow, ses arguments dans l'ordre (`ARG` par ligne). */
  const appels = () => {
    const tous: string[][] = [];
    let courant: string[] | null = null;
    for (const ligne of readFileSync(journal, 'utf8').split('\n')) {
      if (ligne === 'CALL') {
        courant = [];
        tous.push(courant);
        continue;
      }
      if (courant && ligne.startsWith('ARG ')) courant.push(ligne.slice(4));
    }
    return tous;
  };

  /** La valeur de l'option `nom` dans un appel. */
  const option = (args: string[], nom: string) => args[args.indexOf(nom) + 1];

  /** Les prompts contenus dans une invocation, un par ligne non vide. */
  const promptsDeLAppel = (n: number) => {
    const fichier = option(appels()[n] ?? [], '--prompts-file');
    return fichier ? readFileSync(fichier, 'utf8').split('\n').filter(Boolean) : [];
  };

  /** Le dossier de sortie de la n-ième invocation. */
  const sortieDeLAppel = (n: number) => option(appels()[n] ?? [], '--out') ?? '';

  it(
    'le contrôle mord : soixante cartes font deux paquets, et chaque image retombe sur SA carte',
    () => {
      const { code, sortie: texte } = lancer(['--toutes', '--force'], { GFLOW_LOT_SUJETS: sujetsDe60() });
      expect(code, texte).toBe(0);

      // Deux invocations, 50 puis 10 prompts : gflow refuserait davantage.
      const appels = readFileSync(journal, 'utf8').match(/^CALL$/gm) ?? [];
      expect(appels, 'soixante cartes, deux invocations').toHaveLength(2);
      expect(promptsDeLAppel(0)).toHaveLength(50);
      expect(promptsDeLAppel(1)).toHaveLength(10);
      // Chaque paquet a **son** dossier : mêmes noms de fichiers, sinon le second
      // écraserait les `prompt_0_*` du premier.
      expect(sortieDeLAppel(0)).not.toBe(sortieDeLAppel(1));

      // Le rang repart de 0 : la 51ᵉ carte est le prompt 0 du second paquet, et sa
      // graine est celle que gflow a notée pour ce fichier-là (i * 7 + 11).
      expect(lirePayload('atelier-01').images[0]).toMatchObject({
        seed: 11,
        local_path: expect.stringMatching(/images\/1\/prompt_0_0\.jpg$/),
      });
      expect(lirePayload('atelier-51').images[0]).toMatchObject({
        seed: 11,
        local_path: expect.stringMatching(/images\/2\/prompt_0_0\.jpg$/),
      });
      // Et la dernière carte du second paquet : prompt 9, graine 74.
      expect(lirePayload('atelier-60').images[0]).toMatchObject({
        seed: 74,
        local_path: expect.stringMatching(/images\/2\/prompt_9_0\.jpg$/),
      });
      // Les soixante cartes ont leur image : un seul reclassement décalé laisserait
      // des cartes vides, ou pire, l'image d'une autre.
      for (const id of ids) {
        expect(existsSync(join(sortie, id, 'payload.json')), `${id} sans payload`).toBe(true);
      }
    },
    delai,
  );

  it(
    'le contrôle mord : sans base, le nom se lit dans le paquet qui a produit le fichier',
    () => {
      // Le repli par le nom est le seul endroit où le rang est déchiffré : avec la
      // liste de départ au lieu de celle du paquet, `prompt_0` du second paquet
      // désignerait la **première** carte, déjà servie — et dix cartes resteraient
      // sans image.
      const { code, sortie: texte } = lancer(['--toutes', '--force'], {
        GFLOW_LOT_SUJETS: sujetsDe60(),
        FAUX_GFLOW_SANS_BASE: '1',
      });
      expect(code, texte).toBe(0);

      const charge = lirePayload('atelier-51');
      expect(charge.images[0]?.seed).toBeNull();
      expect(charge.images[0]?.local_path).toMatch(/images\/2\/prompt_0_0\.jpg$/);
      expect(lirePayload('atelier-60').images[0]?.local_path).toMatch(/images\/2\/prompt_9_0\.jpg$/);
      for (const id of ids) {
        expect(existsSync(join(sortie, id, 'payload.json')), `${id} sans payload`).toBe(true);
      }
      // Une graine absente reste absente : le repli ne fabrique pas de numéro.
      expect(lignesJournal().filter((l) => l.includes('graine=inconnue'))).toHaveLength(N);
    },
    delai,
  );

  it(
    'soixante cartes restent deux paquets quand on demande plus de 50 prompts par invocation',
    () => {
      const { code, sortie: texte } = lancer(['--toutes', '--force', '--max-prompts', '80'], {
        GFLOW_LOT_SUJETS: sujetsDe60(),
      });
      expect(code, texte).toBe(0);
      // gflow refuserait 80 : le script plafonne et le dit, au lieu d'envoyer un
      // paquet que gflow rejetterait en exit 2.
      expect(texte).toContain('50');
      expect((readFileSync(journal, 'utf8').match(/^CALL$/gm) ?? [])).toHaveLength(2);
      for (const n of [0, 1]) expect(promptsDeLAppel(n).length).toBeLessThanOrEqual(50);
    },
    delai,
  );

  it(
    'le mode --par-carte n’est pas découpé : le wizard fait une invocation par carte',
    () => {
      const { code } = lancer(['--toutes', '--par-carte', '--force'], { GFLOW_LOT_SUJETS: sujetsDe60() });
      expect(code).toBe(0);
      // Aucun appel de génération groupée : le découpage ne concerne que `--lot`.
      expect(readFileSync(journal, 'utf8')).toBe('');
      for (const id of ids) {
        expect(existsSync(join(sortie, id, 'payload.json')), `${id} sans payload`).toBe(true);
      }
    },
    delai,
  );
});
