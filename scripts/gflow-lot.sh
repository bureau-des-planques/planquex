#!/usr/bin/env bash
#
# Lot d'illustrations : produire **plusieurs cartes d'affilée** avec gflow-cli,
# puis les ranger au registre. Compagnon de `scripts/illustration-vague.sh`, qui
# reste le wizard d'UNE carte et **la seule source** du prompt, du rangement
# (`--installe`) et du câblage `art:` — ce script ne réécrit rien de tout ça, il
# l'appelle.
#
# ## Pourquoi un lot, et pas « plusieurs en même temps »
#
# La demande d'origine était d'envoyer plusieurs générations **simultanément**
# (comme à la main dans la page Flow). gflow ne le permet pas, et ce n'est pas
# une limite de Flow : `gflow_cli/profile_lease.py` prend un **verrou noyau**
# (`flock`) par répertoire de profil, un seul porteur à la fois, échec immédiat
# par défaut — deux `gflow` en parallèle se contentent donc de se bloquer
# (exit 11), et `MCP.md` (l. 106-109) dit que la file `wait=false` **ne tourne
# pas** : aucun worker n'existe (#1097). Lancer plusieurs profils pour tourner
# le verrou serait plusieurs sessions sur le même compte Google — hors de ce que
# gflow prévoit, et hors de ce que ce dépôt s'autorise (ToS Google, `AGENTS.md`
# §6).
#
# Ce qui est **légitime et plus rapide**, c'est une **passe groupée** :
# `gflow image t2i --prompts-file` envoie tous les prompts dans **une seule
# fenêtre, un seul projet**, sans rouvrir Chrome à chaque carte. Mesuré le
# 25/10/2026 sur le lot de l'Atelier : 19 images en 9 min (~28 s/image) contre
# 60 à 90 s par carte en mode « une invocation par carte » (démarrage de Chrome
# à chaque fois).
#
# ## La graine survit à la passe groupée (contrairement à ce qu'on croyait)
#
# Le 25/10/2026, une session a conclu que la passe groupée **perdait la
# graine** — et a donc regénéré 22 cartes une par une, pour rien. Le constat
# portait sur `gflow data media`, qui n'affiche pas la graine ; mais gflow
# **écrit chaque image dans sa base SQLite locale**, avec sa graine
# (`assets.seed`) et son prompt (`operations.prompt`). Vérifié le 26/10/2026 :
#
#     prompt_0_0.jpg  →  seed 1858560414  (« image t2i », projet unique)
#
# Ce script relit donc la base : il retrouve, pour chaque fichier produit, sa
# **graine**, son **prompt** (donc sa **carte**) et son **modèle**, puis écrit
# à côté de l'image le même `payload.json` que produit `--json` en mode
# « une carte ». Le rangement (`--installe`) n'a alors rien à deviner.
# Règle tenue : **une graine se lit ou s'écrit « inconnue » — jamais inventée**
# (`AGENTS.md` §6). Une graine nulle (`0`) est comptée comme inconnue.
#
# ## Usage
#
#     bash scripts/gflow-lot.sh --toutes [--ranger] [--commit]
#     bash scripts/gflow-lot.sh --ids /tmp/opencode/gen/ids-restants.txt --ranger
#     bash scripts/gflow-lot.sh atelier-rpo atelier-rui            # deux cartes
#     bash scripts/gflow-lot.sh --toutes --par-carte               # lent, mais autonome
#     bash scripts/gflow-lot.sh --toutes --simuler                 # ne lance rien
#
# Options : voir `--aide`. Tous les chemins sont **surchargeables par
# l'environnement** (`GFLOW_LOT_*`) : c'est ce qui rend le script testable dans
# un bac temporaire, sans réseau et sans navigateur
# (`scripts/gflow-lot.test.ts`).

set -euo pipefail

cd "$(dirname "$0")/.." 2>/dev/null || true

# ── Réglages (surchargeables : les seams du test) ───────────────────────────
WIZARD="${GFLOW_LOT_WIZARD:-scripts/illustration-vague.sh}"
GFLOW_BIN="${GFLOW_LOT_GFLOW:-gflow}"
SUJETS="${GFLOW_LOT_SUJETS:-design/illustrations/SUJETS-flow.md}"
REGISTRE="${GFLOW_LOT_REGISTRE:-design/illustrations}"
DONNEES="${GFLOW_LOT_DONNEES:-src/data}"
CHECK_CMD="${GFLOW_LOT_CHECK_CMD:-npm run check}"
TEST_CMD="${GFLOW_LOT_TEST_CMD:-npm test -- src/data/art.test.ts}"
MODELE="${GFLOW_LOT_MODELE:-Nano Banana 2.1}"
# Les bases SQLite de gflow, dans l'ordre (même convention que le wizard).
BASES="${GFLOW_LOT_DB:-$HOME/.gflow/gflow.db:$HOME/.local/share/gflow-cli/gflow.db}"

MODE="lot"          # lot | carte
SORTIE="${GFLOW_LOT_SORTIE:-}"
PROJET="${GFLOW_CLI_PROJECT:-}"
IDS_FICHIER=""
TOUTES=0
RANGER=0
COMMIT=0
SIMULER=0
FORCE=0
MAX_ECHECS="${GFLOW_LOT_MAX_ECHECS:-3}"
JITTER=""          # "" = la valeur de gflow (0.5-1.5 s)
IDS=()

if [[ -t 1 ]]; then
  DIM=$'\033[2m'; RESET=$'\033[0m'; VERT=$'\033[32m'; JAUNE=$'\033[33m'; ROUGE=$'\033[31m'
else
  DIM=""; RESET=""; VERT=""; JAUNE=""; ROUGE=""
fi
dit()   { printf '  %s\n' "$1"; }
note()  { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
ok()    { printf '  %s✓%s %s\n' "$VERT" "$RESET" "$1"; }
alerte(){ printf '  %s⚠ %s%s\n' "$JAUNE" "$1" "$RESET"; }
erreur(){ printf '  %s✗ %s%s\n' "$ROUGE" "$1" "$RESET" >&2; }

aide() {
  cat <<'TXT'
Lot d'illustrations par gflow-cli — voir l'en-tête du script pour le pourquoi.

  bash scripts/gflow-lot.sh [options] [id-de-carte…]

Quelles cartes
  --toutes                 toutes les cartes de la table des sujets sans image
  --ids <fichier>          un id par ligne (lignes vides et # ignorées)
  <id>…                    des ids nommés

Comment générer
  --lot                    (défaut) une passe --prompts-file : une fenêtre, un projet
  --par-carte              une invocation gflow par carte (--json), plus lent

Après
  --ranger                 range chaque image au registre (illustration-vague.sh --installe)
  --commit                 un commit par carte, vérifications réelles à chaque carte
                           (sans --commit, les vérifications tournent UNE fois à la fin)
  --simuler                n'appelle ni gflow ni le wizard : dit seulement ce qui serait fait

Réglages
  --sortie <dossier>       où tombent les images (défaut .scratch/gflow/lot-<horodatage>)
  --projet <id>            projet Flow existant (défaut : $GFLOW_CLI_PROJECT)
  --modele <nom humain>    défaut « Nano Banana 2.1 » (résolu par illustration-vague.sh)
  --max-echecs <n>         arrêt de sécurité après n échecs de suite (défaut 3)
  --jitter <spec>          pause anti-bot entre deux envois, passée telle quelle à gflow
                           (`0` pour la couper ; défaut de gflow : 0.5-1.5 s). Gagne
                           ~1 s par carte, et rapproche les envois — gflow conseille
                           de l'ÉLARGIR quand les 403 arrivent (WAF)
  --force                  lance même si une génération gflow tourne déjà

  --aide                   ce texte
TXT
}

while (( $# )); do
  case "$1" in
    --aide|-h|--help) aide; exit 0 ;;
    --toutes) TOUTES=1; shift ;;
    --ids) IDS_FICHIER="${2:?--ids attend un fichier}"; shift 2 ;;
    --lot) MODE="lot"; shift ;;
    --par-carte) MODE="carte"; shift ;;
    --ranger) RANGER=1; shift ;;
    --commit) COMMIT=1; shift ;;
    --simuler) SIMULER=1; shift ;;
    --sortie) SORTIE="${2:?--sortie attend un dossier}"; shift 2 ;;
    --projet) PROJET="${2:?--projet attend un id}"; shift 2 ;;
    --modele) MODELE="${2:?--modele attend un nom}"; shift 2 ;;
    --max-echecs) MAX_ECHECS="${2:?--max-echecs attend un nombre}"; shift 2 ;;
    --jitter) JITTER="${2:?--jitter attend une valeur}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -*) erreur "option inconnue : $1"; exit 2 ;;
    *) IDS+=("$1"); shift ;;
  esac
done

case "$MAX_ECHECS" in ''|*[!0-9]*) MAX_ECHECS=3 ;; esac
# Le même réglage, en variable d'environnement : le mode « une par carte » passe
# par le wizard, qui n'a pas de drapeau `--jitter` — gflow lit celle-ci.
if [[ -n "$JITTER" ]]; then export GFLOW_CLI_JITTER_RANGE="$JITTER"; fi

if [[ ! -f "$SUJETS" ]]; then
  erreur "table des sujets introuvable : $SUJETS"
  exit 2
fi

# ── La table des sujets : les cartes connues ────────────────────────────────
# Même lecture que le wizard : les blocs de code (```) montrent le **format**,
# ils ne sont pas des données.
cartes_connues() {
  awk -F'|' '/^```/ { bloc = !bloc; next }
    !bloc && /^\| `/{ id=$2; gsub(/^[ `]+|[ `]+$/, "", id); print id }' "$SUJETS"
}

connue() { cartes_connues | grep -qxF -- "$1"; }

# deja_servie ID : le registre a l'image **et** une carte la cite.
deja_servie() {
  local id="$1"
  [[ -f "$REGISTRE/$id.webp" ]] && grep -rqF "art: '$id.webp'" "$DONNEES" 2>/dev/null
}

# ── La liste des cartes à produire ─────────────────────────────────────────
liste=()
if (( TOUTES )); then
  while IFS= read -r id; do
    [[ -n "$id" ]] && liste+=("$id")
  done < <(cartes_connues)
fi
if [[ -n "$IDS_FICHIER" ]]; then
  [[ -f "$IDS_FICHIER" ]] || { erreur "fichier d'ids introuvable : $IDS_FICHIER"; exit 2; }
  while IFS= read -r id; do
    id="${id%%#*}"; id="${id//[[:space:]]/}"
    [[ -n "$id" ]] && liste+=("$id")
  done < "$IDS_FICHIER"
fi
if (( ${#IDS[@]} )); then
  liste+=("${IDS[@]}")
fi
if (( ${#liste[@]} == 0 )); then
  erreur "aucune carte : donnez --toutes, --ids <fichier>, ou des ids."
  aide >&2
  exit 2
fi

# Dédoublonnage en gardant l'ordre, et refus des inconnues.
a_faire=()
declare -A vu=()
for id in "${liste[@]}"; do
  [[ -n "${vu[$id]:-}" ]] && continue
  vu[$id]=1
  if ! connue "$id"; then
    alerte "« $id » n'est pas dans la table des sujets — ignorée."
    continue
  fi
  if deja_servie "$id"; then
    continue
  fi
  a_faire+=("$id")
done

if (( ${#a_faire[@]} == 0 )); then
  ok "rien à faire : toutes ces cartes ont déjà leur image et leur « art: »."
  exit 0
fi

# ── L'alias de modèle : une seule source, le wizard ────────────────────────
# Le mapping nom humain → alias gflow vit dans illustration-vague.sh
# (`modele_alias`). On l'appelle au lieu de le recopier : deux tables
# divergeraient au premier ajout de modèle.
ALIAS=""
if ! ALIAS=$(bash "$WIZARD" --modele "$MODELE" 2>/dev/null); then
  erreur "modèle inconnu : « $MODELE ». Les noms acceptés sont ceux du wizard :"
  bash "$WIZARD" --modele "" >/dev/null 2>&1 || true
  printf '%s\n' '    Nano Banana 2.1 · Nano Banana 2 Lite · Nano Banana Pro · Imagen 4' >&2
  exit 2
fi

# ── Sortie et journal ──────────────────────────────────────────────────────
if [[ -z "$SORTIE" ]]; then SORTIE=".scratch/gflow/lot-$(date +%Y%m%d-%H%M%S)"; fi
mkdir -p "$SORTIE"
SORTIE=$(cd "$SORTIE" && pwd)          # absolu : gflow note ses chemins en absolu
JOURNAL="$SORTIE/lot.log"
: > "$JOURNAL"
journaliser() { printf '%s %s\n' "$1" "$2" >> "$JOURNAL"; }

printf '\n%s  Lot d’illustrations — %d carte(s), mode %s%s\n' "" "${#a_faire[@]}" \
  "$([[ $MODE == lot ]] && echo 'passe groupée' || echo 'une par carte')" ""
note "sortie : $SORTIE"
note "modèle : $MODELE → --model $ALIAS"
(( RANGER )) && note "rangement : oui (illustration-vague.sh --installe)"
(( COMMIT )) && note "commit : un par carte, vérifications réelles à chaque fois"

# ── Une génération gflow tourne-t-elle déjà ? ───────────────────────────────
# Le verrou de gflow est par profil ; un second appel échoue en exit 11. Autant
# le dire avant de lancer 200 cartes, plutôt qu'à la première.
if (( ! SIMULER && ! FORCE )); then
  if pgrep -af "gflow image t2i" 2>/dev/null | grep -qv "gflow-lot"; then
    alerte "une génération gflow tourne déjà (verrou de profil occupé) :"
    pgrep -af "gflow image t2i" | sed 's/^/      /'
    note "attendez la fin, ou relancez avec --force si vous savez ce que vous faites."
    exit 1
  fi
fi

# ── Les prompts : le wizard les construit, pas nous ────────────────────────
# `illustration-vague.sh --prompt <id>` rend socle + sujet + accent, aplati sur
# une ligne. Une seule source : si le socle change, le lot en hérite.
prompts_fichier="$SORTIE/prompts.txt"
cartes_fichier="$SORTIE/cartes.tsv"
: > "$prompts_fichier"
: > "$cartes_fichier"
retenues=()
for id in "${a_faire[@]}"; do
  p=$(bash "$WIZARD" --prompt "$id" 2>/dev/null) || p=""
  if [[ -z "$p" ]]; then
    alerte "$id : le wizard n'a pas rendu de prompt — carte écartée."
    journaliser "$id" "SANS-PROMPT"
    continue
  fi
  printf '%s\n' "$p" >> "$prompts_fichier"
  printf '%s\t%s\n' "$id" "$p" >> "$cartes_fichier"
  retenues+=("$id")
done

if (( ${#retenues[@]} == 0 )); then
  erreur "aucun prompt construit — rien n'a été envoyé."
  exit 1
fi
note "$(wc -l < "$prompts_fichier" | tr -d ' ') prompt(s) prêts : $prompts_fichier"

if (( SIMULER )); then
  dit "Simulation : gflow n'est pas appelé."
  printf '%s\n' "${retenues[@]}" | sed 's/^/      /'
  exit 0
fi

# ── Génération ─────────────────────────────────────────────────────────────
code_gen=0
if [[ "$MODE" == "lot" ]]; then
  dit "Passe groupée : une fenêtre, un projet, tous les prompts."
  args=(image t2i --prompts-file "$prompts_fichier" --model "$ALIAS" --aspect 1:1
        --out "$SORTIE/images")
  [[ -n "$PROJET" ]] && args+=(--project "$PROJET")
  [[ -n "$JITTER" ]] && args+=(--jitter "$JITTER")
  set +e
  "$GFLOW_BIN" "${args[@]}" > "$SORTIE/gflow.out" 2> "$SORTIE/gflow.err"
  code_gen=$?
  set -e
  # `--continue-on-error` est le défaut : un prompt en échec n'arrête pas la passe.
  note "sortie de gflow : exit $code_gen · $SORTIE/gflow.out"
  if (( code_gen != 0 )); then
    alerte "gflow a rendu $code_gen — les images déjà écrites restent valables."
  fi
else
  dit "Une invocation par carte (le wizard, mode --direct)."
  echecs_suite=0
  for id in "${retenues[@]}"; do
    if bash "$WIZARD" "$id" --direct > "$SORTIE/gen-$id.log" 2>&1; then
      journaliser "$id" "GENERE"
      echecs_suite=0
    else
      journaliser "$id" "GEN-ECHEC"
      echecs_suite=$((echecs_suite + 1))
      alerte "$id : génération en échec (voir $SORTIE/gen-$id.log)"
      if (( echecs_suite >= MAX_ECHECS )); then
        erreur "arrêt de sécurité : $MAX_ECHECS échecs de suite."
        break
      fi
    fi
  done
fi

# ── Mode « une par carte » : le wizard a déjà tout écrit ───────────────────
# En `--par-carte`, chaque carte a son dossier (`$SORTIE/<id>/`) et son
# `payload.json`, rendus par `--direct`. On relit la graine et le modèle **par
# le wizard** (`--lit-json`), pas par une seconde lecture à nous : une seule
# façon de lire le payload, donc un seul endroit à corriger s'il change.
declare -A image_par_carte=()
declare -A graine_par_carte=()
declare -A modele_par_carte=()
declare -A generees=()

if [[ "$MODE" == "carte" ]]; then
  for id in "${retenues[@]}"; do
    img=$(find "$SORTIE/$id" -type f \( -name '*.jpg' -o -name '*.png' \) -printf '%T@ %p\n' 2>/dev/null \
          | sort -nr | head -1 | cut -d' ' -f2-)
    [[ -n "$img" ]] || continue
    image_par_carte["$id"]="$img"
    if [[ -f "$SORTIE/$id/payload.json" ]]; then
      lu=$(bash "$WIZARD" --lit-json "$SORTIE/$id/payload.json" 2>/dev/null || true)
      base="${img##*/}"
      graine_par_carte["$id"]=$(printf '%s\n' "$lu" | awk -F'\t' -v b="$base" \
        '$1 == "graine" && substr($2, length($2) - length(b) + 1) == b { print $3; exit }')
      modele_par_carte["$id"]=$(printf '%s\n' "$lu" | awk -F'\t' '$1 == "modele" { print $2; exit }')
    fi
    generees["$id"]=1
    journaliser "$id" "GENERE graine=${graine_par_carte[$id]:-inconnue}"
  done
fi

# ── Associer chaque fichier à sa carte, sa graine et son modèle ────────────
# Trois sources, dans cet ordre, et **jamais** une valeur inventée :
#   1. la base locale de gflow (`local_files` → `assets.seed`, `operations.prompt`) ;
#   2. à défaut, le nom du fichier `prompt_<n>_<k>.jpg` → la (n+1)ᵉ ligne de
#      `prompts.txt` (convention observée de gflow en passe groupée) ;
#   3. à défaut, la carte reste « sans association » et le script le dit.
associer() {
  local lignes
  lignes=$(python3 - "$SORTIE" "$BASES" <<'PY' 2>/dev/null || true
import os, sys, sqlite3

sortie = os.path.realpath(sys.argv[1])
bases = [b for b in sys.argv[2].split(":") if b]

requete = """
select lf.path, a.seed, o.prompt, o.model
from local_files lf
join assets a on a.id = lf.asset_id
left join operation_assets oa on oa.asset_id = a.id
left join operations o on o.id = oa.operation_id
where lf.path like ?
"""

for base in bases:
    if not os.path.isfile(base):
        continue
    try:
        con = sqlite3.connect("file:%s?mode=ro" % base, uri=True)
    except Exception:
        continue
    try:
        for chemin, graine, prompt, modele in con.execute(requete, (sortie + "%",)):
            if not chemin or not os.path.isfile(chemin):
                continue
            graine = "" if graine in (None, 0) else str(graine)
            prompt = (prompt or "").replace("\t", " ").replace("\n", " ")
            modele = (modele or "").strip()
            print("%s\t%s\t%s\t%s" % (os.path.realpath(chemin), graine, modele, prompt))
    except Exception:
        pass
    finally:
        try:
            con.close()
        except Exception:
            pass
PY
)
  printf '%s' "$lignes"
}

if [[ "$MODE" == "lot" ]]; then
trouvailles=$(associer)

# table prompt → carte (le prompt est unique par carte : il porte son sujet)
declare -A carte_du_prompt=()
while IFS=$'\t' read -r id p; do
  [[ -n "$id" ]] && carte_du_prompt["$p"]="$id"
done < "$cartes_fichier"

# Ce que la base dit de chaque fichier, indexé par son chemin **réel**.
declare -A graine_du_fichier=()
declare -A modele_du_fichier=()
declare -A prompt_du_fichier=()
while IFS=$'\t' read -r chemin graine modele prompt; do
  [[ -z "$chemin" ]] && continue
  graine_du_fichier["$chemin"]="$graine"
  modele_du_fichier["$chemin"]="$modele"
  prompt_du_fichier["$chemin"]="$prompt"
done <<< "$trouvailles"

# Les fichiers produits, qu'on parte de la base ou non : le disque fait foi.
# (Une première version ne parcourait que les lignes de la base — donc une base
# muette rendait **zéro** image, alors que les fichiers étaient là.)
while IFS= read -r chemin; do
  [[ -z "$chemin" ]] && continue
  rp=$(realpath "$chemin" 2>/dev/null || printf '%s' "$chemin")
  prompt="${prompt_du_fichier[$rp]:-}"
  # Bash refuse un indice **vide**, même sur un tableau associatif
  # (« mauvais indice de tableau ») : la base muette doit donc se taire, pas
  # faire tomber le script.
  id=""
  [[ -n "$prompt" ]] && id="${carte_du_prompt[$prompt]:-}"
  if [[ -z "$id" ]]; then
    # 2. le nom du fichier : prompt_<n>_<k>.<ext>
    base="${chemin##*/}"
    if [[ "$base" =~ ^prompt_([0-9]+)_ ]]; then
      n=$(( BASH_REMATCH[1] + 1 ))
      id=$(sed -n "${n}p" "$cartes_fichier" 2>/dev/null | cut -f1)
    fi
  fi
  if [[ -z "$id" ]]; then
    alerte "fichier non associé à une carte : $chemin"
    journaliser "${chemin##*/}" "SANS-ASSOCIATION"
    continue
  fi
  # une carte = une image : la première trouvée gagne
  [[ -n "${image_par_carte[$id]:-}" ]] && continue
  image_par_carte["$id"]="$chemin"
  graine_par_carte["$id"]="${graine_du_fichier[$rp]:-}"
  modele_par_carte["$id"]="${modele_du_fichier[$rp]:-}"
done < <(find "$SORTIE/images" -type f \( -name '*.jpg' -o -name '*.png' -o -name '*.webp' \) 2>/dev/null | sort)

# Le payload : la **même forme** que le `--json` de gflow (graine sous
# `images[]`), pour que `--installe` n'ait rien à deviner. Une graine absente
# n'est **pas** écrite : le wizard lira « inconnue », il n'inventera pas.
for id in "${retenues[@]}"; do
  img="${image_par_carte[$id]:-}"
  if [[ -z "$img" ]]; then
    journaliser "$id" "GEN-ECHEC"
    continue
  fi
  generees["$id"]=1
  mkdir -p "$SORTIE/$id"
  g="${graine_par_carte[$id]}"
  m="${modele_par_carte[$id]}"
  python3 - "$SORTIE/$id/payload.json" "$img" "$g" "$m" <<'PY'
import json, sys
dest, chemin, graine, modele = sys.argv[1:5]
image = {"local_path": chemin}
if graine:
    image["seed"] = int(graine)
else:
    image["seed"] = None
charge = {"status": "ok", "command": "image t2i", "count": 1, "images": [image]}
if modele:
    charge["model"] = modele
with open(dest, "w", encoding="utf-8") as f:
    json.dump(charge, f)
PY
  journaliser "$id" "GENERE graine=${g:-inconnue}"
done
fi   # fin du mode « passe groupée » : l'association et le payload

printf '\n  Bilan de la génération : %d carte(s) produite(s) sur %d.\n' \
  "${#generees[@]}" "${#retenues[@]}"
for id in "${retenues[@]}"; do
  if [[ -n "${generees[$id]:-}" ]]; then
    printf '      %-44s graine %s\n' "$id" "${graine_par_carte[$id]:-inconnue}"
  else
    printf '      %-44s %séchec%s\n' "$id" "$ROUGE" "$RESET"
  fi
done
note "journal : $JOURNAL"

# ── Ranger (facultatif) ────────────────────────────────────────────────────
if (( RANGER )) && (( ${#generees[@]} )); then
  printf '\n  Rangement au registre…\n'
  # Le wizard relance `npm run check` et le test de l'art **à chaque carte**
  # (~30 s). Sans --commit, ces vérifications sont neutralisées dans la boucle
  # et tournent **une fois**, pour de vrai, à la fin : on ne gagne pas de temps
  # en sautant la vérification, on évite de la refaire 200 fois.
  if (( ! COMMIT )); then
    export GFLOW_ILLUSTRATION_CHECK_CMD=true
    export GFLOW_ILLUSTRATION_TEST_CMD=true
    # Dit à voix haute, parce que le journal du wizard affichera « les deux
    # tests passent » : ce sont des commandes neutres, la vraie vérification
    # est **une seule fois, à la fin**, et elle n'est pas facultative.
    note "vérifications par carte différées : elles tournent une fois à la fin du lot."
  fi
  # Le wizard d'une carte est **interactif** (`[y/N]` avant d'écrire le
  # registre et de câbler `art:`, plus les pauses). On répond oui : c'est sa
  # procédure normale, pas un raccourci. Les réponses viennent d'un **fichier**,
  # pas de `yes y |` : sous `set -o pipefail` (actif ici), `yes` meurt en
  # SIGPIPE (141) et la boucle compterait un succès pour un échec — constaté à
  # la première exécution.
  oui="$SORTIE/oui.txt"
  : > "$oui"
  for _ in $(seq 1 200); do printf 'y\n' >> "$oui"; done
  for id in "${retenues[@]}"; do
    [[ -n "${generees[$id]:-}" ]] || continue
    img="${image_par_carte[$id]}"
    if bash "$WIZARD" "$id" --installe "$img" < "$oui" > "$SORTIE/rangement-$id.log" 2>&1; then
      journaliser "$id" "RANGE"
      ok "$id rangée"
      if (( COMMIT )); then
        git add "$REGISTRE/$id.webp" "$REGISTRE/README.md" "$DONNEES" 2>/dev/null || true
        git commit -q -m "illustration : $id (image, registre, art:)" \
          && note "commit fait" || alerte "commit impossible pour $id"
      fi
    else
      journaliser "$id" "RANGEMENT-ECHEC"
      alerte "$id : rangement en échec (voir $SORTIE/rangement-$id.log)"
    fi
  done
  unset GFLOW_ILLUSTRATION_CHECK_CMD GFLOW_ILLUSTRATION_TEST_CMD 2>/dev/null || true
fi

# ── Vérification, une fois ─────────────────────────────────────────────────
if (( RANGER && ! COMMIT && ${#generees[@]} )); then
  printf '\n  Vérification finale (une seule fois pour tout le lot)…\n'
  echec=0
  if $CHECK_CMD > "$SORTIE/check.log" 2>&1; then
    ok "$CHECK_CMD : exit 0"
  else
    alerte "« $CHECK_CMD » a échoué — lis $SORTIE/check.log"
    echec=1
  fi
  if $TEST_CMD > "$SORTIE/test.log" 2>&1; then
    ok "le test des illustrations passe"
  else
    alerte "le test des illustrations a échoué — lis $SORTIE/test.log"
    echec=1
  fi
  if (( echec )); then
    erreur "ce qui est sur le disque n'est pas prêt à être commité. Retour arrière :"
    note "  git checkout -- $REGISTRE $DONNEES"
    exit 1
  fi
  note "commit : un seul pour tout le lot, images + README + art: ensemble."
fi

printf '\n'
if (( ${#generees[@]} == ${#retenues[@]} )); then
  ok "lot terminé : ${#generees[@]} image(s)."
  exit 0
fi
alerte "lot terminé avec des manques : ${#generees[@]} image(s) sur ${#retenues[@]}."
note "relancez le script avec les mêmes cartes : celles qui ont réussi sont sautées."
exit 1
