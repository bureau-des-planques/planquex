# Astuces de jeu — capturé le 2026-10-20

> **Preuve primaire.** Neuf captures des écrans « Astuces de jeu » de l'application de
> référence, en **français**. Les textes ci-dessous ont été recopiés après **relecture des
> images à taille réelle** (les captures font jusqu'à 8 596 px de haut : rendues entières,
> elles sont illisibles). C'est la formulation du jeu qui fait la preuve, pas ma lecture
> (`docs/preuves/README.md`).

- **Application** : Pokémon TCG Pocket — **version à relever** (Paramètres de l'app)
- **Appareil / OS** : **à relever**
- **Langue de l'interface** : **français**
- **Chemin** : menu du bas → **« Astuces »**, puis **« À propos des règles de combat »**
  (et **« FAQ détaillée sur les combats »** pour les cas particuliers)

## 1. Les entrées réelles du menu

`01-menu-astuces.png` donne la liste complète du menu d'aide. Deux entrées portent sur les
règles : **« À propos des règles de combat »** et **« FAQ détaillée sur les combats »**.

`02-regles-de-combat.png` déplie la première. Les 7 sous-entrées, dans l'ordre affiché :

| # | Sous-entrée (intitulé exact) | Capture |
|---|---|---|
| 1 | Zones de combat | `03` |
| 2 | Préparation d'un combat | `04` |
| 3 | Déroulement d'un tour | `05` |
| 4 | Mettre un Pokémon K.O. et issue d'un combat | `06` |
| 5 | Contrôle Pokémon et États Spéciaux | `07` |
| 6 | Nombre maximum de tours et temps imparti | `08` |
| 7 | Erreurs de connexion pendant les combats | `09` |

**Le protocole se trompait sur les intitulés** : « Astuces du jeu », « Règles de combat »,
« Conditions spéciales » n'existent pas tels quels dans l'app. Les vrais sont ci-dessus.

## 2. Transcription, page par page

### `03-zones-de-combat.png`

> En combat, le terrain de jeu est divisé en plusieurs zones :
> • **Le deck** : c'est là que les cartes du deck sont posées face cachée.
> • **Le Poste Actif** : c'est à cet endroit que les Pokémon utilisent des attaques pour
> combattre. Le Pokémon sur le Poste Actif est appelé le « Pokémon Actif ».
> • **Le Banc** : les Pokémon qui peuvent être échangés avec le Pokémon Actif sont placés
> ici. Les Pokémon sur le Banc sont appelés les « Pokémon de Banc ».
> • **La pile de défausse** : les Pokémon K.O. et les cartes utilisées sont placés sur cette
> pile. On dit alors que les cartes sont défaussées. Dans la pile de défausse, les cartes
> sont toujours posées face visible. Pendant un combat, les deux joueurs peuvent voir le
> nombre de cartes qui se trouvent dans la pile et peuvent consulter toutes les cartes qui
> s'y trouvent à tout moment.
> • **La main** : ce sont les cartes que vous pouvez utiliser durant le combat. **Un joueur
> ne peut pas avoir plus de 10 cartes à la fois dans sa main.**
> Remarque : contrairement au Jeu de Cartes à Collectionner Pokémon, **ce jeu n'inclut pas
> les cartes Récompense.**

### `04-preparation-dun-combat.png`

> La préparation d'un combat se fait dans l'ordre suivant :
> 1. **Une pièce est lancée automatiquement. Le joueur qui obtient le côté face a la main,
>    tandis que celui qui obtient le côté pile joue en deuxième.**
> 2. **Des cartes sont piochées dans le deck automatiquement.**
> 3. Les joueurs sélectionnent un Pokémon de base à placer sur le Poste Actif. Ils peuvent
>    aussi choisir les Pokémon de base à placer sur le Banc. (À ce stade, les joueurs ne
>    voient pas encore quels Pokémon l'adversaire a mis en jeu.)
> 4. Les joueurs touchent « Commencer » pour mettre fin à la préparation du combat.
> 5. Lorsque les deux joueurs ont terminé leurs préparatifs, les Pokémon qu'ils ont mis en
>    jeu sont révélés et le combat commence.
> Remarques : • Lorsqu'un joueur dépasse le temps de préparation imparti, un Pokémon de base
> choisi aléatoirement est placé sur le Poste Actif et le combat commence. • Si un joueur
> touche le bouton « Réinitialiser » avant d'avoir terminé ses préparatifs, tout Pokémon mis
> en jeu sera replacé dans sa main.

> **Ce que ça ne dit pas** : ni le **nombre** de cartes piochées au départ (5), ni une
> éventuelle **reprise de poste**. Aucun remélange n'est décrit : c'est un argument **par
> absence**, pas une preuve.

### `05-deroulement-dun-tour.png`

> **Le début d'un tour**
> Lorsque votre tour commence, vous piochez une carte de votre deck et l'ajoutez à votre
> main. De l'Énergie est ensuite générée dans votre zone Énergie. La zone Énergie affiche
> l'Énergie qui vient d'être générée et celle qui sera générée après.
> Remarque : **durant le premier tour de la personne qui joue en premier, aucune Énergie
> n'est générée dans la zone Énergie.**

> **Placer un Pokémon sur le Banc**
> Si vous avez un Pokémon de base dans votre main, vous pouvez le placer sur votre Banc.
> **Le Banc a trois emplacements**, et tant qu'il y a des emplacements vides, vous pouvez y
> placer autant de Pokémon que vous le souhaitez n'importe quand pendant votre tour.

> **Attacher de l'Énergie aux Pokémon**
> Les Pokémon ont besoin d'Énergie pour utiliser leurs attaques. **Tant que vous disposez
> d'Énergie dans votre zone Énergie, vous pouvez en attacher autant que vous le souhaitez à
> vos Pokémon durant votre tour.** Vous pouvez choisir d'attacher de l'Énergie à votre
> Pokémon Actif ou à vos Pokémon de Banc. De plus, il est possible d'attacher au Pokémon un
> type d'Énergie différent du sien.

> **Jouer des cartes Dresseur**
> Vous pouvez jouer les cartes Dresseur dans votre main. Elles seront défaussées ensuite.
> Remarque : **vous ne pouvez jouer qu'une seule carte Supporter par tour.**

> **Faire évoluer vos Pokémon**
> […] Vous ne pouvez pas faire évoluer un Pokémon pendant le même tour où il a été mis en
> jeu.
> Remarques : • **Il est impossible de faire évoluer un Pokémon lors du premier tour de la
> partie, qu'on joue en premier ou en deuxième.** • Lorsqu'un Pokémon évolue, tous les effets
> d'attaques (par exemple, lorsqu'au prochain tour, les attaques infligent plus de dégâts) ou
> les **États Spéciaux** qui l'affectent disparaissent.

> **Utiliser les talents des Pokémon**
> Certaines cartes Pokémon ont des talents, en plus de leurs attaques. […] Certains talents
> s'activent de manière automatique tant que le Pokémon est en jeu. D'autres nécessitent que
> leurs conditions soient remplies pour fonctionner.

> **Battre en retraite**
> Votre Pokémon Actif peut battre en retraite et échanger sa place avec un Pokémon de votre
> Banc. Pour le faire battre en retraite, vous devez **défausser une Énergie de votre Pokémon
> Actif pour chaque symbole d'Énergie Incolore listé dans son Coût de Retraite. Les Énergies
> défaussées peuvent être de n'importe quel type.** Échangez ensuite le Pokémon qui bat en
> retraite contre un de vos Pokémon de Banc, et **placez ce dernier sur le Poste Actif**.
> Remarques : • **Vous ne pouvez battre en retraite qu'une fois par tour.** • Vous ne pouvez
> pas battre en retraite si vous ne parvenez pas à défausser suffisamment d'Énergie du
> Pokémon Actif, ou si vous n'avez pas de Pokémon de Banc. • Après avoir battu en retraite,
> le Pokémon garde tous les dégâts subis ainsi que toutes les Énergies qui lui sont encore
> attachées. • **Quand le Pokémon Actif est envoyé sur le Banc**, tous les effets d'attaques
> […] ou les **États Spéciaux** qui l'affectent disparaissent.

> **Utiliser les attaques de vos Pokémon**
> […] **Seul le Pokémon Actif peut utiliser des attaques.** […] les symboles d'Énergie
> Incolore indiquent que n'importe quel type d'Énergie peut être utilisé. **Le Pokémon garde
> les Énergies qui lui sont attachées après avoir utilisé l'attaque**, sauf si le texte de la
> carte indique autrement. **N'appliquez pas la Faiblesse aux Pokémon de Banc.** **Une fois
> l'attaque lancée, votre tour est terminé.**

### `06-ko-et-issue-dun-combat.png`

> **Mettre un Pokémon K.O.**
> Lorsqu'un joueur met un Pokémon K.O., il gagne un point. **Si un joueur met plusieurs
> Pokémon K.O. en même temps, il obtient un point par Pokémon mis K.O.**
> Le joueur dont le ou les Pokémon ont été mis K.O. doit défausser ces Pokémon ainsi que
> toutes les Énergies et les cartes qui leur sont attachées. **Si le Pokémon sur le Poste
> Actif est mis K.O., le joueur le remplace avec un de ses Pokémon de Banc.**
> Remarque : la plupart du temps, les joueurs ne gagnent qu'un seul point après avoir mis un
> Pokémon K.O., mais **il est possible d'en gagner deux ou plus s'il s'agit de Pokémon avec
> un encadré Règle.**

> **L'issue d'un combat**
> L'issue d'un combat est déterminée par les conditions ci-dessous. Il suffit d'en remplir
> une pour que le combat prenne fin.
> • **Si un joueur obtient en premier le nombre de points requis ou plus, il remporte le
> combat.**
> • **Si un joueur n'a plus de Pokémon en jeu, il perd le combat indépendamment du nombre de
> points que chaque joueur possède.**
> Remarques : • Si un joueur déclare forfait, il perd le combat indépendamment des cartes en
> jeu ou du nombre de points que chaque joueur possède. • **Même si un joueur est à court de
> cartes dans son deck, cela n'entraîne pas sa défaite.**

### `07-controle-pokemon-etats-speciaux.png`

> **Qu'est-ce que le Contrôle Pokémon ?**
> Le Contrôle Pokémon est une étape ayant lieu après la fin de chaque tour. […] Tout Pokémon
> n'ayant plus aucun PV à la fin du Contrôle Pokémon est K.O.
> **Si les Pokémon des deux joueurs sont affectés par des États Spéciaux, le joueur dont le
> tour vient de prendre fin procède d'abord au contrôle.**
> Si un Pokémon est affecté par plusieurs États Spéciaux, ces derniers sont résolus dans
> l'ordre suivant :
> **1. Empoisonné  2. Brûlé  3. Endormi  4. Paralysé**
> Remarque : le Contrôle Pokémon n'est pas considéré comme une partie du tour des joueurs.

> **États Spéciaux**
> Les États Spéciaux sont appliqués aux **Pokémon Actifs** par les attaques, entre autres.
> **Empoisonné, Brûlé, Endormi, Paralysé et Confus** sont des États Spéciaux.
> • Les Pokémon **Empoisonnés** subissent **10 dégâts** durant chaque Contrôle Pokémon.
> L'état Empoisonné **est cumulable** avec d'autres États Spéciaux.
> • Les Pokémon **Brûlés** subissent **20 dégâts** durant chaque Contrôle Pokémon. Le joueur
> dont le Pokémon est Brûlé **lance une pièce** pendant le contrôle. **Si c'est face, le
> Pokémon est guéri** de cet état. Si c'est pile, il reste Brûlé. L'état Brûlé **est
> cumulable** avec d'autres États Spéciaux.
> • Les Pokémon **Endormis** ne peuvent ni attaquer ni battre en retraite. **Le joueur dont
> le Pokémon est Endormi lance une pièce** pendant le Contrôle Pokémon. Si c'est face, le
> Pokémon est guéri, mais si c'est pile, il reste Endormi.
> • Les Pokémon **Paralysés** ne peuvent ni attaquer ni battre en retraite. **Après le
> prochain tour de la personne à laquelle il appartient, il guérit au cours du Contrôle
> Pokémon.**
> • Lorsqu'un Pokémon **Confus** attaque, la personne à laquelle il appartient doit **lancer
> une pièce**. Si c'est face, l'attaque fonctionne normalement. **Si c'est pile, l'attaque
> n'est pas lancée et le tour du joueur prend fin.**
> Remarque : les états **Endormi, Paralysé et Confus ne sont pas cumulables** avec d'autres
> États Spéciaux. Si l'un de ces États Spéciaux est appliqué, **il remplacera les autres.**

> Les Pokémon peuvent guérir des États Spéciaux lorsque […] :
> • Le Pokémon est placé sur le Banc. **Seuls les Pokémon Actifs peuvent être affectés par
> des États Spéciaux.** Si un Pokémon Actif retourne sur le Banc en battant en retraite ou
> autre, il guérit de tous ses États Spéciaux.
> • **Le Pokémon évolue.** Dans ce cas, il guérit de tous ses États Spéciaux.
> • L'effet d'une carte est utilisé.

### `08-tours-et-temps-imparti.png`

> **Le nombre de tours par combat est limité. Lorsque le nombre de tours maximum est atteint,
> le combat se solde par une égalité.**
> • **Temps imparti pour le combat** : […] une fois ce temps écoulé pour l'un des joueurs,
> **ce dernier perd le combat.**
> • **Temps imparti pour le tour** : […] si le temps imparti est écoulé, **le tour se termine
> automatiquement** […].
> • **Temps imparti durant le tour de l'adversaire** : […] une fois cette limite atteinte,
> vous ne pourrez plus faire de choix et **une décision aléatoire sera automatiquement prise
> par l'application.**

### `09-erreurs-de-connexion.png`

> […] Si votre connexion ne présente pas de problème et que votre adversaire ne parvient pas
> à revenir dans le combat dans le laps de temps prévu pour la reconnexion, **vous gagnez la
> partie.** Inversement, […] **vous perdez la partie.** […] Si la connexion Internet des deux
> adversaires est tellement instable que la liaison est interrompue, **le combat prend fin et
> les deux adversaires perdent la partie.** Si l'application reçoit une mise à jour pendant un
> combat, […] **celui-ci comptera comme une défaite pour les deux adversaires.**

## 3. Verdict, ligne par ligne contre `AGENTS.md` §4

| Ligne de `§4` | Capture | Verdict |
|---|---|---|
| main maximale **10 cartes** | `03` | ✅ **observé** |
| Rack **3 places** | `05` | ✅ **observé** |
| Évolution impossible au **premier tour de chaque joueur** | `05` | ✅ **observé** |
| Pression : le café n'est **pas consommé** | `05` | ✅ **observé** |
| Pression **1 par tour** | `05` | ✅ **observé** |
| Vulnérabilité **+20**, jamais au Banc | `05` | ✅ **observé** |
| Rotation : défausse autant de cafés que le coût, **n'importe quel type** | `05` | ✅ **observé** |
| Objet illimité / Collègue **1 par tour** | `05` | ✅ **observé** |
| Ordre des statuts **Surcharge → Épuisement → Sieste → Immobilisation** | `07` | ✅ **observé** |
| Statuts : effets (10 / 20 + pièce / pièce / 1 tour / pièce avant l'attaque) | `07` | ✅ **observé** |
| Défaite : 3 Interventions **ou** plus aucun Planqué | `06` | ✅ **observé** |
| **Qui choisit la relève** | `06` | ✅ **observé** — le joueur K.O. |
| Pioche vide : **pas de défaite** | `06` | ✅ **observé** |
| COMEX = **2 Interventions** | `06` | ✅ **observé** — « Pokémon avec un encadré Règle » |
| Premier joueur : ne peut pas attacher de café | `05` | ✅ cohérent (aucune Énergie générée) |
| **Premier joueur : « ne pioche pas »** | `05` | ⚠️ **§4 est faux** — seule l'Énergie est exceptée |
| **Statuts : « cumulables »** | `07` | ⚠️ **§4 est imprécis** — Sieste, Immobilisation et Dérive **s'excluent** |
| **Machine à café : « 1 attachement par tour »** | `05` | ⚠️ **à trancher** — le jeu écrit « autant que vous le souhaitez » |
| Machine à café : « pas de nouveau café si le slot du haut est occupé » | — | ❔ **non observé** |
| Main de départ **5 cartes** | `04` | ❔ **non observé** |
| Pas de reprise de poste | `04` | ❔ **par absence** |
| Types de café : jusqu'à **3**, ordre aléatoire | — | ❔ **non observé** — demande l'éditeur de deck |

## 4. Règles du jeu **absentes de `§4`** et désormais observées

| Règle observée | Capture |
|---|---|
| Le **premier joueur** est tiré au sort (pièce, face = premier) | `04` |
| **Aucune carte Récompense** dans ce jeu | `03` |
| **Pile de défausse visible** et consultable par les deux joueurs | `03` |
| Un **craquage simultané** rapporte un point **par** Planqué mis K.O. | `06` |
| Le **forfait** est une défaite, quel que soit le score | `06` |
| Seuls les Planqués **au Poste** portent un statut ; **Rack** et **évolution** les purgent | `07` |
| **Contrôle Pokémon** : étape après la fin de chaque tour, hors du tour des joueurs | `07` |
| Le joueur **dont le tour vient de finir** contrôle ses statuts **en premier** | `07` |
| **Limite de tours** → égalité ; **temps imparti** (combat = défaite, tour, tour adverse) | `08` |
| **Perte de connexion** : défaite simple ou double selon les cas | `09` |

## 5. Vocabulaire relevé dans l'app

| Notre terme (`§3.1`) | Terme officiel vu sur l'écran |
|---|---|
| Machine à café | **zone Énergie** |
| Poste | **Poste Actif** / **Pokémon Actif** |
| Rack | **Banc** / **Pokémon de Banc** |
| Rotation | **battre en retraite** / **Coût de Retraite** |
| Surcharge · Épuisement · Sieste · Immobilisation · Dérive | **Empoisonné · Brûlé · Endormi · Paralysé · Confus** |
| COMEX | **Pokémon avec un encadré Règle** |
| Vulnérabilité | **Faiblesse** |
| Rebut | **pile de défausse** |
| Lancer de tampon | **lance une pièce** (côté **face** / côté **pile**) |

## 6. Sources web complémentaires (fournies le 20/10/2026)

### « FAQ détaillée sur les combats » — support officiel

<https://app-ptcgpt.pokemon-support.com/hc/fr/sections/53604902813209>

C'est le **miroir web de l'entrée vue dans `01-menu-astuces.png`**. Elle contient 7 articles,
tous des **cas particuliers** (pas les règles de base) :

| Article |
|---|
| Effet de la carte Objet Robot Rafleur de la Team Rocket |
| Pourquoi je n'ai pas pu choisir un Pokémon en jeu avec l'effet de Marc ? |
| **Comment calculer la somme des dégâts subis par un Pokémon** (Faiblesse + effets) |
| Ordre des effets de fin de tour quand les deux joueurs en ont |
| Mimiqui-ex et le talent Fantômasque (×2) |
| **Points obtenus quand un Pokémon est défaussé par l'effet d'une carte** |

Deux d'entre eux recoupent des points déjà connus : le **calcul des dégâts** (ordre des
étapes, et le ×2 qui n'existe qu'avec le Lieu *Champ Barrière*) et l'**absence de points**
sur une défausse par effet — cohérent avec `06`.

### Articles et stratégies Pokémon.com

<https://www.pokemon.com/fr/articles/tous/content-products_vg-and-apps-product-names.pokemon-tcg-pocket>

**Constat honnête : cette page ne contient aucune règle.** C'est un index de **40 articles de
stratégie de deck** (« stratégie du deck Méga-Lucario-ex », etc.), du 15/07/2025 au
20/05/2026. Utile pour le contenu et le vocabulaire des cartes, **pas** pour trancher une
ligne de `§4`. La conclusion du `MIROIR-2026-DELTAS.md` §2 tient : le jeu **ne publie pas de
livre de règles web** — les règles vivent dans les **Astuces** de l'app, d'où ces captures.

## 7. Reste à capturer

- l'écran **d'édition du deck** (le nombre de **types d'Énergie** — plafond de 3, ticket #30) ;
- au besoin, une fiche de carte montrant **Faiblesse + 20** et **Retrait**.
