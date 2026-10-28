# DESIGN.md — Bureau des Planqués

> **Système de design du projet** : palette, gabarit de carte, cadre de rareté, badges,
> mascotte et planches de style. Ce fichier est le **`DESIGN.md`** attendu à la racine par
> les agents de design (`create-design-md`) ; il **remplace** l'ancien
> `docs/DIRECTION-ARTISTIQUE.md`, fusionné dedans le 20/10/2026 pour n'avoir qu'une source.
>
> État : **première passe** (20/10/2026). Elle fixe les jetons de couleur, le gabarit de
> carte et les planches de style ; la **curation carte par carte** viendra ensuite.
> Ce document ne crée **aucune règle de jeu** : les règles vivent dans `docs/JEU.md` §4 et
> `docs/DECISIONS.md`. Il décrit l'apparence, pas la mécanique.
>
> Il suit `docs/PROPOSITION.md` §4.6 : direction « **corporate dark premium** »,
> palette **bleu nuit / or**, rendu **semi-réaliste**, option **A (IA + curation)**.

---

## 1. Palette et rôles

Les jetons vivent dans `src/styles.css`, bloc `:root`. Une couleur qui change se change
**là**, une seule fois. Les noms restent clairs et stables.

### 1.1 Fonds et lignes — le bleu nuit

| Jeton | Hex | Rôle |
|---|---|---|
| `--bg` | `#0b1220` | fond de l'application (= `theme_color` du manifeste) |
| `--bg-deep` | `#070c16` | creux (sol, fond des icônes) |
| `--bg-sunken` | `#0e1626` | surfaces en retrait (barres, champs, journal) |
| `--bg-raised` | `#131c2e` | surfaces en avant (panneaux, cartes) |
| `--line` | `#243049` | filets et bordures |
| `--line-strong` | `#34456a` | bordures d'un élément actif ou mis en avant |

### 1.2 Textes

| Jeton | Hex | Rôle |
|---|---|---|
| `--text` | `#e8eef8` | texte principal |
| `--text-muted` | `#9aa9c2` | texte secondaire (libellés, légendes) |
| `--text-dim` | `#7e8fb0` | texte tertiaire (identifiants, notes) |

### 1.3 Accents — bleu primaire, or secondaire

| Jeton | Hex | Rôle |
|---|---|---|
| `--accent` | `#4f8ef7` | **primaire** : bleu de l'interface, actions, sélection. **Remplacé en ligne par la couleur de la faction** dans une carte (`CardView`) et dans la fiche (`CardDetail`) |
| `--accent-deep` | `#356fe0` | déclinaison sombre du primaire (documentaire) |
| `--gold` | `#e6b64c` | **secondaire premium** : Café, COMEX, filets d'apparat |
| `--gold-soft` | `#f4d68a` | or clair : chiffres du Seuil, monogramme |
| `--gold-deep` | `#a67c22` | or sombre : ombre du dégradé or, cadres |

### 1.4 États

| Jeton | Hex | Rôle |
|---|---|---|
| `--ok` | `#46b98a` | validation (Deck valide, fin gagnée) |
| `--warn` | `#e0a33e` | avertissement (deck de test, fin perdue) |
| `--danger` | `#e06a4e` | erreur |

### 1.5 Contraste (Vérifié le 20/10/2026 ; pastilles de Condition et surfaces de scène ajoutées le 25/10/2026, D-093, #195 ; écart du centre éclairé clos le 25/10/2026, #198 ; plancher typographique vérifié à l'écran le 25/10/2026, #196 ; pastille de café, étiquettes et plancher de `--fs-2xs` rejoués le 27/10/2026, #290 ; paires de la direction de scène recalculées le 27/10/2026, #295 ; filet de danger relevé et mesuré sur la page le 27/10/2026, #323)

Ratios WCAG calculés sur les paires réelles du thème (formule de luminance relative
WCAG 2.1). Seuil : **AA = 4.5:1** pour le texte courant.

**Ce qui fait foi, et comment on le vérifie.** Ces ratios sont **calculés sur les jetons de
`src/styles.css`** et **gardés** par `src/styles-scene.test.ts` : changer un jeton de scène sans
changer la ligne d'ici fait échouer le test. Les chiffres du même genre recopiés dans
`docs/DIRECTION-SCENE-COMBAT.md` §7 sont la **proposition de la direction** du 25/10/2026, pas une
mesure : quand les deux se contredisent, **ce tableau-ci l'emporte**.

**Le critère « en navigateur » de #290** (T7) : `npm run detect:ui:page` **est** le
`impeccable detect <url>` demandé — il sert `dist/` et passe le détecteur sur chacun des
**treize** écrans servis, un par un (`scripts/detect-ui-pages.mjs`, `docs/COMMANDES.md`). Le
critère est donc tenu par cette commande, pas par une inspection à la main.

| Paire | Ratio | Verdict |
|---|---:|---|
| `--text` sur `--bg` | 16.06 | AA |
| `--text` sur `--bg-raised` | 14.61 | AA |
| `--text-muted` sur `--bg` | 7.87 | AA |
| `--text-muted` sur `--bg-raised` | 7.16 | AA |
| `--text-dim` sur `--bg-raised` | 5.22 | AA |
| `--gold` sur `--bg` | 9.95 | AA |
| `--gold-soft` sur `--bg-raised` | 12.03 | AA |
| `--accent` sur `--bg-raised` | 5.31 | AA |
| **Sigle de faction** : `--accent` éclairci à 65 % de blanc, sur la face teintée (accent à 9 % sur `--bg-raised`) | **5,61 à 8,56** | AA — calculé sur les dix `FACTION_META.color` (#208) ; la couleur **pure** tombait entre **2,66 et 6,14**, donc sous AA pour huit factions sur dix, et c'est elle qui est corrigée |
| Texte COMEX (`#1c1304`) sur `--gold` | 9.75 | AA — vrai depuis #208 : le badge est un **aplat** d'or, plus un dégradé (le dégradé mesurait 3,6:1) |
| Texte blanc sur le **haut** du bouton primaire (`--accent` à 80 % + `#04080f`) | 4.65 | AA |
| Texte `#1c1304` sur le bouton or | 9.75 | AA |
| **Pastille Surcharge** : `#d9b3ec` sur teinte 22 % de `#9b59b6`, au-dessus de `--bg-sunken` | 7.95 | AAA |
| **Pastille Épuisement** : `#f0b492` sur teinte 22 % de `#e0783e`, au-dessus de `--bg-sunken` | 7.36 | AAA |
| **Pastille Sieste** : `#c3cede` sur teinte 22 % de `#788caa`, au-dessus de `--bg-sunken` | 8.34 | AAA |
| **Pastille Immobilisation** : `#a8d3ef` sur teinte 22 % de `#5aaadc`, au-dessus de `--bg-sunken` | 7.76 | AAA |
| **Pastille Dérive** : `#e8cd93` sur teinte 22 % de `#c8a050`, au-dessus de `--bg-sunken` | 7.99 | AAA |
| Encre `#241a0c` (`--scene-ink-parch`) sur parchemin `--scene-parch` (étiquette des piles) | 5.43 | AA |
| Crème `--scene-chalk` sur encre `--scene-ink-parch` (compte des piles) | 13.87 | AAA |
| Encre `#0b1220` sur vert `--scene-go` (« Fin du tour », état « à toi ») | 8.75 | AAA |
| Encre `#0b1220` sur néon `--scene-neon` (repli de la direction, non appliqué en CSS) | 10.78 | AAA |
| `--text` sur feutre `--scene-felt` | 14.11 | AAA |
| `--text` sur feutre éclairci `--scene-felt-lit` (centre de la table) | 7.73 | AAA |
| `--text` sur feutre vignetté `--scene-felt-deep` | 15.83 | AAA |
| `--text` sur carte de scène `--scene-card` | 13.73 | AAA |
| `--text-muted` sur feutre `--scene-felt` | 6.91 | AA |
| `--text-muted` sur carte de scène `--scene-card` | 6.73 | AA |
| **`--text-muted` sur feutre éclairci `--scene-felt-lit`** | **3.79** | **interdit sur la table** (#198, voie 1) : la paire reste insuffisante, donc aucun texte atténué ne se pose sur le centre éclairé — `.board .muted` et `.piste__nom` passent en `--text` (7.73, ligne ci-dessus) |
| `--accent` (pastilles de café) sur feutre `--scene-felt` | 5.12 | AA |
| `--gold` sur feutre `--scene-felt` | 8.74 | AAA |
| `--scene-danger` sur feutre (filet d'état, non-texte) | 6.55 | **filet seulement** : 3:1 ✓, texte ✗ |
| **Les paires de la direction (T12, #295, 27/10/2026)** — recalculées sur les jetons de la feuille, pas recopiées de `docs/DIRECTION-SCENE-COMBAT.md` §7 | | |
| **Faute AA n° 1 de la vidéo** : crème `#efe0c2` sur parchemin `--scene-parch` | **2.41** | **✗ interdit** — inversée : encre `--scene-ink-parch` (5.43, ligne plus haut). Le jeton `--scene-chalk` sur le même parchemin tombe aussi à **2.55** ✗ : il ne se pose **que** sur l'encre (13.87) |
| **Faute AA n° 2 de la vidéo** : blanc `#fff` sur vert `--scene-go` | **2.14** | **✗ interdit** — inversée : encre `#0b1220` (8.75, ligne plus haut). Le blanc `#f4feff` y fait 2.09 |
| Encre `#3a2a18` (celle de la direction) sur parchemin `--scene-parch` | **4.38** | **✗** — la direction annonçait 5,95 : c'est faux, d'où `--scene-ink-parch` (#190) |
| Blanc `#f4feff` sur la pilule cyan `#2d556a` (bannière de la direction) | 7.81 | AAA — la direction annonçait 8,02 ; la bannière n'est pas livrée |
| `--scene-neon` sur feutre `--scene-felt` / sur le centre éclairé `--scene-felt-lit` / sur carte `--scene-card` | 9.47 / 5.19 / 9.22 | AAA / AA / AAA — même en texte, mais le néon est un filet |
| `--scene-neon-core` sur `--scene-felt` / sur `--scene-felt-lit` | 13.24 / 7.26 | AAA |
| `--scene-gold-hot` (le chiffre de Stress) sur `--scene-felt` / sur `--scene-felt-lit` | 12.54 / 6.87 | AAA |
| Or `#d8b96a` sur feutre / or profond `#8a6a34` sur feutre | 8.67 / 3.28 | AAA / 3:1 — l'or profond n'est **ni** texte **ni** livré (la direction le réservait aux filets) |
| Parchemin `--scene-parch` sur feutre (contour de la pile) | 5.23 | AA non-texte ✓ |
| `--scene-go` sur feutre / sur le centre éclairé | 7.68 / 4.21 | AAA / AA non-texte ✓ |
| `--scene-danger` sur le vignetté `--scene-felt-deep` / **sur le centre éclairé `--scene-felt-lit`** | 7.35 / **3.59** | 3:1 ✓ **dans les deux cas** (#323) : le filet danger du camp de la Direction est une ombre intérieure de 2 px sur le **bord gauche** de la zone. **Mesuré sur la page** le 27/10/2026 (420 × 900, capture lue au pixel près au bord du camp) : le jeton `#e0563f` y rendait `#a63f2e` sous la vignette de la table pour un feutre `#121f2b`, soit **2,80:1** — sous 3:1 malgré le « calcul géométrique » de #295 (3,94, jamais vérifié). Le jeton est relevé à `#ff7f3f` : **3,18:1 au pire** (le coin le plus vignetté) et **3,83 à 3,98:1** sur le reste du filet |
| Filet `--scene-danger` de « Fin du tour » (tour adverse) contre la barre d'action (dégradé de `--bg-raised` à `--bg-sunken`) | 6.78 / 7.20 | 3:1 non-texte ✓ ; contre son **propre remplissage** `--scene-steel-deep` il vaut **3.03** (#323 : 2,02 avec l'ancien jeton, donc sous 3:1) : le **libellé** (blanc sur `--scene-steel-deep` : **7.61**, AAA) continue de porter l'état au premier chef, le filet le souligne désormais au-dessus du seuil |
| Pilule danger `#5f1a16` de la direction sur feutre | 1.29 | **✗ non livrée** : « Fin du tour » à la Direction prend `--scene-steel-deep` + filet danger (ligne précédente). Si la pilule revient, le filet est **obligé** |
| `--text` `#e8eef8` (l'encre de la scène) vs l'encre `#eef4fb` de la direction, sur feutre | 14.11 / 14.85 | AAA — la scène ne crée **pas** d'encre : elle prend `--text` |
| **Pastille de café** (#290) : la couleur de faction contre son **liseré sombre** `--bg-deep` — les dix `FACTION_META.color` | **3,27 à 8,09** | 3:1 non-texte ✓ — le pire est la Direction (`#5b6472`, 3,27) ; le meilleur Amélioration continue (8,09) |
| Pastille de café : anneau `--text` contre le liseré `--bg-deep` | 16.79 | AAA |
| Pastille de café : anneau `--text` sur les trois feutres (`--scene-felt-deep` 15.83, `--scene-felt` 14.11, `--scene-felt-lit` 7.73) | **7,73 à 15,83** | 3:1 non-texte ✓ — c'est l'anneau, non la teinte, qui fait exister la pastille sur la table |
| Pastille **vide** ou incolore : bord pointillé `--text` sur `--scene-felt-lit` | 7.73 | 3:1 non-texte ✓ (avant : `--text-dim`, **2,77** ✗) |
| **Avant #290** : la couleur nue de la Direction sur `--scene-felt` / `--scene-felt-lit` | 2.75 / 1.51 | **✗ sous 3:1** : c'est la cause de « les couleurs du café ne se voient pas » (vrac du 27/10) ; corrigé par l'anneau ci-dessus |
| Pastille de café dans le bouton primaire : liseré `--bg-deep` sur `--accent` | 6.10 | 3:1 non-texte ✓ (l'anneau crème y tombe à 2,75 : il est **décoratif**, c'est le liseré qui découpe la pastille) |
| Étiquette « SEUIL » : `--text` sur la plaque `rgb(7 12 22 / 72 %)` posée sur une illustration **blanche** (pire cas, fond rendu `#4c5057`) | 6.93 | AA — avant : `--text-muted`, **3,40** ✗ au pire cas |
| Chiffre du Seuil : `--gold-soft` sur la même plaque, pire cas | 5.71 | AA |
| Étiquette « Jouable » de la main : `--gold-soft` sur teinte or 18 % de `--bg-raised` / de `--scene-card` | 8.32 / 7.72 | AAA |

Méthode : luminance relative et ratio de la formule WCAG 2.1 calculés sur les valeurs hexadécimales
de `src/styles.css` (bloc `.battle`, jetons `--scene-*` de #190) et de `:root` ; pastilles :
la teinte à 22 % est composée sur `#0e1626` (`--bg-sunken`) avant le calcul. Les ratios ont été
calculés par un script jeté après usage, à refaire de la même façon. Les deux fautes AA de la
direction (`docs/DIRECTION-SCENE-COMBAT.md` §7 — crème sur parchemin à 2,41:1, blanc sur vert
à ≈2,1:1) sont **inversées** ici : encre sombre sur parchemin, encre sombre sur vert ou néon.

**Écart clos par composition (#198, voie 1)** : `--text-muted` sur `--scene-felt-lit` tombe à
**3,79:1** (sous 4,5:1) — ratio recalculé le 25/10/2026 par la formule WCAG 2.1 sur `#9aa9c2` et
`#214d69` (le pic du dégradé, le pixel exact du centre de `.board` sur la capture). Le feutre est
éclairci **au centre** de la table, donc un texte atténué posé là échoue. Le halo **ne baisse pas** :
la lumière est une décision de scène (D-093). Le texte s'est adapté : tout `.muted` posé sur le
plateau (`.board .muted`, dont la Machine et le « Poste libre ») et le nom des camps de la piste
d'Interventions (`.piste__nom`) passent en `--text`, dont le ratio sur le même pic est **7,73:1**
(AAA). Mesuré sur la page (capture 420 × 900, fond rendu sous chaque texte) : aucun texte du combat
n'est sous 4,5:1. Le plancher de **taille** est vérifié à l'écran ci-dessous (#196).

Le ratio d'une pastille de Condition est **plus haut** sur une carte de scène (`--scene-card`,
6,4 à 7,3:1) que sur `--bg-sunken` : le calcul ci-dessus est le cas le plus sombre où elle tombe.

**Plancher typographique du combat — vérifié à l'écran (25/10/2026, #196), puis corrigé (#201)**.
Le plancher maison reste **`--fs-xs` (0.7rem = 11,2 px à la racine)** pour un texte porteur
d'information. #196 avait mesuré **23 nœuds de texte visibles sous 11,2 px** à l'arrivée, **31** en
`détaillé`, et inscrit quatre dettes. #201 les a traitées ; voici l'état après.

| Texte mesuré | Taille avant | Aujourd'hui | Verdict |
|---|---:|---:|---|
| Nom du Planqué (Poste) | 8,96 px | **11,2 px** (0.7rem, **trois** lignes) | **réglé** — « Psychologue du travail » se lit en entier |
| Nom du Planqué (Banc) | 8,64 px | **9,92 px** (`--fs-2xs`) | **écart inscrit** : la place fait 56 px, et « TRAVAIL » à 11,2 px prendrait trois lignes dans une vignette de deux. Le nom entier est dans l'inspecteur ; le groupe porte son `aria-label` |
| Numéro de Seuil | 9,6 px | **11,2 px** | **réglé** — c'est une décision (avant de craquer), pas un ornement |
| Chiffre de Stress (`détaillé`) | 9,92 px | **11,2 px** | **réglé** — une mesure se lit |
| Nom d'une Condition | 9,92 px | **11,2 px** | **réglé** — la règle se lit, elle ne se devine pas |
| Mot « Seuil », étiquettes de pile, nom du camp sur la piste, types de café, nature dans la pose | 6,7 à 10,2 px | **9,92 px** (`--fs-2xs`) partout, **11,2 px** pour les types de café du `détaillé` | **réglé en #290** — le mot « Seuil » (0,42 rem, **6,7 px**), l'emblème de faction (0,55 rem) et le nom du camp sur la piste (0,6 rem) étaient les trois seules règles du combat sous `--fs-2xs` ; elles y sont |

**Ce qui reste, dit franchement** : un seul texte porteur d'information est encore sous le plancher,
le **nom du Planqué au Banc** (9,92 px), et c'est un arbitrage de place, pas un oubli : à 56 px de
large et deux lignes, `--fs-xs` amputerait le nom au milieu d'un mot. Le passage à 64 px coûterait
22 px de hauteur, que la garde ne donne pas. La porte de lecture reste l'inspecteur (nom entier à
0.85rem), et le `aria-label` du groupe ne dépend pas de la taille.

La règle « aucun
texte porteur d'information sous `--fs-xs` » **n'est donc pas satisfaite** : c'est une dette
d'écran, pas une description du système.

**Le plancher du combat est `--fs-2xs`, et il est gardé (#290, 27/10/2026).** Deux choses sont
distinctes : le plancher **maison** d'un texte porteur d'information reste `--fs-xs` (dette ci-dessus,
inchangée) ; le plancher **mécanique** du combat — ce qu'aucune règle `.battle`, `.board`, `.poste`,
`.piste`, `.pile`, `.hand`, `.card--plateau`, `.combat-*`… n'a le droit de descendre sous — est
`--fs-2xs` (0,62 rem = 9,92 px). `src/styles-combat.test.ts` lit la feuille, **échoue** si une
déclaration passe dessous (il voit une règle de 0,42 rem comme de 8 px : le contrôle mord) et a été vu
**rouge** avant la correction sur trois règles (0,42 / 0,55 / 0,6 rem). Mesure à l'écran, 420 × 900,
arrivée **et** tour 3 avec un café attaché : **aucun nœud de texte visible sous 9,92 px** (le plus petit
est 9,92 px : noms du Banc, emblèmes, « Deck » / « Rebut », noms des camps de la piste). Ce que la
mesure ne prouve pas : les pseudo-éléments (`::before` « SEUIL ») ne sont pas des nœuds de texte, c'est
le test de la feuille qui les couvre.

**La pastille de café (#290).** Elle faisait **8 px** (`.pip`) avec un filet noir à 35 % : la couleur de
la Direction (`#5b6472`) y tombait à **1,51:1** du centre éclairé de la table, donc le café s'y fondait
— c'est la plainte du vrac du 27/10 (« les couleurs du café ne se voient pas »). Dans `.battle` elle
fait maintenant **14 px** (Pressions, barre d'action) et **18 px** dans la fiche du camp (cafés attachés,
Machine), cernée d'un liseré sombre puis d'un **anneau crème** : la pastille existe par son anneau
(7,73 à 15,83:1), et sa teinte par son liseré (3,27 à 8,09:1) — ratios en §1.5. **Ce qui reste, dit
franchement** : la teinte seule ne distingue toujours pas deux factions voisines pour une personne
daltonienne ; le nom du type est dans le `title`, l'`aria-label` et l'inspecteur, pas sur la pastille.
Un glyphe de faction dans la pastille serait une autre décision (place : 18 px).

Le bouton primaire a été **corrigé** le 23/10/2026 (#131) : son haut, éclairci au blanc, donnait
**3.1:1** sous le texte blanc — le détecteur d'Impeccable **en navigateur** (`npx impeccable detect
<url>`) l'a relevé, la commande `npm run detect:ui` (analyse de sources, regex) ne le voit pas. Ce
dernier le dit lui-même : « findings are an undercount ». Les faction-boutons de la fiche d'une carte
(`--accent` remplacé par la couleur de la faction) gardent le texte blanc : pour les factions claires,
le ratio n'est pas garanti — **écart connu, laissé** (voir le rapport de #131).

Aucune paire de texte du tableau n'est en dessous de AA : la seule qui y tombe (`--text-muted` sur
feutre éclairci, 3,79:1) est **interdite sur la table** par composition (ci-dessus, #198). Les pips de café (or sur fond sombre)
restent décoratifs : l'information est aussi portée par le `title` et l'`aria-label`.

### 1.6 Échelles

- **Typographie** : `--fs-2xs` 0.62rem → `--fs-3xl` 2.1rem (11 pas). `--font-display`
  (Outfit) pour les titres et les chiffres-clés, `--font-body` (Inter) pour le reste.
- **Espacement** : `--sp-1` 0.25rem → `--sp-6` 2rem (base 4 px).
- **Rayons** : `--radius-sm` 9px, `--radius` 14px, `--radius-lg` 20px.
- **Mouvement** : les transitions CSS sont neutralisées sous
  `@media (prefers-reduced-motion: reduce)`.

---

## 2. Composition de la carte

Le gabarit est rendu par `src/components/CardView.tsx`, stylé par `src/styles.css`.
Deux variables pilotent tout l'habillage, **posées en ligne depuis les données** :

- `--accent` = `FACTION_META[faction].color` — la **seule** source de la couleur de faction ;
- `--rarity` = `RARITY_META[rarity].color` — la couleur du cadre de rareté.

### 2.1 Anatomie (de haut en bas)

Depuis #179 (23/10/2026) la carte est un **cadre** et une **face** : `.card` est l'anneau de
rareté, `.card__face` est la carte elle-même.

| Zone | Classe | Contenu |
|---|---|---|
| Cadre | `.card` | un **anneau plein de 4 px** en dégradé de `--rarity` (de `--gold` pour un COMEX, `--frame`) — la rareté colore l'anneau **entier**, pas un filet sur un seul côté (tell d'UI générée). **Exception : la Couronne** (`COU`), dont l'anneau est **plat** — un dégradé de violet est un tell d'UI générée (`ai-color-palette`, #208, §3) |
| Titre | `.card__top` / `.card__title` | barre pleine largeur teintée de la faction. En haut, le **stade** (`.card__stage`, Entrant / N+1 / N+2, ou la catégorie d'une carte Action) et le badge **COMEX** (`.card__comex`, or) ; dessous le **nom** (`.card__name`, Outfit 700, capitales, **deux lignes réservées**, un mot trop long se coupe) |
| Seuil | `.card__seuil-badge` | **plaque dorée** à droite du titre : le mot « Seuil » (dessiné par `data-label`) au-dessus du chiffre |
| Illustration | `.card__art` | l'image du registre **posée sur l'aplat de faction** — `color-mix` sur `--accent`, une **couleur plate** (`APLAT_FACTION`, `CardView`) : un dégradé violet ou cyan sur fond sombre est un tell d'UI générée (#208, `ai-color-palette`), alors qu'un aplat non. Deuxième couche : la carte garde son fond de faction pendant le chargement, ou si l'image n'arrive pas hors ligne (#131) ; sinon l'aplat seul + glyphe (`.card__glyph`) ; voile `.card__shine` ; les raretés étoilées reçoivent en plus un voile holographique (`.card--holo`). La palette dérivée `card.palette` (un dégradé, `planquePalette`) reste la **donnée** d'identité de la faction, et son test la garde |
| Emblème | `.card__emblem` | médaillon de la **faction** (couleur et glyphe de `FACTION_META`) au coin bas-gauche de l'illustration — **seulement quand il y a une illustration** : sans elle, le glyphe du fond tient ce rôle |
| Barre de Seuil | `.card__seuil` | **la barre seule**, dix crans, pleine sur la carte : elle montre la **capacité**. Au combat, la même barre montre le **Stress qui monte** (D-026) |
| Pressions | `.card__attacks` | une ligne par Pression : pastilles de café (`.pips` / `.pip`), nom, dégâts |
| Ambiance | `.card__flavor` | le texte de flavour, masqué en mode compact |
| Pied | `.card__footer` | rareté (diamants/étoiles, couleur `--rarity`), faction (point + sigle) ; l'identifiant court (`.card__id`) **seulement sur la carte en grand** |

### 2.2 Grille et marges

- Grille de la Collection : `repeat(auto-fill, minmax(160px, 1fr))`, écart 0.75rem — **deux colonnes** à 420 px (cartes de 188 × 263 px). Sous **420 px** elle est **forcée à deux colonnes** (`repeat(2, minmax(0, 1fr))`) : à 360 px la page offre 328 px, deux cartes de 160 px avec leur gouttière en demandent 332, et `auto-fill` retombait à une colonne (#131).
- Carte : **`aspect-ratio: 63 / 88`** — le format réel d'une carte, et ce qui garantit que toutes font la même taille quel que soit leur texte. Padding **4 px** (l'anneau), rayon 10 px.
- Face : rayon 6 px, filet noir intérieur, `gap` 0.3rem ; chaque bloc porte son propre espacement horizontal (0.4rem).
- Illustration : **elle prend l'espace restant** (`flex`), rayon 4 px, filet interne double (noir à l'extérieur, clair à l'intérieur), cadrage **haut** (`50% 28%`) — les illustrations sont des portraits.
- Barre de Seuil : hauteur 7 px sur la carte, **12 px** au combat, dix crans (`.stress`, `::after`).
- Pips de café : 8 px, `gap` 2 px — **hors du combat** ; dans `.battle` : 14 px (18 px dans la fiche du camp), anneau crème, `gap` 0,3 rem (#290).

### 2.3 États

| Classe | Effet |
|---|---|
| `.card--selected` | bordure `--accent` + halo `color-mix(--accent 18%)` |
| `.card--comex` | `--frame` = `--gold` : l'anneau est or — le statut COMEX (D-026). L'or **est** l'anneau : il n'y a pas de second filet (l'ancien `.card--comex::before`, déclaré sans `content`, ne rendait rien ; retiré, #131) |
| `.card--holo` | voile holographique sur l'illustration (1S, 2S, 3S, COU) |
| `.card--compact` | masque la flavour et l'identifiant (grilles) |
| `.card-slot.is-full` | carte à 60 % d'opacité (plus d'exemplaire possible au Deck) |
| `.card-slot.is-missing` | carte **non possédée** : grisée (`grayscale(1)`) et son illustration et sa barre de Seuil à 40 % d'opacité — le **texte**, lui, garde son contraste (#208 : à 40 % d'opacité sur toute la carte, le nom tombait à 2,1–3,5:1, et une carte illisible n'est pas une carte éteinte). Sa pastille « ×0 » (pointillés) et la mention « Non possédée » restent **hors de `.card`** : elles ne s'éteignent pas avec elle |

**Le slot** (`CardSlot`, `src/components/CardSlot.tsx`) enveloppe la carte dans la Collection, dans « Dedans » et dans la Collection du Deck : un bouton rond au coin haut-droit (ajouter, ou ouvrir la fiche), et au coin bas-droit les pastilles — **possession** (`×2`, or) et **Deck** (`Deck ×1`, filet de la faction, seulement au-dessus de zéro).

**Le tri** (`TriCartes`, `src/components/tri-cartes.ts`) est le même sur la Collection et sur le Deck : par défaut, faction, stade, rareté (la plus rare d'abord), nom, possédées d'abord. La liste montre le choix courant ; « Réinitialiser » le rend à « par défaut ».

### 2.4 L'écran de combat (D-093 ; #169, #187–#200 ; relu sur le code le 27/10/2026, #291, D-121 ; écart de collage de la barre daté le 27/10/2026, #289, #323)

> **Depuis D-142 (28/10/2026)**, cette section décrit la **référence 420 × 900**. Sur un écran plus
> court, en paysage et sur PC, la disposition change : la barre du haut s'efface en combat (une
> sortie `←` entre dans l'en-tête), le Banc passe à côté du Poste, la barre d'action vit dans la
> console. Voir §2.7.

L'écran est une **table** (D-093, §2.6) et se lit à **420 × 900** (D-060). Il ne promet plus que
tout tient « sans défiler » : `npm run capturer` **mesure** le défilement et les deux surfaces qui
doivent rester au-dessus de la navigation (limite **830 px**, haut de la barre de navigation, avec
**20 px** de marge exigés par D-094 (3)). Remesuré le 27/10/2026 (`npm run capturer`, #322) sur les
64 états du passage de combat, cibles de 44 px comprises : **aucun défilement** (D-103) ; pas-à-pas
**terminé**, le bas de la **main** est à **663–667 px** et celui de la **barre d'action** à
**711–758 px** (72–119 px de marge) ; pas-à-pas **ouvert** (`1 / 5`, il ajoute sa bande), la main
finit à **714–717 px** et la barre à **762–809 px** (**21–68 px** de marge). Un tour chargé (relève,
choix) fait défiler la barre **en elle-même** (`max-height: 42dvh`) plutôt que de recouvrir la table.

Les tailles sont celles de l'écran, pas celles de la maquette : **Poste 88 px** (`--poste-w:
5.5rem`), **Banc 56 px** (`--banc-w: 3.5rem`), **carte de main 64 px** (`--carte-w: 4rem`) dans
un conteneur de **105 px** (la carte entière, son inclinaison et la place du soulèvement) :
**rien n'est rogné**, le Seuil reste visible.

| Zone | Classe | Ce que fait l'écran |
|---|---|---|
| Barre d'état | `.battle__head` | **une ligne** : `Combat`, `Tour n · à toi / à la Direction`, puis à droite **Conditions** (le dialogue des cinq), `ⓘ` (`.battle__infos` : bascule `sobre` / `détaillé`, `aria-pressed`, raccourci `I`) et `⋯` (`.combat-menu__bouton` : menu du combat). « La Direction réfléchit… » prend la ligne du dessous. |
| Pas-à-pas | `.pas-a-pas` | **une ligne collée** sous la barre d'état : `1 / 5`, le titre de l'étape, **Suivant** ; **Plus** déplie Précédent, Passer le pas-à-pas et Lire le détail. Les **7 cibles** `[data-pas-a-pas]` reçoivent le contour doré ; Suivant et Précédent font défiler la page vers la cible. Instantané sous `prefers-reduced-motion` ou « Mouvement réduit ». |
| Table | `.board` | deux camps **empilés** : l'adversaire lit **Banc puis Poste**, le mien **Poste puis Banc**, donc les deux **Postes se font face** au centre. Une seule lumière au centre (§2.6) ; aucun cadre autour d'un camp. |
| Camp | `.board__side`, `.board__zone`, `.board__fiche` | la carte du **Poste** à gauche, sa **fiche** à droite : nom du camp, `main n`, les **piles Deck / Rebut** avec leur compte, les cafés attachés, la Machine, les Conditions. Le **Banc** est une rangée de trois places ; une place libre garde la forme d'une carte, en pointillé. |
| Piste d'Interventions | `.piste` | **horizontale**, entre les deux camps : le nom de chaque camp et trois hexagones (l'adversaire à gauche, toi à droite) ; l'or marque une Intervention acquise. **Une** cible `data-pas-a-pas="interventions"`, sur le conteneur. |
| Main | `.hand`, `.hand__carte` | un **éventail** de vraies cartes du gabarit (64 px), inclinées, qui ne se chevauchent que quand la largeur l'exige ; la carte se soulève au survol et au focus (pas sous « Mouvement réduit » : c'est alors le panneau de l'inspecteur qui s'ouvre). Le bouton transparent posé dessus porte le geste et le nom lu ; « Jouable » est un filet néon, l'état choisi un filet plus épais. |
| Pose | `.pose` | une carte **choisie** ouvre un panneau sous la main qui la nomme et donne **où** la jouer : « Poser au Poste », « Mettre au Banc 2 », « Jouer cet Objet ». |
| Inspecteur | `.infobulle`, `.inspecteur` | **survol ou focus = lire**, **clic, tap ou Entrée = agir** (D-121). Chaque carte du Poste et du Banc est un `role="button"` nommé par le Planqué entier (`CarteSurvolable`, `InspecteurCombat.tsx`). La lecture est une infobulle `role="tooltip"` : 300 ms à la souris seule (au tactile le tap ouvre le panneau, pas l'infobulle), aucun élément focusable, Échap la ferme. Posée dans `body` à la verticale de sa carte (sous elle, au-dessus si l'écran manque de place), 17 rem de large au plus. Le panneau **non modal**, sans voile, montre la fiche entière — nom entier, stade, faction, rareté, `x/y de Stress (Seuil y)`, cafés, Conditions, Pressions, Talent, Machine — et les gestes de la carte. Sur téléphone, feuille basse (`top: --inspecteur-haut`, posé sous la carte décrite, et jamais plus haut que 45 % de la fenêtre) ; à partir de 900 px, colonne collée dans la console. |
| Barre d'action | `.combat-barre` | **collante** au-dessus de la navigation — **au-dessus de 640 px de large seulement** : sous 640 px (donc à la cible de 420 px de D-060) elle repasse en `position: static` et se range sous la main, sinon elle remontait par-dessus le bas de la main (#289, écart **assumé**, `src/styles.css`). Elle porte la **dernière ligne du journal**, puis la relève ou le choix en attente, la ligne « Hors de portée du café : … », les gestes du Poste (café, Rotation, Talent), les Pressions et **Fin du tour** (vert quand c'est à toi). C'est la cible `poste-actions` du pas-à-pas. |
| Écran large (≥ 900 px) | `.battle__table` | la table à gauche, la console (inspecteur, main, pose) à droite. |

Le **secondaire** est derrière le `⋯` : Journal (les 14 dernières lignes), Partie à deux (un code
à se passer, sans serveur), Règles (le dialogue des Conditions), Abandonner (quand le forfait est
proposé), Nouveau combat. **Une seule vue du menu** est ouverte à la fois ; Échap ferme le menu
et rend le focus au bouton, et un dialogue ouvert par-dessus garde son propre Échap.

Les **piles** Deck et Rebut sont des objets **posés** et **comptés** : le Rebut **ne s'ouvre pas**
(écart à `SPEC-COMBAT-UI` R5, pas une règle).

**Le clavier et le doigt** (D-121 ; la recherche est `SPEC-COMBAT-UI` §4 et §6.6, elle ne fait pas règle).

| Geste | Effet |
|---|---|
| `Tab` / `Maj+Tab` | l'ordre du document : barre d'état → cartes du plateau (adversaire, puis moi) → main → barre d'action. Aucun `tabindex` positif. |
| `Entrée` / `Espace` sur une carte | ouvre le panneau d'action |
| `Échap` | ferme l'infobulle, ou le panneau (le focus revient à la carte), ou le menu `⋯` (le focus revient au bouton), ou le dialogue ouvert par-dessus — **un seul étage à la fois** |
| `I`, `Ctrl+I` (`Cmd+I`) | bascule `sobre` / `détaillé`. La case **« Raccourcis clavier au combat »** (Réglages) est **cochée par défaut** ; décochée, les deux touches ne font plus rien. Sans effet dans un champ de saisie (le code de la partie à deux). `Ctrl+Maj+I` reste au navigateur. |
| flèches, `Page↑/↓` | **défilent la page**. Le plateau n'est pas un `role="grid"` (D-121) : huit places au plus, le `Tab` naturel suffit. |
| appui long | n'existe nulle part ; le tap suffit |

Le focus est **rendu** : l'anneau d'une carte du plateau est un contour de 2 px au néon
(`--scene-neon`, décalé de 3 px, `.poste__carte:focus-visible` et `.bench__carte:focus-visible`), celui
des autres éléments est l'anneau global (`:focus-visible`, 2 px `--gold`, décalé de 2 px). Le panneau
rend le focus à la carte qu'il décrivait (`finalFocus`), et la fermeture du panneau ne rouvre pas
l'infobulle de cette même carte.

**Cibles de doigt (état mesuré le 27/10/2026, #320, #322).** Toutes les cibles du combat font
**44 px** (`2.75rem`, D-116) : la barre d'état, le menu `⋯`, ses entrées, la bascule `ⓘ`, **les boutons
de la barre d'action** (`.combat-barre .button`, « Fin du tour » compris) et **ceux de la ligne du
pas-à-pas** (`.pas-a-pas__ligne button`, dont « Plus »). Il ne reste **aucun écart** : ce que ce
paragraphe disait avant #320 — ces deux surfaces à 36 px, « écart daté » — est **caduc**. La
mesure est celle de `npm run capturer`, qui lit dans le navigateur la hauteur rendue de chaque bouton
et **échoue** sous 43,5 px (`boutonsPetits` : `[]` sur les 64 états mesurés ce jour, « Fin du
tour » de 44 px de haut). La marge de D-094 (3) tient avec ces 44 px : le bas de la barre d'action est
à **758 px au plus** pas-à-pas terminé (72 px de marge) et à **806 à 809 px** pas-à-pas ouvert
(**24 px** en `sobre`, **21 px** au pire cas `détaillé`), pour **20 px** exigés ; aucun défilement.

**Trois notes de lecture (25/10/2026, #196)** — des constats datés sur des actes qui ne se
réécrivent pas. Ils disent où le code a avancé depuis la ligne, ou pourquoi un chiffre de l'acte
n'est pas celui de l'écran.

1. **D-079, la dette UI est payée.** L'acte dit « l'affichage privé n'est pas encore câblé ».
   Il l'est depuis #171 : `regardDuDernierGeste` retrouve le `peek` du dernier geste et
   `RegardDuDessus` (`Battle.tsx`) affiche le dessus de **mon** Deck dans une section privée,
   hors main et hors journal — donc sans révélation à l'autre camp. La décision n'est pas
   modifiée ; c'est sa dette qui est close. Le journal le porte lui-même depuis D-111 (le ⚠️ en
   tête de la ligne de D-079), et D-121 le redit (27/10/2026, #291).
2. **D-035, « Radix » n'est pas le paquet installé.** L'acte écrit « shadcn/Radix ». Le paquet
   réel est **Base UI** : `@base-ui/react` (`package.json`), importé par
   `src/components/ui/dialog.tsx` et `button.tsx`. Le choix de fond — shadcn/ui pour les
   composants génériques seulement — tient ; le nom du moteur, lui, est Base UI. Le journal ne
   réécrit pas D-035 : sa ligne porte un ⚠️ de lecture daté du 27/10/2026 qui renvoie à D-121 (b).
3. **La largeur du Poste : 116 px dans D-093, 88 px sur l'écran.** L'acte écrit « le Poste à
   116 px, le Banc à 64 px » (la direction visuelle, elle, dit 112, `docs/DIRECTION-SCENE-COMBAT.md`
   §3.1) ; l'écran mesure **88 px** pour le Poste (`--poste-w: 5.5rem`) et **56 px** pour le Banc
   (`--banc-w: 3.5rem`). L'écart n'est pas une nouvelle règle : c'est la **plus grande combinaison
   qui garde la main et la barre d'action au-dessus de la navigation** à 420 × 900 (20 px de marge
   au moins, ci-dessus). Les deux chiffres de l'acte restent écrits ; c'est l'écran qui est plus petit que
   la cible.

### 2.5 Les états d'un écran (D-060, critère 3 ; #131)

Chaque écran a ses états — **vide**, **chargement**, **erreur**, **hors ligne** — ou dit pourquoi il n'en a pas. Les états **transverses** vivent dans le `Layout`, une seule fois :

| État | Où | Ce que voit le testeur |
|---|---|---|
| Erreur de rendu | `ErreurDeRendu` (Layout, autour de l'écran ; et `main.tsx`, autour de tout) | « Cet écran a planté » + Recharger + accueil ; la barre de navigation reste, changer d'écran referme l'erreur |
| Adresse inconnue | `Introuvable` (`path="*"`) | « Ce couloir ne mène nulle part » + l'adresse ; les anciennes adresses redirigent (D-075) |
| Hors ligne | `BandeauHorsLigne` (Layout) | un bandeau sous l'en-tête : ce qui continue (combat, Collection, Deck), ce qui attend (mur, traces) |
| Confirmation | `Confirmation` | le geste irréversible (forfait, réinitialisation) passe par **un seul** dialogue ; « Annuler » prend le focus |

| Écran | Vide | Chargement | Erreur | Hors ligne |
|---|---|---|---|---|
| Accueil | une Collection neuve a des cartes de départ | l'aplat de faction sous l'illustration (`.card__art`) | — | bandeau |
| Collection | « Ta Collection est vide » ; grille vide : la cause est nommée (recherche, filtre, ou les deux) + « Tout effacer » | idem | — | bandeau |
| Deck | « Le deck est vide » ; « Aucune carte possédée » | idem | l'illégalité est dite (`notice--warn`) | bandeau |
| Combat | sans objet (deck de démonstration) | « La Direction réfléchit… » pendant son tour | — | bandeau (le combat est local) |
| Réglages | sans objet | sans objet | refus d'import annoncé (`role="alert"`) | bandeau |
| Idées | « Le mur est encore vide » | « Le mur se charge… » (branché sur la base) | notice si la base ne répond pas, repli sur le fichier | repli sur le fichier + bandeau |

**Le combat — ses états d'écran (D-093)** : l'inspecteur et le menu `⋯` ne sont pas des pages,
mais des **états de la même vue**. Ils sont listés ici pour qu'on sache quoi regarder sur une
capture.

| État | Comment on y entre | Ce que voit le testeur | Sortie |
|---|---|---|---|
| `sobre` (défaut) | à l'arrivée (`combatDetaille: false`) | les cartes du plateau, leur nom, le Seuil et la barre de Stress ; la Machine en pastille ; une Condition en icône seule ; le chiffre de Stress et les Pressions ne sont pas écrits sur la carte. **Rien de ce qui change une décision n'est caché** : la fiche de l'inspecteur dit tout | `ⓘ`, `I` ou `Ctrl+I` → `détaillé` |
| `détaillé` | `ⓘ` (`aria-pressed="true"`) ou `I` / `Ctrl+I` (`aria-keyshortcuts="I"`) | les annotations reviennent : nom et dégâts des Pressions sur la carte, chiffre `x/y` de Stress, types de café de la Machine, nom des Conditions. Le choix **survit au rechargement** (store persisté) | le même geste, ou `ⓘ` |
| Raccourcis coupés | Réglages → décocher « Raccourcis clavier au combat » (cochée par défaut, D-121) | `I` et `Ctrl+I` ne font plus rien ; `ⓘ` reste le seul chemin. Taper « i » dans le code de la partie à deux n'a jamais d'effet sur l'écran | recocher la case |
| Inspecteur — lecture | survol à la **souris** (300 ms) ou focus clavier d'une carte du Poste ou du Banc ; le tactile n'y entre pas (le tap ouvre l'action) | une infobulle `role="tooltip"` reliée à la carte par `aria-describedby`, sous elle (au-dessus s'il n'y a pas de place) : nom entier et fiche, **aucun bouton, aucun élément focusable**. Le pointeur peut passer de la carte à l'infobulle sans la perdre | sortie du pointeur ou du focus ; **Échap** la ferme sans bouger le pointeur ; elle s'efface dès que le panneau montre la même carte |
| Inspecteur — action | clic, tap ou **Entrée** / **Espace** sur une carte | un panneau **non modal**, sans voile, titré du nom entier : la même fiche, plus les gestes de la carte (« Gestes de cette carte ») ; feuille basse sous la carte sur téléphone, colonne collée à ≥ 900 px | **Fermer** ou **Échap** ; le **focus revient à la carte** décrite, et l'infobulle ne se rouvre pas toute seule |
| Inspecteur — carte sans geste | une carte de **l'adversaire** : la fiche seule, pas de section de gestes. Une carte à **moi** sans geste légal (tour adverse, café déjà attaché) : la fiche et « Aucun geste pour cette carte ce tour. » | **aucun bouton grisé** : les gestes viennent de `legalActions` (café, évolution, Talent, Rotation, relève), l'écran n'en invente pas | idem ; un geste choisi ferme le panneau et joue l'action |
| Menu `⋯` — fermé | — | le bouton `⋯` seul, à droite de `ⓘ` | ouvrir |
| Menu `⋯` — ouvert | `⋯` | un panneau ancré sous la barre d'état, **une vue à la fois** : la liste, le Journal (14 dernières lignes) ou la Partie à deux | `⋯`, **Échap**, ou une entrée ; le focus revient au bouton |
| Règles | `⋯` → **Règles**, ou **Conditions** dans la barre d'état | le dialogue des cinq Conditions : libellé, icône et règle | **Échap** ou la fermeture du dialogue |
| Pas-à-pas | premier combat ; `Réglages` → « Revoir le pas-à-pas du combat » | une ligne `1 / 5` + titre + Suivant ; **Plus** déplie Précédent, Passer, Lire le détail | « Passer le pas-à-pas », ou la fin de l'étape 5 |
| Aucun geste | tour de la Direction, ou partie terminée | la ligne de repos de la barre d'action, **sans bouton grisé** : l'écran ne rend que `legalActions` | attendre le tour, ou `⋯` |
| Mouvement réduit | `Réglages` → « Réduire les animations », ou `prefers-reduced-motion` | les mêmes informations, sans mouvement : chiffre de Stress fixe, éventail qui ne se soulève pas, carte craquée désaturée | — |

**Les dialogues** — la fiche d'une carte, l'Arrivage, la Journée d'intégration, les Conditions, la confirmation — passent tous par `components/ui/dialog.tsx` (D-035) : rôle, Échap, focus piégé et fond sont les siens. Il n'y a plus de dialogue maison (`.modal` a disparu).

### 2.6 La scène de combat (D-093, 25/10/2026)

L'écran de combat est le seul qui pose **sa propre palette** : une **table** sous les cartes, au lieu
d'un panneau dans la page. Les jetons sont déclarés **une fois**, sur le sélecteur de l'écran
(`.battle`), et **ne réécrivent aucun jeton de `:root`** — le bleu nuit du §1.1 reste la famille.

| Jeton de scène | Valeur | Rôle |
|---|---|---|
| `--scene-felt` | `#16202c` | le feutre de la table |
| `--scene-felt-lit` | `#214d69` | la **seule** lumière, au centre |
| `--scene-card` | `#1b222c` | la surface d'une carte |
| `--scene-neon` / `--scene-neon-core` | `#61d5df` / `#9ef5fb` | le néon **d'état** |
| `--scene-go` | `#46c78c` | « Fin du tour » quand c'est à toi |
| `--scene-danger` | `#ff7f3f` | tour adverse, craquage — relevé le 27/10/2026 (#323) : à `#e0563f` le filet tombait à **2,80:1** mesuré au bord du camp de la Direction |
| `--scene-gold-hot` | `#f7e264` | le **Stress** qui monte |
| `--scene-parch` | `#b18a60` | le parchemin des piles (Deck, Rebut) |
| `--scene-parch-dark` | `#664d38` | le filet usé des piles |
| `--scene-ink-parch` | `#241a0c` | l'encre des piles (5,4:1 sur le parchemin, mesuré par `impeccable detect` sur la page) ; aussi la pastille du compte |
| `--scene-chalk` | `#f4e6cc` | le chiffre clair de la pastille du compte (sur `--scene-ink-parch`) |
| `--scene-felt-deep` | `#0d1420` | le bord vignetté de la table (les quatre coins) |
| `--scene-steel` / `--scene-steel-deep` | `#8a93a8` / `#4a5468` | le métal ardoise du cadre standard |

Les jetons sont posés sur `.battle` (`src/styles.css`, bloc « La scène de combat ») : ils
n'existent pas hors de l'écran de combat, et `:root` n'en change aucun.

**Gardé par un test (T12, #295, 27/10/2026)** : `src/styles-scene.test.ts` lit la feuille et échoue si
(1) l'un des huit jetons de `SPEC-COMBAT-UI` §6.9 (`--scene-felt`, `-felt-lit`, `-card`, `-neon` et
`-neon-core`, `-go`, `-danger`, `-gold-hot`, `-parch`) n'est pas déclaré **une fois**, ou si un
`--scene-*` est déclaré ailleurs que sous `.battle` (`:root` compris) ; (2) un ratio de la direction
(les deux fautes AA et leurs inversions comprises) calculé sur les jetons n'est plus écrit en §1.5 ;
(3) une surface du combat porte une ombre **extérieure, floue et colorée** — un halo. Le néon est un
**état** : le filet en ombre intérieure du camp qui a la main, l'anneau de focus, le contour d'une
carte jouable. Une carte qui n'est ni active, ni désignée, ni en train de subir n'a aucun halo. Chaque
garde a son « le contrôle mord » dans le même fichier. Depuis #323, il garde aussi le **plancher
3:1 du filet de danger** sur le feutre le plus clair (WCAG 1.4.11), avec l'ancien jeton comme cas
fautif.

**Quatre règles, et elles tiennent tout l'écran :**

1. **Une lumière, au centre**, entre les deux Postes ; les quatre coins s'éteignent
   (`radial-gradient` + vignette en ombre interne). C'est ce qui produit la profondeur, pas les filets.
2. **Quatre plans, une ombre chacun** : la table (vignette), les zones **posées** (piles, piste,
   cartouches de camp), les cartes **soulevées**, l'élément **actif** (son ombre **plus** un halo).
   Une surface ne porte jamais deux ombres, et jamais un filet fin **avec** une grosse ombre.
3. **Le néon est un état, pas un style.** Allumé : le camp qui a la main, l'élément désigné, le danger.
   Éteint partout ailleurs. Un néon permanent est un tell du détecteur (`.opencode/skills/impeccable/`).
4. **L'or reste la marque du COMEX** (§2.3) : les cartes standard portent un cadre de **métal ardoise**
   (`#8a93a8 → #4a5468`), et la barre de Seuil/Stress est **dorée**, pas rouge — le rouge est la
   couleur d'un danger d'état, pas d'une mesure. La référence vidéo met de l'or partout : on ne la suit
   pas, sinon le statut COMEX disparaît.

**La contradiction §2.3 / règle 4, tranchée (25/10/2026, #190)**

- §2.3 dit que la rareté colore l'anneau **entier**. La règle 4 dit que le cadre standard est
  **métal ardoise**, et que l'or est réservé au COMEX. Les deux ne peuvent pas être vrais du même anneau.
- **Décision** : l'anneau **garde la rareté** — il reste plein, et sa **teinte** est celle de
  `RARITY_META`. Dans la scène, sa **matière** change : un cadre standard prend le métal ardoise,
  teinté à 14–22 % de la couleur de rareté (`.battle .card:not(.card--comex)`). Le **COMEX** garde
  l'or seul, comme le veut §2.3 (`.card--comex`, `--frame: var(--gold)`).
- **Hors scène**, §2.3 reste la règle : la Collection, le Deck et la fiche gardent l'anneau de rareté
  pur. La matière métal ne vit que dans la table.
- **L'or a deux emplois dans la scène, pas davantage** : le cadre COMEX, et les **mesures** qui
  se remplissent — la barre de Stress et les Interventions acquises. Ce ne sont pas des cadres :
  un hexagone d'Intervention est une mesure, pas un statut. Si cette extension dérange, c'est la
  seule partie à rouvrir.
- Le **néon** n'éclaire que l'état (règle 3) ; un cadre n'a jamais de néon au repos.
- **Le néon tient en filet et en liseré, sans halo coloré.** La direction prévoyait un halo sur
  l'élément actif ; le détecteur le lit comme le tell « glowing accents » (`dark-glow`), et la
  direction elle-même (§7) dit que le néon suffit aux filets. Pas d'exception déposée : on n'a pas
  eu besoin de l'écarter.
- **Encre des piles** : la direction annonçait `#3a2a18` à 5,95:1 sur le parchemin ; c'est faux (mesuré
  4,4:1, en dessous d'AA). L'encre passe à `#241a0c` (5,4:1).

**Ce qui est posé sur la table** (#190). Une seule lumière (règle 1) : le feutre `.board` a son
dégradé centré entre les deux Postes et sa vignette. Les camps sont des zones posées (une ombre,
fond translucide) ; le camp qui a la main porte le **néon**, la Direction le **danger**, et un camp
au repos n'a aucun halo. Les **piles** de Deck et de Rebut sont visibles des deux camps avec leur
compte ; le Rebut **ne s'ouvre toujours pas** (écart constaté en #196 à `SPEC-COMBAT-UI` R5 : #188
a livré l'inspecteur des cartes, pas l'ouverture des piles). La **piste d'Interventions** est **un**
conteneur **horizontal**, entre les deux camps — `data-pas-a-pas="interventions"` n'y est que là — avec
six hexagones, trois par camp, chacun nommé (« Intervention 2 sur 3, La Direction »). « Fin du tour » est vert quand c'est à
toi, filet rouge quand c'est à la Direction.

**Ce qui bouge, et son repli.** Le Stress qui monte (chiffre doré, 700 ms, une fois), la carte de la
main qui se soulève au survol et au focus, la pile de Deck qui s'allume à la pioche, l'Intervention qui
se remplit, la traînée de craquage. **Aucun de ces effets ne porte une information seule** : sous
`prefers-reduced-motion` **ou** « Mouvement réduit », le mouvement part et l'information reste (le
chiffre s'affiche sans bouger). Jamais plus de **trois flashs par seconde**, jamais d'effet qui décale
une cible ou retarde le geste suivant.

**Ce que la scène n'a pas, et n'aura pas en v1** : les accessoires de la référence (classeurs,
trombones, feuilles) — ce sont des assets, et l'univers est l'atelier MRO (D-025).

> Le détail — palette mesurée, gabarits, pièges, table de contraste — vit dans
> `docs/DIRECTION-SCENE-COMBAT.md` ; la recherche et les tâches dans `docs/SPEC-COMBAT-UI.md`.

---

### 2.7 Téléphone, portrait, paysage et PC (D-142, 28/10/2026)

L'écran se mesure à **six gabarits** : la référence **420 × 900** (D-060, D-094), puis la fenêtre
réelle d'un téléphone — **360 × 640**, **390 × 664** (Safari, barre comprise) —, le **paysage** —
**740 × 360**, **844 × 390** — et le **PC**, **1280 × 800**. `npm run capturer` les joue tous ; ce
qui suit est ce que `src/styles.css` fait de chacun.

| Situation | Média | Ce qui change |
|---|---|---|
| Combat sur téléphone | `max-width: 899px` | la barre du haut s'efface (comme celle du bas, #275) ; la **sortie** `←` de l'en-tête mène à l'accueil — pas un forfait, la partie est rangée |
| Écran court | `max-height: 860px` (portrait) | chaque camp range son **Banc à côté du Poste**, sa fiche sous le Banc ; la fiche s'écoule en lignes |
| Très court | `max-height: 700px` (portrait) | le titre « Ta main » cède sa ligne (le compte reste dans la fiche) ; Banc 52 px, main 60 px |
| Paysage de téléphone | `orientation: landscape` et `max-height: 600px` | plateau à gauche, **main et barre d'action** à droite ; un camp sur **une** rangée (Poste 80, Banc 52, fiche) ; la console défile en elle-même ; l'inspecteur est une colonne, pas une feuille basse ; hors combat, l'en-tête se serre et la barre du bas met icône et libellé côte à côte |
| Écran large | `min-width: 900px`, ou paysage ≥ 600 px | plateau à gauche, console à droite, barre d'action **dans** la console |
| PC | `min-width: 1200px` et `min-height: 700px` | le combat prend 1360 px de large ; Poste, Banc et main **grandissent avec la hauteur** (`clamp`, D-094 (1) en plancher) |
| Grand écran | `min-width: 1440px` | la coquille passe de 1080 à 1280 px (`--shell-max`, lu aussi par la barre du bas) : une colonne de cartes de plus en Collection et au Deck |
| Partout | — | `min-height: 100dvh` ; encoches (`env(safe-area-inset-*)`) sur l'en-tête et les bords ; **44 px** pour un bouton, un champ, une case de Réglages, un onglet du comité, et la zone tactile du `+` d'une carte (la pastille garde 24 px) |

**Règle** : la **disposition** cède avant la **lisibilité**. Les tailles de D-094 (1) ne baissent
qu'aux deux cas nommés (très court, paysage), et seulement d'un cran.

## 3. Cadre de rareté, rareté par rareté

La source est `RARITY_META` (`src/data/index.ts`) : le libellé **et** la couleur y vivent,
le CSS ne fait que les lire par `--rarity`.

| Rareté | Libellé | Couleur | Traitement visuel |
|---|---|---|---|
| `1D` | ◆ | `#8fa3b8` | filet gris froid |
| `2D` | ◆◆ | `#9fc4e8` | filet bleu clair |
| `3D` | ◆◆◆ | `#c9a227` | filet or sourd |
| `4D` | ◆◆◆◆ | `#f0c75e` | filet or vif ; les 4◆ sont les COMEX (`card--comex`, cadre or) |
| `1S` | ★ | `#e8b54a` | filet or + voile holographique |
| `2S` | ★★ | `#f2d27a` | filet or clair + voile holographique |
| `3S` | ★★★ | `#ffd76e` | filet or + holo ; **4 variantes** depuis #87 |
| `COU` | ♛ | `#c9a2ff` | filet violet **plat** (atténué : `color-mix` à 62 % sur `--bg-deep`) + holo ; **3 variantes** depuis #87. Plat, parce qu'un dégradé de violet est un tell d'UI générée (`ai-color-palette`, #208) |

Les raretés hautes (`3S`, `COU`) sont portées **uniquement par des variantes
re-raréfiées** (#87, `npm run status` → `"3S": 4, "COU": 3`). Le traitement
holographique s'applique déjà : `HOLO_RARITIES` les inclut (`src/components/CardView.tsx`).

---

## 4. Badges de statut

Les cinq conditions (`docs/JEU.md` §4) sont rendues par `src/components/StatusBadge.tsx`,
`STATUS_META` : libellé, description et icône en **une seule** source. `Battle.tsx` les
affiche sur le Poste et dans une légende « Conditions » ; il ne recopie plus aucun libellé.

| Condition | Icône | Couleur du badge |
|---|---|---|
| Surcharge | fiole | violet `#9b59b6` |
| Épuisement | flamme | orange `#e0783e` |
| Sieste | lune | gris-bleu `#788caa` |
| Immobilisation | cadenas | bleu `#5aaadc` |
| Dérive | vent | or sourd `#c8a050` |

---

## 5. Mascotte et logo

Le « planqué » est représenté **avachi à son poste**, un café à la main. La tasse de
**Café** est le motif maison : elle revient dans le monogramme, dans le logo de la barre
du haut et dans les pips de coût.

### 5.1 Les fichiers

| Fichier | Contenu | Usage |
|---|---|---|
| `public/favicon.svg` | monogramme **BP** en dégradé or, cadre or sur bleu nuit (32×32) | favicon, lisible à 16 px |
| `public/icon-192.svg` | la scène complète, `viewBox` 512 (rendue en 192) | icône PWA |
| `public/icon-512.svg` | la scène complète + le mot « Bureau des Planqués » | icône PWA, écran d'accueil |
| `design/logo/cafe-clair.svg`, `cafe-sombre.svg` | **la tasse seule, en trait** : godet, anse, trois vapeurs, arc d'ombre ; aucun remplissage, trait de 5 sur un `viewBox` 64. Encre `--bg` pour le thème clair, or `--gold-soft` pour le sombre | **la marque du README** (#328), choisie par `<picture>` + `prefers-color-scheme` — l'or sur fond clair tombe à 1,9:1. Ce n'est **ni** le favicon **ni** l'icône PWA |

La scène, dans sa version 512 : salle bleu nuit, cadre or, écran de contrôle à gauche,
dossier de chaise, **le Planqué** (veste, chemise blanche, cravate or, yeux fermés),
bureau, **tasse de café or** fumante, plante d'angle, puis le nom en bas.
`vite.config.ts` reste la référence : `name: 'Bureau des Planqués'`,
`short_name: 'Planqués'`, `theme_color`/`background_color` `#0b1220`.

### 5.2 Comment la redessiner

- Vectoriel **uniquement** (pas de pixel art), `viewBox` carré, fond sombre, filet or.
- Le personnage : silhouette simple, tête ronde, calotte sombre, yeux fermés, épaules
  basses, un bras posé sur le bureau, l'autre vers la tasse.
- Pas de visage détaillé, pas de logo réel, pas de marque : on ridiculise la posture,
  jamais une personne (`docs/JEU.md` §4.2).
- La barre du haut reprend la **tasse** seule (`src/components/Layout.tsx`) : même dessin,
  simplifié pour tenir dans 30 px.
- La **marque du README** (`design/logo/`) reprend la tasse de l'icône du serveur des testeurs
  (dessinée par `icones_jeu.py`, dossier de session `planquex-discord`, hors dépôt) en **trait** :
  mêmes trois vapeurs, même anse qui descend au bas du godet ; l'ombre remplie devient un arc et le
  reflet disparaît, qui ferait une ligne de trop à 24 px.

---

## 6. Planches de style

Trois descriptions **reproductibles**, à copier telles quelles dans un modèle d'image
pour produire les illustrations (option A : IA + curation, **D-007**) — une par Planqué
de base, les variantes héritant de la leur. La cible suit **D-063** : **autour de 300**,
**sans compter** ; le volume réel se lit dans `npm run status`. Elles partagent le même
socle ; seuls le sujet et le cadrage changent.

### 6.1 Socle commun (à coller avant chaque planche)

> Illustration de jeu de cartes à collectionner, **rendu semi-réaliste peint**, éclairage
> de bureau en fin de journée, atmosphère feutrée et satirique mais jamais méchante.
> Palette **bleu nuit profond** (`#0b1220`, `#131c2e`) dominante, rehauts d'**or** (`#e6b64c`)
> et une seule couleur de faction saturée par image. Léger grain, matière mate, pas de
> brillance plastique. Composition centrée, sujet isolé du fond, **aucun texte, aucun
> logo, aucune marque lisible, aucune personne réelle identifiable**. Format carré,
> 2048×2048, sujet occupant 70 % du cadre, fond légèrement plus sombre que le sujet.
>
> **Lumière du visage** (leçon du 20/10/2026) : une **lumière principale douce et chaude
> éclaire le VISAGE** — peau bien exposée, traits lisibles, pas d'ombre sur les yeux.
> L'**or** n'est qu'un **liseré** sur les épaules et les cheveux. Un socle qui ne demande
> qu'un contre-jour (« rim light ») **laisse les visages dans le noir** : c'est l'erreur de
> la première vague (`design/illustrations/`, à regénérer).

### 6.2 Planche **Portrait** — Le portrait du Planqué (illustrations de Planqués)

- **Sujet** : un employé de bureau, seul, cadré du buste à mi-cuisse. Il **pose** sa
  posture pour la photo de trombinoscope du service.
- **Cadrage** : portrait serré, légère contre-plongée, regard hors-champ. Le décor
  (cloison, badge, écran éteint) n'est qu'un fond flou.
- **Lumière** : source latérale unique (lampe de bureau, écran, hublot) ; ombre douce
  portée ; un liseré d'or rasante sur l'épaule et la tasse.
- **Palette** : bleu nuit + la couleur de la faction en accent (vêtement, objet tenu,
  éclairage d'appoint) + or pour la tasse.
- **Ambiance** : fatigué mais placide, sourire en coin. Satire *punch up* : la posture
  est ridicule, le personnage reste sympathique.
- **À éviter** : visage d'illustration générique sans caractère, surcharge de détails,
  texte, filigrane, marque, uniforme d'entreprise existante.

### 6.3 Planche **Objet** — L'objet du service (illustrations de Collègues et d'Objets)

- **Sujet** : **une** relique de bureau posée sur un plan de travail sombre : par
  exemple une **tasse de café** ébréchée, un **dossier à sangle** badgé, une **baie de
  test**, un **paquet de gâteaux de réunion**. Le sujet remplit le cadre.
- **Cadrage** : nature morte, macro douce, dessus-légèrement-de-trois-quarts, le sujet
  au tiers inférieur, respiration au-dessus.
- **Lumière** : rasant latéral, une ombre nette unique, halo chaud au sol. Un reflet d'or
  sur un bord métallique ou céramique.
- **Palette** : bleu nuit en fond, objet en ton matériau (métal froid, carton, céramique),
  **or** sur un détail unique et lisible.
- **Ambiance** : vénérable et un peu usé — l'objet a une histoire, celle du service.
- **À éviter** : plusieurs objets concurrents, cadres superposés, texte imprimé lisible,
  marque d'entreprise réelle.

### 6.4 Planche **Lieu** — Le vivier (illustrations de zone)

- **Sujet** : **un lieu de travail vide de tout visage**, vu de loin : un atelier, un
  étage de bureaux ou une aile administrative. Trois variantes = les trois viviers
  (`docs/JEU.md` §4.2) : **Atelier** (outils, établis, machines), **Étage** (couloir de
  bureaux, baies vitrées, plantes), **Bureaux** (plateau partagé, cloisons, imprimante).
- **Cadrage** : plan large, un point de fuite marqué, perspective à hauteur d'épaule.
- **Lumière** : éclairage mixte fin de journée — lumière froide des néons, lumière chaude
  des lampes et du couchant aux fenêtres.
- **Palette** : bleu nuit dominant, ors en petits plans (lampes, poignées, reflets),
  une pointe de couleur de faction sur un objet signal (affiche, casque, deck).
- **Ambiance** : vide, silencieux, un peu trop propre — le calme avant la réunion.
- **À éviter** : personnages, visages au fond, texte d'affichage lisible, décor
  reconnaissable d'une entreprise réelle.

### 6.5 Réglages de génération conseillés

| Réglage | Valeur |
|---|---|
| Format | carré, 2048×2048 (variantes de Planqués : reprise de l'image de base + traitement holographique, `PROPOSITION.md` §4.6) |
| Graine | fixée par carte, notée dans le ticket de curation |
| Négatif commun | texte, logo, marque, watermark, photo réaliste, personne réelle, collage |
| Cadrage | constant par planche (voir 6.2 à 6.4) |
| Post-traitement | montée en contraste léger, vignette, calage sur la palette §1 |

---

## 7. Le tuyau d'illustration — testé le 20/10/2026

Le premier test de génération a été fait depuis un **Space Hugging Face** branché en MCP
(`mcp-tools/FLUX.1-Krea-dev`), avec le socle §6.1 et la planche Portrait (§6.2).

- **Prompt** (§6.1 + §6.2, en anglais — ces modèles répondent mieux ainsi) :
  « Editorial corporate dark-premium character illustration: a tired but placid office
  worker, waist-up portrait, slumped at his desk holding a gold ceramic coffee mug. Deep
  midnight-blue palette, single warm gold rim light from a desk lamp, one muted saturated
  faction accent. Semi-realistic painterly rendering, soft single side light, subtle film
  grain, matte surfaces, square 1:1 composition, subject centered on a darker background.
  No text, no logo, no watermark. »
- **Négatif** (Space `Qwen-Image`, quand il est utilisé) : `text, watermark, copyright,
  blurry, low resolution`.
- **Réglages** : `width`/`height` 1024, `num_inference_steps` 24, `guidance_scale` 4.5.
- **Graine** : `1692146197` — **à noter par carte** dans le ticket de curation (§6.5).
- **Résultat** : `design/tests/planque-portrait-01.webp` (1024×1024). Il confirme la
  direction : bleu nuit, or sur la lampe et la tasse, posture avachie, aucun texte.

**Ce tuyau est la voie de production** des illustrations (option A, D-007) : la cible et le
volume sont ceux du §6 (**D-063**, `npm run status`). Les Spaces disponibles en MCP :
`mcp-tools/FLUX.1-Krea-dev` (rendu
naturel, retenu pour les portraits), `mcp-tools/Qwen-Image` (meilleur pour le texte —
utile aux Objets étiquetés), `evalstate/flux1_schnell` (essais rapides), plus l'édition
(`FLUX.1-Kontext-Dev`) et le détourage (`not-lain/background-removal`).

## 8. Ce qui reste à curer (première passe assumée)

- Les illustrations réelles n'existent pas : les cartes affichent l'aplat de faction
  (`APLAT_FACTION`, une couleur plate depuis #208) et le `glyph` des données. Les planches §6
  décrivent le travail d'illustration à venir.
- Les textures (papier, métal, grain) et les effets holographiques sont **simplifiés** :
  voile en dégradé, pas de vraie feuille métallisée.
- Les raretés `3S` et `COU` sont stylées et **portées par 7 variantes re-raréfiées** (#87).
- Le contraste est vérifié pour les paires de texte ; le contraste des pips décoratifs et
  des voiles n'est pas un critère (l'information est portée par le texte).
- Aucune dépendance n'a été ajoutée pour cette passe (`AGENTS.md` §1, règle 7).
