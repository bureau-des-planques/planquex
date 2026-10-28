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
| Cartes posées d'un coup, en rangée, en vignettes | **révélation carte par carte**, puis récapitulatif | c'est le moment que le joueur attend ; il se joue une carte à la fois |

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

### 3.3 L'envol — 1 150 ms

| Instant | Ce qui se passe |
|---|---|
| 0 | la bande s'envole, **éclair** plein écran, secousse, gerbe d'étincelles à la couleur du tirage |
| 140 ms | les cartes, **dos tourné**, émergent **par la fente** : elles sont derrière le corps du sachet, qui les cache sous la ligne |
| 600–640 ms | le sachet tombe et s'efface ; les cartes gagnent le centre en pile |
| 1 150 ms | la révélation commence |

### 3.4 La révélation, carte par carte

Les cartes viennent **dans l'ordre du tirage** (`openPackCards` : du plus courant au plus rare) — la
tension monte sans rien truquer. La carte du dessus se retourne après une attente qui **croît avec
son palier** (`revelation.ts`) :

| Palier | Raretés | Attente | Mise en scène |
|---|---|---:|---|
| `simple` | ◆, ◆◆ | 160 ms | elle se retourne |
| `rare` | ◆◆◆ | 420 ms | halo, éclat qui traverse la carte, gerbe, rayons qui s'avivent |
| `brillante` | ◆◆◆◆ | 900 ms | le dos **s'allume et tremble** avant ; éclair, secousse, reflet holographique |
| `secrete` | ★ et au-delà | 1 300 ms | tout cela, plus **une pluie d'étoiles** sur toute la largeur |

Un **toucher** fait passer la carte (ou la retourne tout de suite si elle attend encore) ; un
**glissement** la jette dans son sens (au-delà de 70 px, ou d'un geste vif). Le badge
« **Nouvelle** » apparaît au retournement.

### 3.5 Le récapitulatif

Les cinq cartes, face visible, dans la grille qui les rend **les plus grandes** : deux colonnes sur un
téléphone en hauteur, trois ou une rangée sur un écran large (`poseRecap`). Une carte touchée se
montre **en grand**, les autres s'assombrissent ; touchée de nouveau, elle se repose. Le bouton
**« Ranger dans la Collection »** ferme.

## 4. Les machines

**La déchirure** (`etats.ts`) — trois phases, un seuil, du TypeScript pur :

```
ferme ──appui sur les pointillés──▶ dechirure ──relâche ≥ 0,9──▶ ouvert
   ▲                                     │
   └──────────relâche < 0,9──────────────┘
```

**La scène** (`SceneOuverture.tsx`) expose son étape dans `data-etape` : `ferme` · `dechirure` ·
`ouverture` · `revelation` · `ouvert` (le récapitulatif).

**Invariants gardés par un test qui mord** (AGENTS.md §6) : un appui hors de la ligne ne déchire
rien ; la déchirure suit le doigt dans les deux sens et part du bord le plus proche ; `ouvert` n'est
atteignable que par la déchirure ; un geste annulé (`pointercancel`, `lostpointercapture`) se
traite **exactement** comme un relâchement ; le palier ne redescend jamais quand la rareté monte ;
le récapitulatif tient dans la scène sans chevauchement.

## 5. Ce qui n'est pas négociable

- **Mouvement réduit** (D-098) : sous `useMouvementReduit()`, la scène s'ouvre **directement sur le
  récapitulatif** — ni sachet, ni particules, ni transition.
- **Accès sans glissement** (les critères WCAG d'accès au pointeur) : **« Ouvrir »** joue la
  déchirure seul, **« Tout afficher »** saute au récapitulatif depuis n'importe quelle étape ; à la
  révélation, la scène prend le focus et **Entrée**, **Espace** ou les **flèches** font passer les
  cartes ; au récapitulatif, chaque carte se prend au clavier.
- **Aucune information dans l'animation** : les cinq `CardView` et leurs badges sont **dans le DOM
  dès le premier rendu**, dos tourné ou non.
- **Les bornes de SPEC-COMBAT-UI §6.8**, qui valent pour toute la feuille : aucune animation CSS de
  plus de 800 ms, aucune boucle sans fin, aucun flou animé (`effets-combat.test.ts`). Les rayons du
  fond sont donc **fixes** (ils pivotent par transition aux grands retournements), l'éclat des
  pointillés est **rejoué** sur événement, et le tremblement avant une carte brillante est une seule
  animation de 780 ms.
- **Pas de texte cuit dans une image** : la pochette est un SVG, son texte est du texte.

## 6. Le son

D-137 n'autorise que **deux** sons dans l'alpha ; celui de l'Arrivage part **au clic** sur « Ouvrir un
Arrivage » (`Home.tsx`), et la refonte n'en ajoute aucun. `etats.ts` expose encore les moments
`contact` et `ouverture` pour #378 (branchement) et #379 (timbres).

## 7. Les preuves

- **jsdom** : `etats.test.ts` (la déchirure), `revelation.test.ts` (paliers, lueur, tracé,
  dispositions), `SceneOuverture.test.tsx` (le parcours entier au doigt, au bouton et au clavier ;
  geste annulé ; mouvement réduit).
- **planches de frames** : `docs/preuves/ouverture-arrivage-2026-10-28/planche-v2-*.jpg`, filmées sur
  le serveur de développement par les scripts du même dossier.

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
| Paliers, attente, lueur, tracé, dispositions | `src/animation/ouverture/revelation.ts` | `revelation.test.ts` |
| La pochette vectorielle | `src/animation/ouverture/Pochette.tsx` | rendue dans `SceneOuverture.test.tsx` |
| Les particules (canvas 2D) | `src/animation/ouverture/particules.ts` | décoratif ; absent sous mouvement réduit |
| La scène et les gestes | `src/animation/ouverture/SceneOuverture.tsx` | `SceneOuverture.test.tsx` |
| Le style | `src/styles.css`, bloc « L'ouverture d'un Arrivage » | `effets-combat.test.ts` (bornes) |
