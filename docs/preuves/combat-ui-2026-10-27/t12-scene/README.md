# T12 — les jetons de scène (#295) : ce que la capture prouve

Lot du **27/10/2026**, tâche **T12** de `docs/SPEC-COMBAT-UI.md` §8 (§6.9). Aucun pixel ne change :
les jetons `--scene-*` existent depuis #190 (bloc `.battle` de `src/styles.css`), T12 les **garde**
(`src/styles-scene.test.ts`) et recopie les paires de contraste dans `DESIGN.md` §1.5.

## Une seule source de lumière — mesuré

`420-combat.png` (ici) est la copie de `captures/combat.png` produite par `npm run build` puis
`npm run capturer` (420 × 900, la même graine que `avant/`). Moyenne de 10 × 10 px, luminance
`0,2126 R + 0,7152 G + 0,0722 B` :

| Point | Pixel | Luminance |
|---|---|---:|
| centre, entre les deux Postes (210, 350) | `#204b67` (≈ `--scene-felt-lit` `#214d69`) | **67,9** |
| coin haut-gauche de la table (18, 185) | `#1a1e23` | 29,5 |
| coin haut-droit (402, 185) | `#1a1e21` | 29,4 |
| coin bas-gauche (18, 565) | `#223437` | 48,4 |
| coin bas-droit (402, 565) | `#171b1e` | 26,4 |

Les quatre coins sont plus sombres que le centre (**39 % à 71 %** de sa luminance). Sur
`apres/420-combat.png` (T3, même écran) : centre 82,0 ; coins 28,7 à 32,6 (35 % à 40 %). Le coin
bas-gauche de la capture ci-contre est le moins sombre (48,4) : **non expliqué ici**.

**Ce que ça ne prouve pas** : la mesure est faite sur deux captures émulées, pas sur un appareil.
