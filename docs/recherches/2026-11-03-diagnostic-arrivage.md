# Diagnostic — l'ouverture d'un Arrivage (03/11/2026)

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `diag-arrivage/RAPPORT.md`. Les planches, frames et relevés `mesures.json` cités
> (`planches/`, `v2/`, `r420/`, `t420/`, `zoom.jpg`) ne sont pas archivés.

> Demande de Bastien : « améliorer le design du booster ; améliorer l'animation de sortie des cartes :
> là elles sont derrière le booster, on n'a pas l'impression qu'elles sortent du sachet ; avoir un mot
> comme Hearthstone (rare, épique, légendaire, dorée) mais avec des mots qui collent à l'univers. »
>
> **Aucune modification** de code ni de doc dans `planquex/` : `git status --short` = 0 ligne, branche
> `main` (vérifié en fin de session). Écriture seulement dans un dossier de travail éphémère, **non archivé**.
> Version du jeu : non citée (elle se lit dans `package.json`, `docs/VERSIONS.md` fait autorité).
>
> Légende : **OBSERVÉ** = commande, fichier ou image vue (chemin cité). **DÉDUIT** = raisonnement,
> non vérifié par une mesure. **NON VÉRIFIÉ** = pas pu faire.

---

## 0. Ce qui a été lu et lancé

| Quoi | Résultat |
|---|---|
| `AGENTS.md` ; `docs/DECISIONS.md` D-137, D-141, D-164, D-169, D-170, D-179 ; `docs/DECISIONS-INDEX.md` | lus. L'index n'a aucune ligne sur « annonce », « rareté (mot) », « sachet », « pochette » : **aucune décision ne nomme les raretés** |
| `docs/SPEC-OUVERTURE-ARRIVAGE.md`, `docs/JEU.md` §3 et §5, `docs/SONS.md`, `DESIGN.md` §2–3, `docs/preuves/ouverture-arrivage-2026-10-28/README.md`, `PRODUCT.md` | lus |
| `gh issue list --state open --search "arrivage"` (exit 0) | **#658** (paquet principal) et **#654** (mot de passe oublié) — ni l'un ni l'autre ne touche l'ouverture. Recherches « ouverture », « sachet », « pochette », « rareté », « annonce », « animation » : seul **#504** (installation iPhone) sort. **Aucun ticket ouvert sur l'ouverture d'Arrivage.** Voisin : **#497** « Preuve de rendu : captures de la synchro » (même famille que la friction §6.1) |
| `npm run detect:ui` (exit 0) | « 373 files scanned with regex matching only … findings are an undercount » : **aveugle** à l'empilement et à la taille rendue |
| `npm run status` (exit 0) | comptes de rareté : `1S` 43, `2S` 25, `4D` 15 (utilisés §3.3) |
| Serveur de dev | lancé par moi sur **127.0.0.1:5192** (`VITE_SUPABASE_URL=http://arrivage-factice.invalid`, pid npx 4187238 / node 4187252), **arrêté** : `kill`, puis `ss -ltn \| grep 5192` → exit 1, rien n'écoute |
| Skill `impeccable` | **refusée** : `Permission denied: skill` (§6.4). La critique du §2 est donc faite **à la main**, sans la skill |

---

## 1. Filmer l'ouverture, et pourquoi les cartes paraissent derrière le sachet

### 1.1 L'outil canonique ne peut plus atteindre la scène — OBSERVÉ

```
BASE_URL=http://127.0.0.1:5192 node scripts/preuves/filmer-animation.mjs --chemin / --clic '.hero__ouvrir' \
  --attendre '.ouverture' --images 4 --intervalle 100 --sortie <dossier-de-travail>/outil-canonique
→ locator.click: Timeout 30000ms exceeded … waiting for locator('.hero__ouvrir').first()   exit=1
```

Cause (sonde `v2/sonde.mjs` du dossier de travail, **non archivée**, exit 0) : avec un Supabase configuré, l'app
redirige vers `/connexion` (« Entrer dans l'alpha ») ; sans Supabase configuré, `Home.tsx` refuse
l'ouverture (`echec === 'configuration'`, D-179 (6)). **Dans les deux cas l'outil standard ne filme
pas la scène** depuis #651 (D-179 (2) : « l'Arrivage s'ouvre en ligne »).

Contournement (le script laissé par la tentative précédente, relu, **réutilisé** et relancé) :
`filmer-arrivage.mjs`, **non archivé**. Il réutilise `htmlPlanche` et `etatAmorce` de
l'outil du dépôt, pose une configuration Supabase **factice** (le navigateur intercepte
`http://arrivage-factice.invalid/**`, aucune requête ne sort), une session factice, un tirage choisi
(1D, 2D, 1D, 3D, ★), et **mesure à chaque frame** quelle part de chaque carte est recouverte par le
corps du sachet.

Relances de cette session (exit 0, `erreurs: []` dans les deux `mesures.json`) :

```
BASE_URL=http://127.0.0.1:5192 node filmer-arrivage.mjs v2/f420  420  900 22 150   → exit 0
BASE_URL=http://127.0.0.1:5192 node filmer-arrivage.mjs v2/f1280 1280 800 22 150   → exit 0
```

### 1.2 Planches (chemins)

| Planche | Chemin |
|---|---|
| Envol à 420 × 900 (40 frames, la mesure en légende) | `planches/envol-420x900.jpg`, **non archivée** ; frames brutes + `mesures.json` : `…/t420/` |
| Envol à 420 × 900, **relancé cette session** | `v2/envol-420x900-rerun.jpg`, **non archivée**, `…/v2/f420/planche.png`, `…/v2/f420/mesures.json` |
| Envol à 1280 × 800 | `…/planches/envol-1280x800.jpg` ; relancé : `…/v2/f1280/planche.png`, `…/v2/f1280/mesures.json` |
| Envol à 390 × 664 | `…/planches/envol-390x664.jpg` |
| Zoom sur deux instants (montée, puis étalage derrière le sachet) | `…/zoom.jpg` |
| Révélation à 420 × 900 (◆◆◆ « Promotion interne ! », ★ « Le COMEX valide sans réunion ! », fiche) | `…/planches/revelation-420x900.jpg`, frames `…/r420/` |
| Dos des cinq cartes avant tout retournement | `…/t420/f17.png` |

### 1.3 Ce que les images montrent — OBSERVÉ

À 420 × 900, mesure `cartesSousLeCorps` (part de chaque carte recouverte par le corps opaque du
sachet, sous la ligne de déchirure), `…/v2/f420/mesures.json` :

| t (ms depuis le relâchement) | corps (opacité) | % de chaque carte masqué | haut des cartes (px) |
|---|---|---|---|
| 35 – 363 | 1 | 100, 100, 100, 100, 100 | 225 |
| 745 | 1 | 64, 68, 72, 82, 92 | 89 |
| 1101 – 1454 | 1 | 53 → 50 (la montée finit à ~**50 % cachées**) | 44 → 29 |
| 1828 | 0,97 | 44 – 47 | **27** (< bas du titre, 52 : les cartes passent sous le titre) |
| 2187 | 0,76 | 4, 4, 57, 28, 28 (les cartes **s'étalent encore derrière** un sachet qui s'efface) | 46 |
| 2558 | 0,04 | 0, 0, 0, 0, 55 | 62 |
| 2921 | 0 | 0 | 62 |

À 1280 × 800 (`…/v2/f1280/mesures.json`) : **le haut des cartes tombe à −72 px puis −82 px (t = 1327
et 1967 ms) : elles sortent de la fenêtre par le haut** ; 50 % toujours cachées derrière le corps.

Trois choses se lisent sur `zoom.jpg` : (1) le haut de la pile émerge, mais **le bas de chaque carte
est coupé net par le bord supérieur du film** — c'est le seul indice de profondeur ; (2) pendant
l'étalage (1700 ms →), les cartes arrivent dans leur grille **sous** un sachet qui s'estompe ; le texte
« ARRIVAGE » et le triangle se superposent en **fantôme** aux dos de cartes ; (3) à aucun instant une
carte n'est **devant** le sachet avant qu'il ait disparu.

### 1.4 Pourquoi — cause, avec fichier:ligne

**Cause principale (OBSERVÉE sur le DOM et la feuille) : un ordre d'empilement qui met les cartes
sous le sachet pendant toute l'ouverture, y compris quand elles « partent ».**

| Fait | Fichier:ligne |
|---|---|
| La zone du sachet est à `z-index: 2` | `src/styles.css:6184-6192` (`.ouverture__zone`, `z-index: 2` l.6191) |
| La liste des cartes est à `z-index: 3`… | `src/styles.css:6428-6436` (l.6435) |
| …mais **tant que `apres` vaut `'ouverture'` ou `null`**, elle porte `--dedans` = `z-index: 1`, donc **sous** la zone | `src/animation/ouverture/SceneOuverture.tsx:928-931` ; `src/styles.css:6454-6458` |
| `apres` ne passe à `'revelation'` qu'à **2 900 ms** (`ENVOL.revelation`) ; ce n'est qu'alors que la zone est retirée du DOM (`!reduit && apres !== 'revelation' …`, l.871) | `SceneOuverture.tsx:69-76`, `:453-456`, `:871` |
| Le corps du sachet est **opaque** : un `rect` rempli du film, puis tout le cadre imprimé | `src/animation/ouverture/Pochette.tsx:104`, `:127-129` ; rendu avec `clipPath` sur le tracé de déchirure `SceneOuverture.tsx:896` |
| Il ne s'efface qu'à partir de **1 500 ms** (délai), sur 1 000 ms, en descendant de 70 % | `src/styles.css:6414-6424` (`ouverture-descend 1000ms … 1500ms`) |

Donc, du point de vue du navigateur, **le sachet est toujours au-dessus des cartes tant qu'il est
dans le DOM**. Rien dans la séquence ne fait changer ce rapport au moment où les cartes « sortent ».

**Cause secondaire : la trajectoire de la montée est trop courte, et centrée sur la scène, pas sur le
sachet.**

- `poseDe` (`SceneOuverture.tsx:779-797`) place les cartes à `fente + 8 px` (dedans), puis, à
  `sortie === 1`, le **haut** de la carte à `fente − 0,55 × hauteurCarte` : **45 % de la carte reste
  derrière le corps** (c'est la mesure ci-dessus, ~50 %). Chaque carte est réduite à 0,8 × la largeur
  du sachet (`echelleSachet`, l.781) : elles ne dépassent donc même pas son gabarit.
- Les cinq cartes montent **en même temps** (1 300 ms, 60 ms d'écart, l.795), en éventail de ±4° :
  une seule pile qui dépasse de la fente, pas des cartes qui **sortent une à une**.
- La pile est un **frère** du sachet dans le DOM (`<ol class="ouverture__cartes">`, l.928), pas son
  enfant : elle **n'hérite pas** de l'inclinaison 3D (`--rx/--ry`, `styles.css:6233-6247`) ni du
  flottement (`ouverture-flotte`, `styles.css:6198-6215`, ±1,4 % de la hauteur). DÉDUIT : si le doigt
  a incliné le sachet au relâchement, la fente et la pile ne sont plus sur le même plan ; **non
  mesuré**.
- À l'étalage (`sortie === 2`, l.771-778), les cartes partent vers leur grille finale **depuis
  derrière le sachet**, avec `z = 30 − i` *dans* un conteneur à `z-index: 1`. C'est ce qui produit
  « les cartes arrivent sous un sachet fantôme » (§1.3 (2)). Le geste se lit à l'envers : ce n'est pas
  le sachet qui rend les cartes, ce sont les cartes qui se glissent hors de dessous un décor qui part.
- Rien ne dit à l'œil que la fente est une **bouche** : pas de dos de sachet visible derrière les
  cartes, pas de lèvre ni d'ombre portée sur la tranche des cartes, seulement le `ouverture__interieur`
  (un dégradé lumineux, `styles.css:6329-6345`).
- Aucune borne en hauteur : à 1280 × 800 la pile monte au-delà du haut de la fenêtre (−82 px, §1.3) ;
  à 420 × 900 elle passe sous le titre (haut des cartes 27 px < bas du titre 52 px ; le titre est à
  `z-index: 8`, `styles.css:6171`).

**À noter** : le rendu « carte coupée par le film » est physiquement juste pour une carte *dans* un
sachet. Le défaut n'est pas la superposition elle-même, c'est qu'elle **dure jusqu'au bout** et qu'il
manque les indices (bouche, lèvre, bascule devant) qui font lire « sorti ».

---

## 2. Critique du sachet et de l'animation (sans la skill `impeccable`)

> La skill est refusée (§6.4). Critique faite sur les images, `DESIGN.md`, `PRODUCT.md`, et la lecture
> de `Pochette.tsx`. Elle n'est **pas** le rapport d'`impeccable critique` : à refaire si la skill se
> débloque. Le détecteur `npm run detect:ui` n'a rien à dire (regex seule).

### 2.1 Le sachet (`Pochette.tsx`)

| # | Constat | Gravité | Preuve |
|---|---|---|---|
| 1 | **Générique.** Film argenté, cadre bleu nuit et or, triangle d'avertissement : c'est l'icône « booster de TCG ». La satire du bureau n'est que dans la microcopie (« SACHET ANTISTATIQUE · NE PAS PLIER », « Contenu non contractuel. »). `PRODUCT.md` : le vocabulaire est le trait non copiable ; le sachet ne l'exprime pas | P1 (identité) | `planches/envol-420x900.jpg` case 1 ; `Pochette.tsx:126-229` |
| 2 | **La blague est illisible** : « SACHET ANTISTATIQUE… » à 7,5 unités de `viewBox` et « Contenu non contractuel. » à 7, soit ~8,4 et ~7,8 px à 420 (sachet de 336 px de large pour 300 unités). C'est sous le plancher maison `--fs-2xs` = 9,92 px (`DESIGN.md` §1.5). Texte décoratif, `aria-hidden`, mais c'est **le seul gag du sachet**. Le détecteur ne voit pas le texte SVG | P2 | calcul `336/300 × 7,5` ; `Pochette.tsx:208-229` |
| 3 | **Tout est or** : cadre, titre, triangle, code-barres. L'or est déjà la couleur de 5 raretés sur 8 (§3.2) ; le sachet n'a aucune couleur propre, rien qui dise « c'est un Arrivage » plutôt qu'un cadre de carte | P2 | `Pochette.tsx:76-82`, `:127-140` |
| 4 | **Pas de volume ouvert.** Après déchirure, le film n'a ni épaisseur, ni intérieur : un rectangle plat dont on a retiré une bande. C'est ce qui rend la sortie des cartes irréelle (§1.4) | P1 | `zoom.jpg` |
| 5 | La déchirure (geste, pointillés, bande qui pivote, trait de lumière, étincelles) est **bonne** et testée : à garder | — | `docs/SPEC-OUVERTURE-ARRIVAGE.md` §3.2, `etats.test.ts` |

### 2.2 L'animation

| # | Constat | Gravité | Preuve |
|---|---|---|---|
| 1 | **Sortie à l'envers** (§1.4) : cartes sous le sachet jusqu'à 2,9 s, puis le sachet disparaît | P1 | §1.3 |
| 2 | **Les cartes sortent du cadre** à 1280 × 800 (−82 px) et passent sous le titre à 420 | P1 | `v2/f1280/mesures.json` |
| 3 | **Le signal de rareté avant retournement ne distingue pas les raretés** : le dos « luit de sa couleur » (`styles.css:6486-6504`), mais ◆◆◆ `#c9a227`, ◆◆◆◆ `#f0c75e`, ★ `#e8b54a`, ★★ `#f2d27a`, ★★★ `#ffd76e` sont **cinq ors** : écart de couleur (ΔE 76, CIELAB) de **5,7 à 23,7** entre eux (4D↔3S 5,7 ; 4D↔1S 7,8 ; 2S↔3S 9,2). Seule la Couronne (violet) ressort (ΔE ≥ 94). Sur `t420/f17.png`, la ◆◆◆ (milieu droit) et la ★ (bas) ont la même lueur dorée, et les trois simples ont déjà un filet doré. Le joueur sait « il y a un rare », pas lequel. Hearthstone s'appuie sur trois teintes (bleu, violet, orange) que notre échelle n'a pas | P1 | calcul ΔE dans la session (script inline, `RARITY_META` `src/data/index.ts:79-90`) ; `t420/f17.png` |
| 4 | **L'annonce existe déjà**, mais c'est une **phrase tirée au hasard** dans le palier (`ANNONCES`, `revelation.ts:60`), pas un **nom de rareté stable** : le testeur n'apprend pas l'échelle. Elle n'arrive qu'**au retournement**, pas à la levée | P2 | `revelation.ts:60-88` |
| 5 | Un **rectangle gris en dégradé** apparaît à droite du texte d'annonce (x 365–420, y 700–780) sur au moins une frame de la ★ (`r420/f35.png`, 2 800 ms) ; **cause non cherchée** (peut-être une particule, un reflet de carte voisine, ou le fond de l'annonce) | P2 | `r420/f35.png` |
| 6 | **Le son ne suit pas le geste** : `jouer('arrivage')` part **au clic** sur « Ouvrir un Arrivage » (`Home.tsx:96`, commentaire : « il ne se déplace pas dans la réponse »). Le fichier dure 0,95 s et contient « film qui craque, déchirure, claquement » (`docs/SONS.md`) ; or le testeur déchire **après** : serveur (D-179) + arrivée du sachet (760 ms) + son geste. DÉDUIT, **non écouté** | P2 | `Home.tsx:91-96`, `SONS.md` |
| 7 | Mouvement réduit (D-098) : la scène s'ouvre sur les cartes retournées, **sans annonce ni mot** : tout ce qu'on ajoutera comme mot devra exister en statique | contrainte | `SPEC` §5 |

---

## 3. Direction proposée

### 3.1 Le sachet — l'« Arrivage » comme objet du courrier interne

Ce que je recommande (Bastien tranche — c'est une question de goût) :

- **Garder** le format vertical 3 × 5, la ligne de pointillés, le geste de déchirure, `LIGNE`
  (`Pochette.tsx:15-17`) et tout ce que `etats.test.ts` garde : la déchirure est le seul geste obligatoire
  de l'écran (D-170 (3)). On change **le dessin et la profondeur**, pas le geste.
- **Remplacer** « sachet antistatique argenté » par un **sachet du courrier interne** : film bulle
  ou kraft, **bordereau d'expédition** imprimé (n° d'Arrivage, « Destinataire : le testeur », case
  « Fragile — Planqués »), **tampon « REÇU »** à moitié sur le bord, **étiquette de scellé** sur la ligne de
  déchirure (« Ne pas ouvrir avant la pause café »), couleur propre (kraft ou bleu-gris chaud) pour que
  l'or reste celui des cartes. La satire passe dans **l'objet**, plus seulement dans le texte.
  Variante plus audacieuse, à soumettre : **enveloppe navette** à œillets, destinataires barrés.
- **Un vrai volume ouvert** : un **dos du sachet** (panneau arrière plus sombre, visible derrière les
  cartes après la déchirure), une **lèvre** (le bord déchiré du panneau avant, avec une ombre portée sur la
  tranche des cartes), la lumière `--lueur` qui sort **entre** les deux panneaux.
- Texte du sachet **à ≥ 9,92 px rendus** (plancher `--fs-2xs`) ou assumé décoratif **et** déplacé là
  où il se lit ; contraste vérifié (`DESIGN.md` §1.5).

### 3.2 La séquence de sortie — les cartes sortent, puis passent devant

Trois couches (arrière → avant) : **dos du sachet** < **cartes** < **corps (panneau avant)**, jusqu'à
une bascule, puis **cartes devant tout**.

| t (depuis la déchirure complète) | Ce qui se passe | Couche |
|---|---|---|
| 0 – 1 000 ms | la bande s'envole (inchangé), éclair, gerbe ; le sachet **cesse de flotter et de s'incliner** (retour à 0 en 250 ms) pour que fente et pile soient sur le même plan | dos < cartes < corps |
| 300 – 1 500 ms | la pile **monte par la bouche** jusqu'à 70 % de sa hauteur, **carte par carte** (écart de 120 ms, la meilleure en dernier comme dans le tirage), avec un léger éventail ; la hauteur est **plafonnée** à ce que la scène autorise (ni sous le titre à 420, ni au-dessus de la fenêtre à 1280) | dos < cartes < corps |
| 1 500 ms | **bascule** : au moment où le bas de la pile franchit la lèvre, la liste passe à **z > zone** ; la pile **grandit vers le spectateur** (échelle 0,8 → ~1) | cartes > sachet |
| 1 500 – 2 400 ms | **le sachet tombe et s'efface derrière** (translateY + opacité, 700 ms) ; les cartes restent | cartes > sachet |
| 1 900 – 3 100 ms | la pile **s'éventaille** vers la grille d'étalage, carte par carte, depuis l'avant | cartes |
| ~3 100 ms | révélation (le focus sur la première carte, inchangé) | — |

Contraintes gardées : chaque `animation` **≤ 3 s** (D-141), aucune boucle < 1 s, **aucun flou animé**.
Les `transition` posées en ligne par la scène (`SceneOuverture.tsx:966`) **ne sont pas** vues par
`bornesDeLArrivage` (qui lit seulement les déclarations `animation:`) : la séquence peut donc dépasser
3 s au total sans enfreindre D-141, mais **c'est un trou**, pas une permission explicite (§4).

Masque : pendant « dedans », pas de `clip-path` à ajouter (le panneau avant occulte déjà la partie basse) ;
un `clip-path: inset()` sur la pile **n'est utile que** si on garde un fondu du corps. Avec la bascule
devant + sachet qui tombe, on n'en a plus besoin — c'est le plus simple et ça supprime le « fantôme » du §1.3.

### 3.3 L'annonce de rareté avant retournement

**Ce qui existe** : dos qui luit (palier `rare`/`brillante`/`secrete`), annonce **au retournement**.
**Ce qui manque** : (a) un signal qui **distingue** les raretés, (b) un **nom stable**, (c) le moment : à
la **levée** (la phase `tension`, 900–1 900 ms), pas seulement après.

- **Distinguer sans dépendre de la teinte seule** (WCAG 1.4.1, et la palette est déjà tout or) : par palier,
  une **forme** de lueur en plus d'une teinte propre à la scène (jetons de scène, pas `RARITY_META`, qui reste la
  source des couleurs de carte — Collection, Deck, fiche) :

  | Palier | Lueur du dos | Au toucher |
  |---|---|---|
  | `rare` ◆◆◆ | halo chaud fixe | un tampon posé sur le dos |
  | `brillante` ◆◆◆◆ (COMEX) | double halo, pulsation lente (≥ 1 s, D-141) | tampon + tremblement (existant) |
  | `secrete` ★ / ★★ | reflet **prismatique** sur le cadre (le voile holo existe déjà, `ouverture__holo`) | tampon + éclair (existant) |
  | `secrete` ♛ | violet (déjà seule teinte distincte) | — *(ne sort d'aucun Arrivage, D-044)* |

- **Le mot est un tampon** : il se **tamponne** sur le dos de la carte à la levée (rotation −6°, encre
  rouge ou bleu de bureau, bord irrégulier), puis la **phrase** d'humour (l'annonce actuelle) arrive au
  retournement. Le tampon est **dans le DOM dès le premier rendu** (comme les `CardView`, `SPEC` §5), lu par
  `role="status"`, et **reste sur la fiche** (« Rareté : ◆◆◆ · Visé ») — donc exploitable en Mouvement réduit.
- **Le tirage ne bouge pas** : l'ordre de `openPackCards` est déjà « la meilleure en dernier » (`pack.ts:60-65` (`openPackCards`)) ;
  l'annonce ne change aucune règle.

### 3.4 Les mots — raretés réelles et propositions

**Raretés réelles** (OBSERVÉ : `src/data/types.ts:28`, `src/data/index.ts:79-90`, `docs/CARD-SPEC.md` §1) :
`1D` ◆, `2D` ◆◆, `3D` ◆◆◆, `4D` ◆◆◆◆, `1S` ★, `2S` ★★, `3S` ★★★, `COU` ♛ — **huit raretés, quatre
paliers** (`revelation.ts:26-38` : simple, rare, brillante, secrète). **Aucune n'a de nom** : `JEU.md` §3 n'a
pas de ligne « rareté », le `label` est un symbole.

**Ce qui sort d'un Arrivage** (OBSERVÉ : `PACK_COMPOSITION`, `src/game/pack.ts:38-42`) : 3 cartes ◆/◆◆, 1 ◆◆◆,
1 carte parmi `1S`, `2S`, `4D`. Avec les comptes de `npm run status` (4D 15, 1S 43, 2S 25), **DÉDUIT** (tirage
uniforme sur les cartes du vivier) : ~18 % de ◆◆◆◆, ~52 % de ★, ~30 % de ★★. `3S` et `COU` (7 variantes) **ne sortent
d'aucun Arrivage** (`JEU.md` §5, D-044) : leur donner un mot maintenant est du travail sans effet.
Note : `docs/CARD-SPEC.md` §1 dit `1S` 24 / `2S` 29 (instantané D-005) ; le code dit 43 / 25. Écart de doc, hors sujet.

**« Dorée » n'existe pas dans le jeu.** Aucune carte « dorée » (ni `foil`, ni variante dorée) dans `JEU.md`, `CARD-SPEC.md`
ni `src/data`. Le seul « or » est la **couleur** des raretés ◆◆◆ à ★★★ et le **cadre COMEX**. L'équivalent
fonctionnel de la dorée de Hearthstone (la même carte, version plus belle) est ce que sont déjà nos **variantes
`-star`/`-star2`** (même carte, rareté étoilée, voile holo). Créer une dorée serait une **mécanique nouvelle** :
interdit sans décision (`AGENTS.md` §1.6, D-018/D-020 : « miroir », Pocket n'a pas de foil).
→ **Je propose de ne rien créer et de mapper « dorée » sur ★★** (à confirmer par Bastien).

**Mapping proposé** (4 mots, comme la demande ; les simples n'ont pas de mot, comme la commune de Hearthstone) :

| Rareté du jeu | Rôle Hearthstone | Mot (nom stable) | Jeu de mots n° 1 (annonce) | Jeu de mots n° 2 (annonce) |
|---|---|---|---|---|
| ◆ ◆◆ | commune | — (aucun) | — | — |
| ◆◆◆ | rare | **Visé** | « Visé ! » (le visa du service) | « Paraphé ! » (les initiales du chef) |
| ◆◆◆◆ = COMEX | épique | **Signé** | « Signé de la Direction ! » | « Arbitrage du COMEX ! » |
| ★ | légendaire | **Placard doré** | « Placard doré ! » (le planqué dans le placard — l'expression française existe) | « Inamovible ! » (le poste dont on ne bouge plus) |
| ★★ | « dorée » | **Médaille d'or** | « Médaille d'or du travail ! » (la vraie distinction) | « Prime d'ancienneté ! » |
| ★★★ ♛ | (hors tirage) | *(rien pour l'instant)* | | |

Vérification (script `v2/mots.py` du dossier de travail, **non archivé**, exit 0) contre la liste exécutable
`FORBIDDEN_ANY_CASE` de `src/data/cards.test.ts:30-44` (`Galère`, `GalèreMon`, `Grèvomon`, `Pokémon`,
`Open-space`, `Classeur`, `Galérodex`, `Bac à courrier`, `Reprise de poste`), `FORBIDDEN_UPPER`, et les termes
réservés de `JEU.md` §3.1 : **aucun interdit, aucun terme réservé** pour les mots et annonces du tableau.
Alternatives écartées : « Poste à vie ! » (collision avec le **Poste**, la zone active) → remplacé par
« Inamovible ! » ; « Échelon » (c'est le **Ranked**), « Cotisation », « Casier », « Chrono », « Tickets »,
« Intervention », « Note de service » (réservé à la Mission), « comité » (c'est le mur).
**Constat sur l'existant** (mêmes vérifications) : trois annonces **actuelles** frôlent un terme réservé :
« Validé en comité ! » (comité = le mur), « Note de service exceptionnelle ! » (= Mission), « Poste à vie, sans
entretien ! » (= Poste). Aucune n'est interdite ; à trancher avec le reste.

### 3.5 Le son

Rien ne l'**exige** (D-137 : deux sons, D-166 : trois de plus pour le combat, « rien d'autre »). Deux
besoins, à décider (§4) : **recaler** `arrivage.wav` (0,95 s, déchirure + claquement) sur le **relâchement
de la déchirure** (`lancerOuverture`, `SceneOuverture.tsx:423`) au lieu du clic ; et, si le mot est un
tampon, **un son de tampon** — `intervention.wav` (« tampon de caoutchouc ») existe mais D-166 le lie à
l'Intervention.

---

## 4. Décisions touchées

| Décision / règle | Touchée ? | Pourquoi / quoi faire |
|---|---|---|
| **D-141** (bornes de l'ouverture) | **Non amendée si** chaque `animation:` ≤ 3 s, boucle ≥ 1 s, pas de flou animé | Elle ne borne que les déclarations `animation:` (`effets-combat.test.ts:332-346`). Les `transition` posées en ligne par la scène (`SceneOuverture.tsx:966`) et les `setTimeout` de l'envol (`:453-456`) échappent à toute borne : **la séquence totale n'est pas bornée**. À dire dans le ticket ; l'amender n'est utile que si on veut une durée totale maximale |
| **D-098** (Mouvement réduit) | **Contrainte** | La scène s'ouvre sur les cartes retournées, sans annonce : le mot doit exister **en statique** (fiche, badge) |
| **D-137 / D-166** (sons) | **À amender si** on recale le son ou en ajoute un | D-137 (b) : « le clic qui ouvre l'Arrivage » ; `Home.tsx:91-96` dit même « il ne se déplace pas dans la réponse ». Recaler sur la déchirure = changer ce texte. Un son de tampon dédié = nouveau son (D-137 « rien d'autre », D-166) ; réutiliser `intervention.wav` = un autre sens pour un son que D-166 a lié à l'Intervention |
| **D-169 / D-170** (lisible à 420 px) | **Contraintes à reprendre dans les critères** | Carte étalée 172 × 242 px à 420 (échelle 0,783, `D-170`) : tampon et mot ≥ 11,2 px rendus (`--fs-xs`) ; **premier tap ouvre la fiche** sous l'échelle 1 ; `.ouverture__carte button` = 0 ; la déchirure reste **acquise** sous le seuil (D-170 (3)) ; la carte est `calme`, pas de bouton dans un bouton |
| **D-044 / `JEU.md` §5** (raretés hautes) | Aucune | Pas de mot pour ★★★/♛ : elles ne sortent d'aucun Arrivage |
| **D-018 / D-020** (miroir), **`AGENTS.md` §1.6** | **« Dorée » = mécanique nouvelle** | Interdite sans décision. Je propose de ne pas la créer (mapper sur ★★) |
| **`AGENTS.md` §1.4, `JEU.md` §3** (vocabulaire) | **Oui — décision datée obligatoire** | Les noms Visé / Signé / Placard doré / Médaille d'or sont du **vocabulaire** : une ligne « Rareté » dans `JEU.md` §3.1 + une décision (`D-1NN`) + `npm run index:decisions` |
| **`DESIGN.md` §3 et §1.5** | **À amender** | Si les lueurs de scène ont de nouvelles teintes : jetons propres à la scène, paires de contraste recalculées ; `RARITY_META` reste la source des couleurs de carte. `DESIGN.md` §2.1 : la Couronne a un anneau **plat** (un dégradé de violet est un tell) — ne pas l'étendre à la lueur |
| **`docs/SPEC-OUVERTURE-ARRIVAGE.md` §3.3, §6** | **À réécrire** | Le tableau de l'envol (2 900 ms, « elles sont derrière le corps du sachet, qui les cache ») décrit **le défaut**. Document descriptif, pas une autorité : il suit le code |
| **D-179** (ouverture en ligne) | Contrainte | La scène ne s'ouvre qu'à la réponse du serveur : la preuve de rendu doit simuler la réponse (§6.1) |

---

## 5. Tickets proposés

Ordre conseillé : **T0 → T1 → T2 → T4 → T5 → T6 → T3**. T0 est un **prérequis de preuve** : sans lui, aucune
planche de T1–T3 ne se refait avec l'outil standard.

**T0 — Preuve de rendu : l'Arrivage se filme et se capture sans backend (D-179)**
`scripts/preuves/filmer-animation.mjs` n'atteint plus la scène ; `npm run capturer` « ignore » l'état `arrivage`
(`capturer.mjs:984-1008`).
- AC1 : `node scripts/preuves/filmer-animation.mjs --arrivage-factice --images 40 …` sort une planche à 420 × 900 et à 1280 × 800, **exit 0**, avec en légende l'étape (`data-etape`) et la part de chaque carte masquée par le sachet ; le script du diagnostic (`filmer-arrivage.mjs`, **non archivé**) en est le prototype.
- AC2 : `npm run capturer` capture l'état `arrivage` **sans** `VITE_SUPABASE_URL` réel : la sortie ne contient plus « non capturé » pour `arrivage`.
- AC3 : **le contrôle mord** : si l'interception est cassée, l'outil sort en **exit ≠ 0** (aucun repli silencieux).
- AC4 : `docs/preuves/ouverture-arrivage-2026-10-28/README.md` ne cite plus de commande qui n'atteint pas la scène.

**T1 — Les cartes sortent du sachet : devant, pas derrière** (la demande n° 2)
- AC1 : sur la planche à **420 × 900** et à **1280 × 800**, après la montée, **0 %** de chaque carte est recouvert par un corps d'opacité > 0,05 (mesure `cartesSousLeCorps` du script T0) ; avant, ~50 % (§1.3).
- AC2 : pendant la montée, ≥ 70 % de la hauteur de chaque carte est au-dessus de la bouche.
- AC3 : `hautCartes ≥ 0` et sous le bas du titre à **390 × 664, 420 × 900 et 1280 × 800** (−82 px à 1280 avant).
- AC4 : test dans `styles-ouverture.test.ts` : la règle de couche (« la liste des cartes passe au-dessus de la zone à la bascule ») ; **le contrôle mord** : inverser les deux `z-index` le fait échouer.
- AC5 : `bornesDeLArrivage` (`npm test -- src/components/effets-combat.test.ts`) passe ; mouvement réduit et le parcours au clavier/bouton de `SceneOuverture.test.tsx` inchangés ; une planche de frames **à 420 × 900** et **à 1280 × 800** est rangée dans `docs/preuves/` avec sa commande.

**T2 — Le sachet a de la profondeur : dos, bouche, lèvre**
- AC1 : après la déchirure, la planche montre un **panneau arrière** visible derrière la pile et une **lèvre** qui projette son ombre sur la tranche des cartes.
- AC2 : l'inclinaison (`--rx/--ry`) et le flottement sont ramenés à 0 au relâchement : écart horizontal entre le centre de la bouche et celui de la pile ≤ 2 px à t = 1 000 ms (mesure dans le script T0).
- AC3 : la déchirure (geste, seuil 0,9, retour à rebours) passe **inchangée** `etats.test.ts` et `SceneOuverture.test.tsx`.

**T3 — Le sachet est un objet du Bureau** (design de `Pochette.tsx`)
- AC1 : nouvelle pochette, planche avant/après à 420 × 900 ; texte du sachet **≥ 9,92 px rendus** ou explicitement décoratif et gardé ; contraste mesuré (`DESIGN.md` §1.5).
- AC2 : aucun texte cuit dans une image (le SVG reste du texte) ; `aria-hidden` conservé.
- AC3 : poids : le cliquet du paquet principal est tenu, ou relevé dans un commit qui le dit.
- AC4 : `npm run detect:ui` exit 0, `npm run capturer` exit 0.
- *Dépend du choix de Bastien (kraft/bulle, enveloppe navette, ou autre).*

**T4 — Décision : les raretés ont un nom** (documentaire, prérequis de T5)
- AC1 : une décision datée dans `docs/DECISIONS.md` (noms, mapping, « dorée » = ★★ ou refusée) ; `npm run index:decisions` régénère l'index.
- AC2 : une ligne « Rareté » dans `JEU.md` §3.1 ; `DESIGN.md` §3 mis à jour.
- AC3 : le mot vit **dans `RARITY_META`** (`src/data/index.ts`, « un fait, un fichier ») ; un test lit les deux sens (rareté → mot).
- AC4 : **la garde de vocabulaire des annonces utilise la liste de `cards.test.ts`** (aujourd'hui : seulement `galère|pokémon`, `revelation.test.ts:98`) ; le contrôle mord : une annonce contenant « Classeur » échoue.

**T5 — Le mot avant le retournement : tampon et lueur par palier**
- AC1 : planche à 420 × 900 avec ◆◆◆, ◆◆◆◆ et ★ : le tampon apparaît **avant** `data-face="recto"` (pendant `data-tension`), puis l'annonce au retournement.
- AC2 : les trois lueurs se distinguent **sans la teinte seule** (forme) ; si une teinte neuve est ajoutée, ΔE ≥ 25 entre paliers (mesuré) et contraste ≥ 4,5:1 pour le texte du tampon.
- AC3 : le mot est dans le DOM dès le premier rendu, lu par `role="status"`, **présent sur la fiche** et en **Mouvement réduit**.
- AC4 : à 420 × 900, mot ≥ 11,2 px rendus, sans recouvrement du nom (mesure comme pour la pastille « Nouvelle », D-169 (3)).
- AC5 : `SceneOuverture.test.tsx` : un test « le mot précède le recto » qui **échoue** si on le retarde après le retournement.

**T6 — Le son suit la déchirure** (*dépend d'une décision de Bastien*)
- AC1 : décision datée amendant D-137 (b) ; `jouer('arrivage')` part à `lancerOuverture`, plus au clic ; test avec un lanceur injecté (`src/test/setup-poste.ts`).
- AC2 : `npm test -- scripts/ressources/sons.test.ts` exit 0 ; aucun nouveau fichier sans D-137/D-166 amendées.

**T7 (facultatif) — Le rectangle gris de l'annonce** : `r420/f35.png`, x 365–420, y 700–780 ; trouver ce que c'est (particule, reflet, fond) ; AC : planche sans artefact à 420 × 900 sur une ★.

---

## 6. Frictions d'environnement

1. **Outil de preuve aveugle à l'Arrivage depuis D-179 (#651).** `filmer-animation.mjs` n'atteint plus la scène (exit 1, `.hero__ouvrir` absent car `/connexion`, §1.1) ; **`capturer.mjs` saute l'état `arrivage` sans backend** et le dit seulement en console (`:984-1008`, « non capturé »). Le build de la CI n'a pas `VITE_SUPABASE_URL` : **l'écran n'est plus capturé en CI**. Les commandes du README de preuve (`docs/preuves/ouverture-arrivage-2026-10-28/`) ne fonctionnent plus. Voisin de #497.
2. **Aucune garde n'aurait attrapé « les cartes sont derrière le sachet ».** jsdom ne calcule pas l'empilement ; `styles-ouverture.test.ts` ne lit pas les `z-index` de la scène (seul le `z-index: 8` du titre est testé, l.72) ; aucun test ne mentionne `--dedans` (`grep` : 0) ; `effets-combat.test.ts` ne borne que les durées ; `detect:ui` est regex seule (exit 0 « findings are an undercount »). **Le défaut est dans le dépôt depuis la refonte du 28/10** et passe les quatre commandes de §8.4. La mesure `cartesSousLeCorps` du script de diagnostic est le candidat naturel (T0/T1).
3. **Garde de vocabulaire des annonces plus faible que celle des cartes** : `revelation.test.ts:98` ne cherche que `gal[eè]re|pok[eé]mon` ; la liste `FORBIDDEN_ANY_CASE` (`cards.test.ts:30`) n'est **pas exportée** et ne couvre que les textes de carte. Une annonce « Classeur ! » passerait.
4. **Skill `impeccable` refusée** (`Permission denied: skill`) alors que `AGENTS.md`/le brief la demandent et que `PRODUCT.md` existe pour elle. Critique faite à la main (§2). `npm run detect:ui` (exit 0) ne vérifie ni empilement ni taille rendue ni texte SVG ; il faudrait `npx impeccable detect <url>` sur la page servie, qui demande l'état `arrivage` (donc T0).
5. **Le script du diagnostic dépend du chemin Chromium** (`<cache-local>/ms-playwright/chromium-1248/…`, codé en dur ; `CHROME_PATH` possible). Deux versions (1228, 1248) sont installées. Pas bloquant.
6. **Son recalé nulle part** : `Home.tsx:91-96` justifie « le son part au clic » ; depuis D-179 la scène apparaît après un aller-retour serveur, donc le son précède de plus en plus le geste (DÉDUIT, non écouté, §2.2 n° 6).
7. **Aucun ticket ouvert sur l'ouverture** : la demande de Bastien n'est portée par rien (`gh issue list`, §0).
8. `docs/CARD-SPEC.md` §1 (`1S` 24, `2S` 29) vs `npm run status` (43, 25) : instantané D-005 périmé, déjà annoncé comme tel dans la note d'autorité du fichier ; sans effet ici.

## 7. Observé vs déduit — récapitulatif

- **Observé** : défaut d'empilement (z-index, classe `--dedans`, `ENVOL.revelation`), mesures de recouvrement 420 et 1280, cartes hors fenêtre à 1280, étalage sous un sachet fantôme, ΔE des cinq ors, outil standard en échec, annonce et mots (grep), vérification des mots contre les listes.
- **Déduit** : désaccord pile/sachet incliné (non mesuré), désynchronisation du son (non écouté), probabilités de tirage (tirage uniforme supposé), sens de l'« épique » = ◆◆◆◆ (par analogie avec Hearthstone).
- **Non vérifié** : rendu sur téléphone réel, images par seconde, lecteur d'écran, cause du rectangle gris (`r420/f35.png`), 390 × 664 mesuré (planche seule, non commentée).
