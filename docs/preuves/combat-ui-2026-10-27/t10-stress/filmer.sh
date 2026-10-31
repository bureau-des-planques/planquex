#!/usr/bin/env bash
# Rejoue la planche du chiffre de Stress (T10, #293). Depuis la racine du dépôt, après `npm run build` :
#   npx vite preview --port 4195 --strictPort &        # le serveur que le script attend
#   BASE_URL=http://localhost:4195 bash docs/preuves/combat-ui-2026-10-27/t10-stress/filmer.sh [reduit]
#
# La graine d'une partie vient de `Date.now()` : l'horloge est figée au 22/10/2026 09:00 UTC, la
# même que `INSTANTS_COMBAT[0]` de `scripts/capturer.mjs`. Six « Fin du tour » plus tard, un Poste
# porte du Stress qui ne vient d'aucune Pression (le Contrôle de fin de tour) : c'est le seul
# cas où le chiffre du DOM est **visible** avec mouvement (pendant une Pression, la scène dessine
# le sien et celui du DOM reste à `opacity: 0`, `.is-scene`).
set -euo pipefail
mode="${1:-anime}"
stockage='{"pasAPasCombatVu":true}'
[ "$mode" = "reduit" ] && stockage='{"pasAPasCombatVu":true,"reducedMotion":true}'

etapes=()
for _ in 1 2 3 4 5 6; do
  etapes+=(--clic '.combat-barre__fin .button.is-a-toi' --pause 400 --attendre '.battle__head:has-text("à toi")' --pause 1000)
done
# Dernière étape : le tour qui fait monter le Stress sans Pression. Le clic est le **déclencheur**
# (joué à t0, 30/10/2026) : on attend le chiffre après lui, dans la fenêtre filmée.
etapes+=(--declencheur '.combat-barre__fin .button.is-a-toi' --attendre '.stress-flottant:not(.is-scene)')

node scripts/filmer-animation.mjs \
  --horloge 2026-10-22T09:00:00Z --stockage "$stockage" "${etapes[@]}" \
  --zone '.board__side:not(.is-direction) .board__poste' --marge 48 \
  --compter .stress-flottant --images 14 --intervalle 1 --colonnes 7 \
  --sortie "captures/film-stress-$mode"
