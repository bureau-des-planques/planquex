# Spec — l'écran de combat : le plateau comme héros

> **Écrite le 25/10/2026.** Recherche de conception + proposition. Ce document **n'acte
> aucune décision** : les lignes datées de `docs/DECISIONS.md` restent seules à engager
> quelque chose, et les tickets qui exécuteront ce plan restent à ouvrir (§8).
>
> **Demande d'origine** (Bastien, 25/10/2026, mot pour mot) :
>
> > « l'UI de combat ne va pas du tout je veux quelque chose de moderne beaucoup plus propre
> > et sobre où on voit bien le plateau de jeu et les infos qui s'affichent quand on passe la
> > souris ou clique sur carte et élément, et peut-être un raccourci pour toggle les infos »
>
> **Statut** : recherche + proposition. Trois choses y sont distinguées partout :
> **observé** (fichier, ligne, capture, commande), **sourcé** (une source primaire est citée
> en §9), **hypothèse** (annoncée comme telle, `AGENTS.md` §1 règle 3).
>
> **Révision du 25/10/2026 (soir)** : la maquette de §6.2-6.7 a été confrontée à une
> **référence vidéo fournie par Bastien** (deux animations de 8 s, générées par IA,
> 720 × 1280) et à sa propre note de lecture
> (`/tmp/opencode/reponse-maquette-video-ui.md`). Six corrections en sortent, rassemblées
> en **§6.8**, qui **prévaut** sur §6.2-6.7 quand les deux divergent. La provenance de cette
> référence est dite en §9.4 : c'est une source de **structure et d'ambiance**, jamais de
> pixels ni de texte.
>
> **Autorité** : `AGENTS.md` §2 — `docs/DECISIONS.md` d'abord, puis `PROPOSITION.md` §3-5,
> `CARD-SPEC.md`/`FACTIONS.md`, `MIROIR-2026-DELTAS.md`, le code, les audits datés.
> `DESIGN.md` fait autorité sur l'apparence. Ce document ne crée **aucune règle de jeu** :
> il parle de l'écran, jamais du moteur.
>
> **Aucune dépendance n'est proposée** (§5.4), et **aucun visuel d'un jeu de référence n'est
> repris** : on décrit des structures, jamais des assets (`docs/CAPTURES-UI.md`, §« la règle
> qui gouverne tout ce document »).

---

## 1. Ce que montre l'écran actuel

Constat sur pièces. Les captures de référence sont
`docs/preuves/finition-alpha-2026-10-23/avant/420-combat.png` et `avant/1280-combat.png` ;
l'état d'après la passe du 23/10 (`apres/420-combat.png`) ne change pas la structure.

### 1.1 Le plateau ne montre aucune carte

| Observé | Où |
|---|---|
| Le Poste affiche un **nom en gras** et une ligne `0/60 de Stress`, jamais la carte | `src/pages/Battle.tsx:380-402` |
| Le Banc affiche jusqu'à trois **noms tronqués** (`Kiné du tra…`) et `0/70 de Stress` | `Battle.tsx:413-427` ; captures `avant/420-combat.png` |
| `CardView` — le gabarit de carte du jeu — **n'est pas importé** par l'écran de combat | `Battle.tsx:1-49` (aucun import de `CardView`) |
| La main est une **bande de boutons texte** de `7.4rem`, pas des cartes | `Battle.tsx:1000-1022`, `src/styles.css:2170-2201` |

C'est le point central de la demande : à 420 px, le jeu de cartes ne montre **aucune carte**.
Les illustrations existent (`src/art.ts`, D-045) et servent partout ailleurs.

### 1.2 L'information est dite quatre fois, en petit

- `0/70 de Stress` apparaît jusqu'à **quatre fois** dans la même fenêtre (deux Bancs + deux
  Postes) ; `Battle.tsx` écrit `de Stress` **3 fois** dans son JSX (`grep -c "de Stress"`).
- Le même cadre usiné sert au camp, au Poste, à chaque place du Banc, aux sections et aux
  blocs repliés : **16 déclarations `border: 1px solid`** dans la partie combat de
  `src/styles.css` (lignes 1584-2300). C'est la définition du tell « **Nested cards** »
  (Impeccable, §5.3) et du « **Cardocalypse** » de sa galerie.
- `.board__side` cumule un **filet de 1 px** et une **ombre large** (`styles.css:1665-1677`) :
  tell « **Hairline border with wide shadow** ». Le camp au trait y ajoute un liseré accentué
  « vers le bas » (`styles.css:1679-1684`) : tell « **Dark mode with glowing accents** ».

### 1.3 Trois informations ne sont accessibles qu'au survol

| Observé | Où | Conséquence |
|---|---|---|
| La Machine à café ne dit ses **types de Deck** que dans un `title` | `Battle.tsx:163` | invisible au doigt, donc invisible à 420 px |
| Une place du Banc ne dit son Stress que dans un `title` | `Battle.tsx:415` | idem |
| Une Condition ne dit sa règle que dans un `title` du badge | `src/components/StatusBadge.tsx:26` | idem ; le texte complet n'est lisible que dans le bloc replié « Conditions » (`Battle.tsx:1064-1081`) |

Le `title` est une infobulle **du navigateur** : WCAG la déclare hors de portée de l'auteur
et donc hors du champ de SC 1.4.13 (§3.2), et elle n'a **aucun équivalent tactile**. Une
info qui n'existe qu'en `title` n'existe pas sur le téléphone — c'est **observé** par le code,
et c'est la raison mécanique pour laquelle Bastien demande « les infos quand on passe la
souris **ou** clique ».

### 1.4 La hauteur ne tient pas, malgré ce que dit `DESIGN.md`

`DESIGN.md:151-153` annonce que « le plateau des deux camps, la main et les actions de la
Pression tiennent dans la fenêtre pour un tour courant, **sans défiler** » à 420 × 900.
Les captures du 23/10 montrent l'inverse : la page défile, la bande de main est **coupée à
droite** (`4 / 10 · touche une carte pour jouer` puis des cartes hors champ), et la dernière
ligne du journal passe **sous la barre de navigation**. Le commentaire de `styles.css:2168`
affirme de son côté que « cinq cartes tiennent côte à côte » : à 420 px, cinq cartes de
`7.4rem` plus quatre gouttières de `0.45rem` demandent ≈ **621 px** (calcul :
`5 × 118,4 + 4 × 7,2`), soit 1,5 fois la largeur disponible.

**Écart signalé, pas tranché** (`AGENTS.md` §2) : soit `DESIGN.md` §2.4 décrit une cible, soit
il décrit un état — aujourd'hui les deux captures disent « cible non atteinte ». La §6 de ce
document propose de la atteindre autrement, en réduisant ce qui est affiché, pas en
rapetissant la police.

### 1.5 Ce que l'écran fait déjà bien, et qu'il ne faut pas perdre

- **Aucun bouton grisé** : la liste vient de `legalActions`, l'écran ne décide rien
  (`Battle.tsx:255-260`, commentaire). C'est une qualité rare, et la refonte doit la garder.
- **Le pas-à-pas** (#143, #169) désigne des cibles réelles, et un test l'exige
  (`Battle.tsx:820-824`, `src/components/pas-a-pas-combat-etapes.ts:24-38`,
  `src/pages/Battle.test.tsx:248-262`). Toute refonte doit **conserver les 7 cibles**.
- **L'anneau de focus global** existe déjà (`src/styles.css:243-246`), sur `--gold`.
- **Le mouvement réduit** est déjà neutralisé deux fois (réglage du store + média CSS,
  `styles.css:2305-2314`).

---

## 2. Ce que font les jeux de référence

On décrit des **structures**, jamais des visuels. Une ligne = une affirmation = une source
(§9). Ce qui n'a pas de source est signalé.

| Affirmation | Source | Verdict pour nous |
|---|---|---|
| Le jeu miroiré nomme **cinq zones** : Deck (face cachée), Poste actif, Banc, pile de défausse, main | capture `docs/preuves/astuces-2026-10-20/03-zones-de-combat.png`, transcription `README.md:37-53` | notre plateau porte déjà ces zones ; il **manque** le Rebut visible (il n'est qu'un compteur, `Battle.tsx:436-438`) |
| La **pile de défausse est consultable à tout moment** par les deux joueurs | même capture, `README.md:45-49` | le Rebut doit être **ouvrable** (inspecteur), pas seulement compté |
| Pour agir sur un Planqué, **on touche la carte, puis on choisit** l'action (ex. le Talent) | capture `05-deroulement-dun-tour.png`, `README.md:109-112` | **c'est le modèle demandé par Bastien** : carte → panneau contextuel |
| La zone de café annonce **le café présent et le suivant** | capture `05`, `README.md:79-83` | petit gain : la Machine peut annoncer « 1 café maintenant · types du Deck » dans l'inspecteur |
| Le coût d'une Pression se lit **à côté de son nom**, sur la carte | FAQ officielle, *How do attacks that do not require Energy work?* (§9) | déjà vrai dans `CardView` (`components/CardView.tsx:123-137`) : le plateau doit montrer la carte, pas la retaper |
| « **Our game is UI** » — un jeu de cartes numérique *est* son interface ; l'UI a été dessinée, jetée et redessinée | Derek Sakamoto (UI senior, Hearthstone), GDC 2015, cité par Game Developer (§9) | la refonte est un travail de jeu, pas de décoration — d'où le découpage en tickets (§8) |
| Dans un jeu de cartes, les défauts d'UI récurrents sont **le texte trop petit, le texte qui déborde, les infobulles qui recouvrent l'interface, les couches qui s'empilent** | notes de correctifs officielles Marvel Snap, 21/07/2026 (§9) — six entrées de ce type dans une seule page | nos quatre défauts de §1 sont **la même famille** ; ce sont des défauts, pas des goûts |
| Une **infobulle qui recouvre du contenu** est un défaut, pas un choix | idem : « *The tooltip for Wild Boosters should no longer overlap with elements of the Conquest UI* » | l'inspecteur ne doit **jamais** recouvrir la carte qu'il décrit (voir §3.4) |
| Le **bouton maintenu** est un obstacle moteur ; le **basculement** est la solution, et le jeu doit offrir **les deux** quand c'est possible | Game Accessibility Guidelines, *Avoid / provide alternatives to requiring buttons to be held down* (§9) | tranche le débat « hold Alt » vs « toggle » : **bascule par défaut**, maintien jamais obligatoire (§4) |
| Un jeu doit **rappeler ses commandes** en cours de partie, et proposer une aide contextuelle | GAG, *Indicate / allow reminder of controls during gameplay* et *Include contextual in-game help / guidance / tips* | le raccourci doit être **visible** dans l'écran, et rappelé dans Réglages (§4.4) |
| Une information **temporaire** ne doit pas être placée **hors du champ de regard** | GAG, *Avoid placing essential temporary information outside the player's eye-line* | le journal d'une ligne reste **dans** la zone d'action, pas en bas de page (§6.2) |
| Les éléments interactifs doivent être **grands et espacés**, surtout sur un écran tactile | GAG, *Ensure interactive elements / virtual controls are large and well spaced…* | cibles ≥ 44 px sur le plateau et la main (§5.1) |

**Ce que cette section ne prouve pas** : aucune de ces sources ne dit *quelle disposition*
adopter. Elles disent ce qui **casse** (survol seul, texte petit, couches empilées, bouton
maintenu) et ce qui **marche** (toucher la carte, rappeler les commandes). La composition de
la §6 est une **proposition**, pas une lecture des sources.

---

## 3. Les patrons de divulgation

### 3.1 Ce que la norme impose

| Patron | Ce qu'il impose | Ce qu'il interdit |
|---|---|---|
| **Infobulle** (APG *Tooltip*, §9) | `role="tooltip"`, déclencheur relié par `aria-describedby`, **Échap** la ferme, elle **reste ouverte** tant que le pointeur est sur le déclencheur **ou** sur elle | **elle ne reçoit pas le focus** ; donc **aucun élément focusable dedans** (« *A hover that contains focusable elements can be made using a non-modal dialog* ») |
| **Dialogue modal** (APG, §9) | focus déplacé dedans, Tab piégé, Échap ferme, focus rendu au déclencheur, `aria-modal="true"` | `aria-modal` **seulement** si le reste est réellement inerte — sinon on casse les lecteurs d'écran |
| **Divulgation** (APG *Disclosure*, §9) | `aria-expanded` sur le bouton, `aria-controls` en option | rien de plus : c'est le patron le moins coûteux |
| **Grille** (APG *Grid*, §9) | un seul arrêt de tabulation, **flèches** pour circuler, gestion de focus écrite à la main | on ne peut pas laisser les flèches faire défiler la page en même temps |
| **SC 1.4.13 Contenu au survol ou au focus** (§9) | trois conditions cumulatives : **fermable** sans déplacer le pointeur (Échap), **survolable** (le pointeur peut entrer dans le contenu), **persistant** (il reste jusqu'à ce qu'on le ferme ou qu'il devienne faux) | un panneau qui **disparaît** quand on va vers lui |
| **SC 2.1.4 Raccourcis à une touche** (§9) | un raccourci **lettre/chiffre/ponctuation** doit être **désactivable**, **remappable avec un modificateur**, ou **actif seulement au focus** | une touche nue non désactivable |
| **SC 2.5.8 Taille de cible** (§9) | **24 × 24 px** minimum, ou un espacement qui isole la cible | des pastilles de 20 px collées |
| **SC 1.4.10 Redistribution** (§9) | pas de défilement dans les deux directions à 320 px de large | de faire tenir le plateau en le rendant illisible |
| **SC 2.4.7 Focus visible** (§9) | un mode d'exploitation où l'indicateur de focus est visible, **non limité dans le temps** | supprimer l'anneau « parce que c'est plus propre » |

**Nuance importante sur SC 1.4.10** : la note 2 de la compréhension du critère cite
explicitement les **jeux** parmi les contenus « qui exigent une disposition en deux
dimensions » et qui sont donc **exceptés** du défilement horizontal. Un plateau de jeu a le
droit d'être un plateau. Mais **l'exception ne s'étend pas** aux cellules ni au texte qui
l'entoure : le nom d'une carte dans l'inspecteur, le texte d'une Pression, le journal
**doivent** se redistribuer. C'est exactement la distinction que la §6 applique (plateau
excepté, inspecteur qui se replie).

### 3.2 Ce que la norme ne couvre pas — et qui compte quand même

- **Le `title` du navigateur** est hors du champ de SC 1.4.13 (« *the visual presentation of
  the additional content is controlled by the user agent* », note 1). Ce n'est donc pas une
  non-conformité — c'est simplement **inutilisable au doigt**. On le remplace (§1.3).
- **Le survol n'existe pas au tactile.** `@media (hover: hover)` et `(pointer: coarse)` sont
  *Baseline, largement disponibles* (§9) : ce sont les bons tests, et ils sont purement CSS.
  Toute information qui n'existe qu'au survol doit avoir un chemin **clic/tap** de même
  contenu — sinon elle n'existe pas pour la moitié des invités.
- **Un raccourci clavier n'a pas d'équivalent tactile** : la §4 exige donc un **bouton
  visible** qui fait exactement la même chose.

### 3.3 Les quatre patrons candidats, comparés

| Patron | Ce qu'il montre | Coût | Risque |
|---|---|---|---|
| **A. Infobulle (tooltip)** | une phrase courte, sans action | faible (`role`, `aria-describedby`, Échap) | ne peut **rien** contenir d'actionnable ; illisible si long ; sur téléphone il faut un autre chemin |
| **B. Panneau d'inspecteur** (dialogue **non modal**) | tout le détail + les actions de la carte | moyen (focus, Échap, retour du focus) | recouvre le plateau s'il est mal placé ; deux panneaux ouverts = confusion |
| **C. Zoom plein cadre** (la carte en grand) | la carte, lisible | moyen (dialogue modal) | coupe le plateau : contraire à « le plateau est le héros » |
| **D. Divulgation** (`aria-expanded`) | une ligne de plus, **dans** le flux | faible | pousse le plateau hors de l'écran à chaque ouverture |

**Recommandation** : **A** pour le survol et le focus (lecture seule), **B** pour le clic et
le tap (lecture **et** action). **C** seulement pour la carte de la main, où le zoom est un
geste attendu (c'est déjà, en esprit, le dialogue de fiche carte de la Collection,
`src/components/CardDetail.tsx`). **D** reste ce qu'il est déjà : les blocs repliés du menu
`⋯`.

Ce découpage n'est pas esthétique, il est **imposé** par l'APG : dès qu'un panneau contient
un bouton, il ne peut plus être une infobulle. On ne choisit donc pas « infobulle **ou**
panneau » : on choisit **lequel pour quel déclencheur**.

### 3.4 La règle de placement qui découle de la source Marvel Snap

L'inspecteur ne doit **jamais** recouvrir la carte qu'il décrit. Deux conséquences :
sur téléphone, il s'ouvre en **feuille basse** au-dessus de la barre de navigation, et la
carte désignée **reste visible** dans la moitié haute ; sur écran large, il occupe une
**colonne** à droite du plateau, et rien n'est recouvert. Aucun positionnement dynamique
n'est nécessaire — donc **aucun besoin** de l'API Popover ni du *CSS anchor positioning*
(§5.4).

---

## 4. Le raccourci

### 4.1 Ce qu'il faut trancher, et avec quoi

| Option | Ce qu'elle donne | Ce que disent les sources |
|---|---|---|
| **Maintien** d'une touche (type « hold Alt ») | les infos sont visibles tant qu'on appuie | GAG : « *Holding requires much greater motor ability than pressing* » ; le maintien ne doit **jamais** être le seul chemin |
| **Bascule** (toggle) | un appui change l'état, l'état reste | GAG : « *Having a toggle on/off button option makes life a lot easier* » — et « *ideally offer a setting for players to choose* » |
| **Au focus seulement** | le détail suit la carte qui a le focus | APG *Tooltip* le décrit ; SC 2.1.4 l'accepte comme dispense (« *Active only on focus* ») |

**Recommandation : bascule.** Le maintien n'est **pas** proposé (il n'apporte rien ici et
ajoute un mode à tester) ; le survol et le focus, eux, **montrent déjà** le détail carte par
carte, sans touche. Autrement dit : le raccourci ne sert pas à *voir* une carte (le survol et
le tap suffisent), il sert à **changer la densité de l'écran entier**.

### 4.2 La touche

| Candidat | Conflit connu | Verdict |
|---|---|---|
| `Espace`, `Entrée` | activent le bouton qui a le focus | **exclu** — c'est le geste d'activation |
| `←` `→` `↑` `↓`, `Page↑`, `Page↓`, `Home`, `End` | défilent la page ; l'APG les réserve à la grille | **exclu** (sauf si on implémente la grille, §6.6) |
| `Échap` | ferme l'inspecteur, le menu, le dialogue | **pris**, pour fermer |
| `F1`–`F12` | F1 = aide du navigateur, F5 = recharger, F11 = plein écran, F12 = outils de développement | **exclu** : aucune n'est libre partout |
| `I` | aucun raccourci de navigateur connu ; lecture mnémotechnique « **I**nfos » | **retenu** — c'est une **touche caractère**, donc soumise à SC 2.1.4 |
| `Ctrl` + `I` | `Ctrl+Shift+I` ouvre les outils de développement, `Ctrl+I` est libre dans Chrome et Firefox | **retenu comme alias permanent** : c'est le « remap avec un modificateur » de SC 2.1.4 |

**Conséquences obligatoires** (SC 2.1.4, au moins une des trois, on en prend deux) :

1. **Désactivable** — une case dans Réglages, « Raccourcis clavier au combat », **cochée par
   défaut** ; décochée, `I` ne fait plus rien et `Ctrl+I` **non plus** (sinon ce n'est pas une
   désactivation, c'est un déplacement du problème).
2. **Remappable** — `Ctrl+I` marche toujours quand les raccourcis sont actifs, donc un
   utilisateur de dictée vocale n'est jamais coincé avec une touche nue.
3. **Neutralisé dans un champ de saisie** — l'écran de combat contient **deux zones de texte**
   (le code de partie à deux, `Battle.tsx:1126-1134` et `1148-1159`) : taper « i » dans le code
   ne doit pas basculer l'affichage. C'est la leçon directe du scénario de dictée décrit par
   SC 2.1.4 (« *a spoken word can become a barrage of single-key commands* »).

### 4.3 Ce que la bascule change — et ce qu'elle ne change jamais

**Règle dure** : la bascule ne cache **aucune valeur qui change une décision**. Elle coupe
les **annotations** (le texte répété, les noms de Conditions, le détail des coûts), pas les
**états** (qui est au Poste, le Stress, les Interventions, à qui c'est le tour).

| | `sobre` (défaut) | `détaillé` |
|---|---|---|
| Carte du Poste | visuel + barre de Stress + pastilles de café + points de Condition | idem + **nom des Pressions et leurs dégâts**, nom des Conditions, café chiffré |
| Place du Banc | visuel + barre de Stress | idem + nom + Stress chiffré |
| Machine à café | une pastille | pastille + **types du Deck** |
| Inspecteur | à la demande (survol, focus, tap) | idem — la bascule ne le remplace pas |

Autrement dit : `sobre` supprime la **redite**, `détaillé` la remet pour qui la veut. Un
invité qui n'a jamais entendu parler du raccourci peut jouer entièrement en `sobre` : il perd
du confort, jamais une information unique.

### 4.4 Le rendre découvrable sans tutoriel

Trois indices, aucun modal :

1. **Le bouton qui porte l'action** est visible, à droite de la barre d'état : une icône
   `SlidersHorizontal` (lucide, déjà en dépendance) + l'infobulle « Infos détaillées —
   `I` ». Il porte `aria-keyshortcuts="I"` (§9) et `aria-pressed`.
2. **Un rappel dans Réglages**, sous « Mouvement réduit » : la case des raccourcis **est** le
   rappel (GAG : *allow reminder of controls*).
3. **Le pas-à-pas ne change pas.** Ajouter une sixième étape « le raccourci » serait du
   tutoriel pour une fonction secondaire, et il faudrait un nouveau `CibleCombat` — donc
   toucher un type que deux tests lisent (`pas-a-pas-combat-etapes.ts:24-38`,
   `Battle.test.tsx:248-262`). **Non.**

### 4.5 Au tactile, l'équivalent

- Le **bouton** de la §4.4 fait exactement la même chose qu'`I` : c'est l'équivalent exigé.
- Le **tap sur une carte** ouvre l'inspecteur (même contenu que le survol, plus les gestes).
- **Aucun appui long**, nulle part (GAG). Le tap suffit.
- Le choix `sobre` / `détaillé` est **mémorisé** (GAG : *ensure that all settings are
  saved/remembered*) → il rejoint le store persisté (§5.6).

---

## 5. Contraintes maison

### 5.1 420 × 900 est la cible de lecture, et 44 px la cible de doigt

- D-060 fait de **420 × 900** le critère de lecture, et `npm run capturer` photographie à
  cette taille (`AGENTS.md` §7). Ce n'est pas une préférence : c'est la commande qui juge.
- **24 × 24 px** est le minimum **AA** (SC 2.5.8) ; **44 × 44 px** est le **AAA** (SC 2.5.5) et
  la recommandation GAG pour un écran tactile. Le projet prend **44** pour tout ce qui se
  touche au combat (boutons d'action, cartes de la main, bouton de bascule), et **24 +
  espacement** pour les pastilles décoratives non actionnables. C'est un choix, pas une
  obligation AA : il est écrit ici pour ne pas être rediscuté.
- **Budget de hauteur, calculé à la main** (hypothèse de conception, à mesurer en §8), dans sa
  version **révisée** (§6.8) :
  barre d'état 44 + plateau **646** + barre d'action 60 + main **150** (rognée par le bas) =
  **900**. Le plateau a gagné la place que l'ancienne composition donnait à trois blocs
  repliés : c'est là que vivent le Poste à 151 px et les deux Bancs. L'inspecteur ouvert
  recouvre alors **la main seule** — jamais le plateau, qui reste lisible : c'est ce qui rend
  la feuille basse acceptable (§3.4).

- **Mesuré le 25/10/2026, et ça change la tâche** : en remplaçant les noms par des cartes
  **sans toucher au reste**, `npm run capturer` passe de « main visible » (bas de la main à
  **666 px**, barre de navigation à 830) à **906 px** — soit **+313 px**, et l'échec du
  critère D-060. Autrement dit : le plateau ne peut pas recevoir de cartes **avant** que la
  composition ne change (barre d'action collante, menu `⋯`, et le pas-à-pas qui ne pousse
  plus le plateau). C'est ce qui fait de #187 et #191 **une seule et même chantier**, dans
  cet ordre : #191 d'abord, les cartes ensuite.

### 5.2 `DESIGN.md` : ce qui est disponible, ce qui manque

Disponible et à réutiliser tel quel : les jetons de `:root` (`DESIGN.md` §1.1-1.4), les
échelles (`--fs-2xs` → `--fs-3xl`, `--sp-1` → `--sp-6`, rayons 9/14/20 px, §1.6), l'anneau de
focus (`styles.css:243`), la barre de Stress à dix crans (`styles.css:2038-2074`), les badges
de Condition (`StatusBadge.tsx`), le gabarit de carte (`CardView.tsx`).

Manque, et c'est à ajouter **dans `DESIGN.md`** avant de coder (sinon le détecteur d'Impeccable
le refusera comme « *Color outside DESIGN.md* » / « *Radius outside DESIGN.md* ») :

| Manque | Pourquoi |
|---|---|
| un jeton d'**ombre de surface** unique (ou la règle « aucune ombre sur le plateau ») | aujourd'hui trois ombres différentes cohabitent dans le combat |
| la **hauteur de l'inspecteur** (feuille basse et colonne) et sa règle de repli | aucune valeur n'existe |
| l'**état « au trait »** d'un camp, redéfini sans halo | le halo actuel est un tell |
| les paires de contraste des **pastilles de Condition** | `DESIGN.md` §1.5 vérifie les textes sur `--bg*`, pas les textes sur teinte à 22 % (§5.5) |

### 5.3 Les tells d'Impeccable que cette proposition ne doit pas cocher

Le catalogue public d'Impeccable (`impeccable.style/slop`, §9) range ses règles en neuf
familles. Celles qui **guettent une refonte de plateau** — et que la §6 évite nommément :

| Règle | Pourquoi elle guette ici | Ce que la §6 fait |
|---|---|---|
| **Nested cards** | le plateau actuel empile quatre cadres | une seule surface, des **filets** et de l'espace, pas des cartes dans des cartes |
| **Cardocalypse** (« five layers of cards ») | cinq niveaux : page, camp, Poste, place, badge | deux niveaux au maximum : le plateau, et la carte |
| **Same text repeated inside one container** | `0/70 de Stress` ×4 | le chiffre ne vit que dans l'inspecteur ; le plateau porte une **barre** |
| **Hairline border with wide shadow** | `.board__side` | bord **ou** ombre, jamais les deux |
| **Dark mode with glowing accents** | `.board__side.is-current` | l'état « au trait » passe par un **filet doré de 2 px** et le libellé du camp |
| **Side-tab accent border** | tente de marquer « mon camp » par une barre latérale colorée | non : c'est le **libellé** et l'ordre qui le disent |
| **Glassmorphism everywhere** | tente de flouter sous l'inspecteur | non : fond opaque `--bg-raised` |
| **Hero metric layout** | le `0/60` en gros, le `60` en petit | non : la barre de Stress **est** la donnée |
| **Tiny interface text** / **Tiny body text** | tout le combat est en `0.62`–`0.82rem` (`styles.css:1688-1798`) | plancher `--fs-xs` pour tout texte porteur d'information |
| **Clipped menus and popovers** | l'inspecteur dans un conteneur `overflow` | l'inspecteur est **hors** du flux du plateau (`position: fixed`), jamais rogné |
| **Text covered by another element** | la bannière du journal passe sous la navigation (capture) | le journal devient une **ligne réservée** dans la zone d'action |
| **Monotonous spacing** | toutes les gouttières à 0.35-0.5rem | trois échelles : dans la carte, entre les cartes, entre les blocs |
| **Identical card grids** | huit places au même poids | le **Poste est plus grand** que le Banc, et c'est la hiérarchie du jeu |
| **Emoji / glyphes debout pour une iconographie** | tente d'un « ⓘ » ou d'un « ⚙ » | `lucide-react`, déjà là (`Info`, `SlidersHorizontal`, `Ellipsis`) |
| **Radius outside DESIGN.md** | coins « modernes » à 24 px | 9 / 14 / 20 px, les trois rayons existants |
| **AI color palette** (violet/cyan) | tente d'un dégradé « premium » | palette `DESIGN.md`, or et bleu nuit, rien d'autre |

**Limite de cette section, dite franchement** : le binaire `impeccable` est en
`devDependency` (`package.json`) mais **n'est pas installé dans cette session**
(`node_modules` absent, `npm run detect:ui` → `sh: 1: impeccable: not found`). Je n'ai donc
**pas** pu lancer le détecteur sur l'écran actuel. Les règles citées viennent du **catalogue
public** et du fichier `craft-floor.md` du dépôt (`.opencode/skills/impeccable/reference/
craft-floor.md:19-44`, section « Refuse »), pas d'une exécution. Le compte a d'ailleurs
bougé : `DESIGN.md` et la CI parlent de **61** tells, la page consultée en annonce **68**
(et les familles qu'elle détaille en listent 67 — l'écart d'une unité est dans la page
elle-même) — le catalogue **grandit**, et c'est le détecteur installé qui fait foi au moment
où on le lance.

### 5.4 Zéro dépendance — et quelles API récentes on s'interdit

Ce qui est **déjà** dans `package.json` et suffit :

| Besoin | Ce qui existe | Note |
|---|---|---|
| cartes du plateau | `CardView` + `src/art.ts` (D-045) | il faut une **variante compacte sans les micro-animations** (`whileHover` y:-4, `CardView.tsx:47-49`) — un drapeau, pas une seconde carte |
| inspecteur / feuille basse | `src/components/ui/dialog.tsx` (`@base-ui/react/dialog`) + `src/components/ui/button.tsx` | le dialogue **non modal** est un mode de ce composant (Base UI expose la racine et le popup), à vérifier à la première ligne de code |
| animation d'ouverture | `framer-motion` (`motion`, `AnimatePresence`, `useReducedMotion`), déjà importé par `Battle.tsx:2` | le repli `prefers-reduced-motion` existe déjà |
| icônes | `lucide-react` | jamais d'emoji, jamais de glyphe Unicode en icône |
| styles | Tailwind v4 + `src/styles.css` (feuille unique), `:has()`, `@media (hover: hover)`, `(pointer: coarse)` | `:has()` est utilisé depuis D-* (`styles.css:1594`), `pointer` est Baseline |

Ce qu'on **s'interdit**, avec la raison :

- **L'API Popover** (`popover` / `popovertarget`) : MDN la classe **« Baseline 2025 — newly
  available »** (§9). « Newly available » veut dire « les dernières versions », pas « les
  téléphones de 2021 ». Une PWA installée qui perd son inspecteur sur un appareil un peu
  ancien est un défaut pire que celui qu'on corrige.
- **Le *CSS anchor positioning*** : la page MDN consultée ne porte **aucun bandeau
  Baseline** (§9). Non prêt.
- **Un plugin de survol** (type `floating-ui`) : une dépendance pour un placement qu'on n'a
  pas à calculer, puisque l'inspecteur est **fixe** (feuille basse / colonne).

**Signalé, pas retenu** : si un jour la carte doit s'agrandir au doigt « à la position du
doigt », alors `anchor positioning` sera la bonne réponse et il faudra une décision datée.

### 5.5 Contrastes AA et mouvement réduit

- `DESIGN.md` §1.5 vérifie **onze** paires, toutes ≥ 4.5:1, et le dit : « aucune autre paire
  de texte n'est en dessous de AA ». Or les **pastilles de Condition** posent du texte
  (`#d9b3ec`, `#f0b492`, `#c3cede`, `#a8d3ef`, `#e8cd93`) sur une **teinte à 22 %** du même
  ton au-dessus de `--bg-sunken` (`styles.css:2107-2135`) — ces cinq paires **ne sont pas
  dans le tableau**. À vérifier et à inscrire avant refonte (ce n'est pas une contradiction,
  c'est un trou : `DESIGN.md` §1.5 ne prétend couvrir que les paires du **thème**).
- Les nouvelles surfaces (inspecteur, feuille basse, zone d'action) doivent être des **jetons**
  (`--bg-raised`, `--bg-sunken`, `--line`, `--line-strong`), pas de nouveaux hex.
- `prefers-reduced-motion` **et** le réglage du store `reducedMotion` existent déjà
  (`styles.css:2305-2314`, `use-pas-a-pas-combat.ts:60-66`) : l'ouverture de l'inspecteur
  suit la même règle (fondu de 120 ms, ou rien).

### 5.6 Le store : un champ de plus, donc une version de plus

`DESIGN.md`/`AGENTS.md` §6 : « toute modification de forme doit être migrée ou versionnée ».
La bascule de la §4.3 est un **réglage d'affichage** : elle doit survivre au rechargement
(GAG), donc vivre dans le store persisté. `STORAGE_VERSION` vaut **7**
(`src/store/useStore.ts:34`) → la refonte passe à **8**, avec une valeur par défaut (`sobre`)
et une entrée dans `migratePersisted` (`useStore.ts:394-...`) et dans `docs/VERSIONS.md` si
le format d'export change. Même mécanique que `pasAPasCombatVu` (v5 → v6).

### 5.7 Ce que la refonte ne doit pas casser

| Contrat existant | Ce qu'il exige |
|---|---|
| les **7 cibles** du pas-à-pas (`plateau`, `main`, `poste`, `machine`, `poste-actions`, `conditions`, `interventions`) | chaque `data-pas-a-pas` doit encore exister à l'écran, **et être seul de son espèce** (`Battle.test.tsx:248-262`) |
| le **défilement vers la cible** | la marge `scroll-margin-top` suit `--pas-a-pas-hauteur` (`styles.css:1518-1526`) : si le plateau devient plus court, le calcul tient, mais l'étape 4 (« Conditions ») doit avoir **sa cible visible** — or les Conditions sont aujourd'hui un bloc **replié**, donc la cible est une ligne de 40 px |
| la **partie à deux** (#125) | l'écran ne montre **rien** des actions de l'autre camp (`Battle.tsx:571-577`) ; le code reste atteignable, et son `textarea` ne doit pas déclencher `I` |
| **`peek`** (D-079) | le dessus du Deck regardé s'affiche au **seul** joueur concerné (`Battle.tsx:339-348`) : il reste dans l'inspecteur, jamais dans le journal, jamais dans un toast partagé |
| **le forfait** (D-030) | passe par `Confirmation`, avec « Annuler » qui prend le focus (`DESIGN.md` §2.5) : le bouton descend dans le menu `⋯`, **le dialogue ne change pas** |
| **le deck de test** | le bandeau d'avertissement (`Battle.tsx:862-869`) reste **visible**, pas dans le menu : c'est une information qui change la partie |
| **la trace du combat** (#173) | aucun impact : elle lit l'état, pas l'écran |

### 5.8 Une divergence à signaler (doc ↔ code)

`docs/DECISIONS.md` **D-079** finit par « **Dette UI** : l'affichage privé n'est pas encore
câblé ». Or il **l'est** : `regardDuDernierGeste` et `RegardDuDessus` (#171) sont en
production dans `Battle.tsx:308-348`, avec la section `.regard`. La phrase de D-079 est un
**instantané daté devenu faux** ; la refonte ne fait que **déplacer** cet affichage. À
corriger par une note de lecture dans le ticket, pas en réécrivant la décision (règle §2 :
un acte daté ne se réécrit pas).

Et une **seconde**, plus grosse : **D-035** écrit « shadcn/**Radix** », alors que
`src/components/ui/dialog.tsx:2` importe **`@base-ui/react/dialog`** — et `AGENTS.md` §6, lui,
dit seulement « shadcn/ui ». La phrase « shadcn/Radix » désigne la *famille* de composants ;
le paquet réel est **Base UI**, qui est bien celui déclaré (`package.json`,
`"@base-ui/react": "^1.9.0"`). Ce n'est pas un défaut de code : c'est un mot du doc qui a
vieilli, à aligner quand `DESIGN.md` §2.4 sera réécrit.

---

## 6. La proposition

### 6.1 La règle de composition

> **Une seule surface. Trois bandes. Un panneau.**
>
> 1. **la barre d'état** — une ligne, jamais deux : tour, à qui, et l'attente de la Direction ;
> 2. **le plateau** — le héros, des **cartes**, deux camps, les Postes face à face ;
> 3. **la zone d'action** — collée en bas, au-dessus de la navigation : la main, puis les
>    verbes du tour ;
> 4. **l'inspecteur** — un seul panneau, ouvert par survol / focus / tap, fermé par Échap,
>    par un tap ailleurs ou par le bouton qui l'a ouvert.

Tout le reste (Journal, Partie à deux, Règles, Abandonner, Nouveau combat, le deck de test
**excepté**) passe derrière **un seul bouton `⋯`**.

### 6.2 Maquette textuelle — 420 × 900

```text
┌────────────────────────────────────────────┐
│ Tour 3 · à toi                  [ⓘ]   [⋯]  │  barre d'état (44 px)
├────────────────────────────────────────────┤
│ LA DIRECTION                          ★★☆  │  camp adverse
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │  Banc (3 places + le vide)
│  │    │ │    │ │    │ │ ·· │               │  4 × 72 px
│  └────┘ └────┘ └────┘ └────┘               │
│  ┌──────────────┐                          │
│  │              │  Psychologue du travail  │  Poste (carte 96 px)
│  │              │  ▓▓▓▓▓▓▓▓░░░░░░  40/60   │  + barre de Stress
│  │              │  ⬤⬤◯  ⌁  ⛁             │  + cafés, Machine, Conditions
│  └──────────────┘                          │
├────────────────────────────────────────────┤
│ TOI                                  ★☆☆  │  mon camp
│  ┌──────────────┐                          │
│  │              │  Secouriste              │
│  │              │  ▓▓▓▓░░░░░░░░░░  20/60   │
│  │              │  ⬤◯◯  ⌁  Sans condition │
│  └──────────────┘                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │    │ │    │ │ ·· │ │ ·· │               │
│  └────┘ └────┘ └────┘ └────┘               │
├────────────────────────────────────────────┤
│ [Visite médicale][Baie de test][Trousse]→  │  main (bande, 96 px)
├────────────────────────────────────────────┤
│ ⚔ Massage cardiaque  40   │  Fin du tour   │  zone d'action (56 px)
│ La Direction a produit 1 café SSE.         │  journal : 1 ligne, 20 px
└────────────────────────────────────────────┘
```

Ce qui **disparaît** de l'écran permanent, et où ça va :

| Aujourd'hui | Devient |
|---|---|
| `main 4 · Deck 14 · Rebut 0` sur chaque camp | **dans l'inspecteur du camp** (et le Rebut devient ouvrable) |
| `0/60 de Stress` écrit quatre fois | **la barre** sur la carte ; le chiffre dans l'inspecteur |
| `Machine ⚙` sur chaque Poste | une **pastille** sur la carte du Poste ; les types du Deck dans l'inspecteur |
| le nom des Conditions en pastilles | **des points** sur la carte ; le nom et la règle dans l'inspecteur |
| « Au Poste » + son paragraphe de portée | la **barre d'action** (les boutons *sont* la portée) |
| le bloc replié « Conditions » | une **ligne de 5 badges** sous le plateau (`data-pas-a-pas="conditions"`), qui ouvre la règle |
| le bloc replié « Journal » | la **ligne de journal** de la zone d'action + l'historique dans `⋯` |
| le bloc replié « Partie à deux » | `⋯` — et il **s'ouvre seul** quand un code est prêt (`transfer.ready`) |
| « Abandonner » / « Nouveau combat » | `⋯` |
| « Ton deck n'est pas valide… » | **reste** en haut, sous la barre d'état |

### 6.3 Maquette textuelle — ≥ 900 px

```text
┌──────────────────────────────────────────────────────────┬──────────────────┐
│ Tour 3 · à toi                                  [ⓘ] [⋯]  │  INSPECTEUR      │
├──────────────────────────────────────────────────────────┤  (colonne fixe)  │
│ LA DIRECTION                                        ★★☆  │                  │
│   [Banc] [Banc] [Banc] [ ·· ]                            │  Psychologue du  │
│   ┌────────────┐  Poste · 40/60 · 2 cafés · Sans cond.    │  travail         │
│   │   carte    │                                          │  Entrant · MGT   │
│   └────────────┘                                          │                  │
│ TOI                                                 ★☆☆  │  Seuil 60        │
│   ┌────────────┐  Poste · 20/60 · 1 café · Surcharge     │  Stress 40       │
│   │   carte    │                                          │  ▓▓▓▓▓▓▓░░░      │
│   └────────────┘                                          │                  │
│   [Banc] [Banc] [ ·· ] [ ·· ]                            │  Pressions       │
├──────────────────────────────────────────────────────────┤  ◆◆ Coup de fil │
│ [main …]                    ⚔ Massage 40 │ Fin du tour    │     40           │
└──────────────────────────────────────────────────────────┴──────────────────┘
```

Le plateau garde **toute** la largeur nécessaire ; l'inspecteur ne recouvre rien
(§3.4). Il s'ouvre à la première désignation et **reste** : c'est la « colonne d'inspection »
d'un écran de bureau, et elle évite le ballet de panneaux flottants.

### 6.4 Ce qui apparaît, et sur quel geste

| Déclencheur | Ce qui s'ouvre | Sémantique | Ce qu'on y fait |
|---|---|---|---|
| **Survol** de la carte (souris seulement, `@media (hover: hover)`) après **300 ms** | l'**infobulle de lecture** : nom, stade/COMEX, faction, Seuil, Stress, cafés, Conditions, Pressions (coût + dégâts), Talent | `role="tooltip"`, `aria-describedby` sur la carte, **aucun élément focusable** | rien : on lit |
| **Focus clavier** sur la carte | la **même** infobulle | idem ; elle se ferme au `blur` | rien |
| **Clic / tap** sur la carte | l'**inspecteur d'action** : le même contenu **+ les gestes qui concernent cette carte** | dialogue **non modal** (pas d'`aria-modal`), focus déplacé dedans, Échap ferme, focus rendu | « Attacher 1 café », « Rotation », « Talent », « Faire évoluer », « Relève » selon la carte |
| **Clic / tap** sur une Condition | la règle de cette Condition, dans l'inspecteur | idem | rien |
| **Échap** | ferme l'infobulle, puis l'inspecteur, puis le menu `⋯` | — | — |
| **`I`** ou **`Ctrl`+`I`** ou le **bouton `ⓘ`** | bascule `sobre` ↔ `détaillé` (§4.3) | `aria-pressed`, `aria-keyshortcuts="I"` | change la densité du plateau |

**Pourquoi l'infobulle au survol et l'inspecteur au clic, et pas un seul composant** : l'APG
l'impose — une infobulle **ne reçoit pas le focus**, donc elle ne peut pas contenir
« Attacher 1 café ». Un seul composant qui contiendrait des boutons devrait donc être un
dialogue **même au survol**, ce qui ferait apparaître des boutons sous le pointeur au passage
et déclencherait SC 3.2.1 (changement au focus). Deux surfaces, un seul contenu : c'est la
solution la moins risquée.

### 6.5 Les états de l'écran

| État | Ce que voit l'invité | Détail |
|---|---|---|
| **Mon tour** | la barre d'état dit « à toi », les verbes de la zone d'action sont là | les cartes jouables de la main portent un **filet doré**, pas une étiquette « Jouable » |
| **Tour adverse** (solo) | « La Direction réfléchit… » (`role="status"`, déjà là, `Battle.tsx:841-845`) ; la zone d'action se réduit à `Fin du tour` si le moteur l'ouvre | le plateau reste **entièrement** consultable : c'est le moment où on lit |
| **Tour adverse** (partie à deux) | une seule ligne : « C'est au Camp B de jouer » + `Coller un code` | **aucun** bouton d'action, conformément à #125 |
| **Relève** | le Banc du camp concerné s'illumine (filet doré), la zone d'action ne porte **que** les relèves | le texte actuel (`Battle.tsx:916-931`) reste, en une ligne |
| **Choix en attente** | idem, une ligne + les cartes désignables | `Battle.tsx:933-942` |
| **Partie terminée** | le bandeau `endBanner` reste **en haut**, et le plateau reste lisible (on veut voir pourquoi on a perdu) | pas de plein écran de victoire : D-030 n'en demande pas |
| **Inspecteur ouvert** | feuille basse (téléphone) / colonne (bureau) ; la carte désignée garde un **filet doré** | un seul inspecteur à la fois |
| **Chargement** | sans objet (combat local) — `DESIGN.md` §2.5 le dit déjà | — |
| **Hors ligne** | le bandeau du `Layout` continue de dire ce qui marche (`BandeauHorsLigne`) | le combat est local |

### 6.6 Le clavier, en entier

| Touche | Effet | Source / contrainte |
|---|---|---|
| `Tab` / `Maj+Tab` | circule dans l'ordre du document : barre d'état → cartes du plateau (adversaire puis moi) → main → zone d'action | ordre naturel, **aucun `tabindex` positif** (APG le déconseille) |
| `Entrée` / `Espace` | sur une carte : ouvre l'inspecteur d'action ; sur un bouton : l'active | comportement natif d'un `<button>` — on ne le réimplémente pas |
| `Échap` | ferme l'inspecteur → puis le menu `⋯` → puis le dialogue | APG *Dialog*, SC 1.4.13 (fermable) |
| `I` | bascule `sobre` / `détaillé` | touche caractère : désactivable en Réglages (§4.2) |
| `Ctrl` + `I` | idem, toujours actif | « remap avec un modificateur » (SC 2.1.4) |
| `←` `→` `↑` `↓` | **défilement de la page**, jamais détourné | on ne prend pas les flèches sans implémenter la grille |
| `F1`–`F12` | rien | conflits navigateur |

**Pourquoi pas `role="grid"`.** L'APG dit une chose tentante : « *if any elements in the
group also have associated elements that appear on hover, the grid pattern is also useful
for providing keyboard access to those contextual elements* ». C'est exactement notre cas
(des cartes avec du contexte au survol). Mais la grille coûte : **un seul arrêt de
tabulation**, **flèches gérées à la main**, `Home`/`End`, `Ctrl+Home`, et un mode
application pour le lecteur d'écran. Avec **huit places** au maximum, le `Tab` naturel fait
le travail en huit appuis et ne casse rien. **Décision proposée : pas de grille en v1** ; si
les tests d'usage montrent que huit appuis sont trop, la grille devient un ticket, avec ses
flèches, et **les flèches cessent alors de défiler** — jamais les deux.

### 6.7 Le détail d'une carte sur le plateau (ce que la carte porte elle-même)

| Couche | Contenu | Visible en `sobre` | Visible en `détaillé` |
|---|---|---|---|
| l'illustration | `CardView` (art ou aplat de faction + glyphe) | oui | oui |
| le nom | le nom complet, **deux lignes réservées** (`DESIGN.md` §2.1) | oui | oui |
| le Stress | la barre à dix crans, **qui monte** | oui | oui |
| le chiffre | `20/60` | non | oui |
| les cafés | pastilles typées (`CafePips`) | oui | oui |
| la Machine | une pastille sur le Poste | oui | + les types du Deck |
| les Conditions | **un point** par Condition, couleur du badge | oui | + le nom |
| les Pressions | — (elles vivent dans la zone d'action et l'inspecteur) | non | + nom et dégâts |

Le nom **n'est plus tronqué** : la carte du Poste fait **116 px** de large et deux lignes de
nom, la place du Banc **64 px** et **une** ligne avec ellipse — l'ellipse est un pis-aller, pas
une règle, et l'inspecteur donne toujours le nom entier (`aria-label` de la carte). Les valeurs
sont celles de §6.8 ; celles de la première passe (96 / 72 px) sont abandonnées.

### 6.8 Révision du 25/10/2026 — ce que la référence vidéo change

**D'où vient la référence.** Bastien a fourni deux animations de 8 s (`/tmp/opencode/video ui/`,
720 × 1280, « Animate me like card game »), **générées par IA** : les textes y sont déformés et
incohérents. On en retient la **structure** et l'**ambiance**, jamais un mot, une couleur ou un
asset (`docs/CAPTURES-UI.md`, « la règle qui gouverne tout ce document »). Sa lecture est écrite
dans `/tmp/opencode/reponse-maquette-video-ui.md`, et elle est reprise ici. Ce n'est **pas une
source primaire** : c'est une **référence visuelle du propriétaire**, ce qui suffit à trancher une
composition et ne prouve aucune règle de jeu (§9.4).

| # | Ce que la maquette de §6.2 ratait | Correction retenue |
|---|---|---|
| **R1** | **La main** : une bande de boutons texte, qui défile (`styles.css:2170-2201`) | une **main en éventail** de vraies cartes du gabarit, inclinées, chevauchées, **rognées par le bas de l'écran** (`overflow: hidden` de la page). Le rognage est ce qui paie le budget de 420 × 900 : on voit le titre et l'illustration, pas le pied de carte |
| **R2** | le score en **★★☆** — collision avec la rareté (`1S`/`2S`/`3S` = ★, `DESIGN.md:199-201`) | une **piste d'Interventions** dédiée, en colonne à gauche : **hexagones** empilés, remplis ou vides. Forme distincte de toute rareté, donc aucune ambiguïté de lecture |
| **R3** | les Conditions en **points de couleur seuls** | un **badge nommé et chiffré** sur la carte (« Surcharge ×2 »), à la couleur de `STATUS_META`. La couleur seule contredit SC 1.4.1 et ne se lit pas à 420 px |
| **R4** | la carte du Poste à **96 px**, plus petite que lisible | le Poste à **116 × 151 px** (≈ 1,8 × la place du Banc), **centré**, dominant ; les deux Postes se font face sur la même verticale |
| **R5** | Deck et Rebut **cachés** dans l'inspecteur et le `⋯` | **quatre piles visibles** en colonne à droite (Deck et Rebut de chaque camp), à la manière d'objets posés : un cartouche, un compteur, et **la pile est ouvrable** (le Rebut est consultable à tout moment, §2) |
| **R6** | **aucun retour d'action** spécifié | une couche de retour : chiffre de Stress qui **monte** en flottant près de la carte touchée, `Fin du tour` qui **change d'état** (à toi / en attente), pile de Deck qui s'illumine à la pioche. Tout est coupé par `prefers-reduced-motion` **et** par « Mouvement réduit » (§5.5), et rien ne **déplace** la mise en page (SC 1.4.13, SC 2.2.2) |

**Ce que la révision ne change pas** : l'inspecteur unique (survol = lecture, clic = action,
§3.3), la barre d'état d'une ligne, aucun bouton grisé, les 7 cibles du pas-à-pas, le clavier
(§6.6), la bascule `sobre` / `détaillé` (§4.3). La densité de la référence vidéo **est** le mode
`détaillé` : c'est l'argument qui garde la bascule.

#### 6.8.1 Maquette révisée — 420 × 900, mode `sobre`

```text
┌──────────────────────────────────────────────────┐
│ Tour 3 · à toi                          [ⓘ] [⋯]  │  barre d'état (44)
├────┬────────────────────────────────────┬────────┤
│ ▲  │ LA DIRECTION                       │ DECK   │
│ ●  │  [B][B][B][ ·· ]                   │  ┌──┐  │
│ ●  │                                    │  │12│  │
│ ○  │   ┌──────────┐  Responsable        │  └──┘  │
│    │   │  POSTE   │  d’unité            │ REBUT  │
│ ○  │   │  116×151 │  ▓▓▓▓▓▓▓░░░        │  ┌──┐  │
│ ○  │   └──────────┘  ⬤⬤◯  ⌁  Surcharge×2│  │ 4│  │
│    │ ═══════════════ laisse passer ═════│  └──┘  │
│    │   ┌──────────┐  Secouriste          │        │
│    │   │  POSTE   │  ▓▓▓░░░░░░░         │ DECK   │
│    │   │  116×151 │  ⬤◯◯                 │  ┌──┐  │
│    │   └──────────┘                      │  │14│  │
│    │  [B][B][ ·· ][ ·· ]  TOI            │  └──┘  │
├────┴────────────────────────────────────┴────────┤
│ ⚔ Massage 40   ⚔ Geste qui sauve +10   Fin du tour│  barre d'action (60)
├──────────────────────────────────────────────────┤
│      ▟▙    ▟▙    ▟▙    ▟▙      ← main rognée     │  main (150, coupée)
└──────────────────────────────────────────────────┘
```

Les **deux Postes sont sur l'axe vertical**, séparés par un filet doré (« laisse passer » est
un commentaire de la maquette, pas un texte affiché : aucun texte de ce genre ne s'affiche).
La **piste d'Interventions** est à gauche : trois hexagones par camp, remplis en or quand
l'Intervention est marquée.

#### 6.8.2 Maquette révisée — ≥ 900 px

```text
┌─────────┬─────────────────────────────────────────────┬──────────────┐
│ ▲ ● ● ○ │ LA DIRECTION            DECK 12 · REBUT 4   │  INSPECTEUR  │
│         │  [Banc][Banc][Banc][ ·· ]                   │              │
│ ○ ○     │  ┌────────┐  Responsable d’unité           │ Responsable  │
│         │  │ POSTE  │  ▓▓▓▓▓▓▓░░░  ⬤⬤◯  Surcharge×2   │ d’unité      │
│         │  └────────┘                                 │              │
│         │  ┌────────┐  Secouriste                   │ Seuil 60     │
│         │  │ POSTE  │  ▓▓▓░░░░░░░  ⬤◯◯             │ Stress 40    │
│         │  └────────┘                                 │ ▓▓▓▓▓▓▓░░░   │
│         │  [Banc][Banc][ ·· ][ ·· ]  DECK 14 · REBUT 4│ Pressions…   │
├─────────┴─────────────────────────────────────────────┴──────────────┤
│ ⚔ Massage 40   ⚔ Geste qui sauve +10   │   Fin du tour  │ JOURNAL     │
└───────────────────────────────────────────────────────────────────────┘
```

À droite du plateau, la **colonne d'inspection** ne recouvre rien ; la piste est à gauche, les
piles sont **dans l'en-tête de chaque camp** (il y a la place) plutôt qu'en colonne : sur un
écran large, une colonne de piles volerait 56 px pour une information qui tient en un
cartouche. Le **Journal** gagne une bande en bas, à droite de la barre d'action.

#### 6.8.3 Les animations de la référence, adaptées

Les deux vidéos bougent beaucoup, et quatre de leurs mouvements **portent une information**
qui, chez nous, n'est aujourd'hui qu'une ligne de journal. Ce sont ceux-là qu'on reprend :
un effet qui ne dit rien est du bruit, un effet qui dit « ce Planqué vient de prendre 60 »
est une lecture plus rapide.

| Ce qui bouge dans la vidéo | Ce que ça dit | Notre événement | Moyen (zéro asset, zéro dépendance) | Sous « Mouvement réduit » |
|---|---|---|---|---|
| **Chiffre de Stress** qui jaillit (`−60`, `−30`), gros, contour sombre, ressort, puis s'élève et s'efface (`55-08`, `49-09`) | les dégâts, à l'endroit du coup | `attack` appliquée à une instance | `<span>` positionné sur la carte, `@keyframes` (scale 1.4 → 1, `translateY` −28 px, `opacity` 1 → 0 sur 700 ms), retiré du DOM ensuite | **le chiffre reste affiché 700 ms sans mouvement**, à sa place, puis disparaît |
| **Arc électrique** en étoile autour de la carte touchée (`49-09`) | une Condition vient d'être posée | `status` ajouté (Surcharge, Immobilisation, Dérive) | deux `conic-gradient` en `mask` + rotation de 400 ms, ou un liseré qui pulse **deux fois** | aucun arc : le **badge nommé** apparaît (R3), c'est suffisant |
| **Filet de feu** qui traverse le plateau de l'attaquant à la cible, puis la carte se consume (`55-08`) | le Planqué **craque** | `Stress ≥ Seuil`, instance au Rebut | traînée `linear-gradient` entre les deux cartes (une seule, 500 ms) + la carte passe à `opacity .2` puis sort | pas de traînée ; la carte se **désature** et le bandeau « a craqué » (déjà présent) dit tout |
| **Bouton de fin de tour** qui change de couleur avec la main (`49-09` rouge, `49-03` vert) | à qui c'est le tour | `state.current` | deux états de teinte sur le bouton (émeraude = à toi, ardoise = en attente), aucune animation | identique (changement de couleur, pas de mouvement) |
| **Capsule de tour** éteinte puis allumée (`55-08` vs `49-03`) | le tour a changé de camp | idem | `box-shadow` + `color` en transition de 200 ms | identique |
| **Carte de la main soulevée** et agrandie au-dessus de l'éventail (`55-05`) | la carte qu'on regarde | survol, focus ou sélection | `transform: translateY(−18px) scale(1.6)` + `z-index`, 160 ms | pas de translation : la carte reste, l'**inspecteur** s'ouvre |
| **Pile de Deck** qui s'illumine à la pioche | une carte est entrée en main | tirage | liseré cyan 150 ms | identique, sans pulsation |
| **Hexagone** qui se remplit | une Intervention est marquée | `points` qui monte | remplissage par `background` + un rebond de 1.15 en 200 ms | remplissage direct |

**Les bornes, et elles ne se discutent pas** :

1. **Aucune information ne vit dans l'animation.** Tout ce que ces effets disent est déjà
   écrit : la barre de Stress bouge, le badge apparaît, le journal écrit la ligne. C'est ce
   qui rend le repli « Mouvement réduit » honnête — il ne cache rien (SC 1.3.3, SC 2.3.3 :
   le mouvement déclenché par une interaction n'est pas indispensable).
2. **Pas de clignotement rapide.** Aucun effet ne dépasse **trois flashs par seconde**
   (SC 2.3.1). L'arc électrique pulse **deux fois**, pas en boucle.
3. **Rien ne recouvre une cible.** Un chiffre flottant ne passe jamais sur le nom d'une
   carte plus de 700 ms, et ne se superpose pas à trois exemplaires (T10, critère 2).
4. **`prefers-reduced-motion` et « Mouvement réduit » du store** coupent tout, un seul
   point de bascule : le réglage du store **et** la préférence système, réunis par
   `use-mouvement-reduit.ts` et posés sur la racine (`data-mouvement-reduit`).
5. **Le coût de rendu** est plafonné : au plus **quatre** éléments animés simultanément.
   Une animation CSS de `transform`/`opacity` ne repeint pas ; un `filter: blur` sur une
   surface qui bouge, si — donc **pas de flou en mouvement**.

> **Révision du 26/10/2026 — la Pression a sa chorégraphie (D-098).** Les bornes 3 et 5 ne
> s'appliquent plus telles quelles à la **Pression** : sa durée monte jusqu'à ~3,7 s quand la
> grosse attaque d'un COU, d'un 3 étoiles ou d'un COMEX joue sa cinématique, et son coût de
> rendu se compte en **particules de `canvas`** (600 au plus, 300 hors cinématique), plus en
> éléments du DOM. Les bornes **1, 2 et 4 ne bougent pas** : aucune information dans
> l'animation, pas plus de trois flashs par seconde, et les deux coupures du mouvement
> (**le repli est la séquence CSS décrite ci-dessus, inchangée**). Détail d'exécution :
> `src/animation/` ; mesures : 60 ips, 57 sur la cinématique la plus lourde.

#### 6.8.4 Ce que la piste d'Interventions remplace

Le compte `★★☆` et le `board__points` actuel (`Battle.tsx:440-446`, `styles.css:1706-1711,
2160-2168`) disparaissent au profit des **six hexagones** (trois par camp, `data-pas-a-pas="interventions"`
conservé). Le nombre reste **lu** par un lecteur d'écran : chaque hexagone porte son
`aria-label` (« Intervention 2 sur 3, La Direction »).

### 6.9 La direction de scène — la matière, la lumière, la couleur

Le 25/10/2026, Bastien a tranché : « je veux que ça ressemble plus au video », « je veux que
ça fasse **AAA** », « **les couleurs et le style peuvent changer** ». La direction visuelle
qui en découle a été écrite par la session « Analyse vidéo et UI recherchée » (Kimi K3) et
**copiée dans le dépôt** : **`docs/DIRECTION-SCENE-COMBAT.md`** — palette mesurée sur les
frames, matières, gabarits, typographie, pièges, table de contraste. Ce paragraphe en retient
ce qui engage l'écran, et **tranche les trois points** où la direction et ce document ne
disaient pas la même chose.

**Les jetons.** L'écran de combat pose ses propres jetons `--scene-*` **par-dessus** ceux de
`:root` : le bleu nuit du projet (`--bg #0b1220`) est déjà la bonne famille, le feutre n'en
est qu'une version éclaircie au centre. **Aucun jeton global n'est réécrit** — `DESIGN.md`
reste l'autorité, et la scène est une couche.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--scene-felt` | `#16202c` | le feutre de la table |
| `--scene-felt-lit` | `#214d69` | le halo central (la **seule** lumière) |
| `--scene-card` | `#1b222c` | la surface d'une carte |
| `--scene-neon` / `-core` | `#61d5df` / `#9ef5fb` | le néon d'état : le tour, l'élément actif |
| `--scene-go` | `#46c78c` | « Fin du tour » quand c'est à toi |
| `--scene-danger` | `#e0563f` | le tour adverse, le craquage |
| `--scene-gold-hot` | `#f7e264` | le Stress, les nombres qui montent |
| `--scene-parch` | `#b18a60` | le parchemin des piles |

**Ce qui fait « AAA », et qui n'est pas une couleur** :

1. **Une seule lumière**, au centre, entre les deux Postes ; les quatre coins s'éteignent
   (un `radial-gradient` + une vignette en ombre interne). C'est la moitié de l'effet.
2. **Quatre plans**, une ombre chacun : la table (vignette), les zones posées, les cartes
   soulevées, l'élément actif (son ombre **plus** un halo). Un plan ne porte jamais deux
   ombres, et jamais filet fin **plus** grosse ombre.
3. **Le néon est un état, pas un style.** Allumé = à toi, action possible, danger. Éteint
   partout ailleurs. Un néon permanent n'est plus un néon, c'est un fond — et c'est le tell
   « Dark mode with glowing accents ».
4. **Des objets, pas des panneaux** : la pile est un parchemin, la carte une plaque de métal,
   la piste trois jetons. Une matière par objet.
5. **Les nombres qui changent la partie sont les plus grands de l'écran** : le Stress qui
   monte, en 2,1 rem doré, éphémère.

**Ce qu'on ne suit pas de la vidéo, avec la raison** :

| La vidéo | Pourquoi non |
|---|---|
| **cadre or sur toutes les cartes** | chez nous l'or **est** la marque du COMEX (D-026). Le standard prend le **métal ardoise**, l'or reste au COMEX — sinon le statut disparaît |
| **violet** dans la piste de score | hors vocabulaire (les Interventions se lisent en or) et famille « violet d'UI générée » |
| **crème sur parchemin** (2,41:1) et **blanc sur vert néon** (~2:1) | deux fautes AA ; on inverse l'encre : sombre sur parchemin (`#3a2a18`), sombre sur néon (`#0b1220`, 8,75:1) |
| **niveau du joueur, photos d'avatar** | n'existent pas ; le cartouche garde les **initiales du camp** et son nom, ce qui sert la partie à deux (#125) |
| **classeurs, trombones, feuilles au bord** | ce sont des **assets** de la référence, et l'univers est l'atelier MRO (D-025). **Jetés en v1** ; s'ils reviennent un jour, ce sera en SVG maison |

**Les trois arbitrages, tranchés ici** :

- **La barre de Stress est dorée**, pas rouge : le rouge est la couleur d'un **danger d'état**,
  pas celle d'une mesure. (La direction le dit ; les maquettes v2 et v3 faisaient l'inverse.)
- **Les props sont hors v1** : ils coûtent des assets et ne disent rien. La profondeur vient
  de la lumière et des ombres, qui sont du CSS.
- **Les animations restent** (§6.8.3), avec leur repli sans mouvement. La direction propose un
  « fondu simple, aucune translation » ; c'est **plus prudent**, et c'est exactement le repli
  qu'on applique sous « Mouvement réduit ». En marche normale, le chiffre de Stress **monte** :
  c'est l'information la plus utile des deux vidéos, et elle est bornée à 700 ms.

**Ce que cette direction coûte** : `DESIGN.md` doit gagner une **section « scène de combat »**
(les `--scene-*`, les quatre plans, la règle du halo) et les paires de contraste qui manquent
(T7). Le reste est du CSS dans la feuille unique, sans dépendance.

---

## 7. Ce que la recherche ne prouve pas

À lire avant de citer ce document comme une preuve.

1. **Aucun test utilisateur.** Personne n'a joué cet écran. Les affirmations « plus propre »,
   « plus sobre », « le plateau est le héros » sont des **intentions de conception**, pas des
   mesures. Les seules preuves sont les sources §9 et les captures §1.
2. **Aucune mesure sur appareil réel.** Le budget de hauteur de §5.1 est **calculé à la
   main**, pas mesuré. `npm run capturer` mesure à 420 × 900 **émulés** ; la lisibilité au
   pouce, la fluidité, la chaleur du téléphone ne sont pas mesurées — le lot du 23/10 le dit
   déjà de lui-même (`docs/preuves/finition-alpha-2026-10-23/README.md`, « Ce que les
   captures ne prouvent pas »).
3. **Le détecteur d'Impeccable n'a pas tourné** (§5.3) : `node_modules` absent, binaire
   introuvable. Les tells cités viennent du catalogue public, pas d'une exécution sur cet
   écran. Le jour où il tournera, il peut en trouver d'autres — et `DESIGN.md:80-83`
   rappelle qu'il **sous-compte** en analyse de sources (le contraste du bouton primaire n'a
   été vu qu'en navigateur).
4. **Les sources « jeu » sont minces, et je le dis.** La conférence GDC sur l'UI de
   Hearthstone est **inaccessible** : `gdcvault.com/play/1022036` renvoyait « Maintenance in
   Progress » le 25/10/2026, et je n'ai donc **pas** le contenu de l'exposé — seulement sa
   phrase-titre, citée par Game Developer. Je n'ai trouvé **aucune** page officielle de
   Blizzard décrivant les options d'accessibilité de Hearthstone (les recherches ne rendent
   que des mods communautaires et des forums) : je ne cite donc **rien** de ce côté, plutôt
   que de citer un wiki.
5. **Les dispositions des jeux de référence ne sont pas documentées publiquement.** Ce qu'on
   sait d'eux vient de nos **propres captures** (`docs/preuves/astuces-2026-10-20/`) et de
   leurs **notes de correctifs** : cela prouve des **règles** et des **défauts**, pas des
   mises en page. La §2 ne prétend donc pas « voici comment Hearthstone compose son plateau ».
6. **Le « toggle » n'est pas mesuré non plus.** Rien ne dit qu'un invité préfère `sobre` ou
   `détaillé`, ni qu'il découvre `I`. La §4.4 parie sur un bouton visible + une ligne dans
   Réglages ; c'est un pari informé par GAG, pas un résultat.
7. **La référence vidéo de §6.8 est un mockup généré par IA, pas un jeu.** Elle ne prouve
   aucune disposition : elle a servi à ce que Bastien **tranche** six points (§6.8, R1-R6).
   Ses textes sont déformés, ses couleurs ne sont pas les nôtres, et aucun de ses assets
   n'entre dans le projet.

---

## 8. Découpage en tâches vérifiables

Chaque tâche a **son critère exécutable**. L'ordre est celui du risque : d'abord ce qui
casse les tests, ensuite ce qui ajoute.

> **Avant tout** : `npm run check`, `npm test`, `npm run garde-fous`, `npm run build`,
> `npm run detect:ui` doivent être verts **avant** la première ligne (definition of done,
> `AGENTS.md` §8.4). Une refonte d'écran ne s'ouvre pas sur une base rouge.

### T1 — Le harnais de preuve (aucun code produit)

- **Quoi** : un lot `docs/preuves/combat-ui-2026-10-XX/` avec `avant/` (420 × 900 et
  1280 × 800) et un `README.md` de lot, sur le modèle de
  `docs/preuves/finition-alpha-2026-10-23/`.
- **Critère** : `npm run build && npm run capturer` → exit 0, **aucune erreur de console**,
  `docs/preuves/combat-ui-2026-10-XX/avant/420-combat.png` existe et montre l'écran **actuel**.
- **Pourquoi** : sans « avant » daté, aucune capture d'après ne prouve un progrès
  (`AGENTS.md` §8.3, « `dist/sw.js` seul ne prouve rien »).

### T2 — `CardView` compacte et sans micro-animation

- **Quoi** : un drapeau (`compact` existe déjà ; ajouter `calme` ou `figee`) qui coupe
  `whileHover`/`whileTap` (`CardView.tsx:47-49`) et force le mode `card--compact`.
- **Critère** : `src/components/CardView.test.tsx` gagne un cas « en mode figé, la carte ne
  porte ni `whileHover` ni `transform` » — un test qui **échoue** si on retire le drapeau
  (garde-fou §8.4 : le contrôle doit mordre) ; `npm test` vert.
- **Risque** : `CardView.test.tsx` existant asserte peut-être `motion` — à lire avant.

### T3 — Le plateau en cartes, sans perdre les cibles du pas-à-pas

- **Quoi** : remplacer les noms par des `CardView` figées au Poste et au Banc ; garder les
  **7** `data-pas-a-pas` ; supprimer les trois `title=` porteurs d'information
  (`Battle.tsx:163`, `165`, `415`).
- **Critère** (trois assertions, dans `src/pages/Battle.test.tsx`) :
  1. `document.querySelectorAll('[data-pas-a-pas]')` contient toujours les 7 valeurs — le test
     existant `Battle.test.tsx:248-262` doit passer **sans être modifié** ;
  2. `grep -c "title=" src/pages/Battle.tsx` ≤ 1 (il ne reste que celui du bandeau de deck de
     test, qui n'est pas une information de carte) ;
  3. `screen.getAllByRole('button', { name: /Secouriste/ })` rend le Poste **et** le Banc quand
     la même carte est aux deux endroits.
- **Capture** : `apres/420-combat.png` montre **au moins une illustration ou un aplat de
  faction** par camp.

### T4 — L'inspecteur, deux modes, un contenu

- **Quoi** : un composant `InspecteurCombat` avec deux rendus — infobulle (lecture) et panneau
  (action) — sur le même contenu ; `aria-describedby` sur la carte en mode lecture ; dialogue
  non modal en mode action (via `components/ui/dialog.tsx`, D-035).
- **Critère** (`src/components/InspecteurCombat.test.tsx`) :
  1. au survol (`userEvent.hover`), le panneau porte `role="tooltip"` et **ne contient aucun
     `button`** (`expect(within(panneau).queryAllByRole('button')).toHaveLength(0)`) ;
  2. `Échap` ferme et **le focus revient** sur la carte (`expect(carte).toHaveFocus()`) ;
  3. au clic, le panneau **est** un dialogue et contient au moins un bouton ;
  4. le contenu contient le Stress **chiffré** et le nom **entier** de la carte, même quand le
     nom est tronqué à l'écran.
- **Garde** : une entrée dans `scripts/garde-fous.mjs` pour le point 1 (une infobulle qui
  contient un bouton est une régression d'accessibilité silencieuse).

### T5 — La bascule et le raccourci

- **Quoi** : le bouton `ⓘ` (`aria-pressed`, `aria-keyshortcuts="I"`), `I` et `Ctrl+I`,
  neutralisés dans un champ de saisie, l'état persisté (`STORAGE_VERSION` 7 → 8 + migration).
- **Critère** (`src/pages/Battle.test.tsx`) :
  1. `fireEvent.keyDown(document, { key: 'i' })` change `aria-pressed` et fait apparaître les
     annotations (ex. le nom d'une Pression sur la carte du Poste) ;
  2. le même événement **dans le `textarea` du code de partie** ne change **rien** ;
  3. `setRaccourcisCombat(false)` puis `keyDown('i')` ne change **rien** ;
  4. `useStore.getState().version` migre un état `v7` sans le champ, et la valeur par défaut
     est `sobre` (`src/store/useStore.test.ts`).
- **Garde** : `npm run garde-fous` reste vert ; le test 2 est le garde-fou de SC 2.1.4.

### T6 — La barre d'action et le menu `⋯`

- **Quoi** : Pressions + « Fin du tour » dans une barre collante ; `Journal`, `Partie à deux`,
  `Conditions (règles)`, `Abandonner`, `Nouveau combat` derrière un bouton unique.
- **Critère** :
  1. `Battle.test.tsx` : les tests existants qui cliquent « Abandonner » / « Nouveau combat »
     passent par une étape d'ouverture du menu (le test est **adapté**, pas supprimé) ;
  2. le dialogue de forfait reçoit toujours le focus sur « Annuler » (test existant conservé) ;
  3. `npm test` vert ; `npm run build` produit `dist/index.html` **et** `dist/sw.js`.
- **Interdit** : mettre « Nouveau combat » dans un menu qui **détruit** une partie sans
  confirmation — le geste destructeur garde son dialogue (D-030, `DESIGN.md` §2.5).

### T7 — Contrastes, tailles, tells

- **Quoi** : vérifier les cinq paires des pastilles de Condition et les nouvelles surfaces ;
  les inscrire dans `DESIGN.md` §1.5 ; plancher typographique `--fs-xs`.
- **Critère** :
  1. `npm run detect:ui` → exit 0 (Impeccable, D-060 critère 1) ;
  2. `npx impeccable detect <url du preview>` en navigateur, comme #131 l'a fait — le détecteur
     de sources **sous-compte** (`DESIGN.md:80-83`) ;
  3. `DESIGN.md` §1.5 compte **au moins** cinq paires de plus, chacune avec son ratio calculé
     et son verdict ;
  4. aucun `font-size` inférieur à `--fs-2xs` dans les blocs `.combat*` (grep dans
     `src/styles.css`).

### T8 — Documentation et décisions

- **Quoi** : réécrire `DESIGN.md` §2.4 sur l'écran **tel qu'il est**, mettre à jour le
  tableau des états (§2.5) pour l'inspecteur, et ouvrir une ligne datée dans
  `docs/DECISIONS.md` **si et seulement si** une règle est engagée (le raccourci par défaut,
  le plancher de 44 px, l'abandon de `role="grid"`).
- **Critère** : `AGENTS.md` §2 respecté — aucune contradiction avec une décision existante ;
  le §7 d'`AGENTS.md` (commandes) n'est pas modifié si les commandes n'ont pas changé ;
  `docs/SPEC-COMBAT-UI.md` (ce fichier) reste la **recherche**, pas la règle.
- **Note** : la phrase périmée de **D-079** (§5.8) et le mot « Radix » de **D-035** (§5.8) se
  corrigent par une **note de lecture datée**, jamais en réécrivant l'acte.

### T9 — Le mode `détaillé` ne casse pas la lecture à 420 px

- **Quoi** : la seule tâche qui peut tout annuler — en `détaillé`, le plateau grossit.
- **Critère** : capture `apres/420-combat-detail.png` ; **la barre d'action reste visible**
  sans défilement (`document.querySelector('.combat-barre')` dans la fenêtre : un test jsdom
  peut lire `getBoundingClientRect` si le layout est simulé — sinon, capture + revue humaine
  consignée dans le `README.md` du lot). Si le budget ne tient pas, `détaillé` **ne montre pas
  plus de choses à l'écran** : il n'ouvre que l'inspecteur au focus. C'est le repli assumé.

### T10 — Le retour d'action (§6.8, R6)

- **Quoi** : trois retours, **sans déplacement de mise en page** : le chiffre de Stress qui
  s'élève près de la carte touchée (fondu + `translateY`, 500 ms), la pile de Deck qui s'illumine
  à la pioche (150 ms), le bouton `Fin du tour` qui change de libellé et de teinte selon l'état
  (à toi / en attente).
- **Critère** :
  1. un cas de test où **« Mouvement réduit » est actif** : aucun élément ne porte de
     `transform`, et la valeur de Stress est **toujours lisible** (le chiffre reste, à sa place) ;
  2. l'élément flottant est **retiré du DOM** après son animation (pas de fuite d'état, pas
     d'empilement de trois chiffres au troisième coup) ;
  3. `prefers-reduced-motion` est couvert comme le reste (`styles.css:2305-2314`).
- **Interdit** : un retour qui **recouvre** le nom de la carte ou la barre de Stress plus de
  800 ms, et un retour qui **décale** le plateau (SC 1.4.13, SC 2.2.2).

### T11 — Les effets de la référence (§6.8.3)

- **Quoi** : l'arc de Condition, la traînée de craquage, la carte de main soulevée au survol,
  l'Intervention qui se remplit. Chacun avec **son repli sans mouvement**.
- **Critère** :
  1. un test par effet qui vérifie que **le repli existe** : avec « Mouvement réduit », le
     nœud animé n'est pas créé (ou porte une classe sans `animation`) — et l'information
     reste lisible (badge, barre, bandeau) ;
  2. aucune `@keyframes` ne dure plus de **800 ms** ni ne boucle plus de **deux** fois
     (grep sur `styles.css`, plus une entrée dans `scripts/garde-fous.mjs`) ;
  3. au plus **quatre** éléments animés simultanément : le compteur est tenu par le composant,
     pas par le CSS ;
  4. `npm run detect:ui` vert — un `filter: blur` en mouvement ou un `backdrop-filter` sur une
     surface animée coche un tell d'Impeccable.
- **Interdit** : un effet qui **déplace** une cible de clic, et un effet qui **retarde** le
  geste suivant (le joueur ne doit jamais attendre une animation pour jouer).
- **Réserve** : ces effets sont la partie la plus facile à trouver « kitsch ». Si `npm run
  detect:ui` ou une capture les refuse, **on les retire** — l'écran tient sans eux, c'est
  tout l'intérêt des replis.

### T12 — Les jetons de scène (§6.9)

- **Quoi** : un bloc `--scene-*` déclaré **une fois** dans `src/styles.css`, sous un sélecteur
  de l'écran de combat (`.battle`), et une section « scène de combat » dans `DESIGN.md`.
- **Critère** :
  1. `grep -c '\-\-scene-' src/styles.css` compte **les huit** jetons de §6.9, et **aucun**
     jeton de `:root` n'a changé de valeur (`git diff src/styles.css` ne touche pas le bloc
     `:root`) ;
  2. les paires de contraste du document de direction (dont les deux fautes AA inversées)
     sont **recopiées dans `DESIGN.md` §1.5** avec leur ratio, et calculées, pas estimées ;
  3. `npm run detect:ui` vert ; tout halo voulu est justifié par « c'est un état » (§6.9) ;
  4. une capture `apres/420-combat.png` montre **une seule** source de lumière : les coins
     sont visiblement plus sombres que le centre.
- **Interdit** : donner un halo à une carte qui n'est ni active, ni désignée, ni en train de
  subir — c'est le tell « Dark mode with glowing accents » et c'est la règle §6.9.

---

## 9. Sources

Consultées le **25/10/2026** sauf mention contraire.

### 9.1 Normes et patrons (W3C / MDN)

| Affirmation | Source | Date |
|---|---|---|
| Contenu au survol : **fermable**, **survolable**, **persistant** ; le `title` du navigateur est **hors champ** (note 1) ; les dialogues **modaux** sont hors champ ; ce qui s'ouvre au survol doit aussi s'ouvrir au focus (§2.1.1) | <https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html> | MAJ 12/07/2026 |
| Un raccourci à **une touche caractère** doit être **désactivable**, **remappable** (modificateur) ou **actif au focus seulement** ; le scénario de dictée vocale | <https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html> | MAJ 23/02/2026 |
| Cible **24 × 24 px** minimum (AA), ou espacement d'un cercle de 24 px | <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html> | MAJ 11/05/2026 |
| Cible **44 × 44 px** (AAA) ; « recommended that larger sizes are used » | <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html> | MAJ 06/09/2026 |
| Redistribution : 320 px de large ; **note 2 : les jeux font partie des contenus à deux dimensions exceptés** ; l'exception **ne s'étend pas** aux cellules ni au texte voisin | <https://www.w3.org/WAI/WCAG22/Understanding/reflow.html> | MAJ 06/09/2026 |
| Focus visible : l'indicateur ne doit pas être **limité dans le temps** ; il relève aussi de SC 1.4.11 | <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html> | MAJ 06/09/2026 |
| Infobulle : `role="tooltip"`, `aria-describedby`, Échap ; **« Tooltip widgets do not receive focus »** ; « *A hover that contains focusable elements can be made using a non-modal dialog* » | <https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/> | consulté 25/10/2026 (patron « work in progress », l'APG le dit lui-même) |
| Divulgation : `aria-expanded`, `aria-controls` en option, `Entrée`/`Espace` | <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/> | consulté 25/10/2026 |
| Dialogue modal : focus déplacé puis rendu, Tab piégé, Échap ; `aria-modal` **seulement** si le reste est inerte | <https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/> | consulté 25/10/2026 |
| Grille : **un seul arrêt de tabulation**, flèches/Home/End gérées à la main ; « *If elements in the group also have associated elements that appear on hover, the grid pattern is also useful…* » | <https://www.w3.org/WAI/ARIA/apg/patterns/grid/> | consulté 25/10/2026 |
| API Popover : **Baseline 2025 — newly available** ; « popovers created using the Popover API are always non-modal » | <https://developer.mozilla.org/en-US/docs/Web/API/Popover_API> | MAJ 17/12/2025 |
| *CSS anchor positioning* : **aucun bandeau Baseline** sur la page consultée | <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning> | MAJ 24/03/2026 |
| `@media (pointer: coarse / fine)` : **Baseline, largement disponible** | <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer> | MAJ 20/04/2026 |

### 9.2 Jeux (sources primaires, ou secondaires assumées)

| Affirmation | Source | Date |
|---|---|---|
| Cinq zones de combat ; **défausse consultable à tout moment** par les deux joueurs | capture du jeu de référence, `docs/preuves/astuces-2026-10-20/03-zones-de-combat.png` ; transcription `…/README.md:37-53` | capture 20/10/2026 |
| **Toucher la carte, puis choisir** l'action (le Talent) ; la zone de café annonce le café **suivant** | `docs/preuves/astuces-2026-10-20/05-deroulement-dun-tour.png` ; transcription `…/README.md:76-133` | capture 20/10/2026 |
| Le coût d'une Pression se lit **à côté de son nom** (« *If no Energy symbol is displayed to the left of the attack name…* ») | FAQ officielle *Battle Rules*, Pokémon Support (article 38906248102292) | MAJ 12/05/2026 |
| **Les défauts d'UI récurrents d'un jeu de cartes** : texte trop petit, texte qui déborde, **infobulle qui recouvre l'interface**, couches qui s'empilent, filtres qui persistent | notes de correctifs officielles Marvel Snap, 21/07/2026 (six entrées concernées) | publié 21/07/2026 |
| « **Our game is UI** » (Derek Sakamoto, UI senior, Hearthstone), et l'aveu que l'UI a été dessinée, jetée, redessinée | Game Developer, « *Video: Designing an immersive user interface for Hearthstone* », GDC 2015 | 22/05/2015 ; **la vidéo GDC Vault était en maintenance le 25/10/2026** |
| Bouton **maintenu** = obstacle moteur ; le **basculement** est la solution ; offrir **les deux** quand c'est possible | Game Accessibility Guidelines, *Avoid / provide alternatives to requiring buttons to be held down* | consulté 25/10/2026 |
| **Rappeler les commandes** en cours de partie, et proposer une aide contextuelle | GAG, *Indicate / allow reminder of controls during gameplay* et *Include contextual in-game help / guidance / tips* | consulté 25/10/2026 |
| Une info **temporaire** ne doit pas être **hors du champ de regard** | GAG, *Avoid placing essential temporary information outside the player's eye-line* | consulté 25/10/2026 |
| Éléments interactifs **grands et espacés**, surtout au tactile ; **aucune information vitale par la couleur seule** ; **mémoriser les réglages** | GAG, listes *Basic* (Motor, Vision, General) | consulté 25/10/2026 |
| Un catalogue de guidelines d'accessibilité de jeu existe côté éditeur, et distingue « *best practices* » de « *compliance* » | Xbox Accessibility Guidelines (Microsoft Learn), v3.2 | MAJ 18/08/2026 |

### 9.3 Le projet

| Affirmation | Source | Date |
|---|---|---|
| L'écran tient « sans défiler » à 420 × 900 — **contrredit par les captures** (§1.4) | `DESIGN.md:149-162` ; `docs/preuves/finition-alpha-2026-10-23/avant/420-combat.png` | 23/10/2026 |
| Jetons, échelles, rayons, et les onze paires de contraste vérifiées | `DESIGN.md` §1.1-1.6 | 20/10/2026, corrigé 23/10/2026 (#131) |
| 420 × 900 est le critère de lecture, `npm run capturer` le mesure | D-060 ; `AGENTS.md` §7 | 21/10/2026 |
| shadcn = composants génériques seulement, jamais l'identité | D-035 | 20/10/2026 |
| Le `peek` ne laisse **aucune trace** dans le journal, l'écran l'affiche au seul joueur concerné | D-079 ; `Battle.tsx:308-348` | 22/10/2026 (décision), code depuis #171 |
| Vocabulaire : Banc (pas « Rack »), Deck (pas « Chariot ») | D-083, D-075 | 23/10/2026, 22/10/2026 |
| Le pas-à-pas a 7 cibles, un test exige qu'elles existent | `src/components/pas-a-pas-combat-etapes.ts:24-38` ; `src/pages/Battle.test.tsx:248-262` | 23/10/2026 |
| Les tells d'Impeccable : familles et règles nommées ; 61 dans `DESIGN.md`, **davantage** dans le catalogue public | <https://impeccable.style/slop> ; `.opencode/skills/impeccable/reference/craft-floor.md:19-44` | consulté 25/10/2026 |
| Le détecteur de sources **sous-compte** | `DESIGN.md:80-83` | 23/10/2026 |

### 9.4 Référence visuelle fournie par le propriétaire

| Affirmation | Source | Nature de la preuve |
|---|---|---|
| Composition du plateau (Poste dominant sur l'axe central, Banc sous chaque Poste, main en éventail rognée en bas, piles visibles à droite, piste d'Interventions à gauche) | Deux animations de **8 s** fournies par Bastien, `/tmp/opencode/video ui/`, 720 × 1280, **générées par IA** ; 24 images extraites dans `/tmp/opencode/frames/` | **Référence de structure et d'ambiance**, pas une source primaire : les textes y sont déformés, les couleurs et les assets ne sont pas à reprendre |
| Les six corrections R1-R6 de §6.8 | `/tmp/opencode/reponse-maquette-video-ui.md` (lecture faite par Bastien le 25/10/2026) | Idem : c'est **son arbitrage**, pas une mesure |

**Ce que cette source ne peut pas prouver** : qu'une disposition soit *meilleure*. Elle montre
ce qui **existe** dans un mockup animé ; elle ne dit rien de la lisibilité réelle, et son
contenu textuel est incohérent par construction. Elle a servi à **corriger une composition**,
pas à établir un fait.

### 9.5 La direction de scène (session Kimi K3)

| Affirmation | Source | Nature |
|---|---|---|
| Palette de scène mesurée frame par frame, quatre plans, règle du halo d'état, gabarits (carte 112 px, cartouche 52 px, bouton 132 × 56, pile 56 × 76, hexagone 24 px), typographie, pièges, table de contraste AA | `docs/DIRECTION-SCENE-COMBAT.md` (copie de `/tmp/opencode/direction-video-aaa.md`, 25/10/2026) | **Proposition de direction visuelle**, pas une mesure de jeu : les teintes viennent d'un JPEG généré par IA (±5 %) |
| Les deux fautes AA de la vidéo qu'on n'inverse pas : crème sur parchemin (2,41:1), blanc sur vert néon (~2:1) | même document, §7 | Ratios calculés (WCAG, luminance relative) ; à revérifier en navigateur avant livraison |
