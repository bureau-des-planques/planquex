#!/usr/bin/env bash
#
# Wizard : infrastructure du TCG (Supabase, Vercel, Brevo) — ticket #8 de
# Chapax/opencode-config. Décisions de référence : D-016 de ce dépôt, amendée
# par D-017 (le projet Vercel est réutilisé, pas recréé ; clé SMTP Brevo rangée
# dans la config Custom SMTP de Supabase, jamais dans .env).
#
# Nommage : le nom technique du projet est « planquex » (D-036) et le site
# legacy est retiré (D-038). Ce wizard écrit donc « planquex » partout où il
# désigne le projet actif ; les actes datés antérieurs (D-016, D-017) gardent
# l'ancien nom, qui ne survit plus que dans le dossier local (D-038).
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

TOTAL_STAGES=9

# Les valeurs vont hors du dépôt par défaut. Le .env du dépôt est ignoré par
# .gitignore, mais D-017 range la clé SMTP Brevo dans Supabase : aucun secret
# ne doit être écrit ici, quels que soient les noms de clés.
ENV_FILE="${ENV_FILE:-$HOME/.secrets/planquex.env}"
mkdir -p "$(dirname "$ENV_FILE")"
chmod 700 "$(dirname "$ENV_FILE")" 2>/dev/null || true
if [[ -f "$ENV_FILE" ]]; then
  set -a; . "$ENV_FILE"; set +a
fi

# Valeurs de référence vérifiées le 18/10/2026.
ORG_ID="hvgyhfwluxdhihfzzclw"
OLD_PROD_REF="pilflaquwcodjgbsotjz"
DASH="https://supabase.com/dashboard"
VERCEL_TEAM="chapaxs-projects"

banner "Infrastructure du TCG — Supabase, Vercel, Brevo"

# ── 1. État Supabase ──────────────────────────────────────────────────────
stage "Supabase : état des projets actifs"
say "L'offre gratuite limite à 2 projets actifs, mais autorise autant de projets en pause que voulu."
say "L'ancien jeu occupe deux places : production pilflaquwcodjgbsotjz et dev ptgyifwvsuyftjlzbqwo."
open_url "$DASH/projects"
step "Vérifie la liste : combien de projets sont actifs ? Lesquels ?"
step "Si un projet est déjà en pause, note-le : il n'y a peut-être rien à libérer."
note "Le TCG a besoin d'une place active pour son propre projet."
pause "Liste vérifiée ? Entrée pour continuer"

# ── 2. Pause de l'ancien projet ───────────────────────────────────────────
stage "Supabase : mettre en pause l'ancien projet de production"
if [[ "${SUPABASE_OLD_PAUSED:-}" == "1" ]]; then
  note "Déjà fait lors d'une exécution précédente."
else
  warn "Décision validée : on met en pause la production $OLD_PROD_REF."
  warn "Conséquence : le backend de l'ancien jeu s'arrête. Le projet Vercel « planquex » est conservé mais reste en pause, et son ancien domaine est retiré (D-038)."
  open_url "$DASH/project/$OLD_PROD_REF/settings/general"
  step "Descends jusqu'à « Pause project » et confirme la mise en pause."
  step "Attends que le tableau de bord affiche le projet comme « Paused »."
  if confirm "Projet de production mis en pause ?"; then
    write_env SUPABASE_OLD_PAUSED "1"
  else
    warn "Sans place active, l'étape 3 échouera. Relance quand la pause est faite."
  fi
fi

# ── 3. Projet Supabase du TCG ─────────────────────────────────────────────
stage "Supabase : créer le projet planquex (schéma vide)"
if [[ -n "${SUPABASE_PROJECT_REF:-}" && -n "${SUPABASE_ANON_KEY:-}" ]]; then
  note "Projet déjà enregistré : $SUPABASE_PROJECT_REF — étape sautée."
else
  open_url "$DASH/new/$ORG_ID?region=eu-west-3"
  step "Nom du projet : planquex"
  step "Mot de passe de la base : génère-en un et range-le dans ton gestionnaire de mots de passe."
  step "Région : Europe (Paris) — eu-west-3. Offre : Free."
  step "Crée le projet, puis attends la fin du provisioning."
  note "Ne crée aucun schéma, aucune table, aucune extension : le projet doit rester vide (D-016)."
  pause "Projet créé ? Entrée pour capturer les identifiants"
  open_url "$DASH/project/_/settings/general"
  step "Project Settings → General → « Reference ID » : copie la référence (20 caractères)."
  ask SUPABASE_PROJECT_REF "Référence du projet :"
  write_env SUPABASE_URL "https://${SUPABASE_PROJECT_REF}.supabase.co"
  open_url "$DASH/project/${SUPABASE_PROJECT_REF}/settings/api-keys"
  step "API Keys : copie la clé publique du client."
  step "Selon le projet : « Publishable key » (sb_publishable_…) ou onglet « Legacy API keys » → « anon public »."
  note "Ne copie jamais la clé secrète / service_role : elle n'a rien à faire ici."
  ask SUPABASE_ANON_KEY "Clé publique (publishable ou anon) :"
  write_env SUPABASE_PROJECT_REF "$SUPABASE_PROJECT_REF"
  write_env SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
fi

# ── 4. Projet Vercel ──────────────────────────────────────────────────────
stage "Vercel : lier le projet existant « planquex » (D-017, renommé par D-036)"
if [[ -n "${VERCEL_URL:-}" ]]; then
  note "Projet déjà enregistré : $VERCEL_PROJECT ($VERCEL_URL) — étape sautée."
else
  warn "On ne crée PAS de nouveau projet Vercel : on réutilise le projet existant « planquex »."
  open_url "https://vercel.com/$VERCEL_TEAM"
  step "Ouvre le projet existant, pas « Add New Project »."
  step "Project Settings → Git : le dépôt lié doit être bureau-des-planques/planquex."
  step "Project Settings → Build and Deployment : Framework preset Vite, Root directory la racine, Build command npm run build, Output directory dist."
  step "Lance un déploiement. Le build passe (src/main.tsx existe) : dist/index.html et dist/sw.js sont produits."
  pause "Projet lié et déployé ? Entrée pour enregistrer les identifiants"
  ask VERCEL_PROJECT "Nom du projet Vercel :"
  step "Domains : relève le domaine de production du projet."
  ask VERCEL_URL "URL de production (sans slash final) :"
  write_env VERCEL_PROJECT "$VERCEL_PROJECT"
  write_env VERCEL_URL "${VERCEL_URL%/}"
fi

# ── 5. Clé SMTP Brevo dédiée ──────────────────────────────────────────────
stage "Brevo : créer la clé SMTP dédiée"
if [[ -n "${BREVO_SMTP_LOGIN:-}" && -n "${BREVO_SENDER_EMAIL:-}" ]]; then
  note "Expéditeur SMTP déjà enregistré ($BREVO_SENDER_EMAIL) — étape sautée. La clé n'étant pas conservée (D-017), l'étape 6 reste à faire dans Supabase."
else
  open_url "https://app.brevo.com/settings/keys/smtp"
  step "Onglet « SMTP » : clique sur « Generate a new SMTP key »."
  step "Nomme-la supabase-planquex (clé dédiée, pas celle de l'ancien jeu)."
  step "Copie la clé affichée : elle ne sera plus jamais montrée."
  ask_secret BREVO_SMTP_KEY "Clé SMTP Brevo :"
  step "Sur la même page, relève le « Login » du relais SMTP (souvent l'adresse du compte)."
  ask BREVO_SMTP_LOGIN "Login SMTP Brevo :"
  open_url "https://app.brevo.com/senders/list"
  step "Vérifie que l'adresse expéditeur du jeu est bien un expéditeur validé."
  ask BREVO_SENDER_EMAIL "Adresse expéditeur :"
  ask BREVO_SENDER_NAME "Nom affiché de l'expéditeur :"
  note "La clé n'est PAS écrite sur disque (D-017) : elle ne sert qu'à l'étape 6, dans Supabase."
  write_env BREVO_SMTP_LOGIN "$BREVO_SMTP_LOGIN"
  write_env BREVO_SENDER_EMAIL "$BREVO_SENDER_EMAIL"
  write_env BREVO_SENDER_NAME "$BREVO_SENDER_NAME"
fi

# ── 6. Auth Supabase : e-mail + SMTP ──────────────────────────────────────
stage "Supabase Auth : activer l'e-mail et brancher Brevo"
open_url "$DASH/project/${SUPABASE_PROJECT_REF}/auth/providers"
step "Email : active le fournisseur."
step "Laisse « Confirm email » activé, comme sur l'ancien projet."
open_url "$DASH/project/${SUPABASE_PROJECT_REF}/auth/smtp"
step "Active « Custom SMTP »."
step "Host : smtp-relay.brevo.com — Port : 587."
step "Username : $BREVO_SMTP_LOGIN — Password : la clé SMTP dédiée (saisie ici seulement)."
step "Sender email : $BREVO_SENDER_EMAIL — Sender name : $BREVO_SENDER_NAME."
step "Enregistre."
note "Brevo : le blocage des IP inconnues doit rester désactivé, sinon erreur 525."
pause "SMTP enregistré ? Entrée pour continuer"

# ── 7. URL de retour ──────────────────────────────────────────────────────
stage "Supabase Auth : Site URL et Redirect URLs"
open_url "$DASH/project/${SUPABASE_PROJECT_REF}/auth/url-configuration"
step "Site URL : $VERCEL_URL"
step "Redirect URLs → Add URL : ${VERCEL_URL}/**"
note "Ajoute aussi http://localhost:5178/** si tu veux tester le serveur Vite en local."
pause "URLs enregistrées ? Entrée pour continuer"

# ── 8. Écriture des valeurs + test réel ───────────────────────────────────
stage "Écrire les valeurs et envoyer un e-mail de test"
write_env SUPABASE_PROJECT_REF "$SUPABASE_PROJECT_REF"
write_env SUPABASE_URL "https://${SUPABASE_PROJECT_REF}.supabase.co"
write_env SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
write_env VERCEL_PROJECT "$VERCEL_PROJECT"
write_env VERCEL_URL "$VERCEL_URL"
note "Fichier : $ENV_FILE (mode 0600). Aucun secret n'y est écrit : la clé SMTP Brevo vit dans la config Custom SMTP de Supabase (D-017)."
chmod 600 "$ENV_FILE" 2>/dev/null || true
open_url "$DASH/project/${SUPABASE_PROJECT_REF}/auth/users"
step "Add user → « Send invitation » vers une adresse que tu consultes."
step "Vérifie que l'e-mail arrive (expéditeur = $BREVO_SENDER_EMAIL, pas Supabase)."
note "Cet utilisateur de test peut être supprimé juste après."
if confirm "E-mail de test reçu ?"; then
  note "SMTP validé en conditions réelles."
else
  warn "SMTP non validé : lis l'erreur dans Auth → Logs et reprends l'étape 6."
fi

# ── 9. Passation ──────────────────────────────────────────────────────────
stage "Passation"
say "Valeurs publiques à reporter dans la réponse du ticket :"
printf '\n    Projet Supabase : %s\n    URL Supabase    : %s\n    Clé publique    : %s\n    Projet Vercel   : %s\n    URL Vercel      : %s\n\n' \
  "$SUPABASE_PROJECT_REF" "https://${SUPABASE_PROJECT_REF}.supabase.co" "$SUPABASE_ANON_KEY" "$VERCEL_PROJECT" "$VERCEL_URL"
say "Secrets : $ENV_FILE (chmod 600). Aucune valeur secrète n'est affichée ici."
note "Le build passe désormais : npm run check, npm test et npm run build sont verts depuis le 19/10/2026."
pause "Entrée pour terminer"

finish
}

run_wizard "$@"; exit
