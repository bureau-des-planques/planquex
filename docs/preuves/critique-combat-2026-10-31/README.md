# Critique du combat — 31/10/2026

Preuves de la passe `/impeccable critique` (lisibilité, jouabilité, fun, expérience) et des cinq
commandes qui l'ont suivie : `clarify`, `typeset`, `bolder`, `delight`, puis la mesure du `layout`.

## Les captures

| Fichier | Ce qu'elle montre | Commande |
|---|---|---|
| `420-sobre.png` | 420 × 900, arrivée, pas-à-pas ouvert : le tutoriel dit le geste, le Stress s'écrit, la bande de score porte `0 — 0 sur 3` | `npm run capturer` |
| `420-detaille.png` | le même écran en `détaillé` (Pressions nommées sur les cartes) | `npm run capturer` |
| `420-pression-tour3.png` | tour 3, Pression jouable : le bouton porte le **Stress appliqué** | `npm run capturer` |
| `360-sobre.png` | 360 × 640, le gabarit le plus serré | `npm run capturer` |
| `1280-pc.png` | 1280 × 800, la console et le journal | `npm run capturer` |

## Ce qui est mesuré, et ce qui ne l'est pas

`npm run capturer` (sept gabarits, 17 captures, exit 0) : **zéro défilement** et **20 px de marge**
sous la barre d'action tenus partout, y compris le pire cas 360 × 640, pas-à-pas terminé avec une
Pression jouable (il n'en restait que 18 px avant que la bande de score ne rende ses 4 px sur écran
court).

Ce que ces captures **ne prouvent pas** : le rendu sur un vrai téléphone, le son (les WAV sont
vérifiés par `scripts/ressources/sons.test.ts` — poids, fondus, aucun son au chargement), et la
lisibilité du nom au plateau, qui reste tronqué (D-167 : la hauteur manque, le trade-off est ouvert).

## Les décisions de la passe

- **D-165** — Stress `x/y` dans les deux densités, Stress appliqué sur la Pression, étape 1 du
  tutoriel à l'impératif, `ⓘ` renommé.
- **D-166** — la bande de score écrite, trois sons de combat générés, la flavour dans la fiche.
- **D-167** — les tailles de D-157 ne bougent pas : l'essai à 104 / 72 / 76 px a été refusé par
  `npm run capturer` (17 à 19 px de marge, jusqu'à 34 px de défilement).
