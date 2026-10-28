# Spec — l'ouverture d'un Arrivage

> Écrite le **28/10/2026** après le prototype de #283, **refondue le même jour** : la première
> version (sept photos fondues l'une dans l'autre, dans un petit dialogue, cartes en vignettes) a
> été jugée « catastrophique » à l'essai, et la demande est devenue un rendu « digne d'un AAA ».
> Elle **n'acte rien** : ce qui engage est déjà daté ailleurs — la forme (**animation, pas vidéo**)
> est tranchée dans **#269**, les sons dans **D-137**, le mouvement réduit dans **D-098**.
> Ce document décrit **ce que le code fait**, avec ses chiffres.

## 1. D'où ça vient

| | |
|---|---|
| Ticket | **#283** — « Ouverture d'un paquet : l'animation » |
| Forme | **animation**, pas vidéo (#269) |
| Recherche | `docs/preuves/ouverture-arrivage-2026-10-28/recherche-outils.md` et `…/recherche-techniques.md` |
| Preuve de rendu | `docs/preuves/ouverture-arrivage-2026-10-28/` — planches de frames de l'écran réel, avec les commandes |

## 2. Ce qui a changé à la refonte, et pourquoi

| Première version | Refonte | Raison |
|---|---|---|
| Dialogue de 420 px | **plein écran** | une ouverture a besoin de sa lumière ; les cartes y gagnent leur taille réelle |
| Sachet **photographié** (7 plaques gflow, ≈ 400 Ko) | sachet **vectoriel** (`Pochette.tsx`, 0 Ko d'image) | les photos étaient rognées en bas, floues de près, et ne s'inclinaient pas ; le vecteur reste net à toute taille et sous toute inclinaison |
| Deux gestes (décoller l'autocollant, puis déchirer) | **un seul** : déchirer le long des pointillés, depuis le bord choisi | le premier geste doublait le second sans rien raconter de plus |
| Déchirure **fondue** entre trois photos | déchirure **au doigt** : la bande et le corps découpent un même tracé dentelé, la bande pivote sur son bout encore attaché | c'était le point ouvert n° 1 de la première spec (« le seul temps qui n'est pas cranté au pixel ») |
| Creux du film en shader WebGL2 | inclinaison 3D + reflet holographique qui suit le doigt | même effet de matière, sans WebGL ni repli à maintenir |
| Cartes posées d'un coup, en rangée, en vignettes | cartes **étalées face cachée**, retournées **une à une, dans l'ordre choisi** ; une rare monte au centre avec une **annonce** ; une carte retournée ouvre sa **fiche** | c'est le moment que le joueur attend ; il se joue une carte à la fois (deuxième passe du 28/10/2026 : « plus de temps pour sortir et révéler », « qu'on clique pour les retourner », « une phrase marrante pour une rare ») |

## 3. Les temps de l'ouverture

### 3.1 Le sachet

| | |
|---|---|
| Arrivée | il tombe dans le faisceau (760 ms) |
| Au doigt | il s'**incline** vers le doigt (± 16° en lacet, ± 12° en tangage, ressort), et le **reflet holographique** suit l'inclinaison |
| Au repos | il se balance doucement, et le balancement **s'éteint en 4 s** : rien ne bouge sans fin (SPEC-COMBAT-UI §6.8) |
| Appui hors de la ligne | il se **presse** (97,5 %), et un éclat parcourt les pointillés pour dire où déchirer |
| Lueur | la lumière de la scène a **la couleur de la meilleure carte du tirage** (`RARITY_META`) : elle filtre par la fente dès la déchirure |

### 3.2 La déchirure

| | |
|---|---|
| Prise | appui à moins de **7,5 %** de la hauteur (26 px au moins) des pointillés |
| Sens | depuis **le bord le plus proche** de l'appui : la moitié droite déchire de droite à gauche |
| Course | **70 %** de la largeur du sachet pour une déchirure complète |
| Suivi | la déchirure suit le doigt **dans les deux sens** ; à rebours, rien ne se déchire |
| Seuil | **0,9** : lâcher avant referme (la bande retombe, ressort de 240 ms), lâcher après ouvre |
| Rendu | la bande pivote jusqu'à 15° sur son bout attaché, un trait de lumière court sur la partie ouverte, des étincelles naissent au front ; une vibration par dixième de course, là où l'appareil la permet |

### 3.3 L'envol — 2 900 ms

| Instant | Ce qui se passe |
|---|---|
| 0 | la bande s'envole (1 s), **éclair** plein écran, secousse, gerbe d'étincelles à la couleur du tirage |
| 300 ms | les cartes, **dos tourné**, montent **lentement par la fente** (1,3 s), en léger éventail : elles sont derrière le corps du sachet, qui les cache sous la ligne |
| 1 500 ms | le sachet tombe et s'efface (1 s) |
| 1 700 ms | les cartes quittent le sachet et **s'étalent** sur le bureau, une à une (140 ms d'écart), posées un peu de travers |
| 2 900 ms | la révélation commence ; la première carte a le focus |

### 3.4 La révélation, au choix du testeur

Les cartes sont étalées **face cachée**, dans la grille qui les rend les plus grandes (deux colonnes
sur un téléphone en hauteur, une rangée sur un écran large : `poseRecap`). Comme dans les grands jeux
de cartes, **le dos d'une carte rare luit de sa couleur** (lueur lente de 1,8 s) : on sait qu'il y a
quelque chose, on choisit quand le voir. Sous le doigt, une carte cachée se soulève.

Le testeur **touche une carte pour la retourner**. La mise en scène croît avec le palier
(`revelation.ts`) :

| Palier | Raretés | Au toucher | Retournée |
|---|---|---|---|
| `simple` | ◆, ◆◆ | se retourne **sur place** (950 ms) | quelques étincelles |
| `rare` | ◆◆◆ | **monte au centre**, les autres s'assombrissent ; 900 ms d'attente | halo, éclat, gerbe, rayons qui s'avivent, **annonce** ; 1,9 s au centre |
| `brillante` | ◆◆◆◆ | monte au centre, **son dos s'allume et tremble** de plus en plus ; 1,4 s | éclair, secousse, reflet holographique, **annonce** ; 2,3 s au centre |
| `secrete` | ★ et au-delà | idem ; 1,9 s | tout cela, plus **une pluie d'étoiles** sur toute la largeur, **annonce** ; 2,9 s au centre |

**L'annonce** est une phrase de la maison, tirée au hasard dans le palier de la carte (`ANNONCES`) :
« Validé en comité ! », « Prime exceptionnelle ! », « Hors grille salariale ! »… — avec, dessous, la
rareté et le nom. Elle est lue par un lecteur d'écran (`role="status"`). Un toucher pendant la tenue
renvoie la carte à sa place. Le badge « **Nouvelle** » apparaît au retournement.

### 3.5 La fiche d'une carte

Une carte **retournée** se touche pour ouvrir sa **fiche** : elle arrive en tournant sur elle-même,
se tient sous le doigt (inclinaison et reflet), et à côté d'elle (écran large) ou en dessous
(téléphone) **tout ce qu'elle porte en toutes lettres** — faction, nature, Seuil, Rotation, rareté,
Talent, chaque Pression avec son coût et son texte entier, Vulnérabilité, flavour (`FicheCarte.tsx`,
`poseFiche`). « Reposer », un toucher sur la carte ou à côté, ou **Échap** la referment — Échap ne
ferme pas l'Arrivage tant qu'une fiche est ouverte.

Toutes retournées, la scène se calme (plus de poussière) et propose **« Ranger dans la
Collection »**.

## 4. Les machines

**La déchirure** (`etats.ts`) — trois phases, un seuil, du TypeScript pur :

```
ferme ──appui sur les pointillés──▶ dechirure ──relâche ≥ 0,9──▶ ouvert
   ▲                                     │
   └──────────relâche < 0,9──────────────┘
```

**La scène** (`SceneOuverture.tsx`) expose son étape dans `data-etape` : `ferme` · `dechirure` ·
`ouverture` · `revelation` · `ouvert` (toutes les cartes retournées). Chaque carte porte
`data-face` (`verso` / `recto`), et pendant sa révélation `data-tension` puis `data-fetee`.

**Invariants gardés par un test qui mord** (AGENTS.md §6) : un appui hors de la ligne ne déchire
rien ; la déchirure suit le doigt dans les deux sens et part du bord le plus proche ; `ouvert` n'est
atteignable que par la déchirure ; un geste annulé (`pointercancel`, `lostpointercapture`) se
traite **exactement** comme un relâchement ; le palier ne redescend jamais quand la rareté monte ;
une rare n'est pas retournée avant la fin de son attente ; l'étalage et la fiche tiennent dans la
scène sans chevauchement.

## 5. Ce qui n'est pas négociable

- **Mouvement réduit** (D-098) : sous `useMouvementReduit()`, la scène s'ouvre **directement sur les
  cartes retournées** — ni sachet, ni particules, ni transition, ni boucle.
- **Accès sans glissement** (les critères WCAG d'accès au pointeur) : **« Ouvrir »** joue la
  déchirure seul, **« Tout afficher »** retourne tout depuis n'importe quelle étape ; à la
  révélation, la première carte prend le focus, **Entrée** ou **Espace** retournent la carte ciblée
  et ouvrent sa fiche, **Tab** passe de l'une à l'autre.
- **Aucune information dans l'animation** : les cinq `CardView` et leurs badges sont **dans le DOM
  dès le premier rendu**, dos tourné ou non.
- **Ses propres bornes d'animation** (D-141) : la scène est **hors** des bornes du combat
  (SPEC-COMBAT-UI §6.8.3, 800 ms et pas de boucle) ; les siennes — boucles **lentes** (1 s au moins,
  jamais un clignotement), 3 s au plus pour une animation qui finit, aucun flou animé — sont gardées
  par `effets-combat.test.ts` (`bornesDeLArrivage`).
- **Pas de texte cuit dans une image** : la pochette est un SVG, son texte est du texte.

## 6. Le son

D-137 n'autorise que **deux** sons dans l'alpha ; celui de l'Arrivage part **au clic** sur « Ouvrir un
Arrivage » (`Home.tsx`), et la refonte n'en ajoute aucun. `etats.ts` expose encore les moments
`contact` et `ouverture` pour #378 (branchement) et #379 (timbres).

## 7. Les preuves

- **jsdom** : `etats.test.ts` (la déchirure), `revelation.test.ts` (paliers, attentes, annonces,
  lueur, tracé, étalage, fiche), `SceneOuverture.test.tsx` (le parcours entier au doigt, au bouton et
  au clavier ; retournement au choix ; annonce ; fiche ; geste annulé ; mouvement réduit).
- **planches de frames** : `docs/preuves/ouverture-arrivage-2026-10-28/planche-v3-*.jpg`, filmées sur
  le serveur de développement par `filmer.cjs`, du même dossier.

## 8. Ce qui reste ouvert

1. **Le son** : voir §6 — rien n'est joué pendant la déchirure ni à la révélation d'une rare.
2. **La mesure sur appareil** : rien n'a été mesuré en images par seconde sur un téléphone milieu de
   gamme. Les particules sont plafonnées à 900 et le canvas à une densité de 2.
3. **Une pochette par Marché** : la pochette est unique ; un futur Marché pourra la décliner
   (couleurs, emblème) sans toucher la scène.

## 9. Où en est le code (28/10/2026)

| Morceau | Fichier | Gardé par |
|---|---|---|
| La déchirure : trois phases, un seuil | `src/animation/ouverture/etats.ts` | `etats.test.ts` |
| Paliers, attentes, annonces, lueur, tracé, étalage, fiche | `src/animation/ouverture/revelation.ts` | `revelation.test.ts` |
| La fiche : tous les textes d'une carte | `src/animation/ouverture/FicheCarte.tsx` | `SceneOuverture.test.tsx` |
| La pochette vectorielle | `src/animation/ouverture/Pochette.tsx` | rendue dans `SceneOuverture.test.tsx` |
| Les particules (canvas 2D) | `src/animation/ouverture/particules.ts` | décoratif ; absent sous mouvement réduit |
| La scène et les gestes | `src/animation/ouverture/SceneOuverture.tsx` | `SceneOuverture.test.tsx` |
| Le style | `src/styles.css`, bloc « L'ouverture d'un Arrivage » | `effets-combat.test.ts` (bornes de D-141) |
