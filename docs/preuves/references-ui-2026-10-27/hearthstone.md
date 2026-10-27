# Hearthstone — UI, parcours et accessibilité (recherche documentaire)

- **Date de la recherche** : 27/10/2026 — toutes les URL **citées comme source** ont été
  ouvertes ce jour-là ; celles qui ne répondaient pas sont listées en §7, avec l'erreur exacte.
- **Objet** : idées d'**UI et de parcours** pour un jeu de cartes en PWA. **Pas** des règles de jeu.
- **Périmètre des sources** : sites et forums **officiels Blizzard** uniquement
  (`hearthstone.blizzard.com`, `playhearthstone.com`, `news.blizzard.com`,
  `us.forums.blizzard.com`). Aucun wiki communautaire, aucun blog tiers n'est utilisé comme
  preuve ; là où un fait ne vient que de joueurs, c'est écrit « rapport de joueur ».
- **Lot** : `references-ui-2026-10-27/`. Il ne rentre dans aucune des catégories décrites par
  `docs/preuves/README.md` (qui liste `astuces-*`, `ui-*`, `regles-*`, `finition-*`,
  `combat-ui-*`, …) : c'est un lot de **recherche documentaire sur un jeu tiers**, sans capture.
  À ranger dans le tableau du README si le lot est conservé.

**Résumé honnête avant lecture** : l'UI et le parcours de Hearthstone sont documentés par
Blizzard par **morceaux** (notes de version, articles de blog, chaînes d'interface du site
officiel). L'**accessibilité**, en revanche, n'a **aucune page officielle dédiée** : c'est le
point où il y a le plus de « non documenté », et c'est un résultat en soi (§3).

---

## 1. UI et écrans

### 1.1 La carte des écrans : un « Journal » qui sert de hub

Le **Journal** remplace le journal de quêtes sur le menu principal. Blizzard l'a annoncé en
2020 en ces termes : « You'll be able to access each of these pages by clicking on a new
Journal icon that will replace the Quest Log on the main menu »
([Revamping Progression & Rewards in Hearthstone](https://playhearthstone.com/en-us/blog/23534414/), 22/10/2020).
Les quatre pages d'origine : **Achievements**, **Rewards Track** (piste de récompenses),
**Quests** (quotidiennes, hebdomadaires, légendaires) et **Profile**
(même source).

En 2026, le Journal est devenu le hub de toute l'extension. La note de version 37.0 en donne le
tour guidé officiel, onglet par onglet
([37.0 Patch Notes](https://hearthstone.blizzard.com/en-us/news/24301454), 12/10/2026) :

| Onglet | Ce que Blizzard en dit |
|---|---|
| **Journey** | « Follow the expansion story by watching voiced vignettes and reading lore. » |
| **Quests** | « Complete Journey Quests to progress and earn rewards. » |
| **Rewards** | « Collect rewards from your Journey and expansion activities. » |
| **Feats** | « Achievements are now known as Feats. New name, same great challenges and rewards. » |
| **Profile** | « View your progression and account details. » |
| **Bookmarks** | « Access events, Tavern Brawls, and other limited-time experiences. Use "Go To" to open the experience. » |

Le même article précise la phrase qui compte pour une PWA : « Everything tied to this expansion
lives in the Journal » (même URL). Autrement dit, **un seul point d'entrée, des onglets à
l'intérieur**, et non une constellation d'icônes sur l'accueil.

### 1.2 Le profil

Le contenu de la page Profil est documenté deux fois, à cinq ans d'écart :

- 2020 : rang Standard et Wild, note Battlegrounds, note Duels, **total de victoires en Arena**,
  niveau et victoires par classe, prochaine récompense de carte, progression vers le portrait
  doré ([Revamping Progression & Rewards](https://playhearthstone.com/en-us/blog/23534414/), 22/10/2020).
- 2021 : « Updated the Player Profile to display total wins for each game mode »
  ([20.4 Patch Notes](https://playhearthstone.com/en-us/blog/23676205/), 02/06/2021).

C'est une page **de statut, pas d'action** : rien à y faire, tout à y lire.

### 1.3 La boutique : la densité traitée par des onglets

Le seul passage où Blizzard explique **comment il réduit la densité d'un écran** est la refonte
de la boutique de la 28.2
([28.2 Patch Notes](https://playhearthstone.com/en-us/blog/24008697/), 04/12/2023) :

> « Now, shop categories are broken down into tabs and sub-tabs to reduce scrolling. There are
> main tabs on the left side for Featured items (like current best-value bundles), Hearthstone
> items, Battlegrounds items, Modes items (like Tavern Tickets), and Runestones. Some of these
> main tabs also have sub-tabs across the top to make further navigation easier! »

Trois mécanismes de lecture, dans la même phrase :

1. **onglets principaux à gauche** (= catégories stables),
2. **sous-onglets en haut** (= sous-catégories),
3. **zoom sur place** : « select the bundled product and click or tap on the part of the
   product image you want to zoom in on » (même URL).

Et un détail d'UI réutilisable : les skins à voix ont « a speech bubble button for you to preview
them » (même URL) — l'aperçu sonore est **derrière un clic**, pas joué automatiquement.

### 1.4 L'ouverture de paquets : un geste, pas un menu

L'ouverture de paquets en masse est décrite comme une **interaction physique**, pas comme un
formulaire
([Introducing Mass Pack Opening](https://news.blizzard.com/en-us/article/23999067/introducing-mass-pack-opening-the-new-way-to-open-your-pre-purchase-bundles), 06/09/2023) :

> « grab a pack from your stack and hold the pack over the stack. It will charge up with energy
> and start adding packs to your opening. Once you've gathered all the packs you want, move over
> to the pack-opening area and release your stack of packs. »

Puis l'écran de résultat est **progressif** : « The interface will then show you some highlights
from your packs, which you can reveal one by one or all at the same time, and then it will give
you a full summary of all the cards opened in that pack stack » (même URL). Seuil : « If you
have 5 or more of the same type of pack, you'll be able to open up to 40 of them at once »
(même URL).

Leçon transposable : **le résumé arrive après les temps forts**, et le joueur choisit le rythme
(« one by one or all at the same time »).

### 1.5 Ce qui est permanent, ce qui est derrière un clic

Reconstitué uniquement à partir des sources ci-dessus :

| Toujours visible | Derrière un clic |
|---|---|
| Le **Journal** comme icône du menu principal (2020, `23534414`) | Les six onglets du Journal (2026, `24301454`) |
| Les **onglets principaux** de la boutique (2023, `24008697`) | Les sous-onglets, le zoom produit, l'aperçu vocal (même source) |
| Le **bouton Copy** du deck, qui n'apparaît qu'après sélection du portrait de héros (2025, `24166335`) | Le deck code lui-même, en bas de la liste copiée (même source) |
| L'**indication des héros et modes verrouillés** (2021, `23676205`) | Le détail de ce qu'il faut faire pour les déverrouiller (§4) |

En 2021, Blizzard a explicitement corrigé un défaut de lisibilité de l'accueil du nouveau joueur :
« Updated the New Player Experience to remove certain restrictions and to **better indicate
locked heroes, modes, and other features** »
([20.4 Patch Notes](https://playhearthstone.com/en-us/blog/23676205/), 02/06/2021, gras ajouté).
C'est l'aveu officiel qu'un écran d'accueil qui cache ses verrous se lit mal.

### 1.6 L'écran de combat

**Non documenté.** Aucune page Blizzard consultée ne décrit la disposition du plateau
(héros, main, cristaux de mana, historique des actions, bouton de fin de tour). Les notes de
version parlent des cartes, jamais de la composition de l'écran. Ne pas déduire une hiérarchie
d'une capture absente : ce point reste ouvert (§7).

### 1.7 Carte des écrans demandée — ce qui est documenté

| Écran demandé | Statut | Source / note |
|---|---|---|
| **Accueil** | partiellement documenté | Le menu principal porte l'icône du Journal depuis 2020 (S1) ; en 2021 l'affichage des héros et modes **verrouillés** y est corrigé (S2). La composition exacte du menu n'est pas publiée : **non documenté**. |
| **Collection** | très partiellement documenté | Existence d'un **Collection Manager** avec des onglets (les Cosmetic Coins « will have their own tab in the Collection Manager », S1) ; entrée du deck builder par « your Collection, create a new deck, and select your class » (S8). Aucune description de la grille, des filtres ou du tri de la collection en jeu : **non documenté**. |
| **Deck building** | documenté (web + parcours en jeu) | §2 ci-dessous (S11, S8). |
| **Ouverture de paquets** | documenté | §1.4 (S4). |
| **Combat** | **non documenté** | §1.6. |
| **Profil** | documenté | §1.2 (S1, S2). |
| **Quêtes** | documenté | Onglet `Quests` du Journal (S9) ; mécanique de quêtes (S1). |
| **Boutique** | documenté | §1.3 (S6). |

---

## 2. Deck builder

Deux outils distincts portent le même nom chez Blizzard, et il faut les séparer :
le **deck builder web** (`hearthstone.blizzard.com/en-us/deckbuilder`) et le **deck builder en
jeu**. Seul le premier publie ses chaînes d'interface ; le second n'est documenté que par les
articles destinés aux joueurs.

### 2.1 L'outil web : les chaînes d'interface comme source

La page [Deck Builder](https://hearthstone.blizzard.com/en-us/deckbuilder) (consultée le
27/10/2026) embarque son dictionnaire de libellés. Ce sont les **mots exacts** que voit le
joueur, ce qui en fait une source de premier choix pour le vocabulaire d'un deck builder :

| Libellé officiel | Chaîne | Ce que ça dit du parcours |
|---|---|---|
| État vide | `Import a deck code or choose a Hero to get started` | Deux entrées possibles : **code** ou **héros** |
| Aide à la saisie | `Click cards to add them or paste a deck code` | Le clic sur une carte est le geste primaire |
| Tri | `Mana: low to high`, `Mana: high to low`, `Card Name: A to Z`, `Attack: low to high`, `Health: low to high`, `Most Recent` | Six tris, dont deux sur le mana |
| Filtres | `Mana` (`Any Cost`), `Attack`, `Health`, `Rarity`, `Card Type`, `Minion Type`, `Set`, `Class`, `Keywords`, `Spell School`, `Factions`, `Clear All` | Filtres **par valeur** (« Any Cost »), pas seulement par catégorie |
| Courbe | `Mana Curve` | La courbe de mana est un **panneau nommé** de l'écran |
| Compte | `{0} cards found`, `{0} cards found for "{1}"`, `No cards found`, `Try removing search item(s) for better results` | Le compte est **permanent**, et l'échec de recherche a son propre message |
| Dépassement du set | `No Standard cards found. You can expand your search to include all cards.` + bouton `Search all cards` | Un **élargissement proposé**, jamais imposé |
| Export | `Copy Deck Code`, `Copy Url`, `Share your deck online!` | Le partage est une **action explicite**, pas un lien permanent |
| Import | `Paste a deck code here`, `There was an error reading the deck code` | Erreur dédiée au code malformé |

(même URL, consultée le 27/10/2026.)

### 2.2 Ce que voit le joueur quand le deck est invalide

Trois états distincts, avec **trois messages distincts** (même page, mêmes chaînes) :

1. **Deck incomplet** — le bouton de copie s'ouvre sur un titre `Incomplete Deck` et le texte :
   > « Your deck does not have 30 cards. Do you want to copy the deck code? You can still import
   > the deck on this deck builder. »

   Deux boutons : `Copy Anyway` (et l'action réussie répond `Deck code has been copied to
   clipboard`). Autrement dit : **l'invalidité n'est pas un blocage**, c'est un avertissement
   avec une sortie.
2. **Deck plein** — `Your deck is full; you need to remove a card before you can add another.`
3. **Contrainte de deck** (runes de Death Knight) — `The runes on this card do not match the
   runes on your deck. Change your decklist to add this card.` La carte est refusée **avec la
   raison**, pas grisée sans explication.

Il existe aussi `Complete your deck` et `Empty Sideboard` / `Cards can be added to this
sideboard` (même page) : la complétion est une **proposition nommée**, pas un bouton anonyme.

Un détail d'ergonomie mobile, utile pour une PWA : la page web affiche `Please switch to portrait
view.` quand l'orientation ne convient pas (même page).

### 2.3 Le parcours en jeu : deck code, cartes manquantes, remplacements

L'article officiel « Launch into Heroes of StarCraft »
([hearthstone.blizzard.com/en-sg/news/24166335](https://hearthstone.blizzard.com/en-sg/news/24166335), 21/01/2025)
décrit le geste exact de l'export :

> « If your deck is already full, when you select the Hero portrait at the top of a deck in your
> collection, you'll see a Copy button. Press that button and your decklist will be copied to
> your clipboard. […] At the bottom of the decklist, you will see a string of letters, numbers,
> and symbols. That is the deck code. »

Et celui de l'import, avec la gestion des cartes possédées :

> « Hearthstone will detect that you have a valid decklist on your clipboard and will ask if
> you'd like to create a new deck with the one you've copied. Any cards you don't own will appear
> **insubstantial (blue-grey)**. If you don't want to craft the missing cards right away, you can
> replace them manually or **select them for suggested replacements** » (même URL ; gras ajouté).

Trois idées d'UI y sont, toutes copiables :

- **détection du presse-papiers** et **proposition** de créer le deck (pas de création muette) ;
- les cartes manquantes sont **visibles mais désaturées** (bleu-gris), donc le deck reste lisible
  comme un tout ;
- les remplacements sont **suggérés** et restent **au choix** du joueur.

### 2.4 Les recettes de deck

- Trois recettes par classe : « Just go to your Collection, create a new deck, and select your
  class—you'll see three Deck Recipe options (one based on the Core Set, two based on recent
  expansions) » (même article, 21/01/2025).
- La 37.0 en ajoute une par classe à chaque extension : « A new Deck Recipe is being added for
  each class featuring new cards from Reign of the Black Empire »
  ([37.0 Patch Notes](https://hearthstone.blizzard.com/en-us/news/24301454), 12/10/2026).

### 2.5 La complétion automatique

Elle existe, mais Blizzard ne la documente que par un correctif de bug : « Fixed a bug where
adding the Signature version of Reanimate the Terror to a deck could result in an **invalid deck
being generated by deck auto-complete** »
([37.0 Patch Notes](https://hearthstone.blizzard.com/en-us/news/24301454), 12/10/2026 ; gras ajouté).
Aucune page officielle ne décrit **comment** l'auto-complétion choisit les cartes : non documenté.

### 2.6 Écart de périmètre à ne pas recopier

Le deck builder de Blizzard raisonne en **30 cartes** (`Your deck does not have 30 cards`,
§2.2). Le nôtre en compte **20** (`AGENTS.md` §4). Le **mécanisme** (avertir sans bloquer,
nommer l'état, proposer une sortie) se transpose ; le **chiffre**, non.

---

## 3. Accessibilité

C'est la section la plus courte, et ce n'est pas un manque de recherche : c'est l'état de la
documentation officielle.

### 3.1 Ce qui est documenté : l'audio

Le seul dispositif d'accessibilité que Blizzard décrit noir sur blanc est **audio**. Message
d'un employé Blizzard (compte `staff`) sur le forum officiel, dans un fil de 12 messages :

> « we're adding expanded Audio Settings to support **separate volume controls** for each of
> these, along with an option for **Mono Sound** »
> — [Addressing Hearthstone Accessibility](https://us.forums.blizzard.com/en/hearthstone/t/addressing-hearthstone-accessibility/97531), 08/11/2022 (gras ajouté).

Le raisonnement exposé avant cette phrase est le vrai contenu : « the combination of
Hearthstone's music, sound effects, character dialog, and tavern ambience […] can conflict with
the audibility of screen-reading software trying to convey the state of the game » (même URL).
C'est-à-dire : **des canaux séparés parce qu'un lecteur d'écran a besoin d'un fond sonore
maîtrisé**. Une PWA peut retenir la leçon sans avoir de musique.

Le même message donne le canal de retour officiel : `accessibility@blizzard.com`, « That feedback
is sent directly to the game teams » (même URL).

L'existence du réglage « Mono Sound » est confirmée par un rapport de joueur en 2026
(« I've tried mono sound on and off », [fil du 26/03/2026](https://us.forums.blizzard.com/en/hearthstone/t/158976)) —
**rapport de joueur, pas documentation**.

### 3.2 Ce qui n'est pas documenté

| Point | État | Ce qui a été vérifié |
|---|---|---|
| **Lecteur d'écran natif** | **non documenté** | Blizzard annonce en 2022 « exploring what it will take to implement native accessibility features » (`97531`) ; aucune page Blizzard ni note de version consultée n'annonce une livraison. En 2025, un joueur écrit encore qu'il n'existe qu'« an unofficial website that offers an accessibility patch » ([fil du 24/08/2025](https://us.forums.blizzard.com/en/hearthstone/t/accessibility-feedback-from-a-blind-player/150950)) — **rapport de joueur**. |
| **Taille des cibles tactiles** | **non documenté** | Aucune page Blizzard, aucune note de version. |
| **Raccourcis clavier** | **non documenté** | Aucune page Blizzard. Des listes existent, mais uniquement dans la doc d'un **mod tiers** (`hearthstoneaccess.com`) : hors périmètre. |
| **Mode daltonien** | **non documenté** | Aucune page Blizzard, aucune note de version. |
| **Sous-titres / taille de texte / contraste** | **non documenté** | Idem. |

### 3.3 La preuve par le contraste : Blizzard sait faire, mais pas pour Hearthstone

Blizzard publie des **guides d'accessibilité** complets pour d'autres jeux, par exemple
[DOOM: The Dark Ages Accessibility Guide](https://news.blizzard.com/en-us/article/24205456/doom-the-dark-ages-accessibility-guide)
(publié par Bethesda sur Blizzard News, 13/05/2025, consulté le 27/10/2026) : « text size scaling
options (for UI, HUD, and subtitles), extensive controls remapping, high contrast mode ». Le même
guide **ose écrire** d'un jeu qu'il ne supporte pas les lecteurs d'écran : « The game currently
does not support screen readers for menu narration. […] Players without sight may need sighted
assistance interacting with the menus and gameplay. » **Aucun équivalent n'existe pour
Hearthstone.** L'absence est donc un choix éditorial, pas une impossibilité de format — et le
contre-exemple montre qu'annoncer une limite est un format acceptable.

Le même guide donne la **forme d'écran** qu'on cherche : « The Accessibility Menu duplicates
select settings from other options menus in one place for ease of discoverability and quick use
in gameplay » (S12). Un **écran d'accessibilité unique qui recopie** les réglages épars, plutôt
que des réglages dispersés dans les options. C'est l'idée la plus directement réutilisable de
cette section — et elle n'est documentée nulle part pour Hearthstone.

### 3.4 Méthode de vérification de l'absence

Pour ne pas conclure « rien » sur une simple intuition, les notes de version récentes ont été
ouvertes et cherchées pour le mot `accessib` : **36.0.3, 36.2, 36.2.2, 36.4, 36.4.2, 36.6**
(`news.blizzard.com/en-us/article/24290431`, `/24290432`, `/24293284`, `/24293283`, `/24296231`,
`/24294373`) — **zéro occurrence** dans le corps des articles. La recherche n'est pas exhaustive
(les notes antérieures à 36.0 n'ont pas toutes été ouvertes) : c'est un indice fort, pas une
preuve définitive.

---

## 4. Tutoriel et entrée dans le jeu

### 4.1 La chaîne d'entrée, dans l'ordre

Décrite du point de vue du joueur par l'article destiné aux nouveaux venus
([Launch into Heroes of StarCraft](https://hearthstone.blizzard.com/en-sg/news/24166335), 21/01/2025) :

1. **Créer un compte** — possible **sans** compte Battle.net si l'on commence sur mobile ;
   « doing so will let you save account progress » (même URL). Le compte se crée **plus tard**,
   depuis le menu Options : l'inscription n'est donc **pas** un mur au premier lancement.
2. **Tutoriel « streamlined »** : « After you create an account and play through the streamlined
   tutorial, you will be placed into the Apprentice Track » (même URL).
3. **Apprentice Track** : « you play Standard games against other new players. As you progress
   through the Apprentice Track, you'll unlock all the classes, earn packs and Gold, and get two
   complete decks of your choice » (même URL).
4. **Tavern Guide** : « a series of introductory quests » qui accompagne la piste et donne
   « even more Arcane Dust and Packs » (même URL).
5. **Decks de prêt** : « For one week, you can play with these decks as much as you want […]
   After that week, or if you've made up your mind about a favorite early, you can claim one of
   the decks » (même URL).
6. **Déverrouillage** : finir l'Apprentice Track « unlocks all the Hearthstone game Modes, Daily
   and Weekly Quests, in-game Events, a new full Rewards Track » (même URL).

Le point de conception à retenir : **les modes et les classes sont des récompenses**, pas des
onglets grisés. C'est la note 28.2 qui l'énonce : « Modes and classes (including Death Knight)
are now earned as rewards on the Apprentice Track, instead of their previous unlock requirements »
([28.2 Patch Notes](https://playhearthstone.com/en-us/blog/24008697/), 04/12/2023).

### 4.2 Ce qui est skippable

Documenté, et documenté **avec son coût** :

> « Experienced players or players who just want to play Battlegrounds will be able to skip the
> track and guide to immediately unlock all classes, modes, and Loaner Decks, but will miss out
> on the other rewards along the Track. »
> — [28.2 Patch Notes](https://playhearthstone.com/en-us/blog/24008697/), 04/12/2023.

Trois propriétés de ce skip, toutes intéressantes :

- il est **adressé à un public nommé** (« experienced players », « players who just want to play
  Battlegrounds ») ;
- il **dit ce qu'on perd** ;
- il **débloque tout** (classes, modes, decks de prêt) : on ne laisse pas le joueur à moitié
  déverrouillé.

Un défaut de ce skip a existé et a été corrigé : « Fixed a bug in the new player experience where
some players were unable to skip the Apprentice Track if they hadn't yet finished the Tavern
Guide » ([29.4.3 Patch Notes](https://us.forums.blizzard.com/en/hearthstone/t/2943-patch-notes/129365), 30/05/2024).
Autrement dit, la **sortie de secours** doit rester atteignable même si l'on n'a pas fini le
parcours guidé.

### 4.3 Le tutoriel lui-même

**Non documenté** par Blizzard : aucune page ne décrit son contenu, sa durée ou ses étapes. Le
seul qualificatif officiel est « streamlined » (article du 21/01/2025). L'existence d'un bouton
« skip tutorial » dans le client n'est attestée que par des rapports de joueurs et par des
chaînes extraites du client par la communauté (dépôt non officiel) : **à ne pas citer comme
fait**.

### 4.4 L'accueil du nouveau joueur, corrigé par itérations

- 2021 : « remove certain restrictions and to better indicate locked heroes, modes, and other
  features » ; « Updated MMR calculation for returning players to better account for their time
  away from the game » ([20.4 Patch Notes](https://playhearthstone.com/en-us/blog/23676205/), 02/06/2021).
- 2023 : l'Apprentice Track remplace les rangs Apprentice, avec l'objectif affiché de
  « simplify and guide new player development and progression » et de prendre « less time to
  complete than the current Apprentice ranks » ([28.2](https://playhearthstone.com/en-us/blog/24008697/), 04/12/2023).
- 2023 : les Catch-Up Packs sont « added to the new and returning player experience » en 28.0
  ([Introducing Catch-Up Packs](https://playhearthstone.com/en-us/blog/24008690/), 03/11/2023).

La trajectoire est claire : **moins de temps imposé, plus de choix explicite, et un rattrapage
pour ceux qui reviennent**.

### 4.5 Comparaison externe : les réglages proposés au premier lancement

Toujours dans l'idée « ce qui est skippable », le guide de DOOM: The Dark Ages documente une
**expérience de premier lancement** distincte du didacticiel : « The first time you launch DOOM:
The Dark Ages, you will be able to adjust a select number of settings, including text size. When
you first visit the Main Menu, additional settings can be adjusted before you start playing. »
(S12) Et les tutoriels restent consultables : « Unlocked tutorials can be reviewed from the pause
menu during gameplay » (S12). Rien d'équivalent n'est documenté côté Hearthstone : **non
documenté**.

---

## 5. Hors de notre périmètre

Tout ce qui suit est **explicitement hors périmètre** pour notre jeu. C'est listé ici pour qu'on
ne le confonde pas avec une idée d'UI à reprendre.

| Élément Hearthstone | Ce que c'est (source) | Verdict |
|---|---|---|
| **Rangs** (Apprentice, Ranked Standard/Wild, Legend) | La fin de l'Apprentice Track fait entrer « into the regular Ranked Hearthstone experience » (`24166335`, 21/01/2025) ; le profil affiche « Current rank in both constructed Standard and Wild » (`23534414`, 22/10/2020) | **hors périmètre** |
| **Quêtes** (quotidiennes, hebdomadaires, légendaires, Journey Quests) | « At the start of every week […] you'll be given 3 new Weekly Quests » ; « you can reroll 1 Weekly Quest per day » (`23534414`, 22/10/2020) ; les Journey Quests en 2026 (`24301454`) | **hors périmètre** |
| **Monnaie** (Gold, Arcane Dust, Runestones, Tavern Tickets, Tavern Tender, Renown) | « Gold, Catch-Up Packs, starter decks » (`24008697`) ; « Runestones » (`24008697`) ; « earn Tavern Tender » (`24301454`) ; « collection points (Renown) » (`24301454`) | **hors périmètre** |
| **Saisons** (piste de récompenses par extension, saison Arena, saison Battlegrounds, chapitres hebdomadaires) | « On October 13, with Patch 37.0, all ongoing Arena runs will end, and a new Arena season will begin » ; « A new part unlocks each week for 7 weeks » (`24301454`, 12/10/2026) | **hors périmètre** |
| **Boutique et monétisation** (Battle.net Shop, Darkmoon Faire Treasures, Pets, skins) | « Darkmoon Faire Treasures is our random pull system […] The first pull is free, and subsequent pulls require Runestones » (`24301454`) | **hors périmètre** |
| **Progression de compte** (XP, niveaux de classe, portraits dorés, Achievements/Feats) | `23534414`, `24301454` | **hors périmètre** |
| **Modes annexes** (Battlegrounds, Arena, Duels, Mercenaries, Tavern Brawl) | `24008697`, `24301454` | **hors périmètre** |

Ne pas importer non plus la **structure de récompense** de l'entrée dans le jeu : chez nous, il
n'y a ni piste, ni monnaie, ni saison (`AGENTS.md` §4.2 : monétisation v1 « aucun argent réel »).

---

## 6. Sources

Toutes consultées le **27/10/2026**.

| # | Source | Auteur | Date | URL |
|---|---|---|---|---|
| S1 | Revamping Progression & Rewards in Hearthstone | Blizzard Entertainment | 22/10/2020 | https://playhearthstone.com/en-us/blog/23534414/ |
| S2 | 20.4 Patch Notes | Blizzard Entertainment | 02/06/2021 | https://playhearthstone.com/en-us/blog/23676205/ |
| S3 | Addressing Hearthstone Accessibility (fil officiel, message employé) | GnomeSayin (Blizzard), forum officiel | 08/11/2022 | https://us.forums.blizzard.com/en/hearthstone/t/addressing-hearthstone-accessibility/97531 |
| S4 | Introducing Mass Pack Opening | Blizzard Entertainment | 06/09/2023 | https://news.blizzard.com/en-us/article/23999067/introducing-mass-pack-opening-the-new-way-to-open-your-pre-purchase-bundles |
| S5 | Introducing Catch-Up Packs | Blizzard Entertainment | 03/11/2023 | https://playhearthstone.com/en-us/blog/24008690/ |
| S6 | 28.2 Patch Notes | Blizzard Entertainment | 04/12/2023 | https://playhearthstone.com/en-us/blog/24008697/ |
| S7 | 29.4.3 Patch Notes (fil officiel) | Blizzard, forum officiel | 30/05/2024 | https://us.forums.blizzard.com/en/hearthstone/t/2943-patch-notes/129365 |
| S8 | Launch into Heroes of StarCraft | Blizzard Entertainment | 21/01/2025 | https://hearthstone.blizzard.com/en-sg/news/24166335 |
| S9 | 37.0 Patch Notes | Blizzard Entertainment | 12/10/2026 | https://hearthstone.blizzard.com/en-us/news/24301454 |
| S10 | Embark on Your Hearthstone Journey | Blizzard Entertainment | 05/10/2026 | https://hearthstone.blizzard.com/en-us/news/24303865 |
| S11 | Deck Builder (outil web, chaînes d'interface) | Blizzard Entertainment | sans date (outil vivant) | https://hearthstone.blizzard.com/en-us/deckbuilder |
| S12 | DOOM: The Dark Ages Accessibility Guide (contre-exemple de format, rédigé par Bethesda) | Bethesda, sur Blizzard News | 13/05/2025 | https://news.blizzard.com/en-us/article/24205456/doom-the-dark-ages-accessibility-guide |
| S13 | Notes de version 36.x, vérifiées pour le mot « accessib » | Blizzard Entertainment | 2026 | https://news.blizzard.com/en-us/article/24290431 · /24290432 · /24293284 · /24293283 · /24296231 · /24294373 |

**Rapports de joueurs** (cités comme tels, jamais comme documentation) :

| # | Source | Date | URL |
|---|---|---|---|
| J1 | « Accessibility Feedback from a Blind Player » | 24/08/2025 | https://us.forums.blizzard.com/en/hearthstone/t/accessibility-feedback-from-a-blind-player/150950 |
| J2 | « Music and background sounds not playing (Closed) » — le réglage « Mono Sound » y est manipulé par un joueur | 26/03/2026 | https://us.forums.blizzard.com/en/hearthstone/t/158976 |

---

## 7. Sources non trouvées

Ce qui a été cherché, et qui **n'existe pas** ou n'a pas pu être atteint. Chaque ligne
« non documenté » de ce fichier renvoie à cette liste.

| Cherché | Résultat | Ce qui a été tenté |
|---|---|---|
| Page d'accessibilité Hearthstone | **inexistante** | `hearthstone.blizzard.com/en-us/accessibility`, `/en-us/accessibility`, `blizzard.com/en-us/accessibility`, `/en-us/company/about/accessibility` → **404** |
| Guide d'accessibilité Hearthstone (équivalent de S12) | **inexistant** | recherche sur les titres du flux `news.blizzard.com/en-us/hearthstone` (24 articles listés) → aucun |
| Description officielle du tutoriel (contenu, durée, étapes) | **non documenté** | `/en-us/game-guide`, `/en-us/how-to-play`, `/en-us/beginners-guide` → pages marketing ou 404 |
| Bouton « skip tutorial » | **non documenté par Blizzard** | seules des chaînes de client extraites par la communauté et des fils de joueurs le mentionnent |
| Disposition de l'écran de combat | **non documenté** | aucune note de version ni article consulté ne la décrit |
| Mode daltonien, taille de texte, sous-titres, taille des cibles, raccourcis clavier | **non documentés** | aucune occurrence dans les sources S1–S13 |
| Documentation du deck builder **en jeu** (côté Blizzard) | **non documentée** | seules les chaînes de l'outil **web** (S11) et des articles destinés aux joueurs (S8, S9) existent |
| Centre d'aide Blizzard (`support.blizzard.com`) | **inatteignable** | toutes les requêtes vers `support.blizzard.com` (recherche et articles) ont expiré ou renvoyé **502** le 27/10/2026 ; un article d'aide sur les « accessibility concerns » existe d'après un résultat de recherche, il n'a **pas** pu être ouvert — donc **non cité** |
| Portail d'accessibilité Blizzard (toutes franchises) | **inexistant** aux URL essayées | `blizzard.com/accessibility`, `/en-us/accessibility/`, `/en-us/company/accessibility` → **404** |
