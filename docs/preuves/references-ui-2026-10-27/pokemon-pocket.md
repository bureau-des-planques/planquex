# Pokémon TCG Pocket — références d'interface et de fonctionnalités (état 2026)

- **Objet** : documenter les **écrans**, les **fonctionnalités** et le **quotidien** de l'application
  *Pokémon Trading Card Game Pocket* (Creatures Inc. / DeNA, éditeur The Pokémon Company), pour un
  projet qui en est le **miroir de règles** mais qui a **sa propre UI**.
- **Date de consultation de toutes les sources** : **27/10/2026**.
- **Niveau de preuve** : uniquement des sources **primaires** — support officiel
  (`support.pokemon.com`), site officiel du jeu (`tcgpocket.pokemon.com`, `pokemontcgpocket.com`),
  actualités éditeur (`pokemon.com/us/news`, `/features`, `/strategy`), fiche App Store de
  l'éditeur. **Aucun wiki communautaire, aucun blog tiers** n'est cité.
- **Ce que ce document n'est pas** : ce n'est **pas** une preuve de règle. Les règles de combat du
  projet restent celles d'`AGENTS.md` §4, adossées à `docs/preuves/astuces-2026-10-20/` et
  `docs/preuves/regles-2026-10-20/`. La §4 ci-dessous ne sert qu'à **situer**.
- **Livraison** : ce fichier est **rédigé dans le bac à sable**
  (`~/.local/share/opencode/sandbox/references-ui-2026-10-27/pokemon-pocket.md`) et **destiné** à
  `docs/preuves/references-ui-2026-10-27/pokemon-pocket.md`. Le dépôt est en lecture seule pour cet
  agent : la copie est à faire par la session appelante.
- **Limite majeure, à lire avant tout le reste** : l'éditeur **ne publie pas de description
  systématique de ses écrans**. Ce qui suit est donc reconstitué à partir de **procédures de
  navigation** citées dans les FAQ officielles (« Menu (bouton en bas à droite) > Autres >
  Paramètres > Langue »), des pages « Comment jouer » du site officiel, et de trois articles
  officiels datés (11/2024, 01/2025, et les FAQ de 2026). Les affirmations sont donc
  **localisées** : un écran
  dont j'ai la procédure est documenté ; un écran dont je n'ai que le nom est signalé comme tel.

---

## 1. UI et écrans

### 1.1 La barre du bas : des **positions** nommées par l'éditeur, pas une barre décrite

Les FAQ officielles donnent les **positions** des boutons, ce qui est la seule description
structurelle fiable dont on dispose. Elles nomment **quatre rôles** ; le **nombre total** de boutons
n'est pas documenté (une barre à quatre comme à cinq emplacements reste compatible avec ces textes).

| Bouton | Position (texte de la source) | Source |
|---|---|---|
| **Accueil** (`Home`) | « leftmost button at the bottom of the screen » / « bouton en bas à gauche de l'écran » | FAQ gameplay (30/07/2026) |
| **Collection** (`My Cards`) | « second button from the left at the bottom of the screen » / « le deuxième bouton en partant de la gauche, en bas de l'écran » | FAQ gameplay (30/07/2026) |
| **Communauté** (`Social Hub`) | « middle button at the bottom of the screen » / « le bouton du milieu en bas de l'écran » | FAQ échanges (08/09/2026), FAQ partage (12/05/2026) |
| **Menu** | « rightmost button at the bottom of the screen » / « bouton en bas à droite de l'écran » | FAQ gameplay (30/07/2026) |

Le **quatrième** rôle (deuxième en partant de la droite) n'est nommé dans aucune source
consultée : **non documenté**. Les captures internes du lot `docs/preuves/astuces-2026-10-20/`
montrent le menu tel qu'il est en jeu, mais elles ne sont pas une source primaire de l'éditeur.

### 1.2 Écran par écran

| Écran | Ce qui est montré | Où c'est placé | Information répétée ailleurs | Source |
|---|---|---|---|---|
| **Accueil** | La **jauge de vitalité Booster** (« pack stamina meter ») et le temps restant avant le prochain Booster ; l'entrée **Pause café / pioche miracle** (« Wonder Pick »), surmontée en campagne du bandeau « Coups d'œil disponibles ! » ; l'entrée **Boutique** ; un bouton **Missions** ; les icônes de **passe** ; l'**icône de profil** | Bas de l'écran, 1er bouton. Icône de profil : « bouton en haut au milieu de l'écran ». Icône de passe : « troisième bouton en partant de la droite, **en haut** de l'écran ». Bouton Missions : « partie inférieure droite de l'écran » | La vitalité Booster revient dans le bouton « Ouvrir 10 Boosters » (qui n'apparaît **que** quand elle est à zéro) ; l'icône de passe mène à son propre écran, où sont détaillés les avantages | Guide officiel de collection (25/11/2024) ; FAQ gameplay et FAQ achats (30/07/2026, 12/05/2026) |
| **Collection** (`My Cards`) | Les cartes possédées, avec un **Cartodex** ; un bouton de bascule du dex pour afficher les cartes **non possédées** (elles n'affichent alors que leur numéro) ; le **cœur de liste d'envies** ; trois onglets **en haut** : **Portfolios**, **Cadres expo**, **Decks** | 2e bouton du bas ; les trois onglets sont « en haut de l'écran » | La carte peut apparaître en plusieurs langues (bouton « en haut au milieu » sur la fiche) ; le nombre de cartes affichées baisse si des cartes sont passées en effets déco, échangées ou partagées | FAQ gameplay (30/07/2026) ; guide officiel (25/11/2024) |
| **Fiche de carte** | Données de la carte, **bouton liste d'envies en haut à droite**, bouton **en bas à droite** pour appliquer un effet déco (ornement ou combat), bouton du milieu en haut pour les langues | — | La liste d'envies apparaît aussi **sur le profil** (3 cartes), **sur l'écran d'échange**, **sur l'écran de partage** et **dans la pioche miracle** (icône cœur) | FAQ échanges (08/09/2026) ; guide officiel (25/11/2024) |
| **Deck** (Collection > Decks) | L'éditeur de deck : 20 cartes, max 2 par nom, au moins 1 Planqué de base ; le **choix manuel des types générés par la Zone d'énergie**, réglé **pendant l'édition du deck** ; les effets déco de combat | Onglet « Decks » de la Collection | Les decks d'emprunt (« rental decks ») et les decks thématiques vivent à côté ; les **Community Decks** (voir §2) sont annoncés pour fin octobre 2026 | Page stratégie éditeur (30/01/2025) ; lettre du producteur (15/10/2026) ; FAQ gameplay |
| **Sélection de Booster / ouverture** | Le choix du Booster, avec les **taux d'obtention** (« offering rates ») par Booster ; l'animation d'ouverture (glisser le doigt, le paquet se déchire, on fait glisser les cartes) ; les **points Booster** gagnés | Depuis l'Accueil | Le bouton **« Ouvrir 10 Boosters »** n'apparaît **que** vitalité à zéro ; le Booster **favori** est réinitialisé à chaque nouveau Booster | Guide officiel (25/11/2024) ; FAQ gameplay (30/07/2026) |
| **Pause café** (pioche miracle / Wonder Pick) | Une **liste de sélections** de cartes venant de paquets ouverts par des amis ou d'autres joueurs ; un **chrono** au-dessus de chaque sélection ; les sélections **expirées** en bas de liste ; l'**icône « deck »** en bas à gauche d'une carte déjà possédée ; le **cœur** des cartes en liste d'envies | Écran dédié, entrée sur l'Accueil | Même information « déjà possédée » que la Collection ; même liste d'envies que la fiche de carte | Guide officiel (25/11/2024) ; FAQ gameplay (30/07/2026) |
| **Combat** | Le plateau (Poste, Banc), la **Zone d'énergie**, les **points** (3 pour gagner) ; un mode **auto-combat** activable **pendant** le combat ; un bouton **Guide** (deux thèmes : « For New Players », « For Advanced Players ») | Bouton Guide : « sur l'écran de combat » | Les règles sont consultables ailleurs : « Astuces » et l'icône **« ? » en haut à droite** de « divers écrans » | Page « バトルしよう！ » du site officiel ; guide officiel (25/11/2024) ; FAQ gameplay (30/07/2026) |
| **Boutique** | L'échange de **tickets Boutique** contre des cartes Dresseur ; un stock **limité** de Sabliers Booster et Sabliers Miracles **renouvelé chaque mois** ; l'achat de **Poké Lingots** ; l'onglet **Premium** (dans « Durée limitée / Évènements ») | Depuis l'Accueil > Boutique | Les Sabliers sont aussi des récompenses de missions et de combats par palier ; les Poké Lingots apparaissent dans « Objets » | Guide officiel (25/11/2024) ; FAQ achats (12/05/2026) |
| **Missions** | Les missions et leurs récompenses à réclamer ; un onglet **Premium**, atteint en **balayant vers la gauche** | Depuis l'Accueil > Missions (bouton en bas à droite) | La période de disponibilité des récompenses est rappelée deux fois dans la même FAQ (missions normales, missions quotidiennes) | FAQ achats (12/05/2026) ; FAQ gameplay (30/07/2026) |
| **Profil** | Le **pseudonyme** (modifiable, verrouillé 30 jours), la **liste d'envies** (3 cartes visibles), les **Portfolios / Cadres expo** publics ou privés | Accueil > icône de profil (haut milieu) > appui sur le pseudonyme | Les 3 cartes de liste d'envies s'affichent **aussi** sur l'écran d'échange et l'écran de partage | FAQ gameplay (30/07/2026) ; FAQ échanges (08/09/2026) ; FAQ partage (12/05/2026) |
| **Menu / Autres** | Les réglages : **Langue**, **Échange** (suspendre les offres), **Pause café** (partager ses Boosters), **Compte** (comptes liés) | Menu (bas droite) > Autres > Paramètres / Compte | — | FAQ gameplay, FAQ échanges, FAQ partage, FAQ achats |
| **Communauté** (`Social Hub`) | **Échange**, **Partage**, et leurs **historiques** (30 opérations sur 90 jours) | 3e bouton du bas | Les historiques sont la réponse officielle à « pourquoi ai-je moins de cartes ? » | FAQ échanges (08/09/2026) ; FAQ partage (12/05/2026) |
| **Matchs classés** | Les points de classement, le rang, les **récompenses de saison**, un bouton **« ? »** en haut à droite menant à « Détails de l'évènement », « Actualités », « Historique de combat » ; un bouton **« Rafraîchir »** (une fois par heure) | Écran dédié | Les règles de saison sont **aussi** dans les Actualités du jeu | FAQ gameplay (30/07/2026) |
| **Cadeaux** (`Gifts`) | Les objets **non réclamés**, l'onglet **« Déjà récupérés »**, la période de disponibilité | Accueil > Cadeaux | Les objets bonus d'un achat y arrivent aussi | FAQ gameplay (30/07/2026) ; FAQ achats (12/05/2026) |
| **Actualités** (`News`) | Les annonces du jeu ; **les images de cartes y sont toujours en anglais**, quelle que soit la langue choisie | En jeu | — | FAQ gameplay (30/07/2026) |
| **Astuces** (`Tips`) | Les règles de combat, et les « Astuces » proprement dites | **Menu (bouton en bas à droite) > Astuces / « Game Tips » > À propos des règles de combat** | Le support renvoie explicitement vers elles au lieu de publier les règles | FAQ gameplay (30/07/2026) ; article JA « バトルのルールを知りたい » (S16) |

### 1.3 Ce qui est **répété** — et pourquoi c'est un fait, pas une impression

Trois répétitions sont **documentées** par les procédures officielles, donc utilisables :

1. **L'état de vitalité Booster** pilote **deux** éléments : la jauge de l'Accueil et l'apparition du
   bouton « Ouvrir 10 Boosters », qui n'existe qu'à zéro.
   <https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ>
2. **La liste d'envies (max 40 cartes)** est visible à **quatre** endroits nommés — fiche de carte,
   profil (3 cartes), écran d'échange, écran de partage — et signalée par un cœur, en cinquième, sur
   les cartes proposées en pioche miracle.
   <https://support.pokemon.com/hc/en-us/articles/34322874608660-Pok%C3%A9mon-TCG-Pocket-Trading-FAQ>
3. **L'icône « ? » en haut à droite** est un motif générique, présent sur « divers écrans », et
   c'est le renvoi officiel vers les règles.
   <https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ>

À l'inverse, l'affirmation « la même information est répétée partout » **ne peut pas** être faite :
aucune source ne décrit la composition complète d'un écran. Le reste est **non documenté**.

---

## 2. Fonctionnalités

| Fonctionnalité | Ce qu'elle fait, selon la source | Dépend de la monétisation ? | Dépend du social ? |
|---|---|---|---|
| **Ouverture de paquets** | **Deux Boosters par jour** gratuits ; chaque Booster d'une extension a **son propre pool** de cartes (vérifiable via les taux d'obtention) | **Non** pour les deux quotidiens ; **oui** pour l'accélération (Sabliers, Poké Lingots) | Non |
| **Points Booster** | Gagnés en consommant de la vitalité ; **n'expirent pas** ; valables **sur une seule extension** ; échangeables contre des cartes de cette extension | Non (gagnés gratuitement) — mais c'est un **levier d'économie** | Non |
| **Pause café** (Wonder Pick) | Prendre **une** carte parmi les 5 d'un paquet ouvert par un ami ou un autre joueur ; les cartes retournées sont mélangées ; une sélection choisie **disparaît** ; le propriétaire **garde** ses cartes ; on peut **remercier** l'auteur (tickets Boutique pour les deux) | Non pour la vitalité miracle ; **oui** pour Sabliers miracles, Poké Lingots et Rembobinateurs | **Oui, par construction** : la matière vient des ouvertures des autres |
| **Échanges** | Amis **uniquement** ; débloqué **14 jours après le début du jeu** ; **une** transaction à la fois ; cartes de **même rareté** (et mêmes effets déco / cadre d'or) ; coût en **« shinedust »** selon la rareté (terme EN de la FAQ ; libellé FR **non documenté**) ; **vitalité d'échange** ; historique 30 / 90 jours | Partiellement (vitalité d'échange, **shinedust**) | **Oui** (amis obligatoires) |
| **Partage** | Donner **une** carte de rareté 1–4 losanges à un ami ; débloqué **14 jours** après le début ; **une carte reçue par jour** et par joueur ; réglage « Partager mes Boosters » | Non | **Oui** |
| **Missions** | Missions quotidiennes (récompense réclamable **une fois par jour**), missions d'évènement, **missions Premium** ; les récompenses non réclamées **expirent** | **Non** pour les missions de base ; **oui** pour les Premium | Non |
| **Boutique** | Cartes Dresseur contre tickets ; Sabliers en stock mensuel ; Poké Lingots (argent réel) ; onglet Premium | **Oui, entièrement** | Non |
| **Abonnement** (Premium Pass) | Service payant **mensuel** ; **+1 Booster toutes les 24 h** ; missions Premium ; tickets premium ; **essai gratuit de 14 jours** ; privilèges liés au compte Apple/Google, pas à la sauvegarde | **Oui, entièrement** | Non |
| **Collection** | Cartodex, vues « possédées / non possédées », cartes multilingues, **effets déco** (ornement et combat), **cadre d'or** réservé aux 1–3 losanges (pas aux brillantes parallèles, 4 losanges et plus, ni promo) | Les effets déco consomment des cartes + des objets (économie), mais la collection **existe sans** | Non, sauf le partage des Portfolios |
| **Decks** | 20 cartes, max 2 par nom, ≥ 1 Planqué de base ; **decks d'emprunt** (usages limités, **interdits en versus** — jusqu'à la mise à jour annoncée) ; decks thématiques ; **codes motif 2D** ; **Community Decks** annoncés | Non | Les Community Decks, oui |
| **Combat** | Solo (ordinateur), **combats par palier** (« step-up battles »), versus, **matchs classés** (débloqués au **niveau de joueur 3**) ; **auto-combat** ; forfait | Non — mais des **combats évènement** consomment de la vitalité évènement (Sabliers évènement, Poké Lingots) | Oui pour le versus et le classement |
| **Progression** | **Niveau de joueur** (EXP) ; les montées de niveau donnent des **Rembobinateurs** ; saisons de classement avec récompenses | Non — **aucune source** ne documente un achat d'EXP | Le classement, oui |
| **Cosmétiques** | Effets déco, protège-deck, tapis de jeu, pièces, Portfolios, Cadres expo | **Oui** (Boutique, tickets premium) | Le partage, oui |
| **Réseau social de jeu** | Amis, remerciements, liste d'envies partagée, Portfolios publics | Non | **Oui** |
| **Réglages / compte** | Langue (9 langues), liaison de compte (Nintendo/Apple/Google), suspension des offres d'échange, partage des Boosters | Non | Non |
| **Actualités / Cadeaux** | Annonces en jeu ; cadeaux à réclamer avec fenêtre de validité | Non | Non |

Évolutions **annoncées** (lettre du producteur, 15/10/2026 — « under development », donc **pas encore
en jeu** au 27/10/2026) : cycle de Booster porté d'environ **4 semaines à 6 semaines** ; **Special
Pack: First Partners** avec une **vitalité hebdomadaire** ; cartes **immersives en récompense de
mission** ; **cartes promo ★1** par missions hebdomadaires (3 semaines) ; **Community Decks** ;
**decks d'emprunt sans limite d'usage et autorisés en versus** ; **combats évènement à restrictions
de cartes** ; améliorations d'échange et de partage (voir la dex du partenaire, repérer sa liste
d'envies).

---

## 3. Fonctionnement — le quotidien du joueur

| Point | Valeur documentée | Source |
|---|---|---|
| Paquets gratuits | **2 par jour** | site officiel EN ; fiche App Store |
| Rythme de la vitalité Booster | **un Booster toutes les 12 heures**, au choix du joueur parmi les Boosters de l'extension | guide officiel (25/11/2024) |
| Accélération | **Sabliers Booster** (récompenses de missions, etc.) puis **Poké Lingots** | guide officiel ; FAQ gameplay |
| Plafond quotidien des Poké Lingots | **720 Poké Lingots par jour** pour réduire l'attente des Boosters ; remise à zéro à **06:00 UTC** | FAQ gameplay (30/07/2026) |
| Plafond de stock des Poké Lingots | **3 600** | FAQ achats (12/05/2026) |
| Ouverture en série | Le bouton **« Ouvrir 10 Boosters »** n'apparaît **que** quand la vitalité est à zéro | FAQ gameplay (30/07/2026) |
| Vitalité miracle | **1 unité toutes les 12 heures** ; une sélection rare coûte **plus** | guide officiel (25/11/2024) |
| Rembobinateurs | Rend possible une pioche miracle **expirée** ; **inutilisable** sur un paquet déjà pioché ; donnés aux montées de niveau | guide officiel ; FAQ gameplay |
| Changement de date | **06:00 UTC** ; ne peut pas être avancé en changeant l'heure de l'appareil | FAQ gameplay (30/07/2026) |
| Missions quotidiennes | Récompense réclamable **une fois par jour** ; non réclamée = perdue au changement de date | FAQ gameplay (30/07/2026) |
| Partage | **1 carte reçue par jour** et par joueur ; débloqué à **J+14** | FAQ partage (12/05/2026) |
| Échange | Débloqué à **J+14** ; **vitalité d'échange** restaurée si l'échange est annulé | FAQ échanges (08/09/2026) |
| Passe premium | **+1 Booster / 24 h** ; validité **1 mois** ; essai **14 jours** ; prix historique **9,99 $/mois** (chiffre de **novembre 2024**, non reconfirmé depuis) | FAQ achats ; guide officiel (25/11/2024) |
| Renouvellement boutique | Stock de Sabliers **mensuel** ; mises à jour des missions Premium **indépendantes** du renouvellement du passe | guide officiel ; FAQ achats |
| Classement | Saison ; égalité = **aucun** changement de points mais **série de victoires remise à zéro** ; bonus de série plafonné à **5 victoires** ; rafraîchissement **1×/heure** | FAQ gameplay (30/07/2026) |
| Déconnexion en versus | Fenêtre de reconnexion d'environ **120 secondes**, sinon défaite | FAQ gameplay (30/07/2026) |
| Ce qui est **payant** | Poké Lingots et Passe premium ; le jeu lui-même est « free to start » | FAQ gameplay ; page officielle « Free-to-start; optional in-game purchases » |

**Ce qui est gratuit** : les 2 Boosters quotidiens, la vitalité miracle, les missions de base, les
cartes Dresseur contre tickets Boutique, les decks d'emprunt, le combat solo, la collection, les
réglages. **Ce qui achète du temps** : Poké Lingots → Sabliers/Rembobinateurs, et le passe premium →
un Booster de plus par jour.

---

## 4. Règles (situation)

Uniquement pour situer. **Le projet suit déjà ces règles** ; rien ici n'est à implémenter.

- **Objectif** : **3 points** ; un craquage rapporte un point (le COMEX en rapporte deux, cf.
  `AGENTS.md` §4 — **non redocumenté** sur le web officiel).
- **Deck** : **20 cartes**, **max 2** exemplaires du même nom, **au moins 1 Planqué de base** ;
  perdre son dernier Planqué en jeu = défaite immédiate.
  <https://www.pokemon.com/us/strategy/learn-how-to-build-a-deck-in-pokemon-tcg-pocket>
- **Énergie** : pas de cartes Énergie dans le deck ; la **Zone d'énergie** fournit **une énergie par
  tour**, que le joueur attache où il veut ; par défaut elle fournit **les types exigés** par les
  attaques du deck, et le joueur peut **choisir manuellement** les types générés **en éditant le
  deck**. La source ne donne **aucun plafond** de types → le plafond de **3 types** relève de
  `docs/preuves/regles-2026-10-20/`, pas d'une source web primaire.
- **Mise en place** : Banc, préparation par les cartes Dresseur, puis attaque (« Pression » dans nos
  termes) ; « auto-combat » disponible en cours de partie.
  <https://www.pokemontcgpocket.com/ja/howtoplay/battle/>

---

## 5. Ce qui tient sans monétisation

Le projet a rangé hors périmètre : économie, boutique, missions, succès, échanges, amis, cotisation,
classement, notifications, anglais. Voici, fonctionnalité par fonctionnalité, **ce qui survit** à ce
retrait, et **pourquoi**.

### 5.1 Tient sans monétisation **et** sans social (le socle reprenable)

| Fonctionnalité | Ce qu'on garde | Ce qu'on jette |
|---|---|---|
| Ouverture de paquets | **2 Boosters/jour** + un **minuteur** lisible et une jauge sur l'accueil | Sabliers, Poké Lingots, « Ouvrir 10 Boosters » (il suppose un stock) |
| Points Booster | Le principe « ouvrir donne des points, les points achètent une carte précise de l'extension » — **entièrement gratuit** dans le jeu d'origine | Le plafond d'extension (il suppose un catalogue multi-extensions) |
| Collection | Cartodex, vue possédées/non possédées, fiche de carte, cartes en plusieurs langues | Effets déco, cadre d'or, Portfolios, Cadres expo (cosmétiques payants ou sociaux) |
| Decks | Éditeur 20 cartes, choix des types d'énergie **à l'édition**, decks thématiques | Community Decks, codes de partage |
| Combat | Solo contre l'ordinateur, auto-combat, écran de règles accessible par « ? » | Combats par palier avec vitalité d'évènement, versus, classement |
| Réglages | Langue (le français existe), liaison de compte | Réglages propres aux fonctions sociales (offres d'échange, partage des Boosters) |
| Astuces | Un écran de règles **dans** le jeu — l'éditeur lui-même renvoie vers lui plutôt que vers le web | — |
| Actualités | Un flux d'annonces | — |

### 5.2 Tient **sans monétisation mais pas sans social**

| Fonctionnalité | Pourquoi elle dépend du social | Ce qu'on peut en garder sans amis |
|---|---|---|
| **Pause café** | Sa matière est l'ouverture **d'un autre joueur** — pas seulement d'un ami : la source dit « vos amis **et d'autres joueurs** » | Rien : sans autres joueurs, il n'y a pas de sélection à piocher. Un substitut (pioche miracle « locale », ou Pause café désactivée au lancement) est un **choix de conception**, pas une reprise |
| Échanges | Amis **obligatoires**, J+14, même rareté | Rien |
| Partage | Amis, 1 carte/jour | Rien |
| Classement | Saisons, autres joueurs, rang | Rien |
| Community Decks / Portfolios publics | Contenu d'autres joueurs | Les decks thématiques fournis par le jeu |

### 5.3 Dépend de la monétisation — donc **hors périmètre** par construction

- **Boutique** (tickets, Sabliers en stock mensuel, Poké Lingots, onglet Premium).
- **Passe premium** (abonnement, missions premium, +1 Booster/24 h, tickets premium, essai 14 jours).
- **Monnaie payante** et ses plafonds (3 600 Poké Lingots, 720/jour).
- **Cosmétiques achetés** (protège-deck, tapis, pièces, effets déco).
- **Économie de ressources** qui existe pour réguler ces achats : vitalité d'échange, **shinedust**,
  Rembobinateurs, vitalité d'évènement.

### 5.4 Le cas limite à connaître

**Missions et progression.** La mission quotidienne n'est **pas** monétisée en soi, mais dans le jeu
d'origine elle est le **robinet** qui alimente l'économie (Sabliers, tickets). Reprendre l'écran
« Missions » sans la Boutique qui consomme ses récompenses donne un écran qui **distribue dans le
vide**. Le projet l'a donc rangé hors périmètre : c'est cohérent, et ce document ne propose pas de
le rouvrir.

---

## 6. Sources

| # | URL | Ce que la source dit (et sa date) |
|---|---|---|
| S1 | <https://tcgpocket.pokemon.com/en-us/> | Site officiel EN. « open two booster packs every day at no cost » ; « Free-to-start; optional in-game purchases available » ; jeu par Creatures Inc. et DeNA ; cartes immersives. Page **sans date** (contenu de lancement, © 2024). |
| S2 | <https://www.pokemontcgpocket.com/ja/howtoplay/battle/> | Page « Comment jouer — Combattre » (JA). Deck de **20 cartes** ; énergie fournie par la **Zone d'énergie** ; **3 points** pour gagner ; **auto-combat**, **decks d'emprunt**, **composition automatique** ; protège-deck, tapis, pièces, effets déco. |
| S3 | <https://www.pokemontcgpocket.com/ja/howtoplay/> | Index « Comment jouer » : trois entrées — *collecter des cartes*, *profiter de la collection*, *combattre*. |
| S4 | <https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ> | **FAQ gameplay, mise à jour 30/07/2026.** Navigation exacte (Accueil 1er bouton, Collection 2e, Menu dernier, profil haut milieu, onglets Collection en haut, Communauté au milieu, profil de passe 3e en partant de la droite **en haut**) ; date à **06:00 UTC** ; langues ; pseudonyme verrouillé 30 j ; **« Ouvrir 10 Boosters » seulement à vitalité zéro** ; **720 Poké Lingots/jour** ; points Booster par extension et sans expiration ; récompenses de mission périssables ; usages des effets déco ; langues des cartes ; reconnexion **~120 s** ; matchs classés (niveau 3, égalité, série plafonnée à 5, rafraîchissement 1×/h) ; campagnes **coup d'œil** ; cadres d'or (1–3 losanges seulement). |
| S5 | <https://support.pokemon.com/hc/fr/articles/30330309361172-JCC-Pok%C3%A9mon-Pocket-FAQ-gameplay> | **Même FAQ en français, 30/07/2026.** Vocabulaire d'interface : *menu principal, Autres, Paramètres, Langue, Collection, Communauté, Portfolios, Cadres expo, Decks, Cartodex, pioche miracle, Rembobinateur, Poké Lingots, Sabliers Booster / Miracles / Évènement, vitalité Booster, points Booster, Boutique, Cadeaux, Actualités, Matchs classés, decks d'emprunt, effets déco, cadre d'or, ticket avenir*. |
| S6 | <https://support.pokemon.com/hc/en-us/articles/30331739144596-Pok%C3%A9mon-TCG-Pocket-Purchase-and-Premium-Pass-FAQ> | **FAQ achats et passe premium, 12/05/2026.** Boutique : Accueil > Boutique > Acheter des Poké Lingots > (i) > Finaliser l'achat ; **max 3 600 Poké Lingots** ; passe = service payant mensuel, écran via l'icône de passe (3e en partant de la droite, en haut) ; **missions Premium** via Accueil > Missions (bas droite) > Premium (balayer à gauche) ; onglet **Premium** dans Boutique > Durée limitée / Évènements ; validité 1 mois ; **essai 14 jours** ; privilèges liés au compte Apple/Google, **60 jours** avant nouveau transfert. |
| S7 | <https://support.pokemon.com/hc/en-us/articles/34322874608660-Pok%C3%A9mon-TCG-Pocket-Trading-FAQ> | **FAQ échanges, 08/09/2026.** Amis uniquement ; déblocage à **J+14** ; une transaction à la fois ; suspension des offres via Menu > Autres > Paramètres > Échange ; **même rareté** exigée (+ effets déco / cadre d'or) ; **shinedust** selon rareté (libellé FR **non documenté**) ; vitalité d'échange rendue si annulation ; historique **30 / 90 jours** ; **liste d'envies max 40**, **3 cartes** visibles sur le profil, l'écran d'échange et l'écran de partage. |
| S8 | <https://support.pokemon.com/hc/en-us/articles/30332621133204-Pok%C3%A9mon-TCG-Pocket-Sharing-and-Social-FAQ> | **FAQ partage et social, 12/05/2026.** Partage débloqué à **J+14** ; **1 carte reçue par jour** ; historique 30 partages / 90 jours ; Cadeaux : 100 objets / 30 jours ; réglage « Partager mes Boosters » via Menu > Autres > Paramètres > Pause café ; un paquet d'ami **peut** apparaître en pioche miracle, pas toujours ; remerciement non annulable ; visibilité des Portfolios (public / privé / amis). |
| S9 | <https://support.pokemon.com/hc/en-us/articles/38906248102292-Pok%C3%A9mon-TCG-Pocket-Battle-Rules-FAQ> | **FAQ règles de combat** : uniquement des interactions de cartes précises, **pas** les règles de base. Confirme que le web officiel **ne publie pas** les règles de base. |
| S10 | <https://www.pokemon.com/us/features/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket> | **Guide officiel de collection, 25/11/2024.** Booster **toutes les 12 h** ; jauge de vitalité sur l'accueil ; Sabliers et Poké Lingots ; pools par Booster et taux d'obtention ; points Booster ; écran **Guide** sur l'écran de combat (For New Players / For Advanced Players) ; max 2 cartes du même nom ; effets déco ; **Pause café** (5 cartes retournées et mélangées, une seule choisie, sélection consommée, le propriétaire garde ses cartes, remerciement = tickets Boutique) ; **vitalité miracle 1 / 12 h** ; liste d'envies (cœur) ; sélections **expirées** + **Rembobinateurs** ; raretés 1–4 losanges, 1–3 étoiles, couronne ; **Boutique** (tickets, stock mensuel, Poké Lingots, **passe premium 9,99 $/mois → +1 Booster/24 h**, missions premium) ; mode de défaite (« plus qu'un seul Planqué → défaite »). |
| S11 | <https://www.pokemon.com/us/strategy/learn-how-to-build-a-deck-in-pokemon-tcg-pocket> | **Page stratégie éditeur, 30/01/2025.** Deck **20 cartes**, max 2 par nom, ≥ 1 Planqué de base ; **3 points** pour gagner ; pas de cartes Énergie, **1 énergie/tour** par la Zone d'énergie ; types générés **choisis manuellement à l'édition du deck** ; aucun **plafond de types** mentionné. |
| S12 | <https://www.pokemon.com/us/news/read-the-pokemon-tcg-pocket-october-2026-producer-letter> | **Lettre du producteur, 15/10/2026.** Cycle de Booster **~4 → ~6 semaines** ; **Special Pack: First Partners** avec **vitalité hebdomadaire** ; **immersives en récompense de mission** ; **promo ★1** hebdomadaires (3 semaines) ; **Community Decks** ; **decks d'emprunt illimités et autorisés en versus** ; **combats évènement à restrictions** ; améliorations d'échange et de partage. Tout est annoncé **« under development »** : **pas encore en jeu** au 27/10/2026. |
| S13 | <https://apps.apple.com/us/app/pok%C3%A9mon-tcg-pocket/id6479970832> | **Fiche App Store de l'éditeur (v1.7.5, « Sep 29 », année non affichée).** « two booster packs available to open every day » ; partage d'une carte 1–4 losanges entre amis ; échanges (dont 2 étoiles, Shiny 1, Shiny 2) ; Portfolios et Cadres expo publics ; **matchs classés** ; « Free · In-App Purchases ». |
| S14 | `docs/preuves/astuces-2026-10-20/` (interne) | Le menu **Astuces** tel qu'il apparaît en jeu et sa transcription mot pour mot — utilisé **uniquement** pour situer le renvoi « Astuces » de S4, pas comme source primaire. |
| S15 | `docs/preuves/regles-2026-10-20/` (interne) | Établit ce que le web officiel **ne publie pas** (dont le plafond de **3 types** d'énergie). Sert de garde-fou : ce document ne prétend pas le re-sourcer. |
| S16 | <https://app-ptcgp.pokemon-support.com/hc/ja/articles/61745874022553> | **Article officiel JA « バトルのルールを知りたい » (« Je veux connaître les règles de combat »).** Donne la navigation exacte : « メニュー（画面最下部の右端のボタン） ＞ ゲームのヒント ＞ バトルのルールについて » — **Menu (bouton le plus à droite en bas de l'écran) > Astuces de jeu > À propos des règles de combat**. Confirme que le bouton **Menu** est le plus à droite et que les règles vivent **dans l'app**, pas sur le web. |

---

## 7. Sources non trouvées

Points demandés **sans source primaire** au 27/10/2026. Rien n'a été comblé par un wiki.

| Point | Statut |
|---|---|
| **Le bouton de barre non nommé** (2e en partant de la droite) | **Non documenté.** Les quatre rôles cités (Accueil, Collection, Communauté, Menu) le sont textuellement par les FAQ ; le nombre total de boutons ne l'est pas. |
| **Composition complète d'un écran** (nombre de zones, ordre vertical, ce qui est en haut / en bas au-delà des éléments nommés) | **Non documenté.** Aucune source éditeur ne décrit un écran entier ; les FAQ ne citent que les éléments utiles à une procédure. |
| **Liste et contenu des missions quotidiennes** (lesquelles, combien) | **Non documenté** sur le web officiel. Seules leurs **règles de réclamation** le sont. |
| **Contenu, prix et rotation de la Boutique** | **Non documenté** au-delà de « stock mensuel de Sabliers », « tickets Boutique → cartes Dresseur » et l'existence de l'onglet Premium. |
| **Prix actuel du passe premium en 2026** | **Non documenté.** Le seul chiffre publié (9,99 $/mois) date du **25/11/2024** (S10). |
| **Écran d'accueil : ordre exact des vignettes** | **Non documenté.** On sait que la vitalité Booster, la pioche miracle, la Boutique, les Missions et les Cadeaux sont accessibles depuis l'Accueil, pas dans quel ordre. |
| **Détail de l'écran de combat** (disposition du plateau, de la main, de la piste de points) | **Non documenté** par l'éditeur. Les captures de `docs/preuves/combat-ui-*` documentent **notre** écran, pas le sien. |
| **Écran de résultat de combat** | **Mentionné** (FAQ gameplay : « si vous ne voyez pas l'écran de résultat ») mais **non décrit**. |
| **Écran de niveau / EXP** | **Non documenté.** On sait seulement que le niveau 3 débloque les combats, et que les montées de niveau donnent des Rembobinateurs. |
| **Notifications** | **Non documenté** sur le web officiel. |
| **Nombre maximal de decks / Portfolios / Cadres expo** | **Non documenté.** La FAQ dit seulement qu'il **ne peut pas être augmenté**. |
| **Version de l'application en français** | **Non documentée** séparément : la fiche App Store consultée est celle du Store US (v1.7.5, « Sep 29 »), et les libellés FR viennent de S5, pas d'une capture. |

---

## 8. Ce que ce lot ne prouve pas

- Il **ne prouve aucune règle de combat** : la §4 est une mise en situation, et le plafond de
  3 types d'énergie n'a **pas** de source primaire web (voir §7 et S15).
- Il **ne décrit pas fidèlement les écrans** au pixel : il décrit ce que les procédures officielles
  et les pages « Comment jouer » **nomment**. Pour la composition visuelle, la seule preuve
  acceptable reste une **capture datée** (`docs/CAPTURES-UI.md`, lot `ui-<AAAA-MM-JJ>/`).
- Les chiffres **temporels** (12 h, 24 h, 720/jour, 3 600) viennent de pages datées : la FAQ de
  2026 pour les plafonds et la date de bascule, le guide de **novembre 2024** pour les 12 h. Une
  évolution entre les deux n'est **pas** exclue ; elle n'est simplement **pas documentée**.
