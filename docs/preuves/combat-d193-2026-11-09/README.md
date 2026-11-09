# Combat D-193 — table ronde zoomée, bas réservé à la main (09/11/2026)

Preuves de #774 et des tickets de la vague 2 (#739 à #751). Branche `agent/combat-da`, rien fusionné.

| Fichier | Ce qu'il montre | Origine |
|---|---|---|
| `combat-420x900.png`, `combat-pression-420x900.png` | l'écran de combat à la référence téléphone | `npm run capturer` (exit 0, 09/11/2026) |
| `combat-1280x800.png` | l'écran de bureau après #750 | script ponctuel, navigateur de dev |
| `combat-1920x1080.png` | grand écran | `npm run capturer` |
| `planche-ouverture.png` | #746 : dos visibles puis retournement des Entrants (ralenti ×5) | `scripts/preuves/filmer-animation.mjs` |
| `planche-tap-agrandir-voler.png` | #745 : la carte en grand, puis la copie qui vole | `scripts/preuves/filmer-animation.mjs` |
| `table-zoomee-essai.png` | l'essai de composition avant le pop-up « Fin du tour » | navigateur de dev |

## Mesures (`npm run capturer`, exit 0, 0 échec, 19 captures, `arrivage` ignoré : serveur non configuré)

| Gabarit | Hauteur visible de la main | Plateau | Défilement |
|---|---:|---:|---:|
| 420 × 900 | 56 px | 676 px (746 px pas-à-pas terminé) | 0 |
| 360 × 640 | 56 px | 425 px | 0 |
| 390 × 664 | 56 px | 448 px | 0 |
| 412 × 810 | 56 px | 589 px | 0 |
| 1280 × 800 | 149–150 px (main non rognée) | 597 px | 0 |
| 1920 × 1080 | 198 px | 805 px | 0 |

## Ce que ces preuves ne prouvent pas

- **L'animation de pioche et de pose adverse** : la planche (> 1 Mo, refusée par la garde D-189) n'est pas conservée ; seul le DOM la prouve. **L'évolution n'est pas filmée.**
- **La durée totale de l'ouverture (≤ 2 s)** : la planche ne couvre que ~0,8 s sur 1,76 s ; la version « Mouvement réduit » n'est pas filmée.
- **Le rendu de la main rognée à 56 px** : sur les captures de dev, la barre de l'outil live en masque le bas ; la capture de `npm run capturer` en fait foi.
- **L'écran de bureau** : composition cohérente (table à gauche, main et actions à droite) mais pas finale ; la main est en haut de sa colonne.
