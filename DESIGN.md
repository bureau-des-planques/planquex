# DESIGN.md — Bureau des Planqués

> **Système de design du projet** : palette, gabarit de carte, cadre de rareté, badges,
> mascotte et planches de style. Ce fichier est le **`DESIGN.md`** attendu à la racine par
> les agents de design (`create-design-md`) ; il **remplace** l'ancien
> `docs/DIRECTION-ARTISTIQUE.md`, fusionné dedans le 20/10/2026 pour n'avoir qu'une source.
>
> État : **première passe** (20/10/2026). Elle fixe les jetons de couleur, le gabarit de
> carte et les planches de style ; la **curation carte par carte** viendra ensuite.
> Ce document ne crée **aucune règle de jeu** : les règles vivent dans `AGENTS.md` §4 et
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

### 1.5 Contraste (Vérifié le 20/10/2026 ; pastilles de Condition et surfaces de scène ajoutées le 25/10/2026, D-093, #195)

Ratios WCAG calculés sur les paires réelles du thème (formule de luminance relative
WCAG 2.1). Seuil : **AA = 4.5:1** pour le texte courant.

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
| Texte COMEX (`#1c1304`) sur `--gold` | 9.75 | AA |
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
| **`--text-muted` sur feutre éclairci `--scene-felt-lit`** | **3.79** | **insuffisant** pour du texte courant — **écart consigné, non corrigé** (voir ci-dessous) |
| `--accent` (pastilles de café) sur feutre `--scene-felt` | 5.12 | AA |
| `--gold` sur feutre `--scene-felt` | 8.74 | AAA |
| `--scene-danger` sur feutre (filet d'état, non-texte) | 4.36 | **filet seulement** : 3:1 ✓, texte ✗ |

Méthode : luminance relative et ratio de la formule WCAG 2.1 calculés sur les valeurs hexadécimales
de `src/styles.css` (bloc `.battle`, jetons `--scene-*` de #190) et de `:root` ; pastilles :
la teinte à 22 % est composée sur `#0e1626` (`--bg-sunken`) avant le calcul. Les ratios ont été
calculés par un script jeté après usage, à refaire de la même façon. Les deux fautes AA de la
direction (`docs/DIRECTION-SCENE-COMBAT.md` §7 — crème sur parchemin à 2,41:1, blanc sur vert
à ≈2,1:1) sont **inversées** ici : encre sombre sur parchemin, encre sombre sur vert ou néon.

**Écart consigné** : `--text-muted` sur `--scene-felt-lit` tombe à **3,79:1** (sous 4,5:1). Le
feutre est éclairci **au centre** de la table (dégradé radial de `.board`), donc un texte atténué
posé au centre échoue. Aucune couleur n'est changée ici (hors périmètre de la doc) ; il faut
soit placer ce texte hors du centre, soit monter son encre. À trancher avec #196.

Le ratio d'une pastille de Condition est **plus haut** sur une carte de scène (`--scene-card`,
6,4 à 7,3:1) que sur `--bg-sunken` : le calcul ci-dessus est le cas le plus sombre où elle tombe.

**Plancher typographique du combat** : aucun texte porteur d'information (nom de Condition,
étiquette, Stress, compte, nom de zone) ne descend sous **`--fs-xs` (0.7rem)**. Relevé dans le code
(`src/styles.css`, règles de la scène, 25/10/2026) — **non vérifié à l'écran** (#187 modifie le
plateau en cours ; la vérification visuelle est renvoyée à **#196**) :

| Sélecteur | Taille | Information portée |
|---|---:|---|
| `.status-chip` (Conditions du Poste et de la légende) | `--fs-2xs` 0.62rem | nom de la Condition |
| `.pile` (étiquette Deck / Rebut) | 0.62rem | étiquette de pile |
| `.piste__nom` (nom du camp, piste d'Interventions) | 0.6rem | nom du camp |
| `.board__poste .stat-label`, `.board__bench .stat-label` | 0.64rem | libellé de statistique |
| `.hand__kind` | 0.64rem | nature de la carte (Collègue, Objet) |
| `.hand__tag` | 0.62rem | étiquette de la carte |
| `.bench__stress` | 0.68rem | Stress d'une carte au Banc |

Ces sept règles sont **sous le plancher** : c'est un écart de code, pas une règle de doc. Elles sont
consignées ici et restent à corriger (ou à justifier) en #196.

Le bouton primaire a été **corrigé** le 23/10/2026 (#131) : son haut, éclairci au blanc, donnait
**3.1:1** sous le texte blanc — le détecteur d'Impeccable **en navigateur** (`npx impeccable detect
<url>`) l'a relevé, la commande `npm run detect:ui` (analyse de sources, regex) ne le voit pas. Ce
dernier le dit lui-même : « findings are an undercount ». Les faction-boutons de la fiche d'une carte
(`--accent` remplacé par la couleur de la faction) gardent le texte blanc : pour les factions claires,
le ratio n'est pas garanti — **écart connu, laissé** (voir le rapport de #131).

Hors l'écart consigné ci-dessus (`--text-muted` sur feutre éclairci), aucune paire de texte
du tableau n'est en dessous de AA. Les pips de café (or sur fond sombre)
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
| Cadre | `.card` | un **anneau plein de 4 px** en dégradé de `--rarity` (de `--gold` pour un COMEX, `--frame`) — la rareté colore l'anneau **entier**, pas un filet sur un seul côté (tell d'UI générée) |
| Titre | `.card__top` / `.card__title` | barre pleine largeur teintée de la faction. En haut, le **stade** (`.card__stage`, Entrant / N+1 / N+2, ou la catégorie d'une carte Action) et le badge **COMEX** (`.card__comex`, or) ; dessous le **nom** (`.card__name`, Outfit 700, capitales, **deux lignes réservées**, un mot trop long se coupe) |
| Seuil | `.card__seuil-badge` | **plaque dorée** à droite du titre : le mot « Seuil » (dessiné par `data-label`) au-dessus du chiffre |
| Illustration | `.card__art` | l'image du registre **posée sur l'aplat `card.palette`** (deuxième couche : la carte garde son fond de faction pendant le chargement, ou si l'image n'arrive pas hors ligne — #131), sinon l'aplat seul + glyphe (`.card__glyph`) ; voile `.card__shine` ; les raretés étoilées reçoivent en plus un voile holographique (`.card--holo`) |
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
- Pips de café : 8 px, `gap` 2 px.

### 2.3 États

| Classe | Effet |
|---|---|
| `.card--selected` | bordure `--accent` + halo `color-mix(--accent 18%)` |
| `.card--comex` | `--frame` = `--gold` : l'anneau est or — le statut COMEX (D-026). L'or **est** l'anneau : il n'y a pas de second filet (l'ancien `.card--comex::before`, déclaré sans `content`, ne rendait rien ; retiré, #131) |
| `.card--holo` | voile holographique sur l'illustration (1S, 2S, 3S, COU) |
| `.card--compact` | masque la flavour et l'identifiant (grilles) |
| `.card-slot.is-full` | carte à 60 % d'opacité (plus d'exemplaire possible au Deck) |
| `.card-slot.is-missing` | carte **non possédée** : grisée (`grayscale`) et à 40 % d'opacité, plus pâle que `.is-full` pour que les deux ne se confondent pas. Sa pastille « ×0 » (pointillés) et la mention « Non possédée » restent **hors de `.card`** : elles ne s'éteignent pas avec elle |

**Le slot** (`CardSlot`, `src/components/CardSlot.tsx`) enveloppe la carte dans la Collection, dans « Dedans » et dans la Collection du Deck : un bouton rond au coin haut-droit (ajouter, ou ouvrir la fiche), et au coin bas-droit les pastilles — **possession** (`×2`, or) et **Deck** (`Deck ×1`, filet de la faction, seulement au-dessus de zéro).

**Le tri** (`TriCartes`, `src/components/tri-cartes.ts`) est le même sur la Collection et sur le Deck : par défaut, faction, stade, rareté (la plus rare d'abord), nom, possédées d'abord. La liste montre le choix courant ; « Réinitialiser » le rend à « par défaut ».

### 2.4 L'écran de combat (#169)

L'écran se lit **d'un coup** à 420 × 900 (D-060) : le plateau des deux camps, la main et les
actions de la Pression tiennent dans la fenêtre pour un tour courant, sans défiler. Ce qui est
secondaire (Conditions, Partie à deux, Journal) est **replié après**.

| Zone | Classe | Règle |
|---|---|---|
| Pas-à-pas | `.pas-a-pas` | **en haut**, sous l'en-tête, `position: sticky` ; pas de fond assombri. « Suivant » et « Précédent » **font défiler** la page vers la première cible (au centre) ; le contour doré `[data-pas-a-pas]` ne marque que les cibles de l'étape. Défilement instantané sous `prefers-reduced-motion` ou « Mouvement réduit » |
| Plateau | `.board`, `.board__side` | le camp adverse **en haut** (Banc puis Poste), le mien **en bas** (Poste puis Banc) : les deux Postes se font face. L'étiquette (« Poste », « Banc ») est à gauche, le contenu à droite |
| Actions | `.actions-panel` | « Au Poste » : café, Rotation, Talent, puis Pressions et « Fin du tour » |
| Main | `.hand`, `.hand__card` | une **bande** de cartes-boutons ; la marque « Jouable » dit lesquelles ont un geste |
| Pose | `.pose` | une carte **choisie** (`aria-pressed`, bordure `--accent`) ouvre un panneau qui la nomme ; les gestes disent **où** : « Poser au Poste », « Mettre au Banc 2 », « Jouer cet Objet » |
| Écran large (≥ 900 px) | `.battle__table` | le plateau à gauche, la console du joueur à droite |

### 2.5 Les états d'un écran (D-060, critère 3 ; #131)

Chaque écran a ses états — **vide**, **chargement**, **erreur**, **hors ligne** — ou dit pourquoi il n'en a pas. Les états **transverses** vivent dans le `Layout`, une seule fois :

| État | Où | Ce que voit l'invité |
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
| `--scene-danger` | `#e0563f` | tour adverse, craquage |
| `--scene-gold-hot` | `#f7e264` | le **Stress** qui monte |
| `--scene-parch` | `#b18a60` | le parchemin des piles (Deck, Rebut) |
| `--scene-parch-dark` | `#664d38` | le filet usé des piles |
| `--scene-ink-parch` | `#241a0c` | l'encre des piles (5,4:1 sur le parchemin, mesuré par `impeccable detect` sur la page) ; aussi la pastille du compte |
| `--scene-chalk` | `#f4e6cc` | le chiffre clair de la pastille du compte (sur `--scene-ink-parch`) |
| `--scene-felt-deep` | `#0d1420` | le bord vignetté de la table (les quatre coins) |
| `--scene-steel` / `--scene-steel-deep` | `#8a93a8` / `#4a5468` | le métal ardoise du cadre standard |

Les jetons sont posés sur `.battle` (`src/styles.css`, bloc « La scène de combat ») : ils
n'existent pas hors de l'écran de combat, et `:root` n'en change aucun.

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
compte ; le Rebut ne s'ouvre pas encore (son panneau arrive avec #188). La **piste d'Interventions**
est **un** conteneur — `data-pas-a-pas="interventions"` n'y est que là — avec six hexagones, trois par
camp, chacun nommé (« Intervention 2 sur 3, La Direction »). « Fin du tour » est vert quand c'est à
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
| `COU` | ♛ | `#c9a2ff` | filet violet + holo ; **3 variantes** depuis #87 |

Les raretés hautes (`3S`, `COU`) sont portées **uniquement par des variantes
re-raréfiées** (#87, `npm run status` → `"3S": 4, "COU": 3`). Le traitement
holographique s'applique déjà : `HOLO_RARITIES` les inclut (`src/components/CardView.tsx`).

---

## 4. Badges de statut

Les cinq conditions (`AGENTS.md` §4) sont rendues par `src/components/StatusBadge.tsx`,
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

### 5.1 Les trois fichiers

| Fichier | Contenu | Usage |
|---|---|---|
| `public/favicon.svg` | monogramme **BP** en dégradé or, cadre or sur bleu nuit (32×32) | favicon, lisible à 16 px |
| `public/icon-192.svg` | la scène complète, `viewBox` 512 (rendue en 192) | icône PWA |
| `public/icon-512.svg` | la scène complète + le mot « Bureau des Planqués » | icône PWA, écran d'accueil |

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
  jamais une personne (`AGENTS.md` §4.2).
- La barre du haut reprend la **tasse** seule (`src/components/Layout.tsx`) : même dessin,
  simplifié pour tenir dans 30 px.

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
  (`AGENTS.md` §4.2) : **Atelier** (outils, établis, machines), **Étage** (couloir de
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

- Les illustrations réelles n'existent pas : les cartes affichent l'aplat `palette` et le
  `glyph` des données. Les planches §6 décrivent le travail d'illustration à venir.
- Les textures (papier, métal, grain) et les effets holographiques sont **simplifiés** :
  voile en dégradé, pas de vraie feuille métallisée.
- Les raretés `3S` et `COU` sont stylées et **portées par 7 variantes re-raréfiées** (#87).
- Le contraste est vérifié pour les paires de texte ; le contraste des pips décoratifs et
  des voiles n'est pas un critère (l'information est portée par le texte).
- Aucune dépendance n'a été ajoutée pour cette passe (`AGENTS.md` §1, règle 7).
