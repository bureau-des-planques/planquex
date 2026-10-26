# Preuves d'écran — 26/10/2026 — les anti-patterns de #208

Lot **avant/après** des écrans traités par le ticket #208 (« 54 anti-patterns préexistants,
et deux écrans que le détecteur ne lit pas »). Ce ne sont **pas** des preuves de règle : ce
sont les captures de **notre** application, à comparer au compte du détecteur.

## Ce qui a été lancé

```bash
npm run build         # dist/index.html + dist/sw.js
npm run capturer      # 420 × 900, fenêtre seule, amorcé (tutorielVu) — écrit captures/
npm run detect:ui:page # sert dist/ sur 4179 et passe impeccable sur les cinq écrans
```

**`npm run capturer` sort en `1`** dans cet arbre, et ce n'est pas de ce lot : la garde de
hauteur de `/battle` refuse la **barre d'action du combat** (bas à 836, 910 et 912 px pour
une limite de 830 px à 420 × 900), sur les cinq graines de `INSTANTS_COMBAT`. Le défaut est
**préexistant** — il se reproduit sur l'arbre d'intégration sans aucune de mes modifications
(`git diff integration/alpha-2026-10-26 -- src/styles.css` ne touche pas `.combat-barre`) —
et il est signalé au ticket plutôt que masqué. Les images de ce lot ont été produites **avant**
ce refus : `capturer` écrit chaque page au fil de l'eau, la garde tombe à la fin.

`npm run detect:ui:page` : **0 anti-pattern sur les cinq écrans** après la passe (voir le
README racine de `docs/preuves/` et `scripts/detect-ui-pages.mjs`).

## Ce que les images montrent

| Fichier | Ce que ça nous apprend |
|---|---|
| `collection-avant.png` / `collection-apres.png` | 420 × 900, même état (300 cartes, aucune filtre). **Avant** : les cartes **non possédées** sont à 40 % d'opacité — « MÉDECIN DU TRAVAIL » et « PRÉVENTEUR » se devinent plus qu'ils ne se lisent, et le détecteur les compte à 2,1–3,5:1. **Après** : le nom se lit, le sigle de faction est éclairci, le badge COMEX passe en or plein ; la carte reste **grisée**, son illustration et sa barre restent pâles, la pastille « NON POSSÉDÉE » ne bouge pas. |
| `couronne-avant.png` / `couronne-apres.png` | 420 × 900, défilement sur la **Couronne** « DRH » (`COU`, rareté ♛). Avant : son anneau est un **dégradé** de violet. Après : le même violet, **plat** — DESIGN.md §3 dit « filet violet », et un dégradé violet est un tell d'UI générée (`ai-color-palette`). |
| `reglages-large-avant.png` / `reglages-large-apres.png` | **1280 × 800** (la taille où le détecteur mesure), défilement sur « Traces de combat ». Avant : le paragraphe fait 1009 px de large, ~154 caractères par ligne, 2 lignes. Après : `max-w-[64ch]`, 568 px, 4 lignes — sous la limite de 80 caractères. La capture à 420 px ne montre **rien** : à cette largeur le panneau est déjà plus étroit que 64ch. |
| `deck.png` | 420 × 900. **Aucun pixel ne change** : les six `ai-color-palette` de `/deck` sont des **dégradés de faction sous une illustration** (deuxième couche du fond) — le détecteur les lit dans le style calculé, l'œil non. Le changement est réel (aplat au lieu du dégradé) mais invisible ici ; il se voit sur les cartes sans illustration, et il n'y en a pas dans les 20 cartes de ce Deck. |

## Limites, dites franchement

- Les captures sont prises **sur `dist/`**, donc après `npm run build`.
- `captures/` reste ignoré par git : ces images-ci sont la preuve datée, `captures/` est le
  brouillon reproductible.
- Le compte du détecteur est celui du **26/10/2026** ; un anti-pattern est un avis d'outil,
  pas une vérité : `BASELINE` à zéro veut dire « plus rien à signaler », pas « écran parfait ».
