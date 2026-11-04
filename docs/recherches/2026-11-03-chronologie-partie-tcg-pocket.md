# Chronologie : une partie de Pokémon TCG Pocket (vidéo feAya7Pixc4)

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `refs-2026-11-03/CHRONOLOGIE.md`. Les images et scripts cités
> (`planches/planche-01…17.jpg`, `frames/`, `rafales/`, `scenes.txt`, `rafale.py`,
> `planche_portrait.py`) ne sont pas archivés : ce texte est la seule trace conservée. Les
> libellés d'interface entre guillemets sont de courtes mentions, gardées comme repères de
> lecture ; aucune illustration ni texte de carte n'est reproduit.

> Source : 17 planches `planches/planche-01…17.jpg` (une vignette toutes les 2 s, 0 s → 396 s), croisées avec
> `scenes.txt` (97 changements de scène, seuil 0,25) et, pour la disposition, quelques images pleine taille
> `frames/tNNNs.jpg` (720×1280, portrait). Lu le 03/11/2026.
>
> **Limite de méthode** : une vignette toutes les 2 s ne montre pas un geste de moins de 2 s. Les lignes marquées
> *(incertain)* sont des déductions entre deux vignettes. Les durées fines sont dans `ANIMATIONS.md`.
> **Correction après la partie 2** : les rafales ont démenti quelques lectures de vignettes. Les corrections sont
> faites dans le tableau (lignes marquées « corrigé par rafale »). Les **chiffres rouges** près du coin haut droit
> d'une carte ne sont pas des dégâts mais le **compteur de PV restants qui décroît par pas de 10** (voir
> `ANIMATIONS.md`, « degats » et « ko »). Le **gros nombre au centre d'une carte** (« 60 », « 40 ») avec une étoile
> orange, lui, est le **chiffre de dégâts**.
> **Piège de lecture** : les planches `rafales/<nom>.jpg` produites par `rafale.py` sont en 16:9 alors que la
> vidéo est en portrait : chaque vignette y est minuscule. Pour `ANIMATIONS.md`, j'ai relu les images
> `rafales/<nom>/fNNNN.jpg` (540 px de large) via une planche portrait refaite (`planche_portrait.py`).
>
> Repères de couleur : le plateau est **rouge/orangé quand c'est le tour adverse**, **bleu quand c'est le nôtre**.
> Le joueur est le **bas** de l'écran. Il joue **en second** (« Going second », 6 s ; « You are going second », 14 s).
> Les points se lisent par trois pastilles `1 2 3` sur une bande d'avatar : **rouge = l'adversaire marque, bleu = nous**.

## a. Tableau des événements

| seconde | événement | ce qui est visible |
|---|---|---|
| 0 | menu / hors-combat | Écran quasi blanc-bleuté vide (chargement du plateau). |
| 2 | menu / hors-combat | Écran « VS » : bande rouge (haut) et bande bleue (bas), un avatar rond dans chaque, séparés par un anneau blanc. |
| 4 | menu / hors-combat | Plateau pâle vide, une pièce noire (logo Poké Ball) au centre. |
| 6 | menu / hors-combat | Fond orange, bandeau rouge « Going second », pièce noire agrandie (résultat du tirage). |
| 8 | pioche | *(corrigé par rafale)* Plateau vide, les deux paquets apparaissent sur les bords (8,0–8,2 s) ; à 8,75–9,35 s cinq cartes partent du paquet adverse (gauche) vers l'éventail du haut, cinq autres du paquet du joueur (droite) vers la main du bas. |
| 10 | carte en main agrandie | Exeggcute agrandie au centre (≈ 70 % de la largeur), consigne « Please put a Basic Pokémon in the Active Spot » + pastille rouge « You are going second ». Main en bas (5 cartes), compteur « 5 » en bas à droite. |
| 12 | pose d'une carte | *(corrigé par rafale)* L'agrandissement se ferme à 12,40 s ; Exeggcute, soulevée de la main, est glissée vers l'emplacement Actif cyan (12,45–13,15 s) pendant que la carte adverse **face cachée** descend du haut dans son emplacement (12,65–13,05 s) ; pastille « Time limit 88 ». |
| 14 | pose d'une carte | Exeggcute posée en Actif ; consigne « put up to 3 Basic Pokémon onto your Bench, then tap Start Battle » ; boutons `Reset` (gauche) et `Start Battle` (droite, liseré cyan) ; « Time limit 86 ». |
| 16 | carte en main agrandie | Exeggutor (Évolution, Psychic) agrandie par-dessus le plateau ; main toujours en bas, compteur « 6 ». |
| 18 | pose d'une carte | Même plateau qu'à 14 s (Exeggcute active, adversaire face cachée), pastille « 82 ». Rien de nouveau sur le banc. |
| 19 | révélation/retournement | *(ajouté par rafale)* Appui sur `Start Battle` vers 18,95 s : la carte adverse face cachée se **retourne** (19,20–19,55 s) et révèle Riolu (60 PV) ; liseré cyan 19,57–19,97 s. |
| 20 | fin/changement de tour | Bannière « Ready? Go! » en diagonale rouge/bleue sur un halo clair (20,7 → 21,6 s) : départ du combat. |
| 22 | fin/changement de tour | Bandeau orange « Opponent's turn / Current turn » sur un fond d'hexagones verts ; plateau passé en rouge. |
| 24 | fin/changement de tour | Riolu (60 PV) est déjà face visible (retournée à 19 s, voir plus haut) ; plateau rouge, cartes de l'adversaire en éventail en haut, « Time limit 84 » à droite. |
| 26–30 | fin/changement de tour | Tour adverse, le décompte « Time limit » descend (83, 80). Rien ne change sur le plateau. |
| 32 | fin/changement de tour | Plateau devenu bleu : c'est notre tour (pas de bannière dans l'échantillon, elle a dû passer entre 30 et 32 s) *(incertain)*. |
| 33 | pioche | *(ajouté par rafale)* Une carte (Bellossom) sort du paquet du joueur (droite), se retourne en volant et s'agrandit au centre (33,10–33,35 s), reste visible ~0,65 s puis file vers la main (34,00–34,20 s). |
| 34 | énergie | Pastille d'énergie (feuille verte) en bas à droite : étincelle verte à 34,55–34,75 s, puis infobulle « Next Energy generated » (35,0–35,4 s). |
| 36 | carte en main agrandie | *(corrigé par rafale)* Poké Ball (Dresseur/Objet) agrandie à 35,40–35,60 s, puis glissée vers la zone de dépôt verte (35,85 s →). |
| 38 | pioche | Plateau sans carte agrandie, main de 5 cartes ; la Poké Ball a été jouée (cherche un Basic dans le paquet) *(incertain)*. |
| 40 | carte en main agrandie | Retour au plateau ; la main contient un Basic de plus. |
| 42 | pose d'une carte | Une carte (Bulbasaur) glisse de la main vers un emplacement de Banc : deux emplacements cyan allumés en bas à gauche, voile sombre sur le reste. |
| 44 | carte en main agrandie | Carte illustrée **pleine page** (Bulbasaur) montrée en grand au centre pendant la pose. |
| 46 | pose d'une carte | Bulbasaur posée au Banc, emplacement cyan, Exeggcute encadrée de cyan (cible d'énergie), orbe d'énergie en bas à droite. |
| 48 | énergie | Exeggcute encadrée de cyan, Bulbasaur sur le Banc ; l'orbe d'énergie est toujours lumineuse. |
| 50 | carte en main agrandie | Giant Cape (Outil) agrandie au centre, main en bas. |
| 52 | pose d'une carte | Exeggcute encadrée, bouton `End Turn` apparu à droite du centre. |
| 54–58 | fin/changement de tour | Plateau bleu stable, `End Turn` encore visible à 54 s puis disparu. |
| 60 | fin/changement de tour | Plateau rouge : tour adverse (la bannière est passée entre 58 et 60 s). |
| 62–66 | fin/changement de tour | Tour adverse, « Time limit » 82 → 80 → 78. |
| 68–70 | pose d'une carte | Une carte adverse (orange) apparaît sur le Banc adverse, en haut à gauche. |
| 72 | pose d'une carte | Halo violet et blanc en carré autour de notre Actif : effet qui couvre la carte *(incertain : attaque adverse, effet de statut ou évolution adverse)*. |
| 74 | pose d'une carte | Deux cartes adverses en haut (Actif + Banc remplis). |
| 76 | carte en main agrandie | Riolu (PV 60, attaque « Jab ») agrandie, vue de l'adversaire. |
| 78 | dégâts | *(corrigé)* Compteur rouge « 40 » (PV restants qui décroissent) en haut à droite de notre Actif ; cartes adverses ordonnées en colonne. |
| 80 | fin/changement de tour | Plateau bleu : retour à notre tour ; PV de notre Actif affiché « 30 ». |
| 84 | énergie | Exeggcute encadrée cyan ; bouton `End Turn` ; orbe d'énergie allumée. |
| 86 | pose d'une carte | Une carte (Bulbasaur verte) posée sur l'Actif ; « Time limit 80 ». |
| 88 | dégâts | Bandeau/étiquette orange à gauche de l'Actif : PV passent à 110 (soin ou évolution *(incertain)*). |
| 90 | énergie | Fond assombri, énergie verte attachée à l'Actif ; orbe en bas à droite. |
| 92 | carte en main agrandie | Une carte soulevée dans la main (surlignée) pendant que l'Actif est encadré de cyan. |
| 96 | attaque | Un éclat blanc sur le côté gauche de l'Actif ; PV 110. |
| 98 | dégâts | Bandeau blanc en haut « +20 HP » (soin de 20). |
| 100–102 | énergie | Actif (130 PV) encadré de cyan, `End Turn` visible à droite. |
| 104 | fin/changement de tour | Bandeau rouge « Current turn 5 » traverse l'écran, plateau en train de virer au rouge. |
| 106–108 | fin/changement de tour | Tour adverse. |
| 110 | pose d'une carte | Plateau assombri, aucun surbrillant ; menu rond en bas à gauche. |
| 112 | pose d'une carte | Message « Please choose a Pokémon to switch » ; un Basic sur le Banc entouré de cyan (remplacement de l'Actif). |
| 114 | carte en main agrandie | Carte pleine page (Bulbasaur-like) agrandie, un « 84 » à droite. |
| 116 | attaque | Étiquette orange « 70 » et petite carte sur notre Actif : attaque adverse en cours. |
| 118 | dégâts | PV de notre Actif 70 ; cartes adverses sur trois emplacements. |
| 120 | évolution | Éclats blancs dans la zone adverse, un PV « 20 » sur notre Actif ; main en bas. |
| 122 | carte en main agrandie | Infobulle texte « Attacks by Fighting-type Pokémon do +10 damage to the opponent's Active Pokémon » (talent de Lucario). |
| 124 | attaque | Bannière orange « **Submarine Blow** » (sous-titre « Lucario ») en diagonale, entrée de la droite à 124,60 s ; l'attaquant grossit en haut du plateau (124,90 s). |
| 126 | dégâts | *(corrigé par rafale)* Flash blanc (125,85), chiffre de dégâts « **60** » dans une étoile orange au centre de notre Actif (126,00–126,65 s), puis compteur de PV restants 70 → 10 en rouge (126,65–127,10 s). |
| 128 | fin/changement de tour | Plateau bleu ; bandeau gris « Current turn 6 » *(incertain sur le chiffre)*. |
| 130–134 | énergie | Notre tour : pastille d'énergie verte en bas à droite à 134 s ; « Time limit 81 → 79 ». |
| 136 | carte en main agrandie | Pinsir (Basic, 90 PV) agrandie. |
| 138 | carte en main agrandie | Ivysaur (Stage 1, 90 PV, « Razor Leaf 60 ») agrandie, par-dessus le plateau. Compteur « 5 ». |
| 140 | évolution | *(corrigé par rafale)* Ivysaur glissée de la main vers l'Actif (cadre jaune puis vert, 140,0–141,9 s). |
| 142 | évolution | La carte évoluée saute en gros plan avec traits de vitesse (142,45–142,70 s), flash blanc (142,75–142,95 s), retour à la taille du slot et piliers de lumière cyan (143,10–143,60 s). |
| 144 | évolution | Ivysaur posée ; PV « 30 » ; `End Turn` visible. |
| 146 | énergie | Carte encadrée de cyan, orbe d'énergie verte en bas à droite, « 42 ». |
| 148–150 | pose d'une carte | Plateau bleu ; le Banc contient Exeggutor (130 PV) ; `End Turn` visible à 150 s. |
| 152 | pose d'une carte | Un seul emplacement de Banc cyan en bas, carte soulevée de la main. |
| 154 | fin/changement de tour | Plateau stable, notre tour. |
| 156 | fin/changement de tour | Bandeau « Opponent's turn / Current turn 7 » sur hexagones violets et verts ; main en bas. |
| 158–162 | fin/changement de tour | Tour adverse (« 86 » à 160 s). |
| 164–166 | pose d'une carte | Adversaire a quatre cartes en haut ; 164 s : étiquette orange à gauche de notre Actif. |
| 168 | attaque | Étiquette rouge/orange à gauche de notre Actif (nom d'attaque adverse) ; PV adverses 80. |
| 170 | dégâts | *(corrigé par rafale)* Bannière « Fighting Headbutt » (sous-titre « Sudowoodo ») 169,15–170,15 s, flash 170,40 s, chiffre de dégâts « 40 » à 170,55 s, compteur 30 → 0 (171,40–171,67 s). |
| 172 | K.O. | *(corrigé par rafale)* À 172,40–172,95 s la carte tombée à 0 PV est avalée par un anneau cyan ; l'emplacement Actif du joueur est **vide** ensuite. |
| 174 | K.O. | Fond flouté à 174,50 s ; bande rouge entrée de la droite (174,55 s), avatar adverse (174,65 s), pastilles `1 2 3` éteintes. |
| 176 | K.O. | Première pastille allumée (éclat blanc à 175,20 s, jaune à 175,45 s), puis « +1 point! » avec anneau rose à 176,05 s ; bande tenue ≥ 3 s. |
| 178 | pose d'une carte | Plateau assombri : choix d'un remplaçant sur le Banc (carte cyan en bas à gauche). |
| 180 | carte en main agrandie | Étiquette « Psychic »-like à gauche de l'Actif adverse ; PV « 130 » sur notre nouvel Actif. |
| 182–184 | pioche | Tour bleu ; une carte jaunâtre (Exeggcute ?) sort de la main vers le bas. |
| 186 | pose d'une carte | Carte translucide dorée posée sur un emplacement du Banc. |
| 188 | pose d'une carte | Carte dorée, plus grosse, couvre le Banc. |
| 190 | carte en main agrandie | Exeggutor (130 PV, « Psychic 80+ ») agrandie en pleine page, avec 4 énergies vertes dessous. |
| 192 | carte en main agrandie | Même carte, glissée légèrement vers la droite. |
| 194–198 | énergie | Actif (130 PV) encadré de cyan ; `End Turn` visible. |
| 200 | attaque | Panneau d'attaque « Psychic 80+ » remonté au tap sur l'Actif (carte jaune surlignée, texte d'attaque, bouton). |
| 202 | fin/changement de tour | Boîte « End your turn ? / A Supporter card can be used » avec `Cancel` / `OK`. |
| 204 | attaque | Bannière verte « **Psychic** » en diagonale sur le bas du plateau. |
| 206 | dégâts | Notre Actif en gros plan ; PV adverses baissés. |
| 208 | dégâts | Étiquette « Rocky Helmet » devant la carte adverse (effet de l'Outil adverse). |
| 210 | dégâts | PV de notre Actif « 110 ». |
| 212 | K.O. | Actif adverse **vide**. |
| 214 | K.O. | Bande bleue, avatar, « +1 point! », pastilles `1 2 3` : nous marquons (1). |
| 216 | fin/changement de tour | Retour au plateau ; pastille « 17 » de décompte. Banc adverse à gauche. |
| 218 | fin/changement de tour | Bandeau « Opponent's turn / Current turn 9 » sur hexagones verts. |
| 220–226 | fin/changement de tour | Tour adverse (« 83 »). |
| 228 | fin/changement de tour | Plateau bleu (tour de nous) juste avant la bannière. |
| 230 | fin/changement de tour | Bandeau cyan « **Your turn** / Current turn 10 » sur hexagones. |
| 232 | carte en main agrandie | Sunkern/Seedot (Basic, 70 PV, « Surprise Attack ») agrandie. |
| 234–236 | énergie | Actif encadré, orbe d'énergie allumée (verte) à 236 s, fond assombri. |
| 238 | énergie | Énergie en route vers l'Actif ; « 81 ». |
| 240 | attaque | Panneau d'attaque Exeggutor ouvert depuis l'Actif (liseré cyan, `Psychic 80`). |
| 242 | attaque | Idem. |
| 244 | fin/changement de tour | Boîte « End your turn ? ». |
| 246 | attaque | Notre Actif en lueur claire, plateau vif. |
| 248 | dégâts | PV adverses « 20 » (étiquette sur l'Actif adverse). |
| 250 | dégâts | Éclats verts autour de notre Actif et chiffre « 20 » : dégât de retour (Rocky Helmet) sur notre Actif ; PV 110 → 90. |
| 252 | fin/changement de tour | Bandeau « Opponent's turn / Current turn 11 » à demi sorti. |
| 254–260 | fin/changement de tour | Tour adverse, notre Actif 90 PV. |
| 262 | menu / hors-combat | Bulle « Waiting for opponent… » en haut. |
| 264 | énergie | Éclair/lueur orange sur la zone adverse ; bulle d'effet Lucario. |
| 266 | carte en main agrandie | Infobulle d'effet « Attacks by Fighting-type… ». |
| 268–270 | carte en main agrandie | Lucario (100 PV, « Fighting Coach », « Submarine Blow 40 ») agrandi en pleine page ; « Waiting for opponent… » à 270 s. |
| 272–274 | fin/changement de tour | Plateau stable, retour à notre tour vers 274 s. |
| 276 | énergie | Actif encadré de cyan. |
| 278 | énergie | Orbe d'énergie, fond assombri, « 83 ». |
| 280 | énergie | Énergie en vol vers le Banc/Actif, deux cibles cyan. |
| 282 | énergie | Plateau normal, « 81 ». |
| 284 | attaque | Panneau d'attaque Exeggutor ouvert (« Psychic 80 »). |
| 286 | fin/changement de tour | Boîte « End your turn ? ». |
| 288 | attaque | Bannière verte « **Psychic** ». |
| 290 | dégâts | Chiffre rouge « 10 » sur Actif adverse ; PV adverses aux alentours de 80. |
| 292 | dégâts | Étiquette « Rocky Helmet » (deuxième déclenchement). |
| 294–296 | fin/changement de tour | Plateau ; l'Actif adverse a disparu à 296 s : K.O. adverse. |
| 296 | K.O. | Emplacement Actif adverse vide. |
| 298 | K.O. | Bande bleue, avatar, `1 2 3` avec deux pastilles allumées (nous : 2). |
| 300–302 | pose d'une carte | L'adversaire remplace son Actif (carte orange en position centrale). |
| 304 | fin/changement de tour | Bandeau « Opponent's turn / Current turn 13 ». |
| 306–308 | fin/changement de tour | Tour adverse, « 84 » à 308 s. |
| 310 | révélation/retournement | Halo clair, orange et blanc, autour de la zone centrale : effet adverse ou évolution *(incertain)*. |
| 312–316 | menu / hors-combat | Bulles « Waiting for opponent… » (314 s), « There are no cards in the deck that can be the target of the effect » (316 s) : un effet adverse (recherche) échoue. |
| 318–320 | pose d'une carte | Plateau stable, adversaire a quatre cartes en haut. |
| 322 | révélation/retournement | Carte jaune pâle (Pokémon) retournée face visible au centre, sur le plateau adverse. |
| 324 | dégâts | PV adverses 150 (étiquette) ; notre Actif 70. |
| 326 | attaque | Bannière orange « **Head Smash** » en diagonale ; Actif adverse en gros plan. |
| 328 | dégâts | Notre Actif PV « 0 » (chiffre rouge). |
| 330 | dégâts | Chiffre rouge « 140 » sur le haut ; les PV de notre Actif sont à 0. |
| 332 | K.O. | Notre Actif **vide**. |
| 334 | K.O. | Bande rouge, avatar adverse, `1 2 3` (pastille 2 allumée). |
| 336 | K.O. | « +1 point! » côté adverse (deuxième point adverse). |
| 338 | pose d'une carte | Choix d'un remplaçant : Banc éclairé, fond assombri. |
| 340 | carte en main agrandie | Celebi (carte pleine page) agrandie au centre, halo. |
| 342 | pose d'une carte | Celebi posée en Actif, étiquette « Energy… » rouge et 130 PV. |
| 344 | fin/changement de tour | Bandeau cyan « **Your turn** / Current turn 14 » sur hexagones. |
| 346 | carte en main agrandie | Potion (Dresseur, « Heal 20… ») agrandie. |
| 348 | énergie | Actif encadré de cyan, orbe d'énergie verte en bas à droite. |
| 350 | énergie | Plateau normal, Actif encadré. |
| 352 | dégâts | Pastille « 77 » ; PV « 130 » sur l'Actif. |
| 354 | fin/changement de tour | Plateau stable, `End Turn` visible. |
| 356–358 | carte en main agrandie | Celebi (« Powerful Bloom ») en **très grand format**, énergies visibles en bas. |
| 360 | énergie | Actif encadré de cyan, `End Turn` à droite. |
| 362 | attaque | Panneau d'attaque ouvert sur Celebi. |
| 364 | attaque | Message « Flip a coin for each Energy attached… This attack does 50 damage for each heads », deux pastilles Poké Ball/pièce noire ; pièce posée en bas. |
| 366 | attaque | Pièce qui tourne (vue de chant) : dans le message, compteur `0 / 1`. |
| 368 | attaque | Fond cyan vif, trois pièces visibles (dont deux Poké Ball = faces) ; compteur `2 / 2`. |
| 370 | dégâts | Retour au plateau ; l'Actif adverse porte ses PV réduits. |
| 372 | dégâts | Anneau vert (éclats verts) autour de l'Actif adverse et chiffre « **120** » en haut ; attaque de Celebi qui touche. |
| 374 | dégâts | Orbe bleue claire au centre (effet de dégâts vu en transition). |
| 376 | écran de fin | Bande bleue, avatar, pastilles `1 2 3` (3 allumée) : dernier point, 3 sur 3. |
| 378 | écran de fin | « +1 point! », les trois pastilles jaunes. |
| 380 | fin/changement de tour | Retour bref au plateau : emplacement Actif adverse vide. |
| 381 | écran de fin | *(ajouté par rafale)* Flou de mouvement horizontal du plateau (381,15–381,20 s), **écran blanc plein 0,65 s** (381,25–381,90 s), traînées de vitesse grises avec un dos de carte (381,95 s). |
| 382 | écran de fin | « **Victory!** » en gros, carte Exeggutor (carte de la partie) en grand sur fond iridescent. |
| 384 | écran de fin | Même carte plus haute à l'écran, étincelles ; « Victory! » rétréci en haut à gauche. |
| 386 | écran de fin | Écran récapitulatif quasi vide, avatar rond en haut. |
| 388 | écran de fin | « Victory! », laurier « Card of the Game » avec la carte, tableau (« Turn ended », « Turns played 14 », « Your points ★★★ », « Opponent's points ★★☆ », « Damage dealt 400 » *(chiffres indicatifs, lecture floue)*). |
| 390 | écran de fin | « Victory! » seul, liste vide en dessous. |
| 392 | écran de fin | Liste avec pastille « EXP » (récompense). |
| 394–396 | menu / hors-combat | Fenêtre « Send a thanks! » : avatar adverse, bouton `Request`, puis « Thanks! ». |

## b. Disposition du plateau

Cadre : image **720×1280** (portrait 9:16), deux bandes noires latérales d'environ 30 px. Lu sur `frames/t0024s.jpg`, `t0138s.jpg`, `t0150s.jpg` et `t0014s.jpg`, et recoupé sur les vignettes citées.

- **Haut — côté adverse (24 s, 150 s)** : en haut, 4 à 5 dos de cartes en éventail = **main adverse** (rognée par le haut de l'écran, ~40 px visibles). Dessous, **barre d'infos** en pastille grise (trois pastilles de points à gauche, horloge « 19:54 » à droite) qui chevauche les cartes. Puis rangée de **3 emplacements de Banc** adverse, puis l'**Actif adverse** (carte 190×230 px à l'échelle des vignettes, au centre).
- **Paquets, défausses, énergie (24 s, 150 s)** : le **paquet adverse** est un tas de dos à **l'extrême gauche**, à mi-hauteur du demi-plateau adverse ; sa **défausse** (cartes face visible, un peu transparente) est **juste au-dessus**. Le **paquet du joueur** est à **l'extrême droite**, juste sous la ligne médiane ; sa **défausse** juste dessous (carte visible, 150 s). Un petit **orbe d'énergie** ronde existe à chaque coin : adverse en haut à gauche (icône Combat), joueur en bas à droite (icône Plante, 24 s).
- **Zones de cartes (24 s, 150 s)** : empilées **au centre** : Actif adverse, puis Actif du joueur, séparés par un cercle blanc central (le « tapis » circulaire). Banc du joueur : **3 emplacements en bas** (14 s). Les cartes évoluées montrent l'ancienne carte en **miniature à gauche** du Pokémon, les énergies en pastilles sous la carte (150 s) et un **triangle orange** d'action disponible à droite du nom.
- **Main du joueur (24 s, 138 s)** : en **bas**, 4 à 5 cartes en éventail, **seules les 1/5 supérieures** sont visibles (nom, début d'illustration), le reste est hors écran. Quand on touche une carte, elle **monte de quelques pixels et s'illumine** (cyan à 150 s) ; une carte tapée est **agrandie à ~85 % de la largeur** au centre (138 s) ; un compteur de cartes « ☐ 5 » apparaît **en bas à droite** pendant ce temps.
- **Boutons et menus (14 s, 150 s)** : **menu hamburger** rond en bas à gauche (toujours là) ; `Reset` à gauche et `Start Battle` à droite **au milieu**, entre les deux Actifs, pendant la mise en place (14 s) ; `End Turn` à droite, même ligne (150 s) ; boîte `End your turn ? Cancel / OK` au centre (202 s) ; bulle de consigne arrondie **en haut** (10 s, 14 s).
- **Infos de tour (24 s, 150 s)** : pas de journal d'actions. Le tour est dit par **la teinte du plateau** (rouge/bleu), par une **bannière pleine largeur** (22 s, 156 s, 230 s : « Opponent's turn / Your turn » + « Current turn N », sur hexagones), par une **pastille « Time limit N »** (rond gris à droite, 24 s) qui descend d'une seconde à la seconde, et par l'**horloge de partie** en haut à droite. Les **points** : trois pastilles dans la barre du haut, et un écran de bande plein-largeur à chaque point (174–176 s, 214 s).
- **Pas de journal ni de liste de textes** : tout passe par des **bannières de nom d'attaque** (124 s « Submarine Blow », 204 s « Psychic »), des **bulles blanches en haut** (98 s « +20 HP », 112 s « Please choose a Pokémon to switch ») et des **chiffres rouges** près de la carte touchée (78 s, 126 s).

## c. Fenêtres à découper

Dix fenêtres principales (≤ 2,5 s ; ≤ 1,1 s pour le retournement à 30 fps) et cinq fenêtres de complément. Le nom est aussi
celui du dossier `rafales/<nom>/` et de la planche `rafales/<nom>-p.jpg` (portrait, lisible) ; `rafales/<nom>.jpg`
est la planche 16:9 de `rafale.py`, trop petite pour lire.

| nom | début–fin (s) | fps | ce qu'on y cherche |
|---|---|---|---|
| `distribution-main` | 7.0–9.5 | 20 | fin du tirage, apparition des paquets, cartes du paquet vers les deux mains (pioche initiale) |
| `main-agrandie` | 9.5–12.0 | 20 | tap sur Exeggcute : soulèvement puis agrandissement |
| `pose-actif` | 11.0–13.5 | 20 | fermeture de l'agrandissement, glissé vers l'Actif, carte adverse face cachée qui descend |
| `retournement-flip` | 18.9–20.0 | 30 | retournement de la carte adverse après `Start Battle` |
| `pioche-tour` | 31.5–34.0 | 20 | bannière « Your turn », pioche d'une carte qui sort du paquet |
| `pose-banc` | 41.5–44.0 | 20 | tap, agrandissement, glissé vers le Banc |
| `attaque-bandeau` | 123.0–125.5 | 20 | bannière « Submarine Blow » et attaquant qui grossit |
| `degats` | 125.5–128.0 | 20 | impact, chiffre de dégâts, poussière, compteur de PV |
| `ko` / `ko-pv` | 169.0–171.5 / 171.4–172.6 | 20 / 30 | attaque suivante et compteur 30 → 0, jusqu'à l'anneau du K.O. |
| `ko-point` + `point-bande` | 172.5–175.0 / 175.0–177.5 | 20 | disparition de la carte, bande de point, pastille et « +1 point! » |
| `changement-tour` | 229.0–231.5 | 20 | bannière « Your turn » sur hexagones, bascule rouge → bleu |
| `ecran-fin` | 380.5–383.0 | 20 | dernier coup, écran blanc, dos de carte, retournement, « Victory! » |
| compléments | `pioche-suite` 33.9–36.4 · `energie` 45.4–47.9 · `evolution` 139.0–141.5 · `evolution-suite` 141.4–143.9 · `scan-revele` 13.4–21.6 (6 fps) | 20 | main de la pioche, énergie vers la carte, évolution |
