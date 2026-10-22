#!/usr/bin/env bash
#
# Wizard : finir le renommage « planquex » côté tableau de bord — ticket #100.
# Décisions de référence : D-036 (le nom technique est « planquex ») et D-038
# (le site legacy est retiré, le projet Vercel reste en pause).
#
# Complément de scripts/etapes-infra-tcg.sh : celui-ci MONTE l'infra (#10),
# celui-là la FINIT (#100). Les étapes déjà faites par le premier — projet
# Supabase créé, projet Vercel lié — ne sont pas répétées ici.
#
# Depuis le 21/10/2026, le DÉPLOIEMENT n'est plus un geste de tableau de bord :
# la session `planquex-infra` l'a fait par l'API (MCP Vercel, D-053) — le projet
# est sorti de pause et `main` est en production sur planquex.vercel.app. Ce
# wizard ne garde donc que ce qu'aucune API ne fait : le libellé du projet
# Supabase, la suppression du domaine legacy, l'expéditeur Brevo, et les URL de
# retour de Supabase Auth.
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

TOTAL_STAGES=7

# Les valeurs capturées ici vont dans le .env du dépôt : c'est là que vivent
# déjà VERCEL_URL et BREVO_SENDER_*. Le fichier n'est pas suivi (.gitignore:2).
# Aucun secret n'est capturé — la clé SMTP Brevo reste dans Supabase (D-017).
cd "$(dirname "$0")/.." 2>/dev/null || true
ENV_FILE="${ENV_FILE:-$PWD/.env}"

DASH="https://supabase.com/dashboard"
SB_REF="jzlcwnozlzhadatksvgh"
VERCEL_TEAM="chapaxs-projects"
VERCEL_PROJECT="planquex"
# Ce n'est pas une citation : c'est l'identifiant que l'outil agit (le domaine à
# retirer, mesuré au curl avant et après). Le retirer casserait le wizard (#100).
LEGACY_DOMAIN="grevomon.vercel.app"

# http_code URL → le code HTTP, ou 000 si le domaine ne répond pas du tout.
http_code() {
  curl -sI -m 15 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || echo 000
}

banner "Finir le renommage planquex — le tableau de bord (#100)"

# ── 1. L'état de départ, mesuré ───────────────────────────────────────────
stage "L'état de départ, mesuré"
say "Deux domaines, mesurés AVANT qu'on touche à quoi que ce soit :"
LEGACY_CODE=$(http_code "https://$LEGACY_DOMAIN")
NEW_CODE=$(http_code "https://$VERCEL_PROJECT.vercel.app")
printf '\n    %-30s → HTTP %s\n' "$LEGACY_DOMAIN" "$LEGACY_CODE"
printf '    %-30s → HTTP %s\n\n' "$VERCEL_PROJECT.vercel.app" "$NEW_CODE"
note "État visé depuis le 21/10/2026 (D-053) : 200 sur $VERCEL_PROJECT.vercel.app (la production sert main), et le legacy DÉTACHÉ — donc 404, plus 503 comme du temps où le projet était en pause."
if [[ "$LEGACY_CODE" == "200" ]]; then
  note "Le legacy répond 200 : le domaine est encore attaché au projet. Il ne sert plus l'ancien jeu — il sert le NOUVEAU — mais il porte encore le vieux nom. C'est l'étape 3 qui le retire."
elif [[ "$LEGACY_CODE" == "503" ]]; then
  warn "503 : le domaine est détaché mais le projet est en pause. Remets-le en production (Settings → Pause), sinon les testeurs tombent sur 503."
else
  note "Le legacy ne répond plus : le domaine est détaché. L'étape 3 n'a plus d'objet."
fi
if [[ "$NEW_CODE" != "200" ]]; then
  warn "$VERCEL_PROJECT.vercel.app ne répond pas 200 (HTTP $NEW_CODE) : regarde l'état du projet et de son dernier déploiement avant de continuer."
fi
pause "Entrée pour continuer"

# ── 2. Supabase : renommer le projet ──────────────────────────────────────
stage "Supabase : renommer le projet"
say "La référence technique ne change pas : SUPABASE_URL et la clé publique restent valides."
open_url "$DASH/project/$SB_REF/settings/general"
step "Champ « Project name » : remplace le libellé par  planquex"
step "Enregistre."
note "C'est un libellé d'affichage — rien dans le code ni dans .env ne le lit. Le critère de #100 est un critère de tableau de bord, pas de fichier."
pause "Renommé ? Entrée pour continuer"

# ── 3. Vercel : retirer le domaine legacy ─────────────────────────────────
stage "Vercel : retirer le domaine legacy"
warn "Irréversible depuis ce wizard : une fois retiré, le domaine ne revient qu'en l'ajoutant à la main."
say "Le projet $VERCEL_PROJECT est EN PRODUCTION (D-053) : on retire le domaine legacy, on ne met pas le projet en pause."
open_url "https://vercel.com/$VERCEL_TEAM/$VERCEL_PROJECT/settings/domains"
step "Trouve la ligne  $LEGACY_DOMAIN  (elle porte la mention du domaine de production)."
step "Menu « ⋯ » à droite de la ligne →  Remove."
step "Confirme la suppression dans la boîte de dialogue."
if confirm "Le domaine $LEGACY_DOMAIN est retiré du projet ?"; then
  note "Bien. Vercel réattribue alors au projet son domaine par défaut."
else
  warn "Sans ce retrait, le vieux nom reste attaché au projet et le critère de #100 n'est pas satisfait. L'étape 7 le mesurera."
fi

# ── 4. Vercel : vérifier l'URL du projet ──────────────────────────────────
stage "Vercel : vérifier que $VERCEL_PROJECT.vercel.app est bien l'URL de production"
say "Mesure après retrait :"
NEW_CODE=$(http_code "https://$VERCEL_PROJECT.vercel.app")
printf '\n    %-30s → HTTP %s\n\n' "$VERCEL_PROJECT.vercel.app" "$NEW_CODE"
if [[ "$NEW_CODE" == "200" ]]; then
  note "200 : le domaine sert le jeu — c'est l'état visé (D-053)."
elif [[ "$NEW_CODE" == "503" ]]; then
  warn "503 : le domaine appartient au projet, qui est en pause. Réactive-le avant de donner l'URL aux testeurs."
elif [[ "$NEW_CODE" == "404" ]]; then
  warn "404 : le domaine n'est pas encore rattaché. Vercel met parfois quelques minutes — relance ce wizard plus tard."
else
  note "HTTP $NEW_CODE — à interpréter selon ce que le tableau Vercel affiche pour ce domaine."
fi
ask VERCEL_URL "URL de production du projet (sans slash final) :"
write_env VERCEL_URL "${VERCEL_URL%/}"

# ── 5. Brevo : l'expéditeur, et la décision ───────────────────────────────
stage "Brevo : l'expéditeur, et la décision qui va avec"
say "Le NOM est déjà bon (« Bureau des Planqués »). Ce qui reste, c'est l'ADRESSE — et une adresse ne se renomme pas : elle se remplace."
note "Trois voies — (i) garder l'actuelle comme boîte interne : zéro travail, mais elle apparaît dans chaque e-mail envoyé aux joueurs ;"
note "               (ii) une boîte dédiée au jeu : création, vérification du sender ici, reprise du SMTP dans Supabase ;"
note "               (iii) une adresse sur le futur domaine : la plus propre, mais elle dépend de #10."
open_url "https://app.brevo.com/senders/list"
step "Si tu gardes l'adresse actuelle : vérifie qu'elle est bien listée et « validée »."
step "Si tu changes d'adresse :  Add a sender  → saisis la nouvelle → valide-la depuis sa boîte de réception."
ask BREVO_SENDER_EMAIL "Adresse expéditeur :"
ask BREVO_SENDER_NAME "Nom affiché de l'expéditeur :"
write_env BREVO_SENDER_EMAIL "$BREVO_SENDER_EMAIL"
write_env BREVO_SENDER_NAME "$BREVO_SENDER_NAME"
note "Rappel D-017 : la clé SMTP vit dans la config Custom SMTP de Supabase, jamais dans un fichier."
# Ce n'est pas une citation : c'est la valeur que l'outil doit **reconnaître**
# (l'adresse expéditeur d'origine) pour dire si le critère de #100 est satisfait.
if [[ "$BREVO_SENDER_EMAIL" == "grevomon.game@gmail.com" ]]; then
  warn "Adresse inchangée : le critère « expéditeur renommé » de #100 n'est alors satisfait qu'au sens du nom affiché. À écrire noir sur blanc dans le ticket, sinon la case cochée ment."
fi

# ── 6. Supabase Auth : les URL de retour ──────────────────────────────────
stage "Supabase Auth : Site URL et Redirect URLs"
say "Si ces URL pointent encore sur $LEGACY_DOMAIN, elles pointeront sur un domaine retiré — la connexion casse sans message clair."
open_url "$DASH/project/$SB_REF/auth/url-configuration"
step "Site URL : mets  https://$VERCEL_PROJECT.vercel.app"
step "Redirect URLs : remplace toute entrée en $LEGACY_DOMAIN par  https://$VERCEL_PROJECT.vercel.app/**"
note "Ajoute aussi http://localhost:5178/** si tu testes le serveur Vite en local (c'est le port de npm run dev)."
pause "URLs vérifiées ? Entrée pour continuer"

# ── 7. Vérification finale, et ce qui reste ───────────────────────────────
stage "Vérification finale, et ce qui reste"
say "Les deux domaines, après :"
LEGACY_CODE=$(http_code "https://$LEGACY_DOMAIN")
NEW_CODE=$(http_code "https://$VERCEL_PROJECT.vercel.app")
printf '\n    %-30s → HTTP %s\n' "$LEGACY_DOMAIN" "$LEGACY_CODE"
printf '    %-30s → HTTP %s\n\n' "$VERCEL_PROJECT.vercel.app" "$NEW_CODE"
if [[ "$LEGACY_CODE" == "200" ]]; then
  warn "Le legacy répond encore 200 : le domaine est toujours attaché. Reprends l'étape 3."
elif [[ "$LEGACY_CODE" == "503" ]]; then
  warn "Le legacy répond 503 : le domaine est détaché, mais le projet est en pause. Remets-le en production."
else
  note "Le legacy ne répond plus : $LEGACY_DOMAIN est détaché du projet."
fi
if [[ "$NEW_CODE" != "200" ]]; then
  warn "$VERCEL_PROJECT.vercel.app ne répond pas 200 (HTTP $NEW_CODE) : c'est l'URL donnée aux testeurs (docs/ALPHA-TESTEURS.md)."
fi
say "Pour le dossier local, il n'y a plus rien à faire :"
note "Le dossier local porte « planquex » depuis le 21/10/2026 (D-047) — dépôt, dossier et URL portent le même nom."
say "Reste, et ce wizard ne le fait pas : le LIEN GIT du projet Vercel pointe encore sur l'ancien dépôt (D-053)."
note "Settings → Git : connecte Chapax/planquex, sinon un push sur main ne déploie rien, et un push sur la branche dev de l'archive publierait l'ancien jeu."
say "Et le reste de #10 (domaine + Cloudflare, Sentry, R2, Figma) est un autre chantier, « le moment venu »."
pause "Entrée pour terminer"

finish
}

run_wizard "$@"; exit
