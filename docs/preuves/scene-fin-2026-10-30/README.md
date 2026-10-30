# La scène de fin, filmée — `planche-ralenti-x5.png` (31/10/2026)

Ce dossier prouve **une** chose : à la fin du combat guidé (`/battle?scene=fin`), le tampon
« 3 INTERVENTIONS » **tombe** — il naît grand, translucide et penché, puis se pose. La preuve
est une **planche de frames** (`scripts/preuves/filmer-animation.mjs`), comme l'exige
`AGENTS.md` §6 : ni un style calculé, ni un `snapshot` ne voient une animation de 520 ms.

## La commande exacte

```bash
npm run dev -- --port 5213 &
BASE_URL=http://localhost:5213 node scripts/preuves/filmer-animation.mjs \
  --chemin '/battle?scene=fin' \
  --declencheur 'button:has-text("Redémarrage à froid")' \
  --zone .scene-fin --images 30 --intervalle 40 --colonnes 6 \
  --ralenti 0.2 --sortie captures/film-scene-fin-10
cp captures/film-scene-fin-10/planche.png docs/preuves/scene-fin-2026-10-30/
```

`--declencheur` est le clic qui **ouvre** la scène : il est joué à t0, dans la fenêtre
filmée. La frame 0, légendée « avant le geste », montre la page avant la scène. `--ralenti 0.2`
étire la timeline ×5 (CDP `Animation.setPlaybackRate`, le ralenti des DevTools) : les pixels
sont vrais, le temps est étiré, et la planche **le déclare en tête**. Les légendes sont donc
l'**âge de l'animation**.

## Ce que la planche montre

| Frame | Âge de l'animation | Ce qu'on lit |
|---|---|---|
| « avant le geste » | — | la page, avant la scène |
| f01 → f02 | 46 → 76 ms | le tampon **translucide** et **débordant** : la chute commence |
| **f03** | **107 ms** | le tampon **plein et trop grand** : pic de la chute |
| f04 → f09 | 136 → 260 ms | il rétrécit vers sa taille posée |
| f10 → f14 | 290 → 440 ms | l'atterrissage, inclinaison qui se stabilise |
| f15 → f30 | 470 → 889 ms | la phrase de la Direction arrive, le tampon ne bouge plus |

Trente frames, **trente empreintes distinctes** (`md5sum captures/film-scene-fin-10/f*.png` :
30 valeurs uniques) : la planche n'est pas un cliché répété.

Mesure au pixel, pour qui veut vérifier sans regarder — nombre de pixels dorés par frame
(tampon `rgb(244, 214, 138)`) : 5 926 (avant) → 2 146 → 4 783 → **7 667** → 7 130 → 6 661 →
6 419 → 6 210 → 5 969 → puis la remontée de la réplique (6 149 → 6 796). Le pic à 107 ms est
le tampon encore agrandi et opaque ; la décroissance est le retour à sa taille posée.

## Pourquoi il a fallu `--ralenti`

Une prise `page.screenshot({clip})` coûte ~60 ms, et le clic Playwright ~150 ms : à vitesse
réelle, la première frame tombait à **198 ms d'âge** — opacité déjà à 0,97, échelle 0,99. La
chute (~150 ms) était terminée avant le premier échantillon. Mesuré le 30/10/2026, page réelle,
en échantillonnant `requestAnimationFrame` côté page : `opacity` 0,30 → 1 et échelle 1,52 → 1
entre 0 et 520 ms — l'animation jouait ; c'est l'outil qui ne la voyait pas.

## Ce que la planche ne prouve pas

- Le **ressenti** (une planche est un échantillon, pas un film) ;
- la durée **exacte** : les âges sont des milieux de prise, ×5, donc à ±50 ms d'animation ;
- le cas « mouvement réduit » — il est couvert par le test de `SceneFin`, et la planche
  amortirait tout (le store est amorcé sans « Mouvement réduit », comme toujours ici).
