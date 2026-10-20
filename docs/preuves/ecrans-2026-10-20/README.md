# Preuves d'écran — 20/10/2026

Captures des **cinq écrans** du prototype, produites **après** les fusions du
20/10/2026 (`main` = `5f49bb0`) : #99, #98, #101, #96, #86, #87, **#88/#89/#90**
(le café typé) et #93 (l'IA de niveau 2).

## Ce qui a été lancé, et ce que ça prouve

```bash
npm run build      # tsc -b && vite build  → dist/index.html + dist/sw.js
npm run capturer   # playwright-core, une image par route, exit 0
npm run detect:ui  # npx impeccable detect src/ → aucun refus, 80 fichiers
```

`scripts/capturer.mjs` **échoue** si une page lève une erreur de console ou une
`pageerror` : la capture ne vaut donc que pour une page qui n'a rien cassé
(`AGENTS.md` §6). Ici : **exit 0 sur les trois commandes**, 5 images produites,
**aucune erreur de console**.

## Ce que les images montrent

- `combat.png` — l'écran de combat **après #88** : la Machine « ⌾ » et le message
  **« Hors de portée du café : Massage cardiaque (SSE). »** — c'est le paiement
  **par symbole** qui nomme les types manquants (avant #88, la carte mentait :
  n'importe quel café payait n'importe quel coût). On y voit aussi les Conditions
  dans un dialogue shadcn (D-035) et la bannière « IA de niveau 1 » — le gain
  mesuré du niveau 2 n'est **pas** encore dans le produit (#93, décision ouverte).
- `parc.png` — le Parc : les cartes illustrées (8 signature + leurs variantes) et
  les ~276 autres **en aplat de faction**, sans aucun fond perdu (preuve de #96,
  vérifiée par comptage : 276 aplat + 15 illustration, 0 perdu).
- `accueil.png`, `reglages.png` — les deux écrans sans carte.

## Ce qui n'est pas versionné ici

`captures/chariot.png` (l'écran du Chariot, ≈ 6 Mo : 168 cartes sont mises en
page) n'est **pas** copié ici pour ne pas alourdir le dépôt. Il est produit par
la **même** commande :

```bash
npm run build && npm run capturer   # écrits dans captures/, ignoré par git
```

Le dossier `captures/` reste ignoré par git (`.gitignore`) : ces images-ci sont la
**preuve datée**, `captures/` est le brouillon reproductible.

## Limites

- Le rendu est vérifié à **360 × 800** (le gabarit mobile du prototype) ; aucun
  écran n'a été inspecté en desktop dans cette passe.
- Aucun test de **contraste** n'a été refait ici (`DESIGN.md` §8 le dit assumé).
- Les écrans ne montrent pas les cartes `3S`/`COU` de #87 : elles existent au
  catalogue (`npm run status` → `"3S": 4, "COU": 3`) mais ne sont tirables dans
  aucun Arrivage — c'est le ticket #105.