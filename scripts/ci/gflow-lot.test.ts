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
    python3 - "$GFLOW_LOT_DB" "$f" "$ligne" "$((i * 7 + 11))" "$i" <<'PY'
import sqlite3, sys
db, chemin, prompt, graine, n = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
con = sqlite3.connect(db)
con.executescript("""
create table if not exists assets(id text primary key, seed integer, model text);
create table if not exists local_files(id text primary key, asset_id text, path text);
create table if not exists operations(id text primary key, prompt text, model text);
create table if not exists operation_assets(asset_id text, operation_id text);
""")
con.execute("insert into operations values ('o' || ?, ?, 'NARWHAL')", (n, prompt))
con.execute("insert into assets values ('a' || ?, ?, null)", (n, graine))
con.execute("insert into local_files values ('l' || ?, 'a' || ?, ?)", (n, n, chemin))
con.execute("insert into operation_assets values ('a' || ?, 'o' || ?)", (n, n))
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
