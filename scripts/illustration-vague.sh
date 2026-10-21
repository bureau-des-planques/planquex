#!/usr/bin/env bash
#
# Wizard : produire une illustration de carte par gflow-cli, la ranger, la
# consigner — tickets #97 / #95. Décisions de référence : D-007 (IA + curation),
# D-028 (direction artistique).
#
# Pourquoi ce wizard existe : les illustrations vivent en **deux jeux**.
#   design/illustrations/        le registre (versionné, README + prompts)
#   public/design/illustrations/ ce que Vite sert réellement
# Une regénération faite au registre ne change **rien** à l'écran tant que le
# fichier n'est pas copié : le build passe, les captures passent, et rien ne le
# dit. C'est la seule règle que garde scripts/illustrations-servies.test.ts
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

PROMPTS="design/illustrations/PROMPTS-flow.md"
REGISTRE="design/illustrations"
SERVI="public/design/illustrations"
README="$REGISTRE/README.md"
SCRATCH=".scratch/gflow"

# ── outils du tuyau ───────────────────────────────────────────────────────

# cartes : id <TAB> sujet <TAB> accent — la table « Planche 1 » de PROMPTS-flow.md
cartes() {
  awk -F'|' '/^\| `/{ id=$2; sujet=$3; accent=$4
    gsub(/^[ `]+|[ `]+$/, "", id)
    gsub(/^ +| +$/, "", sujet)
    gsub(/^ +| +$/, "", accent)
    printf "%s\t%s\t%s\n", id, sujet, accent }' "$PROMPTS"
}
connue()   { cartes | awk -F'\t' -v id="$1" '$1 == id { f = 1 } END { exit !f }'; }
sujet_de() { cartes | awk -F'\t' -v id="$1" '$1 == id { print $2 }'; }
accent_de(){ cartes | awk -F'\t' -v id="$1" '$1 == id { print $3 }'; }

# socle() : le bloc de code de « ## Socle commun » — le seul endroit où il vit.
socle() {
  awk '/^## Socle commun/{ f = 1; next }
       f && /^```/ { n++; if (n == 2) exit; next }
       f && n == 1 { print }' "$PROMPTS"
}

# etat_de ID : l'image est-elle au registre, servie, et la carte câblée ?
etat_de() {
  local id="$1" r="non" s="non" a="non"
  if [[ -f "$REGISTRE/$id.webp" ]]; then r="oui"; fi
  if [[ -f "$SERVI/$id.webp" ]]; then s="oui"; fi
  if grep -rqF "art: '$id.webp'" src/data 2>/dev/null; then a="oui"; fi
  printf 'registre %s · servi %s · art %s' "$r" "$s" "$a"
}

# champ JSON DEFAUT : lit un champ de l'objet rendu par `gflow … --json`.
# Le CLI peut rendre un objet ou une liste (une entrée par image) ; on prend la
# première. Toute panne de lecture rend le défaut — jamais une exception, parce
# qu'un wizard ne doit pas mourir sur une réponse inattendue.
champ_json() {
  local json="$1" champ="$2" defaut="$3"
  printf '%s' "$json" | python3 -c '
import json, sys
champ, defaut = sys.argv[1], sys.argv[2]
try:
    d = json.load(sys.stdin)
except Exception:
    print(defaut); raise SystemExit
if isinstance(d, list):
    d = d[0] if d else {}
if not isinstance(d, dict):
    print(defaut); raise SystemExit
v = d.get(champ)
print(defaut if v is None or v == "" else v)
' "$champ" "$defaut" 2>/dev/null || printf '%s' "$defaut"
}

# installer SRC ID : convertit en webp, écrit le registre, copie le servi, et
# **vérifie** que les deux sont identiques à l'octet — la règle du test #120.
installer() {
  local src="$1" id="$2" reg="$REGISTRE/$id.webp" serv="$SERVI/$id.webp"
  python3 - "$src" "$reg" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
if im.mode not in ("RGB", "RGBA"):
    im = im.convert("RGBA")
im.save(dst, "WEBP", quality=90, method=6)
PY
  cp "$reg" "$serv"
  if cmp -s "$reg" "$serv"; then
    printf '  %s✓%s %s — %s o, empreinte %s\n' "$GREEN" "$RESET" "$id.webp" \
      "$(stat -c%s "$reg")" "$(sha256sum "$reg" | cut -c1-12)"
    return 0
  fi
  return 1
}

# consigner ID MODELE GRAINE DATE : tient le README — remet la graine à jour si
# la carte est dans « Cartes produites », retire sa ligne si elle est dans « Non
# produites » (ce n'est plus vrai), et ajoute une ligne au journal vivant.
consigner() {
  local id="$1" modele="$2" graine="$3" date="$4" tmp
  tmp=$(mktemp)
  awk -F'|' -v OFS='|' -v id="$id" -v graine="$graine" -v fichier="$id.webp" '
    /^## Cartes produites/ { section = "produites"; print; next }
    /^## Non produites/    { section = "non"; print; next }
    /^## /                 { section = ""; print; next }
    $0 ~ ("^\\| `" id "`") {
      if (section == "produites") { $5 = " `" graine "` "; $6 = " `" fichier "` "; print; next }
      if (section == "non")       { next }
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
}

# cabler ID : ajoute « art: '<id>.webp' » en **dernière** propriété de l'objet de
# la carte — la convention des cartes déjà câblées. Rend le chemin, ou un code.
cabler() {
  local id="$1" fichier tmp
  fichier=$(grep -rlF "id: '$id'" src/data --include='*.ts' 2>/dev/null | head -n1)
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
  return
fi
note "gflow trouvé : $(command -v gflow)"
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
  return
fi

# ── 2. La carte ───────────────────────────────────────────────────────────
stage "Quelle carte ?"
say "Les 10 cartes signature, avec leur état réel (mesuré, pas déclaré) :"
printf '\n'
while IFS=$'\t' read -r id sujet accent; do
  printf '    %-34s %s\n' "$id" "$(etat_de "$id")"
done < <(cartes)
printf '\n'
note "registre = l'image existe dans $REGISTRE/ ; servi = aussi dans $SERVI/."
note "Les deux doivent dire oui : c'est ce que garde illustrations-servies.test.ts."

CARTE="${1:-}"
if [[ -z "$CARTE" ]]; then
  ask CARTE "id de la carte à produire :"
fi
if [[ -z "$CARTE" ]] || ! connue "$CARTE"; then
  warn "« ${CARTE:-<vide>} » n'est pas dans la Planche 1 de $PROMPTS."
  pause "Entrée pour abandonner"
  finish
  return
fi
say ""
say "Carte retenue : $CARTE"
note "Sujet  : $(sujet_de "$CARTE")"
note "Accent : $(accent_de "$CARTE")"
note "État   : $(etat_de "$CARTE")"
pause "Entrée pour générer"

# ── 3. Générer ────────────────────────────────────────────────────────────
stage "Générer avec gflow"
PROMPT="$(socle) $(sujet_de "$CARTE"), muted $(accent_de "$CARTE") accent."
say "Prompt envoyé (socle §6.1 + sujet) :"
printf '\n%s\n\n' "$PROMPT" | fold -s -w 96 | sed 's/^/    /'
note "Le socle impose la lumière principale sur le VISAGE : c'est le correctif de la"
note "première vague, dont les 8 images ont les visages dans l'ombre. Ne l'enlève pas."
printf '\n'
ask MODELE "Modèle [nano2|nano-pro|nano2-lite|image4] :"
MODELE="${MODELE:-nano2}"
ask NB "Combien de variantes (1-4) :"
NB="${NB:-1}"
case "$NB" in ''|*[!0-9]*) NB=1 ;; esac
if (( NB < 1 || NB > 4 )); then NB=1; fi

mkdir -p "$SCRATCH/$CARTE"
note "Sortie : $SCRATCH/$CARTE/ (gitignoré, cf. .gitignore)"
note "Les images sont gratuites côté Flow ; seuls les outils vidéo dépensent."
printf '\n'
say "Lancement — 30 à 90 s au premier appel, le temps que Chromium chauffe."
JSON=""
if JSON=$(gflow image t2i "$PROMPT" --model "$MODELE" --aspect 1:1 -n "$NB" \
            --out "$SCRATCH/$CARTE" --json 2>/tmp/gflow-illustration.err); then
  printf '  %s✓%s génération terminée\n' "$GREEN" "$RESET"
else
  warn "gflow a échoué — lis /tmp/gflow-illustration.err."
  note "Codes distincts : 23 = dérive de sélecteur (l'UI de Flow a bougé),"
  note "28 = l'interface classique n'a pas été atteinte. Aucun crédit n'est dépensé"
  note "par une génération d'image : une casse ne coûte rien."
  pause "Entrée pour abandonner"
  finish
  return
fi

GRAINE=$(champ_json "$JSON" seed "inconnue")
MODELE_OBS=$(champ_json "$JSON" model_name_type "")
if [[ -z "$MODELE_OBS" || "$MODELE_OBS" == "inconnue" ]]; then
  MODELE_OBS="$MODELE"
  note "model_name_type est nul — normal sur flow.google.com : le compte est servi par"
  note "cet hôte, dont la réponse ne porte pas de champ modèle. On consigne l'alias demandé."
fi
printf '\n'
note "Graine  : $GRAINE"
note "Modèle  : $MODELE_OBS"
printf '\n'
say "Fichiers produits :"
mapfile -t FICHIERS < <(find "$SCRATCH/$CARTE" -type f \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) | sort)
if (( ${#FICHIERS[@]} == 0 )); then
  warn "Aucun fichier trouvé dans $SCRATCH/$CARTE — rien à ranger."
  pause "Entrée pour abandonner"
  finish
  return
fi
for i in "${!FICHIERS[@]}"; do
  printf '    %d) %s\n' "$((i + 1))" "$(basename "${FICHIERS[$i]}")"
done
pause "Entrée pour choisir laquelle garder"

# ── 4. Choisir et ranger ──────────────────────────────────────────────────
stage "Choisir, et ranger les DEUX jeux"
if (( ${#FICHIERS[@]} == 1 )); then
  CHOIX=1
  note "Une seule variante : elle est retenue."
else
  ask CHOIX "Numéro de la variante à garder (1-${#FICHIERS[@]}) :"
  case "$CHOIX" in ''|*[!0-9]*) CHOIX=1 ;; esac
  if (( CHOIX < 1 || CHOIX > ${#FICHIERS[@]} )); then CHOIX=1; fi
fi
RETENU="${FICHIERS[$((CHOIX - 1))]}"
say ""
say "Retenue : $(basename "$RETENU")"
note "Elle va dans deux dossiers, sinon l'écran ne change pas :"
note "  $REGISTRE/$CARTE.webp   ← le registre (versionné)"
note "  $SERVI/$CARTE.webp   ← ce que l'application sert"
printf '\n'
if installer "$RETENU" "$CARTE"; then
  note "Les deux jeux portent le même fichier, octet pour octet."
else
  warn "Les deux copies diffèrent — c'est exactement ce que le test refuse."
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
    note "Et la graine des tableaux est à jour : « Cartes produites » corrigée, « Non produites » retirée."
  else
    warn "La ligne n'a pas été écrite — le README n'a pas été touché comme prévu."
  fi
else
  warn "Rien écrit : l'image est servie, mais le registre ne dit pas comment la refaire."
fi

# ── 6. Câbler et vérifier ─────────────────────────────────────────────────
stage "Câbler « art: », puis vérifier"
if grep -rqF "art: '$CARTE.webp'" src/data 2>/dev/null; then
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
if npm run check >/tmp/illustration-check.log 2>&1; then
  note "npm run check : exit 0"
else
  warn "npm run check a échoué — lis /tmp/illustration-check.log."
  note "Pour revenir en arrière : git checkout -- src/data/"
fi
if npm test -- scripts/illustrations-servies.test.ts src/data/art.test.ts >/tmp/illustration-test.log 2>&1; then
  printf '  %s✓%s les deux tests passent\n' "$GREEN" "$RESET"
else
  warn "Un test a échoué — lis /tmp/illustration-test.log : il nomme le fichier coupable."
fi
printf '\n'
say "Quand tout est vert, commit les trois choses ENSEMBLE : l'image du registre, sa"
say "copie servie, et le README. Un commit qui n'en prend qu'une laisse le test rouge."
printf '\n'
note "Reste, pour les 286 : une vague par faction. Relance ce wizard, il connaît la liste."
pause "Entrée pour terminer"

finish
}

run_wizard "$@"; exit
