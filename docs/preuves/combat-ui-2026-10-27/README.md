# L'écran de combat — l'« avant » de la refonte de la vague 1 (#284, D-116)

Lot du **27/10/2026**, ouvert par le ticket **#284** (tâche **T1** de
`docs/SPEC-COMBAT-UI.md` §8, carte #264). Un lot **ne se remplace pas** : les vagues
suivantes ouvriront leur propre dossier daté, ou un `apres/` à côté de cet `avant/`.
La version de l'application n'est pas recopiée ici : elle se lit dans `package.json`
(`version`, `stage`) et s'affiche par `APP_LABEL` dans Réglages (`docs/VERSIONS.md`).

**#284 ne change aucun pixel.** Il fige l'état **avant** la refonte de la vague 1 et
ne touche ni `src/pages/Battle.tsx`, ni `src/styles.css`, ni `CardView`.

## Ce qu'on entend par « avant » — un écart signalé

L'« avant » de **ce** lot n'est pas celui du 23/10 ni celui de `combat-ui-2026-10-25/avant/` :
la refonte **D-093** (#194, #187 à #204) est déjà livrée, et l'écran de combat **montre
désormais des cartes**. Le point de départ de la vague 1 (D-116) est donc l'écran actuel,
c'est-à-dire **après** D-093 — c'est lui que ce lot photographie et c'est à lui que T3–T12
se compareront.

Conséquence : une phrase de la description de la tâche T1 (« le Poste et le Banc en texte,
la main en boutons ») décrit l'état **d'avant D-093**. Cet état est conservé, daté, dans
`docs/preuves/combat-ui-2026-10-25/avant/420-combat.png` ; il n'est plus l'écran du dépôt.
L'écart est signalé ici plutôt que corrigé en silence (`AGENTS.md` §2) : c'est la **capture
du 27/10** qui est le vrai « avant » de la vague 1.

## Comment elles ont été prises

| Fichier | Commande | Taille |
|---|---|---|
| `avant/420-combat.png` | `npm run build` puis `npm run capturer` (Chromium du cache `ms-playwright`, `vite preview` sur `:4180`) ; copie de `captures/combat.png` | **420 × 900**, fenêtre seule |
| `avant/1280-combat.png` | même `dist/`, script Playwright ponctuel (non commité, comme pour `finition-alpha-2026-10-23/`) : même amorçage du store (`tutorielVu: true`) et même graine figée (`page.clock` → `2026-10-22T09:00Z`), `vite preview` sur `:4181`, fenêtre de 1280 × 800 ; le script **échoue** sur toute erreur de console ou `pageerror` | **1280 × 800**, fenêtre seule |

Les deux captures montrent l'écran **à l'arrivée**, sans qu'on touche à rien : le
pas-à-pas est ouvert, comme pour un testeur qui ouvre le combat. La graine est celle
qu'`INSTANTS_COMBAT[0]` fige dans `scripts/capturer.mjs` — la donner est donc reproductible.

`npm run capturer` sort **exit 0** et ne relève **aucune erreur de console**. Les mesures
de hauteur du passage de combat (D-094 (3)) sont vertes, pas-à-pas ouvert comme terminé :

```
combat · combat · {"fenetre":900,"pasAPasOuvert":true,"limite":830,"defilement":0,
  "mesures":[{"nom":"la main","selecteur":".hand","haut":623,"bas":728},
             {"nom":"la barre d'action du combat","selecteur":".combat-barre","haut":731,"bas":808},
             {"nom":"la piste d'Interventions","selecteur":".piste","haut":370,"bas":387}]}
✔ 14 captures dans captures/ (http://localhost:4180) — dont la première visite et 1 état(s) dédié(s)
```

`defilement` vaut **0** (l'écran tient, D-103) et la marge la plus juste est celle de la
barre d'action : `830 − 808 = 22 px`, au-dessus des **20 px** exigés.

`captures/` n'est pas versionné : ces deux images sont la copie de la preuve, choisie ici.
Les treize autres captures du même passage ne sont pas recopiées : le lot porte sur le
**combat**.

## Ce que les captures montrent (lu à la main)

- **Le plateau montre des cartes** : `CardView` figée au Poste (« Psychologue du travail »,
  « Secouriste ») et sur les trois places du Banc (« Kiné du travail… », « Agent d'ent… »),
  avec illustration, nom, plaque de Seuil et barre de Stress.
- **La main est un éventail** de cartes rognées par son conteneur (« Visite médicale »,
  « Baie de test », « Trousse de secours », « Préventeur »), et non une bande de boutons.
- **Les piles Deck et Rebut** sont comptées dans chaque camp (`DECK 15` / `REBUT 0`).
- **Le score est une piste d'hexagones** entre les deux camps (`LA DIRECTION ◆◆◇`,
  `TOI ◆◇◇`) — plus d'étoiles de rareté à la place des Interventions.
- **La barre d'action collante** porte la ligne de journal et « Fin du tour » ; le reste
  (Journal, Partie à deux, Règles, Abandonner, Nouveau combat) tient derrière un `⋯`.
- **Le pas-à-pas** affiche « 1/5 Le Poste et le Banc » avec « Suivant » et « Plus ».

## À quoi elles serviront (T3–T12)

C'est la référence de comparaison de la vague 1 : `apres/420-combat.png` et
`apres/1280-combat.png` se liront **contre** ces deux images, état pour état (pas-à-pas
ouvert, même graine). T3 (le plateau en cartes compactes), T10 (le retour d'action) et
T12 (les jetons de scène) y prendront leurs captures d'après.

## Ce que les captures ne prouvent pas

Le **ressenti** : la fluidité, le calme des animations, la lisibilité au pouce sur un vrai
téléphone. Une capture est un instant, à une graine figée ; elle ne juge ni le survol, ni le
clavier, ni le tactile.

## `apres/` — T3, le plateau en cartes, sans perdre le pas-à-pas (#286)

`apres/420-combat.png` est prise **le 27/10/2026** par la même commande, sur la même graine et
le même état (pas-à-pas ouvert, à l'arrivée) :

```
npm run build && npm run capturer   →  exit 0
combat · combat · {"fenetre":900,"pasAPasOuvert":true,"limite":830,"defilement":0,
  "mesures":[{"nom":"la main",…,"haut":623,"bas":728},
             {"nom":"la barre d'action du combat",…,"haut":731,"bas":808},
             {"nom":"la piste d'Interventions",…,"haut":370,"bas":387}]}
```

`defilement` reste à **0** : le plateau de T3 ne fait pas défiler l'écran. Chaque camp montre
son **illustration** (le Psychologue du travail pour la Direction, le Secouriste pour toi), et
les trois places du Banc gardent leur nom et leur plaque de Seuil.

**Ce que la capture ne montre pas, et qui est le vrai delta de T3** : la carte du plateau passe
en mode **`calme`** (`CardView`, #285 — gabarit réduit, aucune micro-animation) et devient un
**bouton** nommé par le Planqué, pour qu'un lecteur d'écran trouve le Poste *et* le Banc de la
même carte. Le reste des pixels est déjà celui de D-093 : l'« avant » du 27/10 montrait des
cartes, l'écart est signalé en tête de ce fichier et n'est pas maquillé ici.

## `apres/` — T9, le mode `détaillé` ne casse pas la lecture à 420 px (#292)

**Verdict : le critère tient, sans prendre le repli.** `détaillé` garde ses annotations (le chiffre
du Stress, le nom des Conditions, les types du Deck) ; la barre d'action reste visible sans
défilement, à 420 × 900, dans tous les états mesurés.

| Fichier | État |
|---|---|
| `apres/420-combat-detail.png` | `détaillé`, à l'arrivée, pas-à-pas terminé, graine 22/10 09:00 |
| `apres/420-combat-detail-pression.png` | `détaillé`, au tour d'une Pression jouable (barre sur deux rangées) |
| `apres/420-combat-detail-pire-cas.png` | `détaillé`, **trois Conditions et trois types de café par camp** (posés dans le DOM) |

**Ce que l'arrivée ne montrait pas** : à l'arrivée il n'y a aucune Condition, et `détaillé` y ajoute
seulement `0/60` et les types du Deck — la mesure est identique à celle de `sobre`. Le défaut était
dans le **pire cas** : en colonne, trois noms de Conditions et trois types rallongeaient chaque
fiche de camp de 138 à 188 px. Mesuré avant correction (`npm run capturer`, exit 1) :
`défile de 34 px`, barre d'action à `846 px`, « Fin du tour » à `843 px`, navigation à `830 px`.

**Ce qui change** (`src/styles.css`, `.battle--detaille` seulement — `sobre` ne bouge pas) : la fiche
du camp passe de `11rem` à `15rem` pour que deux noms de Conditions tiennent côte à côte, ses
annotations se rangent **en ligne avec retour**, la pastille d'une Condition se serre de 0,1 rem
en hauteur (le texte garde `--fs-xs`). Les cibles de 44 px et le plancher `--fs-2xs` ne sont pas touchés.

**Ce que la mesure garde** (`npm run capturer`, `mesurerDetaille` et `mesurerAvecUnePression(…, true)`) :
`détaillé` à chaque graine, pas-à-pas ouvert et terminé, avec une Pression jouable, **et** le
pire cas — avec les mêmes contrôles que `sobre` (fenêtre, marge de 20 px de D-094 (3), défilement,
cibles de 44 px). Avec l'ancienne feuille de style, la commande **échoue** (28 manquements, par
exemple `l'écran de combat défile de 34 px (… détaillé, pas-à-pas terminé), pire cas`) ; avec la
nouvelle, elle sort **exit 0**.

**Limite connue, antérieure à T9 et hors périmètre** : en `sobre`, les mêmes trois Conditions sur les
deux camps, au tour à deux rangées de barre et pas-à-pas ouvert, font défiler l'écran de 23 px
(sonde ponctuelle, graine 22/10 14:30 : barre à 835 px). Le cas est quasi impossible (deux camps
à trois Conditions au premier combat) et `détaillé` y fait **mieux** que `sobre` (barre à 806 px) ;
il n'est pas gardé ici.

**Ce que les captures ne prouvent pas** : un Poste qui porterait les trois Conditions *réelles* (la
mesure les pose dans le DOM, le moteur n'est pas touché) ; la lecture au pouce.
