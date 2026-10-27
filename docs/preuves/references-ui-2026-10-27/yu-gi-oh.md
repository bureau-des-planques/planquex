# Yu-Gi-Oh! — MASTER DUEL et DUEL LINKS : références d'UI et de parcours

Lot `references-ui-2026-10-27/` — **recherche documentaire, sans capture**. Ce fichier ne prouve
aucune de nos règles : il relève des **idées d'UI et de parcours** chez deux jeux voisins.

> **Emplacement réel de ce fichier.** L'agent de recherche n'a le droit d'écrire que dans
> `~/.local/share/opencode/sandbox/` : l'écriture dans `docs/preuves/` a été **refusée** par la
> configuration (`permission.rejected`, `edit`). Le fichier est donc produit ici, prêt à être
> recopié dans `docs/preuves/references-ui-2026-10-27/yu-gi-oh.md` par la session qui l'a demandé.

- **Date de la recherche** : 27/10/2026
- **Objets étudiés** : Yu-Gi-Oh! MASTER DUEL (Konami, sorti le 18/01/2022 sur Steam, 19/01/2022
  sur PS5 — <https://store.steampowered.com/app/1449850/>,
  <https://store.playstation.com/en-us/concept/10001481>) et Yu-Gi-Oh! DUEL LINKS (Konami, sorti le
  16/11/2017 sur Steam — <https://store.steampowered.com/app/601510/>).
- **Nature des sources** : uniquement des sources **primaires** — sites officiels Konami
  (`konami.com`), centre d'aide officiel Konami (`us-support.konami.com`), fiches et notes de
  version **publiées par Konami** sur Steam et sur les boutiques des plateformes. Aucun wiki
  communautaire, aucun blog tiers.
- **Limite de méthode** : rien ici n'a été **observé en jeu**. Tout vient de documentation publiée.
  Les notes de version sont publiées par Konami mais **hébergées par Valve** (annonces Steam) :
  c'est du texte de l'éditeur, pas une observation. Ce qui n'est pas documenté est écrit
  **« non documenté »**, jamais déduit d'une capture mentale.

---

## 1. UI et écrans

### 1.1 La carte des écrans, telle que la documentation la nomme

Aucune **carte d'écrans exhaustive** n'est publiée : ce qui suit est l'ensemble des écrans que la
documentation officielle nomme explicitement. Le reste est **non documenté**.

| Écran / élément | Ce que la source en dit | Source |
|---|---|---|
| **Main Menu** | point d'entrée ; on y « select your profile and select *Replay* » | <https://us-support.konami.com/hc/en-us/articles/4813416796951-Is-there-a-function-to-save-and-replay-Duels> |
| **DUEL**, **MISSION**, **SOLO**, **DECK** | cités comme les écrans dont l'UI a été retravaillée dès la v1.1.1 | note de version v1.1.1 (06/05/2022), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4348799082192220487> |
| **Duel Results** | écran de fin de duel, avec le bouton **Save Duel** | <https://us-support.konami.com/hc/en-us/articles/4813416796951-Is-there-a-function-to-save-and-replay-Duels> |
| **Replay** (liste) | « a list of all of the Duel Replays you have on your account » | idem |
| **Dueling Rooms** | salles où l'on peut regarder des duels **en cours** | <https://us-support.konami.com/hc/en-us/articles/4813232087831-Is-it-possible-to-watch-other-players-Duels> |
| **Duel Live** | « The Duel Live function has been enhanced. » (v1.6.0) ; on peut y **copier des decks** (v2.0.0, « Added the ability to copy decks from DUEL LIVE ») | v1.6.0 (14/07/2023), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5124583599316200551> ; v2.0.0 (06/08/2024), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5963413728352209332> |
| **Solo Mode** (et ses « gates ») | UI et mise en page retravaillées deux fois | v2.2.1 (04/02/2025), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1790214123233705> ; v2.3.0 (07/05/2025), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1799088287790724> |
| **Deck Edit** / **My Deck** | UI revue | v2.4.0 (30/07/2025), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1806698490638295> |
| **Collector's Files** | « Introduced new features related to the Collector's file. » (v2.5.0) ; on peut y **rejouer des cut-ins d'invocation** (v2.7.0, « You can now play summon cut-ins in the Collector's Files ») | v2.5.0 (04/11/2025), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1815034433024187> ; v2.7.0 (30/04/2026), <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155566917> |

**Ce qu'on peut retenir pour nous** : les **contenus débloqués** ont leur écran à part
(« Collector's Files »), et la **mémoire des parties** un troisième (« Replay »), atteint depuis le
**profil**, pas depuis l'écran de combat.

### 1.2 Ce que le jeu montre pendant un tour

| Élément | Source (texte exact) |
|---|---|
| **Duel Log** | « The UI of the Duel Log has been improved. » — v1.9.0, 07/05/2024, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5766372999960618271> |
| **Invites / messages d'activation d'effet** | « Improvements to prompts/messages related to card effect activations. » — v1.4.1, 10/02/2023, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5036749277231358285> ; repris en v1.5.1, 08/05/2023, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5138087875092241999> |
| **Effet visuel à l'activation d'une carte** | « New visual effect for when activating cards in Duels. » — v1.5.1 ; « Card activation effects during a duel have been added. » — v2.1.0, 31/10/2024, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/6146943657173889006> |
| **Animations d'invocation spéciale** | ajoutées v1.6.0 (« Added summon effects for special summons. ») ; **désactivables** : « Added Enable/Disable summon animation only once per duel to Preference. » — v1.2.0, 05/08/2022, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4598757090452054262> |
| **Sauter les vidéos d'invocation** | « Videos for Special Summoning monsters (Fusion, Synchro, Xyz, Pendulum, Link) can be skipped through settings. However, the animated Summoning effects implemented for some specific monsters cannot be skipped. » — <https://us-support.konami.com/hc/en-us/articles/4813228184983-Is-it-possible-to-check-the-controls-in-game> |
| **Consulter son Deck en cours de duel** | « A function has been added that allows you to check your deck during duels. » — v2.1.0 |
| **Durée de tour** | « Change to the time limit per turn in Duels. » — v1.4.1 ; « Improvements to the UI and the time limit per turn in Duels. » — v1.5.1 |
| **Reprise après coupure** | « The latest play status will be automatically saved to the server so that you can resume from where you left off » — <https://us-support.konami.com/hc/en-us/articles/4813288647319-Is-there-an-auto-save-function> |

**Ce qui n'est pas documenté** : la **teneur** du Duel Log (quelles lignes, quel ordre, quelle
granularité), l'existence d'une **pile** affichée à l'écran, et la façon dont une **chaîne**
d'actions est démontée visuellement. Le seul fait établi est qu'un **journal** existe, que son UI a
été retravaillée (v1.9.0) et que l'affichage de l'activation des cartes l'a été **trois fois**
(v1.3.1, v1.4.1, v1.5.1) — signe que c'est un point dur d'un jeu de cartes, pas un détail.
**Non documenté** au-delà.

### 1.3 Le parcours « revoir ce qui vient de se passer »

Deux chemins distincts, tous deux documentés :

1. **pendant** le duel — le **Duel Log** (v1.9.0) et les invites d'activation ;
2. **après** le duel — *Duel Results* → **Save Duel**, puis *Main Menu* → profil → **Replay** →
   liste des replays (support 4813416796951) ; en Match en salle, la v1.2.0 ajoute
   « a function to select the viewpoint when replaying a duel replay in room matches ».

C'est le motif le plus directement transposable pour nous : **le journal pendant, le replay après**,
deux objets séparés, et jamais une seule timeline fourre-tout.

---

## 2. Lisibilité du plateau

| Fait | Source |
|---|---|
| Le 4K est **justifié explicitement par la lisibilité du texte des cartes** : « this game supports 4K resolution. This allows Duelists to clearly see the text of the cards placed on the field » | Message de l'équipe de développement, <https://www.konami.com/yugioh/masterduel/us/en/message/> |
| Les **commandes sont posées sur le terrain** : « Some buttons are displayed on screen to various parts of the field or while navigating through the menus. […] The buttons displayed on screen and control methods will differ depending on which console you are playing on. » | <https://us-support.konami.com/hc/en-us/articles/4813228184983-Is-it-possible-to-check-the-controls-in-game> |
| Plancher d'affichage PC : **1280 × 720** minimum, **1920 × 1080** recommandé | <https://www.konami.com/yugioh/masterduel/us/en/> (bloc « System Requirements ») |
| Le **même jeu** tourne sur mobile : iOS 15.0+, Android 7.0+ (page US), cross-platform et données liées entre plateformes | idem |
| **Écart à signaler** : la page US donne « iPhone 8 or later » / « Pixel6 or later » ; la page **japonaise** du même jeu donne « iPhone11以上のスペックの端末 » et « Pixel6以上 » avec **RAM 4GB** — les deux pages officielles ne disent pas la même chose | <https://www.konami.com/yugioh/masterduel/jp/ja/> |
| Capacités déclarées côté Xbox : **4K Ultra HD, HDR10, 60 fps+, cloud saves** | <https://www.xbox.com/en-US/games/store/yu-gi-oh-master-duel/9N9GL8NX4WW8> |
| Une carte **non possédée** s'affiche **en gris** dans une liste de deck importée : « cards that you do not have in MASTER DUEL will be displayed in gray » | <https://us-support.konami.com/hc/en-us/articles/4813772381975-Is-it-possible-to-import-Deck-Lists-from-Official-Yu-Gi-Oh-TCG-Card-Database-to-Yu-Gi-Oh-MASTER-DUEL> |
| Une section **« Related Cards »** existe dans l'écran de deck, élargie en v2.7.0 | v2.7.0, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155566917> |
| La v2.8.0 annonce « Improved the Duel UI. » **sans dire quoi** | v2.8.0, 30/07/2026, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1839676055884270> |

**Idée transposable** : le **grisé** pour « possédé / non possédé » (support 4813772381975) est le
seul état de manque documenté chez eux, et il est **visuel, pas textuel**.

**Non documenté** : le **zoom** sur une carte (geste, seuil, plein écran), les **infobulles**, la
**taille de texte réglable**, un **mode portrait**, et tout réglage d'accessibilité. Les fiches
PlayStation et Xbox de MASTER DUEL ne déclarent **aucune** fonction d'accessibilité
(<https://store.playstation.com/en-us/concept/10001481>,
<https://www.xbox.com/en-US/games/store/yu-gi-oh-master-duel/9N9GL8NX4WW8>) — absence de
déclaration, pas preuve d'absence en jeu.

---

## 3. Entrée dans le jeu

### 3.1 MASTER DUEL — le Solo Mode comme sas

- **Deux blocs, six guides** nommés par l'éditeur : « Solo Mode includes "Tutorial" and "Duel
  Strategy" » — *Tutorial* : « Guide 1 ~ Monster Cards and Spell Cards Basics ~ », « Guide 2 ~ Trap
  Card Basics ~ » ; *Duel Strategy* : « Guide 3 ~ How to Synchro Summon ~ », « Guide 4 ~ How to Xyz
  Summon ~ », « Guide 5 ~ How to Pendulum Summon ~ », « Guide 6 ~ How to Link Summon ~ »
  (<https://www.konami.com/yugioh/masterduel/us/en/>).
- **La promesse est celle d'un apprentissage en jouant** : « Master the basic rules of the game as
  you play! » (idem).
- **Ordre recommandé, écrit par le support** : « First, learn the basic operations and rules of
  Duels in Solo Mode. You can also learn how to use cards and tactics at the same time. Once you've
  learned the basics in Solo Mode, go to the DUEL menu and start Dueling with Duelists from around
  the world. » (<https://us-support.konami.com/hc/en-us/articles/4812893829399-I-m-new-to-Yu-Gi-Oh-MASTER-DUEL-How-should-we-start-the-game>).
- **Ce qui est offert** : « the in-game tutorials will teach you the basics […] **You'll be given a
  Deck when you finish** to help you start your journey! » — texte éditeur, identique sur Steam
  (<https://store.steampowered.com/app/1449850/>), PlayStation
  (<https://store.playstation.com/en-us/concept/10001481>) et Xbox
  (<https://www.xbox.com/en-US/games/store/yu-gi-oh-master-duel/9N9GL8NX4WW8>).
- **Decks prêtés** : le Solo Mode fait combattre avec des **Loaner Decks** — « enjoy Duels with a
  Loaner Deck featuring cards from the archetype » (<https://www.konami.com/yugioh/masterduel/us/en/>).
- Le Solo Mode expose un bouton **Retry** depuis la v1.3.1
  (<https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4732747437222036801>).
- **Détail de parcours intéressant** : la v2.5.0 autorise « Quiz gameplay during large downloads » —
  on apprend **pendant l'installation**
  (<https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1815034433024187>).

### 3.2 DUEL LINKS — le tutoriel, le quiz, puis le monde

La page « Beginner's Guide » officielle découpe l'entrée en **cinq étapes**, dans cet ordre :

1. **Tutorial** — « Follow the tutorial to learn the basic controls of Duel Links! »
2. **Duel Quiz** — « Duel Quizzes will teach you how to Duel! »
3. **Duel World** — « Head out to Duel World […] Keep Dueling and your character will level up! »
4. **Buy Cards at the Shop** — « Spend Gems at the Shop to purchase card packs! »
5. **Building a Deck** — « If you aren't sure of what cards to put in your deck, the "Create
   Auto-Deck" feature will build a Deck for you! »

Source unique : <https://www.konami.com/yugioh/duel_links/en/guide/>.

À quoi s'ajoute, sur la page « Introduction », la boucle de progression : **Missions → Stage Level →
nouveaux Legendary Duelists**, et les **Gate Keys**, exigées pour affronter un Legendary Duelist
(« Gather the required number of Gate Keys and Duel Legendary Duelists! »)
(<https://www.konami.com/yugioh/duel_links/en/game/>). Le texte éditeur revendique
« Intuitive controls for beginners! The depth to satisfy "Yu-Gi-Oh!" veterans! »
(<https://store.steampowered.com/app/601510/>).

**Idées transposables** : (a) un **quiz** séparé du tutoriel — on ne lit pas, on répond ; (b) un
bouton **« construire un deck pour moi »** à côté de l'éditeur, pas à sa place ; (c) **un deck donné
à la fin du tutoriel** — c'est le seul « cadeau de bienvenue » que la documentation officielle
mentionne, et il est **conditionné à la fin du parcours**, pas distribué à l'ouverture.

**Non documenté** : le montant des ressources de départ (gemmes, tickets), le contenu exact du deck
offert, et la durée du tutoriel.

---

## 4. Recherche et filtres

Tout ce qui suit vient des **notes de version** : l'éditeur ne publie pas de manuel des filtres, il
ne dit que ce qu'il **ajoute**.

| Fait | Source |
|---|---|
| **Filtre de recherche** ajouté à l'écran « Forbidden/Limited » | v1.2.0, 05/08/2022, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4598757090452054262> |
| **Filtre de l'édition de deck renforcé** | v2.2.1, 04/02/2025, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1790214123233705> |
| **Filtres liés aux effets** ajoutés à l'écran d'édition de deck | v2.7.0, 30/04/2026, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155566917> |
| Listes de **démontage** séparées : « Dismantle Selected Cards » et « Designated 'Don't Dismantle' » | v2.2.2, 04/03/2025, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1792751526161501> |
| **Import d'une liste de deck** depuis la base de cartes officielle : seule la liste est importée, les cartes manquantes **s'affichent en gris** | <https://us-support.konami.com/hc/en-us/articles/4813772381975-Is-it-possible-to-import-Deck-Lists-from-Official-Yu-Gi-Oh-TCG-Card-Database-to-Yu-Gi-Oh-MASTER-DUEL> |
| Import **et export** de listes depuis/vers l'appli compagnon NEURON | <https://us-support.konami.com/hc/en-us/articles/4814044001687-Is-it-possible-to-import-Deck-Lists-from-Yu-Gi-Oh-NEURON-to-MASTER-DUEL-Additionally-is-it-also-possible-to-export-Deck-Lists-from-MASTER-DUEL-to-NEURON> |
| **Voir les decklists des autres joueurs** du monde entier | <https://store.steampowered.com/app/1449850/> |
| **Copier un deck depuis DUEL LIVE** | v2.0.0, <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5963413728352209332> |
| **Tirage d'essai** : « Try the sample draw feature to simulate what cards you could get in your first hand! » | <https://store.steampowered.com/app/1449850/> |

**Idées transposables** : le **tirage d'essai de la main de départ** depuis l'éditeur de deck (une
simulation, pas une partie) ; le **deck d'autrui comme point de départ** plutôt que comme objet
social ; deux listes distinctes autour du démontage (« ce que je veux démonter » / « ce que je
protège ») plutôt qu'un interrupteur par carte.

**Ce qui est non documenté** : la **liste des critères** effectivement filtrables (attribut, niveau,
ATK/DEF, archétype, rareté, type de carte…), l'ordre des résultats, la présence d'une recherche
**plein texte** sur le texte de carte, et le comportement des filtres combinés. Les notes de version
prouvent que ces filtres existent et grossissent ; **aucune source primaire ne les énumère**.

---

## 5. Ce qui ne se transpose pas

À dire nettement, pour qu'on ne l'importe pas par mimétisme.

1. **Les chaînes et la résolution en pile.** Le cœur du jeu de référence est un système de chaînes
   d'activation (spell speed, priorité, négation). Nos règles n'ont **pas** de chaîne : un tour se
   résout linéairement (`AGENTS.md` §4). Tout ce qui, chez eux, sert à **rendre lisible une chaîne** (invites
   d'activation répétées, journal de résolution, ordre des effets) répond à un problème **que nous
   n'avons pas**. Ce qui se transpose est uniquement le **geste** (un journal, des invites), pas le
   modèle.
2. **Les méthodes d'invocation multiples** : Fusion, Synchro, Xyz, Pendulum, Link — elles structurent
   les guides de leur Solo Mode (« Guide 3 » à « Guide 6 »,
   <https://www.konami.com/yugioh/masterduel/us/en/>) et n'ont **aucun** équivalent chez nous, où
   l'échelle est **Entrant → N+1 → N+2** (`AGENTS.md` §3.1).
3. **L'Extra Deck / le « EX Deck ».** La v2.7.0 permet « different card protectors for the Main Deck
   and EX Deck » : c'est un **deuxième paquet** de règles, hors de notre périmètre.
4. **Les formats** : Speed Duel et Rush Duel (DUEL LINKS, catégories du WCS 2026 —
   <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1842212951301585>),
   les Festivals à règle spéciale et la Limit 1 Festival
   (<https://www.konami.com/yugioh/masterduel/us/en/>), le Duelist Cup, les listes
   **Forbidden/Limited**. Chez nous, la seule variation de format actée est le mode standard.
5. **Les personnages et la licence.** Le « Duel World » de DUEL LINKS est peuplé de personnages de
   l'anime, avec **voix** et **3D** (<https://store.steampowered.com/app/601510/>). Notre jeu n'a ni
   personnages ni ayants droit : rien à en tirer.
6. **Le poids visuel.** Animations d'invocation, cut-ins, doublages, 4K/HDR60. Une **PWA** n'a ni le
   budget ni le besoin de ce coût ; ce qui reste utilisable, c'est le **principe** « désactivable »
   (v1.2.0 : animation d'invocation une seule fois par duel, réglable).
7. **Les chiffres.** Le catalogue annoncé est de « over 10,000 different cards »
   (<https://www.konami.com/yugioh/masterduel/us/en/>) ; le format lui-même (taille de deck, points
   de vie) est décrit dans le **règlement officiel OCG**, vers lequel la page japonaise renvoie par
   un PDF (« 遊戯王OCG ルールブック », <https://www.konami.com/yugioh/masterduel/jp/ja/> →
   <https://www.yugioh-card.com/japan/howto/data/rulebook_masterrule20200401_ver1.0.pdf>) —
   document que **je n'ai pas ouvert** : ses valeurs ne sont donc pas citées ici. Aucun chiffre de
   leur jeu ne se recopie ; `AGENTS.md` §4 fait foi pour les nôtres.

---

## 6. Sources

Toutes consultées le **27/10/2026**.

**Sites et pages officiels Konami**

1. MASTER DUEL, page d'accueil US (Solo Mode, guides 1–6, Loaner Deck, Festivals, configuration) —
   <https://www.konami.com/yugioh/masterduel/us/en/>
2. MASTER DUEL, page d'accueil JP (mêmes blocs, spécifications iOS/Android différentes) —
   <https://www.konami.com/yugioh/masterduel/jp/ja/>
3. MASTER DUEL, « Message from the Development Team » (4K et lisibilité du texte des cartes) —
   <https://www.konami.com/yugioh/masterduel/us/en/message/>
4. DUEL LINKS, accueil — <https://www.konami.com/yugioh/duel_links/en/>
5. DUEL LINKS, « Introduction » (Duel World, clefs, missions, PvP, replays) —
   <https://www.konami.com/yugioh/duel_links/en/game/>
6. DUEL LINKS, « Beginner's Guide » (Tutorial, Duel Quiz, Auto-Deck) —
   <https://www.konami.com/yugioh/duel_links/en/guide/>
7. DUEL LINKS, « News » — <https://www.konami.com/yugioh/duel_links/en/news/>

**Centre d'aide officiel Konami (US)**

8. « I'm new to Yu-Gi-Oh! MASTER DUEL. How should we start the game? » —
   <https://us-support.konami.com/hc/en-us/articles/4812893829399-I-m-new-to-Yu-Gi-Oh-MASTER-DUEL-How-should-we-start-the-game>
9. « Is it possible to check the controls in-game? » (boutons sur le terrain, saut des vidéos
   d'invocation) —
   <https://us-support.konami.com/hc/en-us/articles/4813228184983-Is-it-possible-to-check-the-controls-in-game>
10. « Is there a function to save and replay Duels? » (Duel Results → Save Duel ; profil → Replay) —
    <https://us-support.konami.com/hc/en-us/articles/4813416796951-Is-there-a-function-to-save-and-replay-Duels>
11. « Is it possible to watch other players' Duels? » —
    <https://us-support.konami.com/hc/en-us/articles/4813232087831-Is-it-possible-to-watch-other-players-Duels>
12. « Is there an auto save function? » —
    <https://us-support.konami.com/hc/en-us/articles/4813288647319-Is-there-an-auto-save-function>
13. « Is it possible to import Deck Lists from Official Yu-Gi-Oh! TCG Card Database to Yu-Gi-Oh
    MASTER DUEL? » (cartes manquantes en gris) —
    <https://us-support.konami.com/hc/en-us/articles/4813772381975-Is-it-possible-to-import-Deck-Lists-from-Official-Yu-Gi-Oh-TCG-Card-Database-to-Yu-Gi-Oh-MASTER-DUEL>
14. « Is it possible to import Deck Lists from Yu-Gi-Oh! NEURON to MASTER DUEL? … » —
    <https://us-support.konami.com/hc/en-us/articles/4814044001687-Is-it-possible-to-import-Deck-Lists-from-Yu-Gi-Oh-NEURON-to-MASTER-DUEL-Additionally-is-it-also-possible-to-export-Deck-Lists-from-MASTER-DUEL-to-NEURON>
15. Section « Yu-Gi-Oh! Master Duel » du centre d'aide (liste d'articles) —
    <https://us-support.konami.com/hc/en-us/sections/4645623895191-Yu-Gi-Oh-Master-Duel>
16. Section « Yu-Gi-Oh! Duel Links » (un seul article : contact) —
    <https://us-support.konami.com/hc/en-us/sections/4436002348567-Yu-Gi-Oh-Duel-Links>

**Notes de version publiées par Konami (hébergées par Steam)**

17. v1.1.1, 06/05/2022 — <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4348799082192220487>
18. v1.2.0, 05/08/2022 — filtre Forbidden/Limited, animation d'invocation réglable, point de vue en
    replay — <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4598757090452054262>
19. v1.3.1, 09/11/2022 — Retry en SOLO, « Improved the display of card effect activation » —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4732747437222036801>
20. v1.4.1, 10/02/2023 — invites/messages d'activation, effet visuel, limite de temps —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5036749277231358285>
21. v1.5.1, 08/05/2023 — <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5138087875092241999>
22. v1.6.0, 14/07/2023 — Duel Live —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5124583599316200551>
23. v1.9.0, 07/05/2024 — « The UI of the Duel Log has been improved. » —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5766372999960618271>
24. v2.0.0, 06/08/2024 — copie de decks depuis DUEL LIVE, Boost Generation —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5963413728352209332>
25. v2.1.0, 31/10/2024 — consultation du deck en duel, replays, effets d'activation —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/6146943657173889006>
26. v2.2.1, 04/02/2025 — filtres de deck edit, UI du Solo Mode —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1790214123233705>
27. v2.2.2, 04/03/2025 — listes de démontage —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1792751526161501>
28. v2.3.0, 07/05/2025 — UI de duel, Solo Mode, accessoires —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1799088287790724>
29. v2.4.0, 30/07/2025 — UI de duel, « My Deck » et « Deck Edit » —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1806698490638295>
30. v2.5.0, 04/11/2025 — collector's file, quiz pendant le téléchargement, spectate —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1815034433024187>
31. v2.7.0, 30/04/2026 — filtres d'effets, « Related Cards » élargi, protecteurs Main/EX —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155566917>
32. v2.8.0, 30/07/2026 — « Improved the Duel UI. » —
    <https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1839676055884270>

**Fiches de boutique (texte de l'éditeur)**

33. Steam, MASTER DUEL — deck donné à la fin du tutoriel, decklists des joueurs, tirage d'essai —
    <https://store.steampowered.com/app/1449850/>
34. Steam, DUEL LINKS — « intuitive controls », 3D, Duel World —
    <https://store.steampowered.com/app/601510/>
35. PlayStation Store, MASTER DUEL (texte identique, Remote Play) —
    <https://store.playstation.com/en-us/concept/10001481>
36. Xbox Store, MASTER DUEL (texte identique, capacités 4K/HDR10/60 fps+) —
    <https://www.xbox.com/en-US/games/store/yu-gi-oh-master-duel/9N9GL8NX4WW8>

---

## 7. Sources non trouvées

Ce qui suit n'existe pas en source primaire, ou n'a pas été atteint. **Rien n'a été comblé par une
source secondaire.**

1. **Manuel officiel de MASTER DUEL** (manuel en ligne ou PDF, écran par écran) : **introuvable**.
   Aucune page `konami.com` consultée ne renvoie à un manuel du jeu ; le site ne publie que des
   vidéos de guides (<https://www.konami.com/yugioh/masterduel/us/en/>).
2. **Carte des écrans complète** (accueil, boutique, missions, profil, salon, réglages…) : **non
   documentée**. Les seuls écrans nommés par une source primaire sont ceux du tableau §1.1.
3. **Contenu du Duel Log** (format des lignes, ordre, regroupement) : **non documenté**. Une seule
   phrase de note de version atteste son existence (v1.9.0).
4. **Zoom de carte, infobulles, appui long, taille de texte** : **non documenté** pour MASTER DUEL
   comme pour DUEL LINKS.
5. **Déclaration d'accessibilité** : aucune page Konami trouvée ; les fiches PlayStation et Xbox de
   MASTER DUEL ne déclarent **aucune** fonction d'accessibilité (absence de déclaration, pas preuve
   d'absence).
6. **Liste des critères de filtre** de l'éditeur de deck : **non documentée** (voir §4).
7. **Notes de version de DUEL LINKS** : l'API d'actualités Steam renvoie **0** entrée étiquetée
   `patchnotes` pour l'app 601510 ; aucune page équivalente sur `konami.com/yugioh/duel_links/`.
8. **Communiqué de Konami sur le lancement mobile de MASTER DUEL** : l'URL donnée par un moteur de
   recherche (`https://www.konami.com/games/eu/en/topics/16269`) répond **404** le 27/10/2026 — non
   retenu, donc non cité.
9. **Section d'aide Konami Europe** pour MASTER DUEL : non atteinte (les essais d'URL répondent
   **404**) ; toute la documentation d'aide citée vient du centre **US**.
10. **Portrait/paysage et comportement de l'UI sur téléphone** : **non documenté**. La seule preuve
    que le jeu tourne sur mobile est la liste des plateformes et les prérequis iOS/Android
    (<https://www.konami.com/yugioh/masterduel/us/en/>).

---

## Ce que je retiens pour notre PWA (synthèse, sans source nouvelle)

- **Deux objets, pas un** : le journal **pendant** le duel, le replay **après** — et le replay se
  range dans le profil, pas dans l'écran de combat (§1.1, §1.3).
- **Le manque se voit** : une carte non possédée est **grisée**, pas expliquée (§2).
- **Le deck se simule** : tirage d'essai de la main de départ depuis l'éditeur (§4).
- **L'entrée est un parcours nommé**, en étapes courtes, avec un deck **offert à la fin** (§3).
- **Tout ce qui est spectaculaire est désactivable** (animations), et l'éditeur distingue
  « d'abord ça, ensuite les extra » (§5, point 6).
- **Ce qu'on n'importe pas** : chaînes, méthodes d'invocation, Extra Deck, formats, personnages (§5).
