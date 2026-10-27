> **Note de dépôt** — ce document a été écrit le **25/10/2026** par la session
> « Analyse vidéo et UI recherchée » (modèle Kimi K3), à la demande de Bastien, et il est
> **copié ici depuis `/tmp/opencode/direction-video-aaa.md`** pour ne pas se perdre avec le
> bac temporaire. C'est une **proposition de direction visuelle** : elle n'acte rien, elle
> ne crée aucune règle de jeu, et `DESIGN.md` reste l'autorité sur l'apparence. Son
> application à l'écran de combat est résumée et arbitrée dans `docs/SPEC-COMBAT-UI.md` §6.9.
> Les teintes mesurées viennent d'un JPEG généré par IA : tolérance ±5 %, dit dans le texte.

# Direction visuelle « AAA » — l'écran de combat d'après les vidéos

> Écrite le 25/10/2026. Fait suite à `/tmp/opencode/reponse-maquette-video-ui.md`
> (la **structure** ; ne pas y revenir ici) et s'applique à la maquette de
> `docs/SPEC-COMBAT-UI.md` §6. Ici : **la matière, la lumière et la couleur**.
>
> **Décision de Bastien (25/10/2026)** : « je veux que ça ressemble plus au video »,
> « je veux que ça fasse AAA », « les couleurs et le style peuvent changer ».
>
> **Source** : les 24 frames de `/tmp/opencode/frames/` (deux vidéos générées par IA,
> 720×1280). Toutes les teintes ci-dessous sont **mesurées au compte-gouttes** sur des
> crops (moyenne de zone), chacune renvoie à sa frame. JPEG compressé + génération IA :
> tolérance ±5 % ; quand une teinte est **interprétée** (saturée, éclaircie, ou
> extrapolée), c'est dit en toutes lettres.
>
> **Bornes** : aucun asset ni texte de la vidéo repris ; aucune dépendance ; vocabulaire
> du projet (Planqué, Poste, Banc, Deck, Rebut, Café, Seuil, Stress, Pression,
> Intervention) ; `DESIGN.md` reste l'autorité — cette direction propose des **jetons de
> scène** (`--scene-*`) cantonnés à l'écran de combat, pas une réécriture des jetons
> globaux.
>
> **§8 (les effets) ajoutée le 25/10/2026**, à la demande « et pour les effets des
> attaques et autre ? ». Elle n'acte rien : D-093 (5) couvre le principe et
> `SPEC-COMBAT-UI` §6.8.3 fixe les bornes. §8 est le **détail d'exécution**.
> **Mise à jour du 25/10/2026 (fermeture de session)** : §8.2 et §8.4 décrivent désormais
> **ce qui est livré** (#207, commits `a41b6f3` et `c77bcd3`), les écarts restants étant
> écrits au même endroit. Une version antérieure annonçait 350 ms et des temps tous à 0 ms :
> c'était faux, elle est remplacée.

---

## 1. Palette extraite des frames

Mesures : moyenne de zone sur crop (JPEG, ±5 %). « M » = mesuré, « I » = interprété.

| Rôle projet | Jeton proposé | Hex | Où (frame · endroit) | M/I |
|---|---|---|---|---|
| Fond de table (feutre nuit) | `--scene-felt` | `#16202c` | `49-00` · zone vide gauche-centre (dominante `#19242e`) | M |
| Bords vignettés | `--scene-felt-deep` | `#0d1420` | `49-00` · extrapolé des coins (le plus sombre mesuré `#181b23`) | I |
| Halo central (lumière) | `--scene-felt-lit` | `#214d69` | `49-00` · cuir éclairé autour de la bannière (`#214d69`) | M |
| Surface de carte (nuit) | `--scene-card` | `#1b222c` | `49-00` · carte du Banc (`#1b222c`) | M |
| Surface relevée | `--scene-card-up` | `#232e3d` | dérivé de `#2b3644` mesuré sur la même carte | I |
| Encre principale | `--scene-ink` | `#eef4fb` | `49-00` · âmes des lettres de la bannière (`#9ef5fb`→blanc) ; rejoint `--text` `#e8eef8` | M |
| Encre secondaire | `--scene-ink-2` | `#9fb0c8` | aligné sur `--text-muted` `#9aa9c2` du projet | I |
| **Néon cyan** (tour, lecture) | `--scene-neon` | `#61d5df` | `49-00` · bord lumineux de la bannière (`#61d5df`) | M |
| Noyau cyan (filet chaud) | `--scene-neon-core` | `#9ef5fb` | `49-00` · âme du filet (`#9ef5fb`, `#9cedfb`) | M |
| Pilule cyan (fond) | `--scene-neon-deep` | `#2d556a → #2e7189` | `49-00` · corps de la pilule (dégradé mesuré) | M |
| **Vert action** (Fin du tour) | `--scene-go` | `#46c78c` | `49-00` · pilule verte (menthe mesurée `#5ba28f`, **saturée**) | M+I |
| Vert profond (fond) | `--scene-go-deep` | `#1d3b31` | `49-00` · fond de la pilule (`#19302f`) | M |
| **Danger** (tour adverse, casse) | `--scene-danger` | `#ff7f3f` (livré, #323 ; la direction proposait `#e0563f`) | `55-06`/`49-09` · pilule rouge (corps `#6f1c15`, lueur pâle `#c9a1a1`) — **éclaircie** | M+I |
| Pilule danger (fond) | `--scene-danger-deep` | `#5f1a16` | `49-09` · corps de la pilule rouge (`#6f1c15`) | M |
| **Or métal** (cadres) | `--scene-gold-*` | dégradé `#f2dd9a → #d8b96a → #8a6a34 → #6b5233` | `49-00` · cadre de la carte active (moyenne `#9f8d6c`, haut clair) | M |
| Or pâle (chiffres de Stress) | `--scene-gold-hot` | `#f7e264` | `49-09` · chiffre « −60 » (`#f7e264`) | M |
| Orange de feu (effets) | `--scene-fire` | `#ea9c5e` | `55-06` · feu (cœur `#fbf09d`, corps `#ea9c5e`) | M |
| **Parchemin** (piles) | `--scene-parch` | `#b18a60` | `49-00` · cartouche de pile (`#b18a60`) | M |
| Parchemin sombre (usure) | `--scene-parch-dark` | `#664d38` | `49-00` · bords usés du même cartouche | M |
| Métal ardoise (cartes standard) | `--scene-steel` | `#8a93a8 → #4a5468` | `49-00` · filets des cartes du Banc (`#54575e`, `#969d9e`) | M |
| ~~Violet de la piste~~ | — | `#975a9b` | `49-00` · hexagone — mesuré mais **écarté** (§6) | M |

**Décision de mapping** : le bleu nuit du projet (`--bg #0b1220`) est déjà la bonne
famille — le feutre `#16202c` n'en est qu'une version éclaircie au centre. On ne touche
pas les jetons globaux ; l'écran de combat pose ses `--scene-*` par-dessus.

---

## 2. Matières et lumière

### 2.1 D'où vient la lumière

La vidéo n'a **qu'une seule source** : le centre du plateau, entre les deux Postes.
Tout ce qui s'éloigne du centre s'éteint ; les quatre coins sont presque noirs. C'est
la première chose à reproduire — avant toute couleur.

**CSS** : un seul dégradé sur le fond de la scène, plus une vignette en ombre interne :

```css
.battle-scene {
  background:
    radial-gradient(120% 90% at 50% 46%,
      var(--scene-felt-lit) 0%,
      var(--scene-felt) 52%,
      var(--scene-felt-deep) 100%);
  box-shadow: inset 0 0 18vmin rgb(0 0 0 / .55); /* vignette */
}
```

### 2.2 Les plans, et leurs ombres

La vidéo empile **quatre plans** nets (cinq avec les effets). L'impression « AAA » vient
de cette profondeur, pas des filets :

| Plan | Contenu | Ombre |
|---|---|---|
| 1 — la table | le feutre (§2.1) | vignette interne (ci-dessus) |
| 2 — les zones | cartouches de piles, piste d'Interventions, cartouches de camp | `0 6px 14px rgb(0 0 0 / .45)` — posées |
| 3 — les cartes | Postes, Bancs, main | `0 14px 30px rgb(0 0 0 / .55)` — soulevées |
| 4 — l'actif | carte désignée, bouton d'action, bannière | l'ombre du plan 3 **+ le halo coloré** (§2.4) |
| 5 — les effets | chiffres de Stress, trait d'attaque | aucune : un fondu, pas une ombre |

Une surface = **une** ombre. Pas d'empilement ombre + filet + liseré (§6, tells).

### 2.3 Le feutre sans image

Aucun asset autorisé, donc pas de photo de cuir. Le dégradé de §2.1 fait 90 % du
travail. Le grain, **optionnel** : un SVG inline en `background-image`
(`feTurbulence`, ~200 octets, opacity .04, `pointer-events: none`). Marqué optionnel :
si le rendu gêne un seul test de capture, on le jette, le dégradé suffit.

### 2.4 Les halos colorés — la rareté qui fait « néon »

Dans la vidéo, le halo n'existe que sur **l'élément vivant** : la bannière du tour, le
bouton d'action, la carte qui attaque. Règle : **le halo est un état, pas un style**.

```css
.is-lit {           /* l'élément actif, et lui seul */
  box-shadow:
    0 14px 30px rgb(0 0 0 / .55),                 /* son ombre (plan 4) */
    0 0 22px color-mix(in srgb, var(--scene-neon) 45%, transparent);
}
```

(`color-mix` est Baseline depuis 2023 ; repli : `rgb(97 213 223 / .45)`.)

### 2.5 Les reflets

Un seul reflet par surface, **en haut** (la lumière vient du centre, donc du haut pour
une carte couchée) : `inset 0 1px 0 rgb(255 255 255 / .07)` sur les cartes et les
pilules. Pas de reflet sur le feutre.

### 2.6 Refusés, et pourquoi

- **`backdrop-filter`** : coût GPU sur téléphone, portée imprévisible au tactile, et la
  vidéo n'a aucun flou d'arrière-plan — ses pilules sont des dégradés opaques. Refusé.
- **Lueur pulsée en boucle** (`@keyframes` sur `box-shadow`) : `prefers-reduced-motion`
  (D-026, spec §5.7) et le tell « glow » du détecteur. Refusé. Si une transition est
  voulue : un **fondu unique** à l'apparition (`opacity`, 150 ms), réduit à zéro en
  mouvement réduit.
- **Parallaxe / inclinaison 3D au pointeur** : aucun équivalent tactile, coût, et hors
  demande. Refusé.

---

## 3. Gabarits

Base : fenêtre 420 × 900 (critère (4) de D-060). Tailles en px à cette référence.

### 3.1 Le cadre de la carte du Poste (le héros)

- **Proportions** : ratio carte standard 63/88 (0,716) — largeur **112 px** (le Banc à
  64 px donne le rapport 1,75 de la vidéo). Coins : 7 % de la largeur (~8 px).
- **Matière** : fond nuit `--scene-card`, illustration (`src/art.ts`, D-045), reflet
  haut (§2.5). Le cadre est un **métal** : dégradé diagonal
  `135deg, #8a93a8, #4a5468` (ardoise) **pour les cartes standard** ;
  `135deg, #f2dd9a, #d8b96a 45%, #8a6a34` (or) **réservé au COMEX** — l'or est sa
  marque (D-026), la vidéo le met partout, nous non (§6).
- **Bord** : le métal se rend en **double anneau** — `border: 2px solid transparent` +
  `background: linear-gradient(card) padding-box, linear-gradient(métal) border-box`.
  Pas de `border-image` (coins imprécis). Halo néon seulement si la carte est désignée.
- **Typographie** : bandeau nom en haut — Outfit 700, capitales, interlettrage .04em,
  0.78rem sur le Poste ; pastille de Seuil coin supérieur droit — rond 20 px, fond
  `--scene-card-up`, chiffre Outfit 700, `font-variant-numeric: tabular-nums`.
- **Le Stress** : la barre à crans sous l'illustration (spec §6.7), crans remplis en
  `--scene-gold-hot` `#f7e264` (la couleur des chiffres de la vidéo), jamais en rouge —
  le rouge est le danger d'état, pas la mesure.

### 3.2 Le cartouche de camp (ex-« avatar » de la vidéo)

- **Proportions** : carré arrondi **52 px** + le nom du camp dessous, une ligne.
- **Matière** : nuit `--scene-card`, dégradé vertical `#1a2534 → #101826`, reflet haut.
- **Bord** : filet 2 px `--scene-neon` + halo **uniquement pour le camp dont c'est le
  tour** (le halo est un état, §2.4).
- **Contenu** : **pas de photo, pas de niveau** (n'existe pas, §6) — les initiales du
  camp en Outfit 800 (`BD` pour toi, `DIR` pour la Direction), le nom complet dessous
  en Outfit 600, capitales, .08em, 0.6rem. Utile en partie à deux (#125).

### 3.3 Le bouton « Fin du tour »

- **Proportions** : pilule (rayon 999 px) de **132 × 56** — cible ≥ 44 px (spec §5.1).
- **État actif (à toi)** : fond plein `--scene-go` `#46c78c`, étiquette **encre sombre
  `#0b1220`** (8,75:1 — §7), halo vert. **Jamais de texte blanc sur le vert clair**
  (~2:1, §7) : la vidéo le fait, c'est une faute AA qu'on ne reproduit pas.
- **État adverse** : fond `--scene-danger-deep` `#5f1a16`, filet 2 px `--scene-danger`
  `#ff7f3f` (le fond seul ne ressort pas du feutre : 1,29:1, le filet est **obligé** ; 3,59:1
  contre le feutre le plus clair, `DESIGN.md` §1.5),
  étiquette blanche (12,76:1), halo rouge léger.
- **Typographie** : Outfit 700, capitales, interlettrage .10em, 0.85rem.

### 3.4 Le cartouche des piles (Deck et Rebut)

- **Proportions** : rectangles **56 × 76** (ratio carte), deux par camp, colonne droite
  (structure : premier fichier §1).
- **Matière** : parchemin `#b18a60`, usure = filet interne 2 px `#664d38` + coins 8 px,
  reflet haut très faible. Ombre du plan 2.
- **Typographie** : étiquette (`DECK`, `REBUT`) Inter 600, capitales, interlettrage
  .12em, 0.6rem, **encre sombre `#3a2a18`** — le crème de la vidéo ne passe pas AA
  (2,41:1, §7). Le compte en pastille ronde sombre à cheval sur le coin, chiffre
  Outfit 700 encre claire.
- **État** : le Deck prend le halo cyan quand la Machine à café produit ou quand on
  peut piocher — c'est le « deck qui s'illumine » de la vidéo, gardé comme **état**.

### 3.5 La piste des Interventions

- **Proportions** : colonne de **3 hexagones** de 24 px de haut, espacés de 8 px,
  contre le bord gauche, centrée verticalement.
- **Forme** : `clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)`.
- **États** : à prendre = fond `#1a1e27`, filet 1,5 px `#2d3546` ; **acquise = or
  dégradé** (§3.1) + halo or léger. L'or des Interventions répond à l'or du COMEX
  (D-026) — le violet de la vidéo est jeté (§6).
- **Pas de fond de piste** : les hexagones sont posés sur le feutre (une surface par
  objet, §6 « Nested cards »).

### 3.6 La bannière « À toi »

- **Proportions** : pilule **~200 × 52**, centrée sur l'axe, entre les deux camps.
- **Matière** : « verre » cyan **sans `backdrop-filter`** — dégradé opaque
  `180deg, #2e7189, #2d556a`, reflet haut renforcé (`inset 0 1px 0 rgb(255 255 255 /
  .18)`), halo cyan (elle est l'élément vivant par défaut).
- **Bord** : filet 2 px `--scene-neon-core` `#9ef5fb`.
- **Typographie** : une ligne — `Tour 3 · À toi` — Outfit 800, capitales,
  interlettrage .14em, 1.1rem, encre `#f4feff` (7,81:1 sur la pilule, §7). Chez la
  Direction : `--scene-danger` et texte « La Direction joue ».

---

## 4. Typographie

Le projet n'a que **Outfit** (`--font-display`) et **Inter** (`--font-body`) — il
suffisent, la vidéo ne fait rien d'autre que de la graisse et de l'interlettrage.

| Emploi | Famille · graisse | Casse · interlettrage | Taille (échelle projet) |
|---|---|---|---|
| Bannière de tour | Outfit 800 | capitales · .14em | `--fs-xl` (≈1.3rem) |
| Chiffres de Stress flottants | Outfit 800 | — | `--fs-3xl` (2.1rem) |
| Nom du Poste | Outfit 700 | capitales · .04em | 0.78rem |
| Nom au Banc | Outfit 700 | capitales · .03em | `--fs-2xs` (0.62rem) — **plancher** |
| Étiquettes de zones, piles, camps | Outfit 600 | capitales · .10–.12em | 0.6–0.7rem |
| Étiquette du bouton d'action | Outfit 700 | capitales · .10em | 0.85rem |
| Texte de carte, journal | Inter 400 · 600 | normale | `--fs-sm` |
| Tous les chiffres (Seuil, Stress, comptes) | Outfit 700 | `tabular-nums` | selon l'emploi |

Deux règles : **aucun dégradé dans le texte** (tell du détecteur, §6) ; aucun texte
sous 0.62rem — en dessous, le nom complet vit dans l'inspecteur (spec §6.7).

---

## 5. Ce qui fait « jeu » et pas « tableau de bord »

1. **Une seule lumière**, au centre. Tout dégradé qui ne descend pas du centre est
   interdit. C'est 50 % de l'effet.
2. **Des objets, pas des panneaux** : la pile est un parchemin posé, la carte une
   plaque de métal, la piste trois jetons. Chaque zone interactive a **sa matière** —
   un tableau de bord n'en a qu'une.
3. **Les ombres portent la profondeur, pas les filets** : une surface = une ombre ;
   filet ≤ 2 px, et jamais filet fin + grosse ombre sur la même surface (§6).
4. **Le néon est une rareté d'état** : allumé = à toi, action possible, danger. Éteint
   partout ailleurs. Un néon permanent n'est plus un néon, c'est un fond.
5. **Les nombres qui changent la partie sont les plus grands de l'écran** : le Stress
   qui montre (`−20`, `−60`) en 2.1rem doré, éphémère. Aucun libellé ne rivalise.
6. **Le tour se crie** : une bannière et un bouton à deux états lisibles à un mètre —
   pas une ligne de texte dans un coin.
7. **Le vide central est voulu** : l'axe Poste ↔ Poste reste libre pour le regard et
   les effets. Remplir le vide, c'est redevenir un tableau de bord.
8. **La densité vit dans les cartes, pas entre elles** : gouttières ≥ 12 px, zones
   séparées par de la table, pas par des filets.

---

## 6. Les pièges — ce qu'on garde, ce qu'on jette

| Dans la vidéo | Problème pour le projet | Verdict |
|---|---|---|
| Textes déformés, pseudo-latin (génération IA) | aucun texte ni asset repris | **jeter** ; le micro-texte des mini-cartes est illisible → nom ≥ 0.62rem, le reste dans l'inspecteur (spec §6.7) |
| Cadre **or sur toutes les cartes** | chez nous l'or **est** la marque COMEX (D-026) | **jeter** l'or généralisé : métal ardoise en standard (§3.1), or = COMEX |
| **Violet** de la piste de score | hors vocabulaire (Interventions = or) ; famille « AI purple » des UI générées | **jeter** ; la piste est en or (§3.5) |
| « Level 32 », photos d'avatar | n'existent pas dans le projet | **jeter** le contenu, **garder** le cartouche (initiales + nom du camp, §3.2, utile au PvP #125) |
| Étiquette crème sur parchemin | 2,41:1 — sous AA | **inverser** : encre sombre `#3a2a18` (**4,38:1**, §7 — la valeur de 5,95 était fausse) |
| Texte blanc sur pilule verte claire | ~2:1 si le vert est néonisé | **inverser** : encre sombre sur néon (8,75:1, §7) |
| Feu, éclairs, lueurs en boucle | `prefers-reduced-motion` (D-026, spec §5.7) | **garder** en version réduite : un fondu simple, aucun flash, aucune translation |
| ~30 zones visibles | contredit « une surface, trois bandes, un panneau » (spec §6.1) | **garder la structure de la spec** ; cette direction change la matière, pas la structure |
| Classeurs, trombones, dossiers (props) | assets interdits ; univers = atelier MRO (D-025) | **jeter en v1** ; si un ticket le veut plus tard : props **maison** (classeur MRO, agrafeuse) en SVG inline, jamais ceux de la vidéo |
| Halo généralisé | tell Impeccable « Dark mode with glowing accents » + règle « glow shadows » du détecteur | halo réservé à l'élément actif (§2.4) ; si le détecteur refuse un halo voulu : `<!-- impeccable-disable <règle> -->` **avec la raison** (`AGENTS.md` §6), jamais en silence |
| Filet 1 px + ombre large sur la même surface | tell « Hairline border with wide shadow » (le détecteur local porte 35 règles « hairline ») | filet 2 px, ou l'ombre seule |
| Cartouches empilés dans des panneaux | tell « Nested cards » / « Cardocalypse » | une surface par objet, posée sur le feutre (§3.5) |
| Texte en dégradé | refusé par le détecteur (per-edit tier) | textes unis partout (§4) |

**Garder de la vidéo (structure, renvoi au premier fichier)** : la main en éventail
rognée par le bas, la piste dédiée, le badge de Condition **nommé** sur la carte, le
Poste à ~1,75× le Banc, les piles visibles, la bannière, le bouton à états, le journal
latéral, l'axe central vide.

---

## 7. Palette de repli (contraste AA)

> **Note de lecture (27/10/2026, #323) — qui fait foi.** Ce document est la **proposition de la
> direction** du 25/10/2026 : ses hexadécimaux ont été choisis pour la vidéo, et ses ratios ont
> été posés **d'avance**. Les ratios **mesurés** vivent dans **`DESIGN.md` §1.5**, calculés sur les
> jetons réellement livrés de `src/styles.css` et **gardés** par `src/styles-scene.test.ts`. Si les
> deux tables se contredisent, **`DESIGN.md` §1.5 l'emporte**, et c'est ici qu'on corrige le
> chiffre. Trois l'avaient dérivé : 5,95 → **4,38** (encre `#3a2a18` sur le parchemin), 8,02 →
> **7,81** (blanc sur la pilule cyan), 16,07 → **16,67** (encre sur le feutre vignetté). Le
> « Danger » de la table ci-dessous n'est plus `#e0563f` : le jeton est `#ff7f3f` depuis #323,
> parce que l'ancien tombait à 2,39:1 sur le centre éclairé de la table et 2,80:1 **mesuré** au
> bord du filet du camp de la Direction — sous les 3:1 d'une frontière d'état (WCAG 1.4.11).

Ratios **calculés** (WCAG, luminance relative) sur les jetons de §1. Les paires
marquées ✗ sont celles où la vidéo faut — et où on ne la suit pas.

| Paire | Ratio | Verdict |
|---|---|---|
| Encre `#eef4fb` / feutre `#16202c` | **14,85** | ✓ AAA partout |
| Encre / feutre vignetté `#0d1420` | 16,67 | ✓ |
| Encre / carte `#1b222c` | 14,46 | ✓ |
| Encre secondaire `#9fb0c8` / feutre | 7,45 | ✓ |
| Néon cyan `#61d5df` / feutre | 9,47 | ✓ même en texte |
| Blanc `#f4feff` / pilule cyan `#2d556a` | 7,81 | ✓ la bannière tient AA |
| Encre sombre `#0b1220` / vert `#46c78c` | 8,75 | ✓ **étiquette du bouton d'action** |
| Blanc / vert `#46c78c` | ≈2,1 | ✗ interdit (la vidéo le fait) |
| Encre sombre / cyan `#61d5df` | 10,78 | ✓ repli possible |
| Or `#d8b96a` / feutre | 8,67 | ✓ |
| Or profond `#8a6a34` / feutre | 3,28 | ✓ filets et grandes formes (3:1), pas de texte |
| Parchemin `#b18a60` / feutre | 5,23 | ✓ contour d'objet |
| Encre sombre `#3a2a18~#0b1220` / parchemin | **4,38** | ✓ **étiquette des piles** |
| Crème `#efe0c2` / parchemin | 2,41 | ✗ interdit (la vidéo le fait) |
| Danger / feutre | 6,55 | ✓ filet et halo (3:1) — le jeton est `#ff7f3f` depuis #323 (27/10/2026), relevé pour que le filet du camp de la Direction passe 3:1 ; la direction proposait `#e0563f` (4,36 sur le feutre, mais **2,39** sur le centre éclairé) |
| Pilule danger `#5f1a16` / feutre | 1,29 | ✗ **le filet danger est obligatoire** (§3.3) |
| Blanc / pilule danger | 12,76 | ✓ |

**Les trois règles de repli**, par ordre :

1. **Le néon ne descend jamais** : un cyan plus foncé pour « passer » (`#1d6d7d` =
   2,77:1 ✗) tue l'effet et ne gagne même pas AA. Le repli se fait en **montant
   l'encre**, pas en fonçant le néon.
2. **Le texte sur néon clair est sombre** : étiquette de bouton = `#0b1220` sur
   néon, jamais blanc.
3. **Le néon suffit aux filets et halos** (seuil UI 3:1) : même si un fond de pilule
   frôle, le filet 2 px `#61d5df` / `#ff7f3f` porte la lisibilité de l'état.

**Vérifications avant livraison** : `npm run detect:ui` (tells §6), `npm run capturer`
(420 × 900, preuve de rendu, `AGENTS.md` §8.4), et le contraste des paires ✗ ci-dessus
dans le navigateur — le détecteur **sous-compte** en analyse de sources
(`DESIGN.md:80-83`).

---

## 8. Les effets — la Pression en quatre temps, et les autres gestes

### 8.1 Ce qui est déjà en place (vérifié le 25/10/2026)

Ne pas refaire, ne pas contredire. Le harnais et quatre effets existent (#192) :

| Quoi | Où | Ce qui est acté |
|---|---|---|
| Le harnais (`useEffetsDeCombat`) | `src/components/effets-combat.ts` | natures `stress` / `craquage` / `pioche` / `intervention` ; plafonds `DUREE_MAX_MS` 800 ms, `MAX_EFFETS_SIMULTANES` 4 (le 5ᵉ est **refusé**), boucle ≤ 2 tours ; fusion par identité (un second coup **remplace**, n'empile pas) ; tests `effets-combat.test.ts` et `effets-combat-hook.test.tsx` |
| Le chiffre de Stress flottant | `styles.css` (`.stress-flottant`, `@keyframes stress-monte`, `.is-fixe`) ; `Battle.tsx` (rendu `aria-hidden`) | doré `--scene-gold-hot`, 700 ms, `transform`/`opacity` seuls, retiré du DOM ; repli immobile sous Mouvement réduit |
| La traînée de craquage + la carte désaturée | `styles.css` (`.craquage__train`, `.craquage__carte`) | une bande `danger → gold-hot`, 500 ms ; la carte passe à `grayscale` + `opacity .35`, sans flou |
| La pile de Deck qui s'allume | `styles.css` (`.pile--deck.is-piochante::after`) | liseré néon **une fois**, 150 ms, sur pseudo-élément (rien ne bouge) |
| L'hexagone d'Intervention | `styles.css` (`.piste__hex.is-fraiche`) | un rebond 1.15 en 200 ms ; le remplissage est l'état, pas l'animation |
| Les trois coupures du mouvement | `@media (prefers-reduced-motion)`, `:root[data-mouvement-reduit='true']`, `.battle--mouvement-reduit` + le réglage du store (`reducedMotion`, store `version: 8`, #189) | le mouvement part, l'information reste — chaque effet a son repli |

### 8.2 La Pression en quatre temps

La vidéo découpe une attaque en **anticipation → trait → impact → après**. Les deux
premiers temps manquent chez nous (le chiffre naît sans que le coup parte) ; les deux
derniers existent à moitié. Événement déclencheur : une action `attack` appliquée —
l'état est **déjà final** quand l'effet joue, il ne retarde rien.

| Temps | Vidéo (frame) | Durée | Moyen CSS (zéro asset) | Repli Mouvement réduit |
|---|---|---|---|---|
| **1. Anticipation** | la carte attaquante se cabre (`49-06`) | 200 ms | classe `.attaque__elan` sur la carte attaquante : `translateY(-6px) scale(1.03)` en `@keyframes`, une fois ; le halo `is-lit` (§2.4) s'allume dans le même temps | aucun déplacement : le halo s'allume, fixe, 200 ms |
| **2. Le trait** | l'éclair relie les deux Postes (`49-06`, `55-06`) | 350 ms | **la technique de `.craquage__train`, réutilisée** : une bande en `linear-gradient` sur l'axe central — `neon-core → gold-hot` pour un coup ordinaire, `danger → gold-hot` (existant) si le Planqué craque. **Un seul trait à la fois** : le trait de craquage *est* le trait, on n'en pose pas deux | pas de trait ; le chiffre (déjà affiché, fixe) suffit |
| **3. L'impact** | flash sur la cible (`49-00`, `49-09`) | 150 ms | pseudo-élément `::after` sur la carte touchée : anneau `box-shadow: 0 0 0 3px var(--scene-neon-core)`, `opacity` 1 → 0, une fois — **sans `filter: blur`** (borne 5 de §6.8.3) ; le chiffre de Stress part au même instant (existant) | pas d'anneau |
| **4. L'après** | badge « Stressed ×4 » (`55-03`), traînée de craquage (`55-06`) | 200 ms (badge) | **badge de Condition nommé** (R3) : `badge-pop` — `scale .8 → 1` + `opacity` 0 → 1, 200 ms, une fois ; puis il devient un **état** (il reste). Le craquage suit §8.1 | le badge apparaît sans scale |

**Ce qui est livré** (`src/components/effets-combat.ts`, `src/styles.css`, #207) :

| Élément | Valeur livrée | Écart avec le plan ci-dessus |
|---|---|---|
| Effet `attaque` | **700 ms** (`DUREE_ATTAQUE_MS`) | le plan disait 350 ms : passé à 700 ms, car l'impact (550–700 ms) serait retiré avant son départ |
| Effet `condition` | **240 ms** (`DUREE_CONDITION_MS`), ou **790 ms** quand une Pression l'a posée (`DUREE_CONDITION_APRES_COUP_MS`, #294) | l'arc `condition__arc` pulse deux fois 120 ms ; posé par une Pression, il attend l'impact (550 ms) pour ne pas s'allumer avant le coup. Aucun arc sous mouvement réduit : le badge nommé suffit |
| Identité de `attaque` | attaquant + cible (`uid`, `uidCible`) | conforme : un second coup sur la même paire remplace |
| Anticipation (cabrage) | `attaque-elan`, **0–200 ms**, sur `.poste__carte.is-elan` | conforme |
| Trait | `trait-attaque`, **200–550 ms** (délai 200 ms), sur `.attaque__trait` | conforme dans sa forme ; **ne part pas** si la Pression craque (voir ci-dessous) |
| Impact (anneau) | `impact-anneau`, **550–700 ms** (délai 550 ms), sur `.is-impactee::after` | conforme ; `display: none` sous mouvement réduit |
| Après (badge) | `badge-pop`, 200 ms, **sans délai** | **écart** : le plan le voulait à 700 ms ; il part avec l'effet `condition`, donc au même instant que la Pression |
| Traînée de craquage | 500 ms, **sans délai** | **écart** : le plan le voulait à 700 ms ; elle part en même temps que la Pression |

Deux garanties tenues par le code : un seul trait à la fois (si la cible craque, la traînée
de craquage **remplace** le trait), et aucune séquence sous « Mouvement réduit » (le trait et
l'anneau ne sont pas rendus ou sont masqués, le chiffre reste affiché et figé).

### 8.3 Les autres gestes

| Geste | Durée | Moyen | Repli |
|---|---|---|---|
| **Café attaché** | 200 ms | la pastille de Café de la carte cible **pop** (`scale 0 → 1`) + le liseré de la Machine réutilise `.is-piochante`. Le **vol de la pastille** (Machine → carte) est une v2 — un déplacement mesuré (FLIP) pour un gain faible | la pastille est là |
| **Carte Action jouée** | 150 ms | la carte de l'éventail s'estompe (`opacity`) pendant que la zone cible prend le filet doré de désignation (état, spec §6.5) ; la carte soulevée au survol/focus est déjà dans la table §6.8.3 | identique, sans fondu |
| **Rotation** (les deux cartes échangent) | 250 ms | glissement croisé en `transform` (le Poste sort vers le Banc, la place arrive) ; les badges de Conditions purgés partent en fondu | échange direct |
| **Relève** (après un craquage) | 250 ms | la carte choisie **monte du Banc** : `translateY(12px) → 0` + fondu — pas de mesure de position (FLIP), la direction « depuis le Banc » suffit à raconter le geste | apparition directe |
| **Contrôle** (Surcharge/Épuisement) | — | les +10/+20 de Stress au Contrôle sont la nature `stress` **existante** : le crochet les émet déjà dès que `hp` change. Pas d'animation du lancer de tampon en v1 (le journal le dit) | identique |
| **Fin de partie** | 500 ms, **optionnel** | le bandeau existe ; au plus **un** battement de halo sur le cartouche du vainqueur (la technique de `.piste__hex.is-fraiche`, une fois) | le bandeau seul |

### 8.4 Orchestration — l'enchaînement, jamais la file d'attente

L'ordre après une Pression avec tout qui tombe (le pire cas) :

**Chronologie cible** (le plan) :

```text
0 ms     anticipation (200) ── halo is-lit
200 ms   trait (350)         ── ou trait de craquage si le coup casse
550 ms   impact (150) + départ du chiffre de Stress (700)
700 ms   badge de Condition (200), si la Pression en pose une
700 ms   traînée de craquage (500) + désaturation, si le Planqué craque
1 200 ms relève (250)
```

**Chronologie livrée** (25/10/2026) : anticipation 0–200 ms, trait 200–550 ms, impact
550–700 ms, badge et traînée de craquage **à 0 ms** (écart connu), relève **non livrée**.
L'effet `attaque` reste visible 700 ms, ce qui couvre l'ensemble. Le temps total est donc
bien sous 1,3 s, mais la chronologie ne suit pas celle du plan pour l'après et le craquage.

**Non livré** : tout le §8.3 (café attaché, carte Action jouée, Rotation, relève, Contrôle,
fin de partie). Aucun de ces gestes n'a d'effet dans le module d'effets.

**Trois règles d'orchestre** :

1. **L'état ne attend personne** : `applyAction` a déjà rendu l'état final ; les effets
   sont une surimpression (`pointer-events: none` partout, comme aujourd'hui). L'écran
   reste jouable pendant la séquence.
2. **Un nouveau geste remplace, ne s'empile pas** : si le joueur enchaîne, les effets en
   cours partent au profit des nouveaux (la fusion par identité le fait déjà pour une
   même cible ; l'étendre à « un nouveau `'attaque'` éteint l'ancien »).
3. **Jamais plus de ~1,3 s** entre le geste et l'état visuel stable ; au-delà, la
   lecture souffre plus que le geste ne l'aide.

### 8.5 Règles de fabrication (rappel borné)

- **`transform` et `opacity` seuls** sur tout ce qui bouge ; un halo animé vit sur un
  pseudo-élément **pré-calculé** dont on n'anime que l'`opacity` (le patron
  `.is-piochante::after`) — jamais `box-shadow` animée, jamais `filter: blur` en
  mouvement.
- Toute durée ≤ 800 ms (`DUREE_MAX_MS`), toute boucle ≤ 2 tours, au plus 4 effets
  simultanés — les plafonds sont **dans le module**, pas dans la tête.
- Tout effet est `aria-hidden` et son information vit ailleurs (barre de Stress, badge,
  journal, `aria-live`) — c'est borne 1 de §6.8.3, et c'est ce qui rend le repli honnête.
- **Tests** : étendre `effets-combat.test.ts` (chaque nouvelle nature a sa durée ≤
  plafond, le refus du 5ᵉ tient, la fusion remplace) et le test du hook (`attack`
  émet `'attaque'` avec les deux `uid` ; `status` émet `'condition'`), plus le repli
  immobile — à l'image des deux fichiers de test existants.
- `npm run detect:ui` après coup : les halos *one-shot* sur pseudo-élément sont le
  patron déjà accepté ; un refus se traite comme §6 (correction ou désactivation
  motivée).

### 8.6 Refusés, et pourquoi

- **Système de particules** (étincelles, braises, confettis) : coût de rendu, bruit, et
  le repli honnête d'une particule n'existe pas. Refusé en v1 et v2.
- **L'éclair fractal** de la vidéo (SVG multi-segments ou canvas) : un asset déguisé, et
  le trait en dégradé (§8.2) raconte la même chose pour 3 rem. Refusé.
- **Le son** : hors périmètre de cette direction, non demandé, et il ouvrirait un front
  d'accessibilité entier (contrôle de volume, désactivation). Refusé ici.
- **L'inclinaison 3D au pointeur** : pas d'équivalent tactile. Refusé (déjà §2.6).
- **Toute boucle d'ambiance** (feutre qui respire, halo qui pulse au repos) : le néon
  est un état (§2.4) ; une ambiance animée est un néon permanent déguisé. Refusé.
