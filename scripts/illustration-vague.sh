#!/usr/bin/env bash
#
# Wizard : produire une illustration de carte par gflow-cli, la ranger, la
# consigner — tickets #97 / #95. Décisions de référence : D-007 (IA + curation),
# D-028 (direction artistique).
#
# Les illustrations vivent en **une seule copie** : design/illustrations/
# (registre versionné, README + prompts). Depuis D-045, Vite les embarque dans le
# graphe de modules (`src/art.ts`, `import.meta.glob`) et les hache dans
# `dist/assets/` : il n'y a plus de copie à recopier dans `public/`, donc plus
# d'écart possible entre ce qu'on génère et ce que l'écran sert.
# (#120). Le wizard range les deux copies, puis lance le test qui le vérifie.
#
# La production passe par **gflow-cli** (https://github.com/ffroliva/gflow-cli),
# qui pilote Google Flow sur le compte de Bastien. Conséquences, écrites ici
# pour qu'elles ne se perdent pas :
#   - gflow-cli est **alpha et reverse-engineered**, non affilié à Google ;
#     l'automatisation relève des ToS de Google (docs/ACCOUNT_SAFETY.md).
#   - les **images sont gratuites** ; seuls les outils **vidéo** dépensent des
#     crédits Veo. Ce wizard n'appelle que `image t2i`.
#   - un profil créé avec `--browser internal` n'a pas le marqueur `chrome` :
#     les générations suivantes rouvrent Chromium au lieu de Chrome réel.
#
# Usage : bash scripts/illustration-vague.sh [id-de-carte]
#
# Everything above the "STAGES" marker is the wizard library: do not hand-edit
# it. Author the per-step stages below the marker.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear wipes the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1 && tput clear 2>/dev/null; then return 0; fi
  printf '\033[2J\033[3J\033[H'
}

# banner "Title" shows the opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" clears the screen, then announces a stage and shows progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." prints a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." is a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL opens it in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else false; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

# pause "msg" waits for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" is a y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY: current value of KEY in ENV_FILE, if any, with write_env's single
# quotes or a plain dotenv double-quoted value undone.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line value sq="'\\''"; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  value="${line#*=}"
  if [[ "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; value="${value//"$sq"/\'}"
  elif [[ "$value" == \"*\" ]]; then
    value="${value:1:${#value}-2}"
    [[ "$value" == *[\\\$\"]* ]] && return 1   # escapes, $ or ": can't decode safely; ask again
  fi
  printf '%s' "$value"
}

# ask KEY "Prompt" reads a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret), edited
# with Readline. Fails at EOF with no input.
ask() {
  local key="$1" prompt="$2" current input s=$'\001' e=$'\002' p rc=0
  current=$(_existing "$key" || true)
  # Readline needs the colour codes wrapped in \001..\002 to place the cursor.
  p="  $s$BOLD$e$prompt$s$RESET$e "
  [[ -n "$current" ]] && p+="$s$DIM$e[Enter keeps current]$s$RESET$e "
  read -e -r -p "$p" input || rc=1
  if (( rc )) && [[ -z "$input" ]]; then return 1; fi
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" is like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input rc=0
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || rc=1
  printf '\n'
  if (( rc )) && [[ -z "$input" ]]; then return 1; fi
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE upserts KEY='VALUE' into ENV_FILE (replaces any existing
# line) and sets $KEY. Idempotent. Creates ENV_FILE at mode 0600; writes through
# a symlink and keeps an existing file's mode.
write_env() {
  local key="$1" value="$2" tmp sq="'\\''"
  [[ -e "$ENV_FILE" ]] || (umask 077 && : > "$ENV_FILE")
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf "%s='%s'\n" "$key" "${value//\'/$sq}" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
  printf -v "$key" '%s' "$value"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE sets a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name: gh not ready; set it later"
}

# set_var NAME VALUE sets a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name, gh not ready; set it later"
}

# finish clears, then shows a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES: author this section. One stage() per step the human takes.
# Replace the example below. Set TOTAL_STAGES to match the stages you write.
# Keep every stage inside run_wizard and the last line as is: bash then parses
# the whole file before the first prompt, so an edit mid-run can't break it.
# ──────────────────────────────────────────────────────────────────────────

run_wizard() {

TOTAL_STAGES=6

cd "$(dirname "$0")/.." 2>/dev/null || true

# Tous les chemins sont **surchargeables par l'environnement**, sur le modèle de
# `GFLOW_ILLUSTRATION_SCRATCH`. Sans ça, le wizard n'est testable qu'à moitié : il
# s'arrêtait toujours avant « Choisir et ranger », donc `installer`, `consigner` et
# `cabler` n'étaient **jamais** exercés — et c'est ainsi qu'un bug réel a échappé
# à la boucle (#97 : le nom du fichier rangé était vide).
PROMPTS="${GFLOW_ILLUSTRATION_PROMPTS:-design/illustrations/PROMPTS-flow.md}"
# Les deux tables de #121, et **deux chemins** parce qu'elles ne portent pas la même chose :
# le **sujet** est une ligne par carte (`SUJETS-flow.md`), l'**accent** une ligne par
# faction (`ACCENTS-flow.md`, dix — D-046). Un accent par carte serait la
# seconde source que D-046 supprime, et la recopier ici la ferait revenir.
SUJETS="${GFLOW_ILLUSTRATION_SUJETS:-design/illustrations/SUJETS-flow.md}"
ACCENTS="${GFLOW_ILLUSTRATION_ACCENTS:-design/illustrations/ACCENTS-flow.md}"
REGISTRE="${GFLOW_ILLUSTRATION_REGISTRE:-design/illustrations}"
README="${GFLOW_ILLUSTRATION_README:-$REGISTRE/README.md}"
DONNEES="${GFLOW_ILLUSTRATION_DONNEES:-src/data}"
# Les deux vérifications du dernier stage. Surchargeables : la suite de tests
# lance le wizard dans un bac temporaire, et y déclencherait `npm test` — donc
# `vitest` dans `vitest`.
CHECK_CMD="${GFLOW_ILLUSTRATION_CHECK_CMD:-npm run check}"
TEST_CMD="${GFLOW_ILLUSTRATION_TEST_CMD:-npm test -- src/data/art.test.ts}"
CHECK_LOG="${GFLOW_ILLUSTRATION_CHECK_LOG:-/tmp/illustration-check.log}"
TEST_LOG="${GFLOW_ILLUSTRATION_TEST_LOG:-/tmp/illustration-test.log}"
#
# Où tombent les variantes. Surchargeable par l'environnement **exprès** : sans
# ça, scripts/illustration-vague.test.ts lisait le vrai `.scratch/` du dépôt, et
# passait tant que personne n'avait généré — puis cassait dès la première vraie
# génération, parce qu'il trouvait quatre variantes réelles et attendait un choix
# qu'il ne pouvait pas donner. Un test qui dépend de l'état du développeur ne
# garde rien.
SCRATCH="${GFLOW_ILLUSTRATION_SCRATCH:-.scratch/gflow}"
# Ce que `consigner` a **réellement** touché : « produites », « non », ou « aucun ».
CONSIGNER_TABLE="aucun"

# ── outils du tuyau ───────────────────────────────────────────────────────

# cartes : id <TAB> sujet — la table de SUJETS-flow.md, **une ligne par carte de base**.
# Elle a remplacé la table « Planche 1 » de PROMPTS-flow.md (#121) : le sujet n'est plus
# réservé aux dix signature, il couvre **toutes** les bases, et le rang n'est qu'un
# modificateur.
# Les blocs de code (```) montrent le **format** (`| `FACTION` | accent |`) : ils ne
# sont pas des données. Les lire comme une ligne de table a déjà donné une faction
# fantôme (« FACTION »), donc `cartes` et `accent_de` sautent les blocs.
cartes() {
  awk -F'|' '/^```/ { bloc = !bloc; next }
    !bloc && /^\| `/{ id=$2; sujet=$3
    gsub(/^[ `]+|[ `]+$/, "", id)
    gsub(/^ +| +$/, "", sujet)
    printf "%s\t%s\n", id, sujet }' "$SUJETS"
}
connue()   { cartes | awk -F'\t' -v id="$1" '$1 == id { f = 1 } END { exit !f }'; }
sujet_de() { cartes | awk -F'\t' -v id="$1" '$1 == id { print $2 }'; }

# faction_de ID : **le préfixe de l'id est la faction** (`AGENTS.md` §5 : `sse-…`,
# `direction-…`). C'est ce qui permet de résoudre l'accent **par faction** au lieu de le
# recopier sur toutes les lignes de sujets (D-046).
faction_de() { printf '%s' "${1%%-*}" | tr '[:lower:]' '[:upper:]'; }

# accent_de ID : l'accent de la faction de la carte, dans ACCENTS-flow.md.
accent_de() {
  local faction; faction=$(faction_de "$1")
  awk -F'|' -v f="$faction" '/^```/ { bloc = !bloc; next }
    !bloc && /^\| `/{ gsub(/^[ `]+|[ `]+$/, "", $2)
    if ($2 == f) { gsub(/^ +| +$/, "", $3); print $3 } }' "$ACCENTS"
}

# socle() : le bloc de code de « ## Socle commun » — le seul endroit où il vit.
socle() {
  awk '/^## Socle commun/{ f = 1; next }
       f && /^```/ { n++; if (n == 2) exit; next }
       f && n == 1 { print }' "$PROMPTS"
}
# socle_ligne() : le même, aplati sur une ligne. Le socle est un bloc de code
# multiligne ; `$(socle)` quoté garde ses retours à la ligne, et un prompt
# multiligne ne se journalise pas, ne se compare pas et ne se cherche pas.
socle_ligne() { socle | tr '\n' ' ' | tr -s ' ' | sed -e 's/^ //' -e 's/ $//'; }

# ── Les modèles : noms humains ↔ alias gflow ──────────────────────────────
#
# **La seule source du mapping.** gflow n'accepte que ses alias internes
# (`--model nano2|nano-pro|nano2-lite|image4|imagen4`) et le refuse net :
#
#     Error: Invalid value for '--model': 'nano2.1' is not one of 'nano2', …
#
# Or personne ne connaît ces alias : on connaît « Nano Banana 2.1 ». La
# résolution se fait donc **ici**, avant l'appel — jamais dans gflow.
#
# `nano2` EST Nano Banana 2.1 sur `flow.google.com` : Flow y a remplacé
# Nano Banana 2, et gflow a suivi sous le même alias (gflow, `docs/INDEX.md:174`
# et `docs/PROJECT_STATUS.md:96`, #958 — la vérification a été faite le
# 21/10/2026 sur cette machine). Sur `labs.google`, `nano2` reste Nano Banana 2 :
# l'équivalence dépend de l'hôte, et le compte de Bastien est servi par
# `flow.google.com` (`gflow auth status` le dit).
modele_alias() {
  local v="${1,,}"
  v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"   # trim
  v="${v//  / }"
  case "$v" in
    nano2|nano2.1|nano2,1|beluga|2|2.1|2,1|"nano banana 2"|"nano banana 2.1"|"nano banana 2,1")
      printf 'nano2' ;;
    nano-pro|gem_pix_2|pro|"nano banana pro"|"nano banana pro 1")
      printf 'nano-pro' ;;
    nano2-lite|harbor_seal|lite|"nano banana 2 lite"|"nano banana lite")
      printf 'nano2-lite' ;;
    image4|imagen4|imagen_3_5|imagen|4|"imagen 4")
      printf 'image4' ;;
    *) return 2 ;;
  esac
}
# La même table, pour les messages — jamais recopiée ailleurs.
modeles_lisibles() {
  printf '%s\n' \
    '  Nano Banana 2.1      →  --model nano2       (défaut)' \
    '  Nano Banana 2 Lite   →  --model nano2-lite' \
    '  Nano Banana Pro      →  --model nano-pro' \
    '  Imagen 4             →  --model image4'
}

# demander VAR "invite" [défaut] : `ask` gardé. À EOF, `ask` renvoie 1 et un
# `return 1` nu fait sortir le script sous `set -e` avec le code 1 et **aucun
# message** — observé en vrai. Ici on sort en 130 (128 + SIGINT), après avoir
# dit pourquoi.
demander() {
  local var="$1" invite="$2" defaut="${3:-}"
  if ! ask "$var" "$invite"; then
    _clear
    warn "Entrée interrompue (Ctrl-D ou tube épuisé) — rien n'a été écrit."
    exit 130
  fi
  if [[ -z "${!var}" && -n "$defaut" ]]; then printf -v "$var" '%s' "$defaut"; fi
}

# etat_de ID : l'image est-elle au registre, servie, et la carte câblée ?
etat_de() {
  local id="$1" r="non" a="non"
  if [[ -f "$REGISTRE/$id.webp" ]]; then r="oui"; fi
  if grep -rqF "art: '$id.webp'" "$DONNEES" 2>/dev/null; then a="oui"; fi
  printf 'registre %s · art %s' "$r" "$a"
}

# ── Lecture du `--json` de gflow ──────────────────────────────────────────
#
# La forme **réelle** (capturée le 21/10/2026, `.scratch/gflow/essais/`) n'est
# pas un `GeneratedImage` à plat, contrairement à ce que laissait croire la doc :
#
#   { "status": "ok", "command": "image t2i", "model": "NARWHAL", "count": 1,
#     "images": [ { "seed": 651010515, "local_path": "…/x_1.jpg",
#                   "model_name_type": null, … }, … ] }
#
# Trois conséquences, toutes vérifiées sur une vraie génération :
#   - la graine est dans `images[]`, **pas** au premier niveau ;
#   - `model_name_type` est `null` sur `flow.google.com` — le modèle est dans le
#     `model` du **haut** (`NARWHAL`) ;
#   - avec `-n 4`, `images[]` porte **quatre graines distinctes**, et l'ordre des
#     fichiers sur disque (noms d'UUID) **ne suit pas** l'ordre du tableau. Relier
#     la variante gardée à sa graine se fait donc par `local_path`, jamais par
#     l'indice : un registre qui se trompe de graine est un registre qui ment.

# graines_du_run JSON : une ligne « <chemin>\t<graine> » par image produite.
# Toute panne de lecture rend une sortie vide — un wizard ne meurt pas sur une
# réponse inattendue.
graines_du_run() {
  printf '%s' "$1" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
imgs = d.get("images") if isinstance(d, dict) else d
if isinstance(imgs, dict):
    imgs = [imgs]
for i in imgs or []:
    if not isinstance(i, dict):
        continue
    g = i.get("seed")
    print("%s\t%s" % (i.get("local_path") or "", "inconnue" if g is None else g))
' 2>/dev/null || true
}

# graine_de CARTE_GRAINES CHEMIN : la graine de **ce** fichier, par son nom.
graine_de() {
  local carte="$1" chemin="$2" base
  base="${chemin##*/}"
  printf '%s\n' "$carte" | awk -F'\t' -v b="$base" '
    { n = $1; sub(/^.*\//, "", n); if (n == b && $2 != "") { print $2; exit } }'
}

# modele_du_run JSON : le modèle tel que gflow l'a rapporté (jamais deviné).
modele_du_run() {
  printf '%s' "$1" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
if isinstance(d, dict):
    print(d.get("model") or "")
' 2>/dev/null || true
}

# ── La graine, quand le `--json` est absent : la base locale de gflow ──────
#
# Le CLI `gflow image t2i` rend la graine dans son `--json` — et le **MCP** gflow,
# non : une image produite par le MCP n'a donc aucune graine **dans la sortie**.
# Mais la graine est **en base** : gflow note chaque fichier qu'il produit, dans
# sa base SQLite locale, avec sa graine.
#
# Le chemin de cette base n'est pas le même partout : gflow accepte
# `~/.gflow/gflow.db`, mais l'installation XDG (celle de `uv tool install`, donc
# celle de cette machine) range la sienne dans
# `~/.local/share/gflow-cli/gflow.db`. On essaie les deux, et le premier qui
# répond gagne.
#
# La requête (chemin **absolu**) :
#
#   select a.seed from local_files lf join assets a on a.id = lf.asset_id
#   where lf.path = ?
#
# Toute panne — base absente, verrouillée, schéma différent, fichier illisible —
# se traduit par « graine inconnue ». **Jamais** une erreur fatale, **jamais** une
# graine inventée : une graine fausse au registre est pire qu'une graine absente.

# Les bases à interroger, dans l'ordre. Surchargeable (liste séparée par « : »).
bases_gflow() {
  if [[ -n "${GFLOW_ILLUSTRATION_DB:-}" ]]; then
    local IFS=':'
    local -a _bases=()
    read -r -a _bases <<< "$GFLOW_ILLUSTRATION_DB"
    printf '%s\n' "${_bases[@]}"
    return
  fi
  printf '%s\n' "$HOME/.gflow/gflow.db" "$HOME/.local/share/gflow-cli/gflow.db"
}

# graine_de_la_base IMAGE : la graine (et le modèle, s'il y est) de CE fichier,
# lus dans la base locale de gflow. Rend « graine<TAB>modèle », ou rien.
graine_de_la_base() {
  local image="$1" db sortie
  while IFS= read -r db; do
    [[ -n "$db" && -f "$db" ]] || continue
    sortie=$(python3 - "$db" "$image" <<'PY' 2>/dev/null || true
import os
import sqlite3
import sys

db, image = sys.argv[1], sys.argv[2]


def formes(chemin):
    """Les écritures possibles du même chemin : brut, absolu, réel."""
    vues = []
    for p in (chemin, os.path.abspath(chemin), os.path.realpath(chemin)):
        if p not in vues:
            vues.append(p)
    return vues


def lire(con, colonnes, chemin):
    return con.execute(
        "select %s from local_files lf join assets a on a.id = lf.asset_id "
        "where lf.path = ?" % colonnes,
        (chemin,),
    ).fetchone()


for chemin in formes(image):
    try:
        con = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
    except Exception:
        continue
    try:
        try:
            ligne = lire(con, "a.seed, a.model", chemin)
        except Exception:
            # Schéma plus pauvre : la graine seule, sans le modèle.
            ligne = lire(con, "a.seed", chemin)
        if ligne and ligne[0] is not None:
            modele = ligne[1] if len(ligne) > 1 and ligne[1] else ""
            print("%s\t%s" % (ligne[0], modele))
            sys.exit(0)
    except Exception:
        pass
    finally:
        try:
            con.close()
        except Exception:
            pass
PY
)
    if [[ -n "$sortie" ]]; then
      printf '%s' "$sortie"
      return 0
    fi
  done < <(bases_gflow)
  return 1
}

# installer SRC ID : convertit en webp, écrit le registre, copie le servi, et
# **vérifie** que les deux sont identiques à l'octet — la règle du test #120.
installer() {
  local src="$1" id="$2"
  # Deux `local` séparés, et pas un seul : bash évalue **toutes** les expansions
  # d'un `local` avant d'exécuter la moindre affectation, donc `reg="$REGISTRE/$id.webp"`
  # sur la même ligne lit un `id` encore vide — le fichier s'appelait `.webp`, et
  # le message de succès affichait le bon nom. Trouvé à la première génération
  # réelle (le test des deux copies l'a attrapé).
  local reg="$REGISTRE/$id.webp"
  mkdir -p "$REGISTRE"
  python3 - "$src" "$reg" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
if im.mode not in ("RGB", "RGBA"):
    im = im.convert("RGBA")
im.save(dst, "WEBP", quality=90, method=6)
PY
  # Une seule copie (D-045) : plus de `cp` vers un dossier servi, donc plus rien à comparer.
  printf '  %s✓%s %s — %s o, empreinte %s\n' "$GREEN" "$RESET" "$id.webp" \
    "$(stat -c%s "$reg")" "$(sha256sum "$reg" | cut -c1-12)"
  return 0
  return 1
}

# consigner ID MODELE GRAINE DATE : tient le README — remet la graine à jour si
# la carte est dans « Cartes produites », retire sa ligne si elle est dans « Non
# produites » (ce n'est plus vrai), et ajoute une ligne au journal vivant.
#
# Elle rend aussi **ce qu'elle a réellement touché**, dans `CONSIGNER_TABLE` :
# « produites », « non », ou « aucun ». Les deux tableaux ne couvrent que la planche
# **Portrait** (les dix cartes signature, `README.md`) : une carte hors de ce tableau — les
# autres bases — n'a **aucun** tableau à corriger, et c'est très bien — le journal est le
# registre vivant. Dire l'inverse serait mentir.
consigner() {
  local id="$1" modele="$2" graine="$3" date="$4" tmp rapport
  CONSIGNER_TABLE="aucun"
  if [[ ! -f "$README" ]]; then
    mkdir -p "$(dirname "$README")"
    printf '# Journal des illustrations\n' > "$README"
  fi
  tmp=$(mktemp)
  rapport=$(mktemp)
  awk -F'|' -v OFS='|' -v id="$id" -v graine="$graine" -v fichier="$id.webp" -v rapport="$rapport" '
    BEGIN { print "aucun" > rapport }
    /^## Cartes produites/ { section = "produites"; print; next }
    /^## Non produites/    { section = "non"; print; next }
    /^## /                 { section = ""; print; next }
    $0 ~ ("^\\| `" id "`") {
      if (section == "produites") { $5 = " `" graine "` "; $6 = " `" fichier "` "; print; print "produites" > rapport; next }
      if (section == "non")       { print "non" > rapport; next }
    }
    { print }
  ' "$README" > "$tmp"

  if ! grep -q '^## Journal des productions' "$tmp"; then
    printf '\n## Journal des productions\n\n' >> "$tmp"
    printf '> Tenu par `scripts/illustration-vague.sh` : une ligne par image produite ou\n' >> "$tmp"
    printf '> regénérée, la plus récente en bas. Les deux tableaux ci-dessus sont\n' >> "$tmp"
    printf "> l'instantané du 20/10/2026 ; **ce journal est le registre vivant**.\n\n" >> "$tmp"
  fi
  printf -- '- %s · `%s` · modèle `%s` · graine `%s` · `%s.webp`\n' \
    "$date" "$id" "$modele" "$graine" "$id" >> "$tmp"

  cat "$tmp" > "$README"
  rm -f "$tmp"
  # Le rapport porte une ligne par décision : la **dernière** est la bonne
  # (« aucun » d'abord, puis « produites » ou « non » si un tableau a été vu).
  CONSIGNER_TABLE=$(tail -n1 "$rapport" 2>/dev/null || echo "aucun")
  rm -f "$rapport"
  case "$CONSIGNER_TABLE" in
    produites|non|aucun) ;;
    *) CONSIGNER_TABLE="aucun" ;;
  esac
}

# cabler ID : ajoute « art: '<id>.webp' » en **dernière** propriété de l'objet de
# la carte — la convention des cartes déjà câblées. Rend le chemin, ou un code.
cabler() {
  local id="$1" fichier tmp
  fichier=$(grep -rlF "id: '$id'" "$DONNEES" --include='*.ts' 2>/dev/null | head -n1)
  if [[ -z "$fichier" ]]; then return 2; fi
  tmp=$(mktemp)
  if ! awk -v id="$id" -v art="$id.webp" '
    { ligne[NR] = $0 }
    END {
      debut = 0; fin = 0
      for (i = 1; i <= NR; i++) {
        if (!debut && ligne[i] ~ ("id: '\''" id "'\''")) debut = i
        if (debut && i > debut && ligne[i] ~ /^  \}\)/) { fin = i; break }
      }
      if (!debut || !fin) exit 1
      if (ligne[fin-1] !~ /,$/) ligne[fin-1] = ligne[fin-1] ","
      for (i = 1; i <= NR; i++) {
        if (i == fin) printf "    art: '\''%s'\''\n", art
        print ligne[i]
      }
    }
  ' "$fichier" > "$tmp"; then
    rm -f "$tmp"; return 3
  fi
  cat "$tmp" > "$fichier"; rm -f "$tmp"
  printf '%s' "$fichier"
}

ligne_journal() {
  local motif; motif=$(printf '· `%s` ·' "$1")
  grep -qF "$motif" "$README"
}

# Point d'entrée non interactif : `--modele <nom>` résout et sort. C'est le seam
# que scripts/illustration-vague.test.ts exerce, et il sert aussi à la personne
# qui veut juste savoir quel alias correspond à « Nano Banana 2.1 ».
if [[ "${1:-}" == "--modele" ]]; then
  if alias=$(modele_alias "${2:-}"); then
    printf '%s\n' "$alias"
    exit 0
  fi
  printf 'Modèle inconnu : « %s »\n\n' "${2:-}" >&2
  printf 'Noms acceptés (et leur alias gflow) :\n' >&2
  modeles_lisibles >&2
  exit 2
fi

# Second point d'entrée non interactif : `--lit-json <fichier|->` relit un
# `--json` de gflow et rend ce que le wizard en tire — le modèle et la table
# « chemin → graine ». C'est le **rejeu d'une trace capturée** : la forme réelle
# du payload a déjà déjoué une supposition (elle est imbriquée sous `images[]`,
# là où la doc laissait croire à plat), et une graine fausse au registre est pire
# qu'une graine absente.
if [[ "${1:-}" == "--lit-json" ]]; then
  if [[ "${2:-}" == "-" || -z "${2:-}" ]]; then payload=$(cat); else payload=$(cat "$2"); fi
  printf 'modele\t%s\n' "$(modele_du_run "$payload")"
  graines_du_run "$payload" | awk -F'\t' '{ printf "graine\t%s\t%s\n", $1, $2 }'
  exit 0
fi

# Troisième point d'entrée non interactif : `--lit-base <image>` cherche la graine
# d'une image dans la base locale de gflow. C'est le seam du mode `--installe` :
# une image déjà produite — par le **MCP** gflow, qui ne rend pas la graine — se
# consigne quand même, si gflow a écrit sa ligne dans sa base.
if [[ "${1:-}" == "--lit-base" ]]; then
  if [[ -n "${2:-}" ]] && sortie=$(graine_de_la_base "${2}"); then
    printf 'graine\t%s\t%s\n' "${sortie%%$'\t'*}" "${sortie#*$'\t'}"
  else
    printf 'graine\tinconnue\t\n'
  fi
  exit 0
fi

# Arguments de la session : l'id de la carte, et `--installe <image>` pour
# ranger une image **déjà produite** au lieu d'en générer une. C'est ce qui rend
# la curation praticable (D-007 : IA **+ curation**) : on génère quatre variantes,
# on les regarde, on n'installe que la meilleure. Sans ça, il faudrait choisir
# dans la même session que la génération — donc à l'aveugle.
CARTE=""
INSTALLE=""
while (( $# )); do
  case "$1" in
    --installe) INSTALLE="${2:-}"; shift 2 ;;
    --) shift; break ;;
    *) CARTE="$1"; shift ;;
  esac
done

banner "Produire une illustration par gflow-cli (#97)"

# ── 1. Préconditions ──────────────────────────────────────────────────────
stage "Préconditions — gflow répond-il ?"
if ! command -v gflow >/dev/null 2>&1; then
  warn "gflow est introuvable dans le PATH."
  say "Il vit dans ~/.local/bin. Installe-le, puis reviens :"
  printf '\n'
  step "curl -LsSf https://astral.sh/uv/install.sh | sh"
  step "uv tool install gflow-cli"
  step "uv tool run --from gflow-cli playwright install chromium"
  printf '\n'
  note "Et si ~/.local/bin n'est pas dans le PATH : export PATH=\"\$HOME/.local/bin:\$PATH\""
  pause "Entrée pour abandonner"
  finish
  return 1
fi
note "gflow trouvé : $(command -v gflow)"
# Pillow : le wizard convertit les rendus de gflow (JPEG) en webp — la convention
# du registre. Sans lui, `installer` échoue au milieu du travail. On le dit donc
# AVANT, avec la commande d'installation, plutôt que de laisser une image à moitié
# rangée. Dépendance signalée dans `AGENTS.md` §6, et installée par la CI
# (`.github/workflows/ci.yml`) : sans elle, 8 tests tombent en
# `ModuleNotFoundError: No module named 'PIL'` — constaté le 21/10/2026.
if ! python3 -c 'import PIL' >/dev/null 2>&1; then
  warn "Pillow est introuvable : impossible de convertir les rendus en webp."
  say "Installe-le, puis relance :"
  printf '\n'
  step "Debian / Ubuntu :  sudo apt install python3-pil"
  step "macOS, ou autre :  python3 -m pip install Pillow"
  printf '\n'
  note "C'est la seule dépendance du wizard en dehors de gflow-cli."
  pause "Entrée pour abandonner"
  finish
  return 1
fi
printf '  %s✓%s Pillow %s\n' "$GREEN" "$RESET" \
  "$(python3 -c 'import PIL; print(PIL.__version__)' 2>/dev/null)"
if gflow auth status >/dev/null 2>&1; then
  printf '  %s✓%s un profil Flow est authentifié\n' "$GREEN" "$RESET"
else
  warn "Aucun profil Flow authentifié — la génération échouera."
  say "C'est une étape qui ne peut pas être automatisée : elle ouvre une fenêtre et"
  say "attend que TU te connectes. Elle se fait une fois."
  printf '\n'
  step "gflow auth login --browser chrome"
  note "Chrome doit être installé : c'est la stratégie qui contourne le blocage Google"
  note "(« G12 »). Sans Chrome, --browser internal marche parfois, mais le profil"
  note "créé n'a pas le marqueur chrome — les générations rouvriront Chromium."
  note "Ne ferme pas la fenêtre toi-même : gflow la ferme. Connecte-toi jusqu'à"
  note "l'ÉDITEUR Flow, pas seulement jusqu'à la page de compte Google."
  printf '\n'
  step "gflow auth status   # pour confirmer ensuite"
  pause "Entrée pour abandonner et faire ça"
  finish
  return 1
fi

# ── 2. La carte ───────────────────────────────────────────────────────────
stage "Quelle carte ?"
note "La table des sujets ($SUJETS) couvre $(cartes | wc -l | tr -d ' ') cartes de base."
say "Déjà au registre, avec leur état réel (mesuré, pas déclaré) :"
printf '\n'
DEJA=0
while IFS=$'\t' read -r id sujet; do
  if [[ -f "$REGISTRE/$id.webp" ]]; then
    printf '    %-34s %s\n' "$id" "$(etat_de "$id")"
    DEJA=$(( DEJA + 1 ))
  fi
done < <(cartes)
if (( DEJA == 0 )); then note "  aucune image pour l'instant : le registre est vide."; fi
printf '\n'
note "registre = l'image existe dans $REGISTRE/ ; art = une carte la référence."
note "Les deux doivent dire oui : c'est ce que gardent src/data/art.test.ts et le build."

if [[ -z "$CARTE" ]]; then
  demander CARTE "id de la carte à produire :"
fi
if [[ -z "$CARTE" ]] || ! connue "$CARTE"; then
  warn "« ${CARTE:-<vide>} » n'est pas dans la table des sujets ($SUJETS)."
  pause "Entrée pour abandonner"
  finish
  return 1
fi
say ""
say "Carte retenue : $CARTE"
note "Sujet  : $(sujet_de "$CARTE")"
note "Accent : $(accent_de "$CARTE")"
note "État   : $(etat_de "$CARTE")"
pause "Entrée pour générer"

# ── 3. Générer ────────────────────────────────────────────────────────────
stage "Générer avec gflow"
GRAINES=""
MODELE_OBS=""
BASE_LUE=""
if [[ -n "$INSTALLE" ]]; then
  say "Image fournie — pas de génération : $INSTALLE"
  if [[ ! -f "$INSTALLE" ]]; then
    warn "Fichier introuvable : $INSTALLE"
    pause "Entrée pour abandonner"
    finish
    return 1
  fi
  FICHIERS=("$INSTALLE")
  PAYLOAD="$SCRATCH/$CARTE/payload.json"
  if [[ -f "$PAYLOAD" ]]; then
    GRAINES=$(graines_du_run "$(cat "$PAYLOAD")")
    MODELE_OBS=$(modele_du_run "$(cat "$PAYLOAD")")
    note "Graine et modèle relus dans $PAYLOAD (génération antérieure)."
  else
    # Pas de payload : la graine est peut-être **en base**. gflow note chaque
    # fichier qu'il produit, avec sa graine, dans sa base SQLite locale — donc
    # même une image venue du MCP gflow (qui ne rend pas de graine) est
    # consignable, si gflow l'a bien écrite dans sa base.
    BASE_LUE=$(graine_de_la_base "$INSTALLE" || true)
    if [[ -n "$BASE_LUE" ]]; then
      GRAINES="$INSTALLE	${BASE_LUE%%	*}"
      MODELE_OBS="${BASE_LUE#*	}"
      [[ -n "$MODELE_OBS" ]] || MODELE_OBS="(non rapporté)"
      note "Graine retrouvée dans la base locale de gflow : ${GRAINES##*	}."
      note "Source : la base SQLite de gflow (elle enregistre chaque fichier produit),"
      note "pas le --json — le MCP gflow, lui, ne rend pas la graine."
    else
      warn "Graine inconnue : ni payload --json, ni trace de ce fichier dans la base de gflow."
      note "Bases interrogées : $(bases_gflow | tr '\n' ' ')"
      note "Une image produite **ailleurs** que par gflow ne peut donc pas être consignée"
      note "reproductible : c'est une limite de la source, pas du registre. Copie l'image"
      note "dans le dossier de gflow (ou regénère-la) pour la consigner."
      MODELE_OBS="(non rapporté)"
    fi
  fi
else
PROMPT="$(socle_ligne) $(sujet_de "$CARTE"), muted $(accent_de "$CARTE") accent."
say "Prompt envoyé (socle §6.1 + sujet), aplati sur une seule ligne :"
printf '\n%s\n\n' "$PROMPT" | fold -s -w 96 | sed 's/^/    /'
note "Le socle impose la lumière principale sur le VISAGE : c'est le correctif de la"
note "première vague, dont les 8 images ont les visages dans l'ombre. Ne l'enlève pas."
printf '\n'
say "Quel modèle ? gflow n'accepte que ses alias internes — on traduit pour toi :"
modeles_lisibles
printf '\n'
ALIAS=""
for essai in 1 2 3; do
  demander MODELE "Modèle :" "Nano Banana 2.1"
  if ALIAS=$(modele_alias "$MODELE"); then break; fi
  warn "« $MODELE » n'est pas un modèle connu."
  ALIAS=""
done
if [[ -z "$ALIAS" ]]; then
  warn "Trois essais sans un modèle valide — rien n'a été envoyé à gflow."
  pause "Entrée pour abandonner"
  finish
  return 1
fi
note "« $MODELE » → --model $ALIAS"
if [[ "$ALIAS" == "nano2" ]]; then
  note "Sur flow.google.com, nano2 EST Nano Banana 2.1 : Flow y a remplacé NB2 (#958)."
fi
printf '\n'
demander NB "Combien de variantes (1-4) :" "1"
NB="${NB:-1}"
case "$NB" in ''|*[!0-9]*) NB=1 ;; esac
if (( NB < 1 || NB > 4 )); then NB=1; fi

mkdir -p "$SCRATCH/$CARTE"
note "Sortie : $SCRATCH/$CARTE/ (gitignoré, cf. .gitignore)"
note "Les images sont gratuites côté Flow ; seuls les outils vidéo dépensent."
printf '\n'
say "Lancement — 30 à 90 s au premier appel, le temps que Chromium chauffe."
JSON=""
if JSON=$(gflow image t2i "$PROMPT" --model "$ALIAS" --aspect 1:1 -n "$NB" \
            --out "$SCRATCH/$CARTE" --json 2>/tmp/gflow-illustration.err); then
  printf '  %s✓%s génération terminée\n' "$GREEN" "$RESET"
  mkdir -p "$SCRATCH/$CARTE"
  printf '%s' "$JSON" > "$SCRATCH/$CARTE/payload.json"
  note "Payload conservé : $SCRATCH/$CARTE/payload.json (graine comprise)."
else
  CODE=$?
  case "$CODE" in
    2)
      warn "gflow a refusé nos arguments — erreur d'usage (exit 2)."
      note "Ce n'est PAS une dérive de Flow ni un problème de navigateur : un argument"
      note "est mal formé. /tmp/gflow-illustration.err nomme l'option fautive. C'est le"
      note "message qu'on recevait avant que le modèle soit résolu." ;;
    23)
      warn "Dérive de sélecteur (exit 23) : l'interface de Flow a bougé."
      note "Rien à corriger ici — c'est gflow qui doit suivre l'UI de Flow." ;;
    28)
      warn "Interface classique inatteignable (exit 28, réessayable)."
      note "L'aspect 1:1 a besoin de l'arm « classic » de Flow." ;;
    *)
      warn "gflow a échoué (exit $CODE) — lis /tmp/gflow-illustration.err." ;;
  esac
  note "Aucun crédit n'est dépensé par une génération d'image : une casse ne coûte rien."
  pause "Entrée pour abandonner"
  finish
  return 1
fi

GRAINES=$(graines_du_run "$JSON")
MODELE_OBS=$(modele_du_run "$JSON")
if [[ -z "$MODELE_OBS" ]]; then
  MODELE_OBS="$MODELE"
  note "gflow n'a pas rapporté de modèle : on consigne « $MODELE », la valeur demandée."
fi
if [[ -z "$GRAINES" ]]; then
  warn "gflow n'a rapporté aucune graine — le registre ne pourra pas dire comment refaire l'image."
  note "La lecture du --json attend un objet portant « images[] » ; si la forme a changé, dis-le."
fi
printf '\n'
say "Modèle : $MODELE_OBS"
printf '\n'
say "Fichiers produits, chacun avec SA graine :"
mapfile -t FICHIERS < <(find "$SCRATCH/$CARTE" -type f \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) | sort)
if (( ${#FICHIERS[@]} == 0 )); then
  warn "Aucun fichier trouvé dans $SCRATCH/$CARTE — rien à ranger."
  pause "Entrée pour abandonner"
  finish
  return 1
fi
for i in "${!FICHIERS[@]}"; do
  printf '    %d) %-44s graine %s\n' \
    "$((i + 1))" "$(basename "${FICHIERS[$i]}")" "$(graine_de "$GRAINES" "${FICHIERS[$i]}")"
done
pause "Entrée pour choisir laquelle garder"

fi

# ── 4. Choisir et ranger ──────────────────────────────────────────────────
stage "Choisir, et ranger les DEUX copies"
if [[ -n "$INSTALLE" ]]; then
  CHOIX=1
  note "Variante fournie : rien à choisir."
elif (( ${#FICHIERS[@]} == 1 )); then
  CHOIX=1
  note "Une seule variante : elle est retenue."
else
  demander CHOIX "Numéro de la variante à garder (1-${#FICHIERS[@]}) :"
  case "$CHOIX" in ''|*[!0-9]*) CHOIX=1 ;; esac
  if (( CHOIX < 1 || CHOIX > ${#FICHIERS[@]} )); then CHOIX=1; fi
fi
RETENU="${FICHIERS[$((CHOIX - 1))]}"
GRAINE=$(graine_de "$GRAINES" "$RETENU")
if [[ -z "$GRAINE" ]]; then GRAINE="inconnue"; fi
say ""
say "Retenue : $(basename "$RETENU")"
note "Sa graine : $GRAINE"
note "Elle va au registre, et Vite s'occupe du reste (D-045) :"
note "  $REGISTRE/$CARTE.webp   ← le registre (versionné), seule source"
printf '\n'
if installer "$RETENU" "$CARTE"; then
  note "Image rangée au registre — elle part au build par src/art.ts (D-045)."
else
  warn "Le fichier rangé ne correspond pas à ce qui a été produit : le wizard s'arrête."
fi
note "Le reste des variantes reste dans $SCRATCH/$CARTE/ : gitignoré, tu peux y revenir."

# ── 5. Consigner ──────────────────────────────────────────────────────────
stage "Consigner — modèle et graine"
say "Sans ces deux valeurs, l'image n'est pas reproductible : c'est le critère de #97."
say "Elles viennent de gflow (--json), pas de toi :"
note "  modèle $MODELE_OBS · graine $GRAINE"
if confirm "Écrire ces valeurs dans $README ?"; then
  consigner "$CARTE" "$MODELE_OBS" "$GRAINE" "$(date +%Y-%m-%d)"
  if ligne_journal "$CARTE"; then
    note "Ligne ajoutée au journal vivant."
    # Le message dit **ce qui s'est réellement passé**. Les deux tableaux ne
    # couvrent que la planche Portrait (les dix cartes signature) : pour les autres
    # bases, aucun tableau n'est touché — et c'est normal. Affirmer le contraire
    # ferait croire à une mise à jour qui n'a pas eu lieu.
    case "$CONSIGNER_TABLE" in
      produites)
        note "Le tableau « Cartes produites » a été corrigé : graine et fichier à jour." ;;
      non)
        note "La carte a été **retirée** du tableau « Non produites » : elle est produite." ;;
      *)
        note "Aucun tableau touché : cette carte n'est ni dans « Cartes produites » ni"
        note "dans « Non produites » (ces deux tableaux ne couvrent que la planche Portrait)."
        note "Seule la ligne de journal ci-dessus a été ajoutée." ;;
    esac
  else
    warn "La ligne n'a pas été écrite — le README n'a pas été touché comme prévu."
  fi
else
  warn "Rien écrit : l'image est servie, mais le registre ne dit pas comment la refaire."
fi

# ── 6. Câbler et vérifier ─────────────────────────────────────────────────
stage "Câbler « art: », puis vérifier"
if grep -rqF "art: '$CARTE.webp'" "$DONNEES" 2>/dev/null; then
  note "Déjà câblé : la carte porte art: '$CARTE.webp'."
else
  say "La carte ne porte pas encore d'illustration : sans cette ligne, l'image est"
  say "rangée et servie mais **jamais affichée**."
  if confirm "Ajouter art: '$CARTE.webp' en dernière propriété de la carte ?"; then
    if fichier=$(cabler "$CARTE"); then
      printf '  %s✓%s ajouté dans %s\n' "$GREEN" "$RESET" "$fichier"
    else
      warn "L'objet de la carte n'a pas été trouvé — ajoute la ligne à la main :"
      printf "      art: '%s.webp'\n" "$CARTE"
    fi
  else
    warn "Non câblé : la carte restera sans illustration."
  fi
fi
printf '\n'
say "Les gardes qui existent déjà, et ce qu'elles regardent :"
note "  scripts/illustrations-servies.test.ts  — même liste, mêmes octets (SHA-256)"
note "  src/data/art.test.ts                   — le fichier cité par une carte existe"
printf '\n'
# **Le wizard ne conclut pas sur un échec.** Un `warn` suivi d'un « quand tout est
# vert, commit » conduit droit à commiter un état cassé : les deux vérifications
# ci-dessous sont le **dernier** filtre, donc un échec doit arrêter le script,
# avec le code de sortie qui le dit. (Défaut trouvé en revue le 21/10/2026.)
ECHEC=0
if $CHECK_CMD >"$CHECK_LOG" 2>&1; then
  note "$CHECK_CMD : exit 0"
else
  warn "« $CHECK_CMD » a échoué — lis $CHECK_LOG."
  ECHEC=1
fi
if $TEST_CMD >"$TEST_LOG" 2>&1; then
  printf '  %s✓%s les deux tests passent\n' "$GREEN" "$RESET"
else
  warn "Les tests ont échoué — lis $TEST_LOG : il nomme le fichier coupable."
  ECHEC=1
fi
if (( ECHEC )); then
  printf '\n'
  say "Les vérifications ont échoué : ce qui est sur le disque n'est pas prêt à être"
  say "commité, et le wizard s'arrête ici — il ne t'invite pas à commiter."
  note "Pour revenir en arrière :"
  note "  git checkout -- $REGISTRE $DONNEES"
  note "  git status --porcelain $REGISTRE $DONNEES"
  note "  (une image neuve n'est pas suivie par git : supprime-la à la main si le"
  note "  fichier n'existait pas avant — « git status » la montre.)"
  note "Logs : $CHECK_LOG et $TEST_LOG"
  return 1
fi
printf '\n'
say "Quand tout est vert, commit les trois choses ENSEMBLE : l'image du registre, sa"
say "copie servie, et le README. Un commit qui n'en prend qu'une laisse le test rouge."
printf '\n'
note "Reste, pour les 286 : une vague par faction. Relance ce wizard, il connaît la liste."
pause "Entrée pour terminer"

finish
}

# Le code de sortie EST la réponse du wizard : 0 si tout est vert, 1 si une
# vérification a échoué. `set +e` autour de l'appel pour que `exit $?` rende ce
# code-là, et non le dernier `warn` affiché.
set +e
run_wizard "$@"
exit $?
