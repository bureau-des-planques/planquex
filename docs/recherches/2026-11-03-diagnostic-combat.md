# Diagnostic combat — « plateau TCG Pocket à la sauce Planquex » (03/11/2026)

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `diag-combat/RAPPORT.md`. Les captures, relevés (`mesures-telephones.json`,
> `film-ia.json`, `maquette-mesures.json`, `sim.json`) et scripts (`*.mjs`) cités ne sont pas
> archivés.

**Demande de Bastien** : améliorer le combat — voir les paquets posés, les cartes qui se retournent, le journal ; la main en bas
de l'écran avec seulement le dessus des cartes visible, qui s'agrandit au clic. Référence : une partie de TCG Pocket.

**Cadre** : branche `main` @ `1fd8142` ; `git status --short` vide à la fin (exit 0) — **aucun fichier du dépôt touché**. Tout ce
que j'ai écrit est dans un dossier de travail éphémère, **non archivé**. Légende : **OBSERVÉ** = commande, capture ou fichier cité ; **DÉDUIT** = je le dis.
Le serveur du port 5193 est arrêté : `kill $(cat preview.pid)` puis `ss -ltn | grep 5193` → exit 1 (rien n'écoute).

Build servi : celui de la tentative précédente (`dist/`, 19:17, `build.mjs` hors dépôt, `envDir` vide). Je ne l'ai pas refait : aucun
commit sur `src/` après 18:51 (`git log --since="2026-11-03 18:00" -- src`), donc le build correspond à `main` (**DÉDUIT**).

---

## 1. L'écran actuel (OBSERVÉ)

### 1.1 Captures

Dossier des captures : `captures/` du dossier de travail, **non archivées**. Partie « réelle » = une partie jouée de bout en bout par le moteur et l'IA
(`sim.mjs`, graine 424242), rangée dans le store, **reprise** dans Chromium (début : combat neuf ; milieu : reprise au tour 10 ;
fin : un bot clique jusqu'au verdict). Ce n'est pas un humain, c'est le chemin que prend le jeu.

| État | 420×900 | Bureau |
|---|---|---|
| Début | `420x900-1-debut.png`, `…-debut-pasapas.png` (non relue) | `1280x800-1-debut.png`, `1920x1080-1-debut.png` |
| Milieu (tour 10) | `420x900-2-milieu-reprise.png`, `…-carte-choisie.png`, `…-pression-jouable.png`, `…-menu-journal.png` | `1280x800-2-milieu-reprise.png` |
| Fin (victoire 3 Interventions) | `420x900-3-fin.png`, `…-fin-verdict-immediat.png` | `1280x800-3-fin.png` |
| Animations (frames) | `420x900-anim-pression-00..11.png`, `planche-pression-420.png` (Pression), `planche-tour-ia-420.png` (tour de la Direction, avec coup de grâce) | — |
| Autres gabarits | `360x640-*`, `390x664-*`, `412x810-*` | `1920x1080-*` |

Mesures du DOM : `mesures-telephones.json` (rectangles de `.pile--deck`, `.poste__carte`, `.hand`, `.combat-barre`…) et `film-ia.json`.

### 1.2 Disposition à 420×900, tour 10, rangée de haut en bas (px)

| Zone | y | Ce qu'elle contient |
|---|---|---|
| En-tête | 0–65 | `←`, « Combat · Tour 10 · à toi », « Conditions », `ⓘ`, `⋯` ; la barre de navigation n'est pas rendue en combat (#275) |
| Camp adverse | 66–293 (227) | **Banc** 3 × 64×89 en haut, **Poste** 96×134 dessous à gauche ; à droite du Poste la fiche : « La Direction · main 2 », deux **pastilles** `DECK 6` `REBUT 4` (80×23 et 87×23), les cafés |
| Piste | 333–359 | hexagones d'Interventions, « 0 — 1 sur 3 » |
| Camp du joueur | 399–626 (227) | Poste 96×134, Banc dessous, pastilles `DECK 10` `REBUT 0` |
| Main | 630–764 | titre « Ta main 4 / 10 », éventail de **cartes entières** 72–79 px de large × 101–105 de haut, conteneur `.hand` 113 px |
| Barre d'action | 766–880 | une ligne de **journal** (la dernière phrase), « Fin du tour », cafés, Rotation, Talent, Pression |
| Marge | 880–900 | 20 px (D-094 (3)) |

- **Pioche (Deck) et Rebut** ne sont pas des objets : ce sont deux `<span class="pile">` de 23 px de haut, du texte et un compteur
  (`plateau.tsx:317-326`). Le Rebut **ne s'ouvre pas** (le commentaire dit « arrive avec #188 », #188 est fermé).
- **La main adverse** n'existe qu'en texte : « main 2 ».
- **Journal** : une phrase (17 px) dans la barre ; le journal entier est dans `⋯ → Journal` (`420x900-2-milieu-menu-journal.png`) ;
  sur bureau (≥ 900 px), 12 lignes sous la barre (D-158 (2), `1280x800-2-milieu-reprise.png`).
- **Cartes posées face cachée** : n'existent pas. Le moteur pose les Entrants d'office (`setupPlayer`, `engine.ts:294-312`) et
  l'écran montre tout de suite les deux camps, faces visibles, y compris le Poste adverse.
- **Tap sur une carte de la main** : la carte se lève de 0,5 rem et la **fiche « Carte choisie » s'ouvre sous la main** : le
  document passe de 900 à **1178 px** et la page défile de **278 px** (`film-ia.json` : `avantTap.scrollH 900`, `apresTap.scrollH
  1178, scrollY 278`) ; le camp adverse sort de l'écran (`film-tap-main.png`, `420x900-2-milieu-carte-choisie.png`). L'état « carte
  choisie » n'est mesuré par aucune garde (`INSTANTS_COMBAT` : arrivée, Pression jouable, pire cas).

### 1.3 Animations existantes (OBSERVÉ : frames et `document.getAnimations()`)

| Moment | Ce qui bouge | Source |
|---|---|---|
| Ouverture d'un combat neuf | **rien sur les cartes** ; seule la ligne de journal entre en fondu (`film-ia.json : animationsOuverture` = 2 animations sur `.combat-barre__journal`) ; frames `film-ouverture-0..3.png` | — |
| Pose, évolution, attache de café, relève | **aucune animation** : la carte apparaît (la Direction joue à 600 ms d'intervalle, `useCombat.ts:214`) | `effetsEntre` ne couvre que 6 natures |
| Pioche | un liseré néon de 150 ms sur la pastille `DECK` ; aucune carte ne voyage | `.pile--deck.is-piochante::after`, `styles.css:4735-4760` |
| Pression | scène : motif par attaque (éclair en zigzag pour « Enquête satisfaction »), chiffre « +40 » qui s'élève, carte cible qui recule ; ≈ 0,75 s (`planche-pression-420.png`) | D-098, `SceneAttaque.tsx` |
| Coup de grâce | tampon « POSTE SUPPRIMÉ », carte qui s'éteint, note « Merci pour votre engagement. » (`planche-tour-ia-420.png`) | D-098 (4) |
| Stress, Condition, Intervention, craquage | chiffre flottant 500 ms, arc, rebond d'hexagone 200 ms, traînée 500 ms | `effets-combat.ts` |
| Main | soulèvement de 0,5 rem en 160 ms au survol/focus/choix | `styles.css:5058-5066` |
| Fin | `SceneFin` : voile, tampon, ligne | `styles.css:2681-2720` |

**Un dos de carte existe déjà** — dans la scène d'Arrivage seulement : `.ouverture__dos` (sigle « BP »), `.ouverture__carte[data-face='verso']`,
pivot 3D (`styles.css:6515-6610`, test `face-cachee.test.ts`). Son préfixe `ouverture-` est la seule exemption des bornes de 800 ms (D-141 (4) :
pas de contagion).

---

## 2. Critique du plateau (impeccable)

**La skill `impeccable` m'a été refusée** (`Permission denied: skill`). Je n'ai pas contourné en lisant ses fichiers. Substitut, tout
OBSERVÉ : le détecteur installé, `node_modules/.bin/impeccable detect src/` → exit 0, sortie vide (`detect-sources.json`) ; sur les pages
servies (sorties de la tentative précédente, 19:23) : `detect-page-420x900.json` = 3 avis (`straggler`, `flat-type-hierarchy`,
`repeating-stripes-gradient`), tous `advisory`, aucun anti-pattern bloquant. Le détecteur ne voit pas ce qui suit : c'est une critique
manuelle, contre `DESIGN.md`, `docs/SPEC-COMBAT-UI.md` et D-093.

| # | Constat | Preuve | Gravité |
|---|---|---|---|
| C1 | **L'écran n'a pas la forme que D-093 a décidée.** D-093 (1) « la main en éventail rognée par le bas » ; SPEC §6.8 R1 « rognées par le bas de l'écran » ; R5 « quatre piles visibles… la pile est ouvrable ». Livré : main entière dans un cadre, pastilles de texte, Rebut fermé. La demande de Bastien **rétablit** D-093, elle ne le contredit pas. | §1.2 ; `plateau.tsx:317` ; SPEC 635-639 | P1 |
| C2 | Les deux Postes se font face, mais **rien ne dit « table de jeu »** : pas de paquet, pas de pile, pas de main adverse. Pocket pose le Deck sur le bord et la main adverse en haut (`CHRONOLOGIE.md`, `rafales/main-agrandie-p.jpg` : VU par moi). | captures 420 | P1 |
| C3 | **Le geste le plus fréquent du jeu casse l'écran** : toucher une carte de la main fait défiler la page de 278 px et cache l'adversaire. Contredit D-103 et D-171 (3) dans les faits (états non mesurés). | `film-ia.json` | P1 |
| C4 | La main prend **134 px** (15 % de la hauteur) pour montrer des noms de cartes que la fiche « Carte choisie » répète ; la hauteur est « la ressource rare » (D-167). | `mesures-telephones.json` | P2 |
| C5 | Le journal n'est **qu'une ligne** : le récit du tour adverse (3–5 actions en quelques secondes) n'est pas lisible ; il faut `⋯`. | `420x900-2-milieu-menu-journal.png` | P2 |
| C6 | **Rien ne dit d'où vient une carte** : la Direction pose, évolue, attache sans mouvement ; la pioche ne montre pas la carte. | §1.3 | P2 |
| C7 | Les noms au plateau sont tronqués (« Chief Happi-… », « Direct-eur fantôme »). Déjà connu, D-167 (3) : tranchera quand on saura quelle surface rend de la hauteur. | captures | P3 (connu) |
| C8 | Le Rebut n'est pas consultable alors que la capture `03-zones-de-combat.png` dit « consultable à tout moment » (D-034 : la capture fait foi). | `docs/preuves/astuces-2026-10-20/README.md`, transcription `03` | P2 (écart de règle sourcée) |

---

## 3. Direction proposée

### 3.1 Ce que fait Pocket (VU par moi sur les rafales de l'autre agent, mesures dans `ANIMATIONS.md`)

- **Main en bas, cartes rognées par le bord** : le dessus des cartes (illustration, pastille d'énergie, PV) ; le nom est en haut de la
  carte Pocket, donc visible. Un liseré cyan marque les cartes jouables (`rafales/main-agrandie-p.jpg`).
- **Tap = la carte s'agrandit au centre** (≈ 75–80 % de la largeur, ≈ 55 % de la hauteur, en < 50 ms, sans voile), la carte de la main reste
  liserée dessous. Puis on la **glisse** sur un emplacement allumé en cyan (`ANIMATIONS.md` §2, §3).
- **Paquets** sur les bords (adverse à gauche, joueur à droite), **main adverse** en éventail de dos, en haut.
- **Face cachée** : uniquement à la **mise en place** (le Poste adverse est un dos, retourné à « Start Battle », **0,37 s**,
  `ANIMATIONS.md` §4) et à la **pioche** (la carte se retourne en volant, ≈ 1,1 s). Capture `04-preparation-dun-combat.png` : « les Pokémon qu'ils
  ont mis en jeu sont révélés ». Pas de face cachée en cours de tour.

### 3.2 Ce que « se retourner » peut vouloir dire chez nous (règles §4)

| Lecture | Existe dans le moteur ? | Règle nouvelle ? | Verdict |
|---|---|---|---|
| **A. Mise en scène de l'ouverture** : les 3 à 4 Entrants posés d'office par `setupPlayer` arrivent dos visible puis se retournent, après le lancer de tampon | oui, l'état final existe déjà | **non** : le moteur ne change pas, aucune information cachée n'est inventée | **recommandé** |
| **B. La Direction pose / évolue** : la carte vient d'une main adverse de dos (éventail de dos en haut) et se retourne en arrivant ; un Objet joué va au Rebut face visible ; la pioche retourne la carte en volant | oui, **dérivable par comparaison d'états** (`effetsEntre(avant, après)` n'ajoute « aucun champ au moteur », `effets-combat.ts:165-171`) | **non** | **recommandé**, après A |
| **C. Vraie préparation** (capture `04` : on choisit son Poste et son Banc face cachée, on touche « Commencer », révélation simultanée) | **non** : `phase: 'playing' \| 'ended'` seulement (`engine.ts:345`, `src/data/types.ts:344`), pas de champ « face cachée », pas d'action de placement | **oui** : nouvelle phase, nouvelles actions, IA, `replayBattle`, store (`partie`, migration), partie à deux, traces D-086, pas-à-pas | **à ne pas faire ici** ; c'est un gain de fidélité (capture 04, D-034) mais une règle (AGENTS §1.4, D-081) |

Le moteur permet donc **A et B sans toucher `src/game/`** ; seul **C** est une règle. Ce que A et B ne sont pas : un jeu où l'on cache quelque chose au
joueur (le joueur ne choisit pas son Poste : D-081 « posés d'office »). C'est de la **mise en scène**, il faut l'écrire ainsi.

### 3.3 Ce qui tient à 420×900 sans défilement (maquette injectée, OBSERVÉ + DÉDUIT)

Méthode : le vrai combat, au tour 10, Pression jouable (barre de 114 px, pire cas), où j'injecte du CSS et du DOM dans la page (`maquette.mjs`,
rien dans le dépôt) : piles posées 40×56 (dos empilé, compteur en pastille), journal de 3 lignes, barre au-dessus et main tout en bas, rognée à
56 px (≈ la moitié haute de la carte), main « ouverte » en feuille fixe de 197 px avec des cartes de 105×147 (×1,46 par rapport aux 72 px actuels).
Captures : `maquette-<gabarit>-repos.png`, `maquette-<gabarit>-ouverte.png` ; mesures : `maquette-mesures.json`.

| Gabarit | scrollH / fenêtre | Plateau avant → après | Contenu du plateau | Verdict |
|---|---|---|---|---|
| 420×900 | 900 / 900 | 561 → 589 px | 589 (tient) | **tient** (+28 px rendus au plateau) |
| 412×810 | 810 / 810 | 480 → 499 px | 499 (tient) | **tient** (+19 px) |
| 390×664 | 664 / 664 | 378 → 368 px | **378** (déborde de 10 px) | le document ne défile pas, mais le plateau **mord de 10 px** sur le journal |
| 360×640 | 640 / 640 | 354 → 344 px | **354** (déborde de 10 px) | idem |

Lecture :
- Sur **420×900 et 412×810**, la main rognée + les piles + 3 lignes de journal tiennent **avec** la marge de 20 px et gagnent de la hauteur : **c'est la réponse à D-167 (3)**.
- Sur **390×664 et 360×640**, trois lignes de journal sont trop : **deux lignes** rendent 16 px et couvrent le débord de 10 px (DÉDUIT, non remesuré). Le journal doit avoir un nombre de lignes qui suit la hauteur.
- Les piles posées (56 px) **ne rallongent pas** le plateau : le `scrollHeight` du plateau à 360 reste 354, comme avant (mesuré).
- Main **ouverte** (feuille de 197 px) : elle recouvre la barre d'action et le journal, et mord de ≈ 7–9 px sur le bas du Banc du joueur (`maquette-420x900-ouverte.png`) ; 160 px suffiraient (carte 147). Elle doit donc **laisser la place libre du Banc visible** (c'est une cible de pose, `onPoserPlace`).
- À mesurer sur l'implémentation réelle, pas sur la maquette : le **nom** de la carte est au **pied** de la carte chez nous (sur Pocket il est en haut). Au repos (moitié haute visible), la main ne montre **pas les noms** : on lit l'illustration, le Seuil, le type. C'est un risque de lisibilité, voir T4.

**Deux dispositions possibles pour la barre** (même somme de hauteurs, DÉDUIT) :
- **A — main tout en bas, barre au-dessus** (Pocket) : la main peut **déborder du bord** (+20 px de carte visible), mais il faut amender D-094 (3) et D-171 (4) (voir §4) et réécrire la garde.
- **B — barre en bas, main au-dessus** (comme aujourd'hui) : **aucune décision à amender** (D-094 (3), D-171 (4) tiennent), la main reste « en bas du plateau ». Moins fidèle à Pocket, zéro risque pour la garde.

Je recommande **A** pour le geste (le pouce tombe sur la main), à condition que Bastien accepte l'amendement ; **B** est le repli sans décision.

### 3.4 Proposition (téléphone portrait d'abord)

1. **Paquets posés** : Deck = dos de carte empilé (l'épaisseur dit le nombre), compteur en pastille ; Rebut = dernière carte **face visible** posée en biais, compteur ; les deux **ouvrables** (Rebut surtout, C8). Vocabulaire JEU.md §3 : « Deck », « Rebut » (pas « pioche », « défausse »).
2. **Main adverse** (optionnelle, T8) : éventail de dos, au plus 10, à la place du texte « main 2 ».
3. **Journal** : 2–3 lignes visibles (la dernière en gras), un tap ouvre le journal entier en feuille. Le `⋯ → Journal` reste.
4. **Main** : bas de l'écran, dessus des cartes visible (≈ 50–56 px), pas de titre « Ta main » (le compte passe sur la pastille), cartes jouables liserées.
5. **Au tap** : la main **monte** en feuille (cartes entières) ; un second tap **choisit** (comportement actuel) ; les gestes de pose vivent **dans la feuille** (plus de panneau « Carte choisie » sous la main, donc plus de défilement). Échap ou tap dehors referme.
6. **Retournements** : A à l'ouverture (≤ 2 s, passable d'un tap), B pour la pioche et la Direction. « Mouvement réduit » : face visible tout de suite, rien ne bouge.
7. **Bureau (≥ 900 px)** : la main reste dans la console (D-158) dans un premier temps ; la même logique viendra ensuite, à décider.

---

## 4. Décisions que la demande contredit, oblige à amender ou laisse intactes

(Passages cités tels qu'écrits dans `docs/DECISIONS.md` ; les lignes sont longues, je les lis par `python3`, `Read` les tronque à 2000 caractères.)

| Décision | Passage | Effet de la demande |
|---|---|---|
| **D-093** (1) | « le Poste à 116 px, le Banc à 64 px, la main en éventail rognée par le bas » ; (5) « la carte de main soulevée » ; SPEC R1, R5 | **Rétablie, pas contredite.** À citer comme source dans la nouvelle décision. |
| **D-167** (1) | « D-157 (Poste 96, Banc 64, main 72 px) reste la taille de référence » | **Intacte tant que les tailles du plateau ne grandissent pas.** Si la hauteur rendue par la main sert à grandir le Poste/Banc, il faut le dire. |
| **D-167** (3) | « Ce qui reste à trancher… quelle surface rend de la hauteur pour que le nom d'un Planqué se lise entier » ; « tant que ce trade-off n'est pas acté, D-157 tient » | **La demande tranche** : c'est **la main** (134 → 56 px au repos). À acter. |
| **D-157** (1) | « carte de main 64 → **72 px** » | **Amender** : 72 px devient la taille de la carte au repos (largeur), pas une hauteur de bloc ; la taille ouverte (≈ 105 px) est nouvelle. |
| **D-094** (2)(3) | « la garde de `npm run capturer` fait foi » ; « marge… au moins 20 px à 420 × 900 » | **Amender la garde, pas la règle** : `CIBLES_HAUTEUR` mesure `.hand` (marge ≥ 20, jamais sous la barre). Une main qui **déborde du bord** (disposition A) échoue aujourd'hui. Il faut dire **quel élément** garde les 20 px (la barre ? la zone tactile ?). |
| **D-094** (4) | « sans retirer une information de l'écran » | Le **titre « Ta main »** et le panneau « Carte choisie » disparaissent (déjà retirés sous 700 px par D-142 (3)) : à reporter (compte sur la pastille, fiche dans la feuille). |
| **D-103** | « l'écran de combat ne défile plus » | **Tient, et oblige** : l'état « carte choisie » **défile aujourd'hui de 278 px** (`film-ia.json`). La feuille ouverte le règle ; ajouter l'instant « carte choisie » aux instants mesurés. |
| **D-171** (3)(4) | « le document ne défile pas » ; « le bord inférieur de la barre d'action garde **20 à 32 px** jusqu'au bas de la fenêtre utilisable » | **(3) tient. (4) à amender si disposition A** : la barre n'est plus la dernière chose en bas (la main l'est). Avec B : intacte. |
| **D-121** (2)(3) | « clic, tap ou Entrée = un panneau non modal… Échap ferme, le focus revient à la carte… Aucun appui long » ; « pas de `role="grid"` » | **Compatible si** la main ouverte reste non modale, Échap la ferme, le focus revient à la carte, chaque carte reste un `button` dans l'ordre de `Tab`. Deux feuilles basses (inspecteur D-121 + main) ne peuvent pas coexister : l'inspecteur se pose en `top: var(--inspecteur-haut, 45dvh)`, `styles.css:4263`. |
| **D-142** (3), D-157 | « sous 700 px, le titre « Ta main » cède sa ligne… Banc et main à 52 et 60 px » | La main au repos doit avoir une taille par palier de hauteur (3 paliers, D-173 (2)) : `styles-combat.test.ts` garde la **forme** de la dérivation (`.battle .hand { --carte-w … }`, ligne ~303). |
| **D-173** (1) | « les `safe-area-inset-*` réservent la place » | Une main collée au bord doit ajouter `env(safe-area-inset-bottom)` (PWA plein écran). |
| **D-165** (3) | « l'étape 1 du pas-à-pas… désigne la **main** avant le plateau » | La cible `data-pas-a-pas="main"` devient une bande de 56 px : vérifier que la désignation et la ligne du pas-à-pas tiennent ; le texte « touche une carte de ta main » reste vrai. |
| **D-141 / SPEC §6.8.3** | « aucune animation CSS de plus de 800 ms, aucune boucle de plus de deux tours » ; exemption : préfixe `ouverture-` seulement | Un retournement CSS de **0,37 s** (Pocket) passe. Une **cascade** d'ouverture (3–4 cartes × 2 camps, décalées) ne se juge pas dans la garde, qui ne lit que durée × tours, pas `animation-delay` : le plafond de l'esprit (« un effet ne doit pas retarder la lecture du coup suivant ») est à **écrire** (proposé : ≤ 2 s au total, passable d'un tap). Pas d'exemption `ouverture-` (D-141 (4)). |
| **D-098** | scène : deux `canvas`, WAAPI, la scène « déplace » les cartes ; mouvement réduit = information immobile | Les retournements s'ajoutent sous les mêmes coupures (store + système). Attention à l'ordre des couches (canvas sous/sur les cartes). |
| **D-166** | « un son par effet de scène… l'unique module audio reste `sons.ts` » | **Aucun son** pour les retournements dans ce lot (sinon une décision, un WAV, un test de poids). |
| **D-081** | « la mise en place (les Entrants posés d'office au Poste et au Rack) est une mise en jeu » | **Contredite seulement par la lecture C** (choix du Poste). A et B la laissent intacte. |
| **D-078, D-079** | révélation écrite au journal ; `peek` visible du seul joueur concerné | Une main adverse **de dos** ne fuit rien. `dessusDuDeck` ne doit **jamais** alimenter l'affichage d'un paquet adverse ouvert. |
| **D-018, §4 `Pioche vide`** | miroir de Pocket ; « pas de défaite » | Deck à 0 : la pile devient un emplacement vide, sans message de défaite. |
| **JEU.md §4** | aucune ligne ne parle de face cachée ni de mise en place choisie | **Aucune ligne à changer** pour A et B. Pour C : nouvelle ligne + décision. |
| **AGENTS §1.6** | « Ne pas ajouter de mécanique maison au mode standard » | Respecté (mise en scène seulement). |

**À écrire** : une décision (la prochaine, D-180 si aucune autre n'est prise avant) qui (1) restaure D-093 (1)(5) et R1/R5, (2) tranche D-167 (3), (3) amende D-157 (1),
D-094 (2)(3) et D-171 (4) **ou** retient la disposition B, (4) dit que A et B sont de la mise en scène, (5) fixe le plafond d'animation d'ouverture, (6) laisse C à Bastien.
`docs/DECISIONS.md` et `AGENTS.md` : je n'y ai pas touché.

---

## 5. Tickets ordonnés

Ordre : décision, puis ce qui ne coûte pas de hauteur, puis la main (qui rend la hauteur), puis ce qui la consomme (journal), puis les animations.
Commandes de preuve communes : `npm run check`, `npm run format:check`, `npm test`, `npm run garde-fous`, `npm run build`, **`npm run capturer`** (gabarits
420×900, 412×810, 390×664, 360×640, 1280×800, 1920×1080), `npm run detect:ui:page`.

| # | Titre | Critère d'acceptation vérifiable |
|---|---|---|
| **T0** | Décision : le plateau de combat rend la table (restaure D-093, tranche D-167 (3)) | Ligne datée dans `docs/DECISIONS.md` citant D-093, D-094, D-157, D-167, D-171 ; disposition A ou B choisie ; plafond d'ouverture écrit ; `npm run index:decisions` puis `npm test` (les tests de docs) exit 0. **Bastien tranche A/B et dit si C est voulu.** |
| **T1** | Deck et Rebut : des paquets posés | Deck = dos empilé, Rebut = dernière carte face visible, compteur ; chaque pile a un nom accessible (« Deck de la Direction, 6 cartes ») ; `.pile--deck.is-piochante` conservé (`Battle.test.tsx:1561`) ; Deck à 0 = emplacement vide ; test de rendu pour 0, 1, 20 cartes ; `npm run capturer` exit 0 aux 6 gabarits (plateau ne rallonge pas) ; capture `420x900` jointe. |
| **T2** | Le Rebut s'ouvre (écart D-034 / capture `03`) | Un `button` sur chaque Rebut ouvre un panneau non modal listant `side.discard` **face visible** pour les deux camps ; Échap ferme, focus rendu ; **jamais** le Deck ; test « le contrôle mord » : une carte du Deck n'apparaît pas dans le panneau ; D-121 (3) respecté (pas de `role="grid"`). |
| **T3** | Main au bas de l'écran, dessus des cartes visible (au repos) | Disposition retenue en T0 ; au repos 420×900 : bloc de main ≤ 76 px, titre retiré ; chaque carte reste un `button` au nom accessible et ≥ 44 px de cible ; `env(safe-area-inset-bottom)` ; **garde réécrite** : `capturer.mjs` `controlesHauteur` nomme l'élément qui garde ses 20 px, avec un test « le contrôle mord » (cas fautif : main sous la barre) ; `styles-combat.test.ts` mis à jour (forme de la dérivation) ; `npm run capturer` exit 0 aux 6 gabarits. |
| **T4** | Lisibilité de la main rognée : le nom au repos | Décision sur la variante de carte de main (nom en haut, comme Pocket, ou icône + Seuil seuls) ; si nom en haut : seulement la variante `calme plateau` de `CardView`, **la Collection ne change pas** (`CardView.test.tsx`) ; capture 72×~50 px montrant le nom lisible ≥ 11,2 px (plancher D-164/`--fs-xs`). |
| **T5** | La main s'agrandit au tap, sans défilement | Un tap ouvre la feuille (cartes ≈ 105×147), un second choisit, Échap/tap dehors referme ; les gestes de pose sont **dans** la feuille, le panneau `.pose` sous la main disparaît ; **`document.scrollHeight == innerHeight` après le tap**, mesuré par un nouvel instant « carte choisie » ajouté à `INSTANTS_COMBAT` (échoue si la page défile : cas fautif fabriqué) ; la place libre du Banc reste visible et cliquable (`onPoserPlace`) ; sous « Mouvement réduit » : pas de transition ; `Battle.test.tsx` (33 références `hand`/`pose`) et `effets-combat.test.ts:430-456` (soulèvement de 0,5 rem) mis à jour. |
| **T6** | Journal : 2 à 3 lignes visibles, le reste au tap | Le nombre de lignes suit la hauteur (3 > 860 px, 2 ≤ 700 px) ; le plateau ne mord pas (mesure : `.board` `scrollHeight == clientHeight` à 390×664 et 360×640) ; **une seule** zone `aria-live` (pas de double annonce) ; `⋯ → Journal` inchangé ; aucune ligne `Galère` (`grep -rn Galère src/` vide) ; `npm run capturer` exit 0. |
| **T7** | Ouverture du combat : les Entrants posés se retournent | Seulement pour un combat **neuf** (ni reprise, ni `sceneFin`) ; dos → face, Poste puis Banc, joueur puis Direction, **≤ 2 s au total**, passable d'un tap ; planche de frames par `scripts/preuves/filmer-animation.mjs` montrant au moins 6 frames dos → face ; test : une reprise de partie n'anime pas ; sous « Mouvement réduit » : faces visibles dès le premier rendu ; keyframes ≤ 800 ms, `effets-combat.test.ts` exit 0 (et son contrôle mord conservé). |
| **T8** | Pioche et pose adverse : la carte se retourne en arrivant | Nouvelles natures d'effet **dérivées de `effetsEntre`** (aucun fichier de `src/game/` modifié : `git diff --stat -- src/game` vide) ; la pioche = dos → face en volant de la pile à la main ; la pose de la Direction = dos → face au slot ; ≤ 800 ms par carte ; plafond de 4 effets simultanés respecté (`MAX_EFFETS_SIMULTANES`) ; tests dans `effets-combat.test.ts`. |
| **T9** | Main adverse de dos (optionnel) | Éventail de dos ≤ 10, remplace « main N » ; **mesure** de hauteur avant de promettre (aucune marge démontrée à 360×640) ; rien de la main réelle dans le DOM (test : aucun `cardId` adverse rendu). |
| **T10** | Bureau : la main dans la console | Décision séparée (D-158) ; ne touche pas T3–T5 ; `1280×800` et `1920×1080` sans défilement. |
| **T11** | Docs et preuves | `DESIGN.md` §2.4 (hauteurs), `docs/SPEC-COMBAT-UI.md` (R1/R5 livrés), lot de captures « avant/après » dans `docs/preuves/` ; `docs/COMMANDES.md` si une commande change. |
| *(hors lot)* **C** | Préparation choisie, face cachée (capture `04`) | Ne pas ouvrir sans demande de Bastien : phase `setup`, actions, IA, `replayBattle`, migration du store, partie à deux, traces D-086, pas-à-pas, tests de fuzz ; D-081 amendée ; ligne ajoutée à JEU.md §4. |

Dépendances : T0 → T1, T2, T3 ; T3 → T4, T5, T6 (la hauteur rendue par T3 paie le journal) ; T7 et T8 après T1 (elles animent les piles) ; T9 après T6.

---

## 6. Frictions d'environnement

1. **`impeccable` refusée** : `Permission denied: skill`. J'ai lancé le binaire `impeccable detect` et lu les avis des pages, sans contourner (§2). Si la critique par la skill compte, il faut la lancer dans une session qui y a droit.
2. **`npm run capturer` et `npm run jouer-partie` écrivent dans le dépôt** (`captures/`, `dist/`) et lancent leur propre serveur : interdits pour ce diagnostic. J'ai donc recomposé : build hors dépôt (`build.mjs` : `vite.build({ build: { outDir: '<hors dépôt>' }, envDir: <dossier vide> })`, **sans les variables `VITE_*`**), serveur `vite.preview` programmatique (`preview.mjs`, port 5193), Chromium 1248 du cache local de Playwright via `playwright-core`.
   - **Conséquence** : la garde de hauteur réelle (D-094, D-103, D-171) n'a **pas** été exécutée ; mes chiffres viennent de mesures de DOM à la main. Pour T3, T5, T6, il faut lancer `npm run capturer` **dans un worktree**.
3. **Obtenir un état précis** : il n'y a **pas** de phase de mise en place à scripter et pas d'URL d'état. Ce qui marche (`sim.mjs`) : `createBattle` + `nextAction` (IA) dans `vite.ssrLoadModule`, enveloppe `{ mode, camp, seed, playerDeck, aiDeck, playerCafeTypes, aiCafeTypes, actions[0..k] }` rangée dans `localStorage['bureau-des-planques-v1'].state.partie`, plus `tutorielVu: true`, `pasAPasCombatVu: true` pour supprimer le tutoriel. Piège : l'amorçage ne doit se faire **qu'une fois** (`sessionStorage.amorce`), sinon un rechargement réécrit la partie. Un combat neuf se rejoue par `page.clock.setFixedTime(graine)` (`createBattle` prend `Date.now()`). `capturer-socle.mjs` (`amorcageStore`, `INSTANTS_COMBAT`) fait déjà tout cela : à réutiliser dans le dépôt.
4. **`isMobile` + `hasTouch`** sont nécessaires pour `locator.tap()` et pour que `matchMedia` voie un téléphone ; sans eux le gabarit 420 se comporte comme un bureau étroit.
5. **Lire `docs/DECISIONS.md`** : les lignes dépassent 2000 caractères, `Read` les tronque (D-098, D-121, D-171 coupées). `python3` découpé par `startswith('| D-NNN ')` les rend entières. `gh issue list --search` répond à peine (un seul résultat pour « combat », hors sujet) : j'ai cherché par `--state all --search "combat in:title"` (40 tickets, tous fermés ; aucun ticket ouvert sur le plateau, les piles, la main ou le journal).
6. **La ligne de journal entre en fondu ~1 s après le chargement** (#551) : une capture trop précoce mesure une hauteur de barre fausse ; j'attends 800–1200 ms.
7. **`npm run capturer` ne mesure ni « carte choisie » ni la feuille d'inspecteur** : le défilement de 278 px au tap n'a jamais pu être vu par la CI (§1.2).
8. **Non vérifié** : le rendu sur un téléphone réel ; le comportement de la maquette au toucher (elle n'est qu'un instantané CSS) ; la face du Rebut (placeholder gris) ; le `pas-à-pas` ouvert avec la main rognée (non relu : `420x900-1-debut-pasapas.png` existe mais je ne l'ai pas regardée) ; `CHRONOLOGIE.md` §§ au-delà des 150 premières lignes et `ANIMATIONS.md` au-delà du §5 (lus en diagonale).

---

## 7. Commandes jouées (exit code)

| Commande | Exit | Sortie utile |
|---|---|---|
| `git status --short` (début et fin) | 0 | vide |
| `node preview.mjs` (en tâche de fond) | — | `preview pid 4188952 [ 'http://127.0.0.1:5193/' ]` ; `curl /battle` → `200` |
| `node film-ia.mjs` | 0 | `apresTap.scrollH 1178`, `scrollY 278`, animations du tour de la Direction : `craquage-desature`, `stress-monte`, `train-craquage` |
| `node maquette.mjs` (deux fois) | 0 | tableau du §3.3 |
| `node_modules/.bin/impeccable detect src/` | 0 | sortie vide |
| `gh issue list --state open --search "<mot>"` (10 mots) | 0 | 2 résultats hors sujet (#495, #504) |
| `gh issue list --state all --search "combat in:title"` | 0 | 40 tickets, tous `CLOSED` |
| `kill $(cat preview.pid)` puis `ss -ltn \| grep 5193` | 1 | plus rien n'écoute |

Fichiers : `RAPPORT.md`, `captures/`, `mesures-telephones.json`, `maquette-mesures.json`, `film-ia.json`, `sim.json`, scripts `build.mjs`, `preview.mjs`, `sim.mjs`, `capturer-diag.mjs`, `film-ia.mjs`, `maquette.mjs`.
