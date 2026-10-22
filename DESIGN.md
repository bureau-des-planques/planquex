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

### 1.5 Contraste (Vérifié le 20/10/2026)

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

Aucune paire de texte n'est en dessous de AA. Les pips de café (or sur fond sombre)
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

| Zone | Classe | Contenu |
|---|---|---|
| Cadre | `.card` | la **rareté colore la bordure entière** — pas de filet séparé : un filet sur un seul côté est un tell d'UI générée, et le cadre entier se lit mieux en grille (passe du 21/10/2026) |
| Nom | `.card__top` / `.card__name` | barre pleine largeur teintée de la faction, nom en Outfit 700, capitales, **deux lignes réservées** (au-delà, il s'abrège) ; le **Seuil** est une pastille dorée à droite de la barre |
| Bandeau | `.card__meta` | pastille de **stade** (`.card__stage`, Entrant / N+1 / N+2, ou la catégorie d'une carte Action), badge **COMEX** (`.card__comex`, or), puis la **faction** (`.card__faction`) : point de couleur + sigle, calé à droite |
| Illustration | `.card__art` | aplat `card.palette` + glyphe, voile `.card__shine` ; les raretés étoilées reçoivent en plus un voile holographique (`.card--holo`) |
| Seuil / Stress | `.card__seuil` | **la barre seule**, dix crans, pleine sur la carte : elle montre la **capacité**. Le chiffre du Seuil est en pastille dans la barre de nom. Au combat, la même barre montre le **Stress qui monte** (D-026) |
| Pressions | `.card__attacks` | une ligne par Pression : pastilles de café (`.pips` / `.pip`), nom, dégâts |
| Ambiance | `.card__flavor` | le texte de flavour, masqué en mode compact |
| Pied | `.card__footer` | rareté (diamants/étoiles, couleur `--rarity`) et identifiant court |

### 2.2 Grille et marges

- Grille de la Collection : `repeat(auto-fill, minmax(160px, 1fr))`, écart 0.75rem.
- Carte : **`aspect-ratio: 63 / 88`** — le format réel d'une carte, et ce qui garantit que toutes font la même taille quel que soit leur texte. Padding **0** (chaque bloc interne porte son propre espacement), `gap` 0.35rem, rayon 8 px, bordure teintée par la rareté.
- Illustration : **elle prend l'espace restant** (`flex`), rayon 4 px, filet interne double (noir à l'extérieur, clair à l'intérieur), cadrage **haut** (`50% 28%`) — les illustrations sont des portraits.
- Barre de Seuil : hauteur 7 px sur la carte, **12 px** au combat, dix crans (`.stress`, `::after`).
- Pips de café : 8 px, `gap` 2 px.

### 2.3 États

| Classe | Effet |
|---|---|
| `.card--selected` | bordure `--accent` + halo `color-mix(--accent 18%)` |
| `.card--comex` | bordure `--gold-deep` — le statut COMEX (D-026). Le filet `.card--comex::before` est déclaré **sans `content`** : il ne rend rien, et c'est un bug (#131) |
| `.card--holo` | voile holographique sur l'illustration (1S, 2S, 3S, COU) |
| `.card--compact` | masque la flavour (grilles) |
| `.card-slot.is-full` | carte à 55 % d'opacité (plus d'exemplaire possible au Deck) |

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
