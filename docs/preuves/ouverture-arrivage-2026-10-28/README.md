# L'ouverture d'un Arrivage — la preuve par planche de frames (#283)

> Lot de captures de **notre** écran d'arrivage, ouvert le **28/10/2026** par le ticket **#283**
> (« Ouverture d'un paquet : l'animation »). Ce ne sont pas des preuves de règle du jeu : c'est
> l'animation qui est **regardée**, comme `AGENTS.md` §6 l'exige — « une animation, par une planche
> de frames, pas par un style calculé ».
>
> La version n'est pas recopiée ici : elle se lit dans `package.json` et s'affiche dans Réglages
> (`docs/VERSIONS.md`).

## La refonte (28/10/2026, après-midi) — `planche-v2-*.jpg`

La première version (plus bas) a été refondue le même jour : plein écran, pochette vectorielle,
déchirure au doigt, révélation carte par carte (`docs/SPEC-OUVERTURE-ARRIVAGE.md` §2). Trois
planches, filmées sur le serveur de développement :

| Planche | Écran | Ce qu'elle montre |
|---|---|---|
| `planche-v2-telephone.jpg` | 390 × 844 | le parcours entier au doigt : arrivée, déchirure à 40 % puis 75 %, envol (les cartes émergent **par la fente**), les cinq retournements, le récapitulatif en deux colonnes, une carte en grand |
| `planche-v2-bureau.jpg` | 1366 × 768 | le même parcours ; le récapitulatif passe en une rangée |
| `planche-v2-secrete.jpg` | 390 × 844 | un tirage avec une **carte étoilée** : lueur dorée du sachet, rappel des pointillés, « Ouvrir » sans geste, tension du dos, éclair, rayons, pluie d'étoiles, reflet holographique |

```bash
npm run dev -- --port 5178
D=docs/preuves/ouverture-arrivage-2026-10-28
node $D/filmer-parcours.cjs /tmp/tel            # 390 × 844
node $D/filmer-parcours.cjs /tmp/bureau 1366 768
node $D/filmer-secrete.cjs /tmp/secrete         # rouvre des Arrivages jusqu'à une ★
python3 $D/planche.py /tmp/tel planche.png 5 0.5
```

Les scripts ne s'arrêtent pas sur une erreur de console : ils l'**impriment** à la fin ; les trois
passes du 28/10/2026 en ont imprimé **zéro** (`erreurs: []`).

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
