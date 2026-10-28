# L'ouverture d'un Arrivage — la preuve par planche de frames (#283)

> Lot de captures de **notre** écran d'arrivage, ouvert le **28/10/2026** par le ticket **#283**
> (« Ouverture d'un paquet : l'animation »). Ce ne sont pas des preuves de règle du jeu : c'est
> l'animation qui est **regardée**, comme `AGENTS.md` §6 l'exige — « une animation, par une planche
> de frames, pas par un style calculé ».
>
> La version n'est pas recopiée ici : elle se lit dans `package.json` et s'affiche dans Réglages
> (`docs/VERSIONS.md`).

## La refonte (28/10/2026) — `planche-v3-*.jpg`

La première version (plus bas) a été refondue le même jour, en deux passes : plein écran, pochette
vectorielle, déchirure au doigt ; puis cartes étalées **face cachée** et retournées au choix, annonce
des rares, fiche d'une carte (`docs/SPEC-OUVERTURE-ARRIVAGE.md` §2-3). Deux planches, filmées sur le
serveur de développement :

| Planche | Écran | Ce qu'elle montre |
|---|---|---|
| `planche-v3-telephone.jpg` | 390 × 844 | un tirage avec une **carte étoilée** : sachet, déchirure, envol (les cartes montent par la fente puis s'étalent), dos des rares qui luisent, trois simples retournées sur place, la ◆◆◆ au centre (tension, éclat, annonce), l'étoile (tension, éclair, pluie d'étoiles, annonce), toutes retournées, puis la **fiche** d'une carte |
| `planche-v3-bureau.jpg` | 1366 × 768 | le même parcours ; l'étalage est une rangée, la fiche s'ouvre **à côté** de la carte |

```bash
npm run dev -- --port 5178
D=docs/preuves/ouverture-arrivage-2026-10-28
node $D/filmer.cjs /tmp/tel 390 844 --secrete   # rouvre des Arrivages jusqu'à une ★
node $D/filmer.cjs /tmp/bureau 1366 768
python3 $D/planche.py /tmp/tel planche.png 6 0.42
```

Le script ne s'arrête pas sur une erreur de console : il l'**imprime** à la fin ; les deux passes du
28/10/2026 en ont imprimé **zéro** (`erreurs: []`).


## Le retournement, filmé par l'outil du dépôt (28/10/2026) — `planche-retournement-2026-10-28.png`

Les planches `v3` viennent d'un script **du dossier de preuve**. Celle-ci vient de
`scripts/filmer-animation.mjs`, l'outil que `AGENTS.md` §6 nomme : le retournement d'une carte
est rejoué par la commande standard, sans code dédié. Seize frames, 60 ms d'écart, la zone des
cartes ; la première carte passe du dos au recto, **aucune image ne montre de texte en miroir**
et la carte ne disparaît à aucun instant — c'est ce que trois défauts successifs du 28/10
avaient cassé sans témoin.

```bash
npm run build && npx vite preview --port 4181 --strictPort &
BASE_URL=http://localhost:4181 node scripts/filmer-animation.mjs \
  --chemin / \
  --clic '.hero__ouvrir' --attendre '.ouverture' \
  --clic '[data-ouvrir]' --attendre '.ouverture[data-etape="revelation"]' --pause 600 \
  --clic '.ouverture__carte' --zone '.ouverture__cartes' \
  --images 16 --intervalle 60 --colonnes 4
```

La planche sort dans `captures/film/planche.png` ; celle du dossier est une copie datée.

## La première version — `planche-frames.png`

## Ce que la planche montre

`planche-frames.png`, produite sur l'écran réel (420 × 900), dans l'ordre :

| Case | Ce qui se passe |
|---|---|
| **geste 1 → 4** | l'**autocollant** se soulève d'un coin, s'enroule, puis **sort du cadre** — ce sont des photos tirées par gflow, pas un dessin |
| **geste 3 → 4** | la **déchirure** avance le long des pointillés, en suivant le doigt |
| **1 ms → 417 ms** | le sachet s'ouvre, la bande supérieure se tord, la lueur dorée sort |
| **837 ms → 2052 ms** | les **cinq cartes du tirage** montent de l'intérieur, puis se posent en rangée sous le sachet |

Le titre du dialogue dit **« Arrivage : 5 cartes · 2 nouvelles »** : il compte les cartes que le
testeur n'avait pas, au lieu d'annoncer « cinq nouvelles cartes » quoi qu'il arrive.

## La commande exacte

```bash
# serveur de développement, port 5200 pour ne pas gêner un autre onglet
npm run dev -- --port 5200

BASE_URL=http://localhost:5200 node scripts/filmer-animation.mjs \
  --chemin / \
  --clic 'button.button--gold' \
  --attendre '.ouverture__zone' \
  --pause 400 \
  --glisser '.ouverture__zone:0.5,0.16>0.5,-0.12' --pendant 2 \
  --pause 400 \
  --glisser '.ouverture__zone:0.04,0.075>0.78,0.075' --pendant 2 \
  --pause 500 \
  --zone '.ouverture' --images 6 --intervalle 300 --colonnes 6 \
  --sortie docs/preuves/ouverture-arrivage-2026-10-28/prise
```

`--glisser 'sélecteur:x0,y0>x1,y1'` et `--pendant n` ont été **ajoutés pour ce ticket** : l'outil
ne savait que cliquer, et une planche pilotée au doigt s'indexe sur la **progression** du geste, pas
sur le temps. Les coordonnées sont des **fractions de la boîte**, jamais des pixels absolus.

## Ce que cette planche ne prouve pas

- **Pas de mesure d'images par seconde.** La prise tourne dans Chromium sur le poste, pas sur un
  téléphone milieu de gamme. Le creux est un shader WebGL2 : sa tenue sur iPhone n'est **pas**
  mesurée ici, et aucune capture ne peut le dire.
- **Pas de son.** #283 n'en branche aucun ; le réglage et les timbres sont #378 et #379.
- **Pas de repli sans WebGL** sur cette planche : il existe dans le code (une ombre en dégradé),
  mais il se voit en désactivant WebGL, pas sur cette prise.
- **Pas de lecteur d'écran** : la planche ne dit rien de l'ordre de lecture, même si les cartes et
  le badge sont dans le DOM dès le premier rendu.

## Voisinage

- `recherche-outils.md` — le comparatif des outils d'animation (CSS, Motion, WebGL, Pixi, GSAP,
  Lottie/Rive…), avec les poids et les licences.
- `recherche-techniques.md` — ce qui tient réellement sur iOS et Android : filtres SVG, `clip-path`,
  3D, gestes, audio, et ce qui est **non mesuré**.

Les deux notes ont été écrites par des agents de recherche le 28/10/2026, **sans shell** : elles
disent elles-mêmes ce qu'elles n'ont pas pu vérifier. Elles sont rangées ici comme **sources**, pas
comme verdicts.
