# Références visuelles : combat Pocket, tutoriel et ouverture Hearthstone (03/11/2026)

> **Archive datée — un rapport, pas une source de vérité.** Écrit le 03/11/2026, copié dans
> `docs/recherches/` le 04/11/2026 depuis le dossier de travail du chantier UI (dossier éphémère,
> non conservé). Le texte est celui du 03/11/2026 ; les **chemins locaux** du dossier de travail
> ont été retirés à la copie (les autres écarts éventuels sont déclarés ci-dessous), et les pièces
> qu'ils désignaient ne sont pas archivées.
> Aucune capture, image ni vidéo n'entre dans le dépôt. Rien de ce rapport n'est une règle du jeu :
> `docs/JEU.md` §4 et `docs/DECISIONS.md` font foi.
>
> Source : `refs-2026-11-03/REFERENCES.md`. Les planches, frames et scripts cités (`planches/`,
> `frames/`, `scenes.txt`, `rafale.py`, `planche_portrait.py`) ne sont pas archivés. Les
> descriptions d'écrans et les courtes citations de wikis sont gardées comme repères de lecture :
> aucune image ni texte de carte n'est reproduit.

> Recherche faite le **03/11/2026**. Toutes les URL ont été ouvertes ce jour-là, sauf mention contraire.
> Fichiers déjà lus pour éviter les doublons : `docs/preuves/references-ui-2026-10-27/` (Pocket,
> Hearthstone), `docs/SPEC-COMBAT-UI.md` §2, `docs/DIRECTION-SCENE-COMBAT.md` (en-tête),
> `docs/SPEC-OUVERTURE-ARRIVAGE.md` §1–3.5. Ce qu'ils disent déjà n'est **pas** recopié ici. Par exemple,
> l'ouverture en masse de Hearthstone (article Blizzard du 06/09/2023) figure déjà dans
> `hearthstone.md` §1.4.

## Légende des niveaux de preuve

| Marque | Sens |
|---|---|
| **VU** | J'ai regardé l'image moi-même avec l'outil Read. Le chemin est donné. |
| **LU** | Une source le dit par écrit (URL et date). Je n'ai pas vu l'image. |
| **DÉDUIT** | J'en tire la conclusion à partir de sources LU ou VU. Ce n'est pas observé. |
| **non documenté** | Je l'ai cherché sans le trouver. |

---

## 0. Blocage : la vidéo n'a pas pu être regardée

**Aucune image clé n'a été extraite de https://youtu.be/feAya7Pixc4. La section 1 ne contient donc
aucune observation VU tirée de la vidéo.**

- Le lanceur `lecture-seule.mjs --verifier` **refuse** `python3 -m venv …`, `pip`, `curl` et `mkdir`. Il
  répond « commande non autorisée », vérifié le 03/11/2026. Impossible donc de créer le venv yt-dlp et
  imageio-ffmpeg dans le bac à sable. Je n'ai pas cherché à contourner le refus, comme les règles le
  demandent.
- L'outil Webfetch refuse les images (« Unsupported fetched image content type: image/jpeg », de
  même pour png, webp et gif). L'outil Write n'écrit que du texte, donc il ne peut pas produire de JPEG.
  Read affiche un SVG sous forme de texte (test : `test.svg`, laissé dans le bac à sable faute de
  pouvoir le supprimer).
- **Ce qui est établi sur la vidéo** (page YouTube et oEmbed, lus le 03/11/2026) :
  - titre « Pokémon TCG Pocket Battle #pokemon », chaîne **SweetGameBuddy**, mise en ligne le
    **17/03/2025** ;
  - durée **398 s** ; description : « In this video I play Pokémon TCG Pocket. I find this game very
    fun. » ;
  - la planche d'aperçus YouTube existe en **101 × 180 px**, soit un format **portrait** (DÉDUIT du
    rapport 9:16). Elle compte **81 vignettes**, une toutes les **5 s**, en **9 planches de 3 × 3**. La
    planche `M0` répond `200 image/jpeg` (23 300 octets) ;
  - l'URL de base est
    `https://i.ytimg.com/sb/feAya7Pixc4/storyboard3_L3/M<n>.jpg?sqp=…&sigh=…`.
    La spécification complète est dans `playerStoryboardSpecRenderer` de la page de lecture.
- **Pour débloquer** : une session qui a le droit d'écrire peut lancer ces commandes, puis relire les
  images.
  ```bash
  cd <dossier-de-travail>
  python3 -m venv venv && venv/bin/pip install yt-dlp imageio-ffmpeg
  venv/bin/yt-dlp -f "bv*[height<=480]+ba/b[height<=480]" -o video.mp4 https://youtu.be/feAya7Pixc4
  FF=$(venv/bin/python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
  mkdir -p frames && "$FF" -i video.mp4 -vf fps=1/3 frames/f_%03d.jpg
  ```

---

## 1. Combat dans Pokémon TCG Pocket

### 1.1 Disposition du plateau

| Élément | Ce qui est établi | Niveau | Source |
|---|---|---|---|
| Zones | Deck **face cachée**, Poste Actif, Banc, pile de défausse **face visible**, **consultable à tout moment par les deux joueurs** ; main de **10 cartes au plus** | **VU** (texte de l'app) | capture `docs/preuves/astuces-2026-10-20/03-zones-de-combat.png` (relue le 03/11/2026) |
| Banc | 3 emplacements | LU | même lot, `05` (transcription `README.md` l. 85-88) |
| Zone d'énergie | « un socle en cercle avec un cercle intérieur, **en bas à droite de l'écran** ». La grosse énergie posée dessus est celle du tour, la petite dans le cercle intérieur annonce **le tour suivant** | LU | https://www.pokemon-zone.com/articles/how-to-play-pokemon-tcg-pocket/ (21/09/2024) |
| Réglage d'affichage | Paramètres > Combat : **« afficher la prochaine énergie générée »** et **« vérifier les actions restantes »** (un rappel avant de finir le tour), tous deux désactivables | LU (transcription d'une vidéo) | https://www.youtube.com/watch?v=rVB2vwES00s (16/10/2024) |
| Fin de tour | Il existe un bouton **End Turn** ; une attaque termine aussi le tour | LU | https://bulbapedia.bulbagarden.net/wiki/Battle_(TCG_Pocket) (page de 2026) ; capture `05` (« une fois l'attaque lancée, votre tour est terminé ») |
| Minuteurs | **90 s** par tour, **20 min** par joueur en versus ; en classé, un tour dépassé divise le suivant par deux (**45 s**). « Any additional animations are included in the opponent's time » | LU | Bulbapedia, même page |
| Main en bas : nombre de cartes visibles, part de la carte qui dépasse | **non documenté**. Aucune source textuelle ne le décrit. C'est exactement ce que la vidéo aurait dû montrer | — | — |
| Agrandissement au toucher | **non documenté** pour le combat. Hors combat, une carte se tient au doigt, s'incline en 3D et se retourne d'un toucher (tutoriel du visualiseur 3D) | LU | https://60fps.design/shots/poke-mon-tcg-pocket-3d-card-move-around-tooltip (consulté le 03/11/2026) |

### 1.2 Gestes du joueur

| Geste | Ce qui est établi | Niveau | Source |
|---|---|---|---|
| Attaquer, battre en retraite, activer un talent | « tapping the Pokemon card and then tapping the relevant button » : on touche la carte, **puis** un bouton | LU | https://www.thegamer.com/pokemon-tcg-pocket-how-to-battle/ (22/10/2024) |
| Jouer un Objet ou un Supporter | La carte se **glisse au centre du tapis** | LU | même source |
| Attacher l'énergie | On **glisse** l'énergie de la zone vers un Pokémon | LU | https://cardgamer.com/guides/battle-and-build-decks-in-pokemon-tcg-pocket/ (non daté) |
| Pile ou face | La pièce se **lance d'un geste du doigt**, et la trajectoire suit la force du geste (« fort = haut et loin ») | LU | https://note.com/miteo/n/n9cea07b4cc91 (28/08/2025) |
| Retour tactile | « Une légère irisation apparaît à l'endroit touché » : un retour visuel à chaque toucher | LU | https://note.com/rubul_cc/n/n87fca9f0f989 (05/11/2024) |

### 1.3 Cartes posées face cachée, puis révélées

- **VU** (texte de l'app, capture `docs/preuves/astuces-2026-10-20/04-preparation-dun-combat.png`,
  relue le 03/11/2026) : les joueurs posent leur Poste et leur Banc **sans voir ceux de l'adversaire**.
  Ils touchent « Commencer », et quand les deux sont prêts, « les Pokémon qu'ils ont mis en jeu sont
  **révélés** ». Un bouton « Réinitialiser » rend les cartes posées à la main.
- LU : « Place one Basic Pokémon **face down** in the Active Spot, then both players flip them face up
  at the same time » (https://www.pocketgg.com/en/game-guide, non daté ; même chose sur Pokémon Zone,
  21/09/2024).
- Pendant le tour lui-même, des poses face cachée ou des révélations : **non documenté**.

### 1.4 Animations : pioche, attaque, dégâts, K.O., fin de tour

| Moment | Ce qui est établi | Niveau |
|---|---|---|
| Pioche | Automatique en début de tour (capture `05`). L'animation n'est **pas documentée** | LU / non documenté |
| Attaque, dégâts | **non documenté**. La recherche du 26/10/2026 (**non archivée**, §3.2) en était déjà arrivée là. Un seul indice : une animation par type d'énergie existerait (« eau »), d'après un fil de joueurs | non documenté |
| Durée des animations | Le chrono **continue de tourner pendant les animations** (forums, février 2025, cités au §3.2 du même fichier). Bulbapedia attribue les animations supplémentaires au temps de l'adversaire | LU |
| K.O. | Le Pokémon K.O. part à la défausse avec ses énergies, et le joueur choisit qui le remplace (capture `06`). L'animation n'est **pas documentée** | LU / non documenté |
| Fin de tour | Bouton End Turn, plus le rappel « actions restantes » s'il est activé (voir §1.1) | LU |
| Journal | Un **Battle Log** se consulte **pendant et après** le combat : « This shows every move but it's not easy to extract the data » (https://justabout.com/pokemon/37755/pokemon-tcg-pocket-can-you-export-battle-logs, 25/11/2024). Il est jugé peu pratique : « the battle log is so inconvenient to parse through » (https://www.reddit.com/r/PokemonPocket/comments/1jmsgsv/, 29/03/2025). **Où il se trouve à l'écran : non documenté** | LU |
| Combat automatique | Il existe, mais le réglage **n'est pas retenu** d'une partie à l'autre | LU, https://note.com/rubul_cc/n/n920046254d09 (03/07/2025) |

> **Piège évité** : le fil https://community.pokemon.com/en-us/discussion/24388 (08/06/2026), qui parle
> d'un bouton « log » sur l'écran de résultat et d'un bouton « Export » en haut à droite, mentionne des
> **cartes Récompense**. Il concerne donc **TCG Live**, pas Pocket (Pocket n'en a pas, capture `03`).
> Je ne le retiens pas pour Pocket.

---

## 2. Comment le tutoriel de Hearthstone parle au joueur

Il y a deux tutoriels. L'**ancien** (2013–2023) compte six adversaires et commence par Hogger ; le
**nouveau** (depuis le patch 27.6, en 2023) en compte trois et commence par Rexxar
(https://hearthstone.wiki.gg/wiki/Tutorial, révision lue le 03/11/2026).

| Point | Ce qui est établi | Niveau | Source |
|---|---|---|---|
| Qui parle | Dans l'ancien tutoriel, **l'Aubergiste est la voix off** qui présente les combattants (« Ooh! A new challenger! It's Jaina Proudmoore, the mage! », « Let the battle begin! »). Ensuite **Jaina (le joueur) et l'adversaire** se donnent la réplique | LU | https://hearthstone.wiki.gg/wiki/Hogger_(boss) (transcription) ; https://hearthstone.wiki.gg/wiki/The_Innkeeper |
| D'où vient l'Aubergiste | Il s'inspire du narrateur de *Bastion* (Ben Brode, 24/04/2016) | LU | The_Innkeeper, « Trivia » |
| Longueur d'une réplique | Très courte, **3 à 12 mots** : « I need some minions to fight for me. », « Your move, GNOLL. », « 5 Attack? That thing is huge! », « *snort* » | LU (comptage fait sur la transcription) | Hogger_(boss) ; https://hearthstone.wiki.gg/wiki/Rexxar_(tutorial) |
| Où s'affiche une réplique | Une émote s'affiche « in a speech bubble **next to the character's portrait** », avec le son | LU | https://hearthstone.wiki.gg/wiki/Emote |
| | Les répliques du tutoriel s'affichent de la même façon, dans une bulle à côté du portrait de celui qui parle | **DÉDUIT** (même moteur de répliques ; pas de source explicite) | — |
| La consigne est séparée de la réplique | Les **notes** forment un autre canal que les répliques. Exemples : « Play minions and use them to attack Hogger. Deal enough damage and you win! », « Minions must wait a turn to attack. », « Crush this gnoll! » puis « Click him! » en pointant le serviteur. Elles tiennent en **une ou deux phrases** | LU | Hogger_(boss) ; slides de Derrick Grant : « The copy is extremely direct and rarely more than 2 sentences long » (https://slides.com/derrickgrant/deck-1, non daté) |
| Lien avec ce qu'on montre | Des **flèches rouges** désignent l'action ou la cible. Au premier serviteur, la **moitié du plateau du joueur s'éclaire en vert** pour montrer où le poser. La **carte à jouer luit** | LU | https://hearthstone.wiki.gg/wiki/Tutorial_(removed) ; Hogger_(boss) (« A red arrow points to the Raider. When it is selected, Jaina's side of the board is highlighted green ») ; slides de Grant |
| Bouton de fin de tour | Il passe du **jaune au vert** quand il faut l'utiliser, sans aucune fenêtre modale : « rather than obscuring your UI with big modals … a much less obtrusive colour change and hovering arrow » | LU | slides de Grant |
| Mise en valeur par la taille | Au survol d'un serviteur, l'Attaque et la Vie **grossissent** et une infobulle d'aide apparaît (au lieu du zoom habituel) | LU | Tutorial ; Tutorial_(removed) |
| Refus expliqué par le personnage | Une carte jouée sans mana fait dire à Jaina « I need to wait a turn for my mana to recharge. » Une fin de tour trop tôt affiche « Not yet! You have more cards to play! » ou « Not yet! You can still attack. » | LU | Tutorial |
| Repères ajoutés | Dans l'ancien tutoriel, « +1 » cristal qui s'efface en début de tour, « You have X mana. » **sous** la bannière « Your Turn », mot « Cost » posé sur le pouvoir héroïque. Le nouveau tutoriel fait **luire en jaune** les cartes à jouer | LU | Tutorial_(removed) ; Tutorial |
| Révélation progressive de l'interface | L'historique ne montre aucune carte avant la mission 3, et le nombre de cartes du deck reste caché jusqu'à la mission 6 | LU | Tutorial_(removed) |
| Début spectaculaire | Un paquet « Free cards! » au centre **craque et explose** ; le portrait de Jaina en jaillit avec une **tempête de cartes**, puis le portrait se met en place et les cartes volent dans le deck | LU | Hogger_(boss) |
| Récapitulatif entre deux combats | Un écran « Mission Progress » rappelle la règle apprise, avec un style d'illustration plus simple | LU | Tutorial ; slides de Grant |
| Durée d'une bulle, place exacte à l'écran, flèche de la bulle | **non documenté** | — | — |

---

## 3. Ouverture d'un paquet

### 3.1 Hearthstone

| Point | Ce qui est établi | Niveau | Source |
|---|---|---|---|
| Le geste | Les paquets sont **à gauche**. On en **prend un et on le lâche au centre** (ou on appuie sur Espace). Les légendes de la galerie disent : « Picking up the pack », « Placing it in the center », « The pack bursting open… », « …to reveal… », « …5 brand new cards » | LU | https://hearthstone.wiki.gg/wiki/Open_Packs ; https://hearthstone.wiki.gg/wiki/Card_pack (galerie « Pack SS 1–9 ») |
| Sortie des cartes | « followed by a short animation, and the 5 cards from the pack will appear, displayed **face down** ». On retourne **chaque carte une à une**, au clic ou à la barre d'espace. Une fois les 5 retournées, Espace ouvre le paquet suivant | LU | Open_Packs ; Card_pack |
| Dos des cartes | Le dos est **celui que le joueur a choisi** | LU | Card_pack |
| Lueur de rareté **avant** la révélation | Au **survol** d'une carte encore face cachée, une lueur prend la couleur de sa rareté : **commune = aucune lueur**, **rare = bleu**, **épique = violet** (« purple » sur Card_pack, « pink » sur Rarity), **légendaire = orange**. Ce sont les couleurs d'objets de *World of Warcraft* | LU | Card_pack ; https://hearthstone.wiki.gg/wiki/Rarity |
| Gemme sur la carte | Elle reprend la même échelle de couleurs : blanc, bleu, violet, orange | LU | Rarity |
| Révélation des hautes raretés | « revealed with a **burst of colour** and an enthusiastic announcement from the Innkeeper » | LU | Open_Packs |
| Ce que crie l'Aubergiste | « Rare! », « Epic! », « Wooah, Legendary! », « Golden common! », « Golden rare! », « Golden epic! », « WAAAH, GOLDEN LEGENDARY! » (fichiers `VO_ANNOUNCER_*`). La commune n'a **pas** d'annonce | LU | https://hearthstone.wiki.gg/wiki/The_Innkeeper |
| Dorée | Cadre doré, **illustration animée** propre à chaque carte. L'annonce dorée remplace l'annonce simple | LU / DÉDUIT (le remplacement) | https://hearthstone.wiki.gg/wiki/Golden_card ; The_Innkeeper |
| Après la révélation | Une carte nouvelle dans la collection porte un **contour bleu lumineux et le mot « NEW! »** | LU | Card_pack |
| Son d'ouverture du sachet | **non documenté** (pas de description écrite trouvée) | — | — |
| Durées | **non documentées** | — | — |

### 3.2 Pokémon TCG Pocket

| Point | Ce qui est établi | Niveau | Source |
|---|---|---|---|
| Choix du sachet | D'abord l'un des trois visuels, puis un **carrousel 3D** de sachets qu'on fait tourner d'un geste, avec de l'inertie et un sol qui reflète. Un toucher **zoome** sur le sachet choisi. On peut le **retourner** pour voir le dos, et les sachets **flottent** en léger décalage | LU | https://www.polygon.com/pokemon/452814/ (19/09/2024) ; https://60fps.design/shots/poke-mon-tcg-pocket-3d-spin-packet-picker-interaction ; …-choose-booster-pack-interaction ; …-booster-pack-floating (consultés le 03/11/2026) |
| La déchirure | On suit du doigt une **ligne lumineuse** en haut du sachet : « Dragging along the path creates a **glowing light trail**, triggering a realistic tearing animation. The pack top detaches » | LU | https://60fps.design/shots/poke-mon-tcg-pocket-swipe-packet-to-reveal-card-interaction |
| Son et vibration | Le son « riiiip » a été choisi après l'ouverture de vrais paquets (Satoru Nagaya, directeur artistique chez Creatures). L'appareil **vibre** à la découpe | LU | Polygon (19/09/2024) ; https://note.com/design101_sym/n/n2452bc384dd7 (03/04/2026) |
| Sortie des cartes | La carte **monte hors du sachet** et grandit jusqu'à être nette, avec une **gerbe** et un badge « NEW ». Ensuite on fait **défiler les cartes une à une d'un geste**, et l'on peut **décaler le paquet pour jeter un œil** à la suivante. Un geste vers le haut range les cartes dans le Cartodex | LU | 60fps.design (ci-dessus) ; https://screenrant.com/pokemon-tcg-pocket-hands-on-preview/ (19/09/2024) ; https://note.com/miteo/n/n9cea07b4cc91 (28/08/2025) ; https://note.com/airi_okuno/n/n08c70afabee1 (10/12/2024) |
| Révélation d'une carte holographique | Un **reflet holographique** balaie l'illustration, une **étoile rebondit** dans le coin bas gauche (effet de ressort), puis « Tap to Proceed » apparaît en fondu | LU | https://60fps.design/shots/poke-mon-tcg-pocket-card-flip-animation |
| Fin | Deux petits dos de carte **tombent vers l'icône Collection** de la barre du bas, puis une bulle « Grand total cards acquired » affiche un grand « 5 » | LU | https://60fps.design/shots/poke-mon-tcg-pocket-cards-acquired-drop-animation |
| Signal de rareté avant la révélation | « sparkles and special sounds to signal rare cards » : **source faible** (blog marchand), le moment exact n'est pas précisé | LU (faible) | https://dxcollection.com.sg/the-hidden-joy-of-tcg-pack-opening/ (23/09/2025) |
| Ordre selon le côté ouvert | Ouvert par l'avant, les cartes sortent face cachée et la meilleure arrive **en dernier** ; ouvert par l'arrière, elles sortent face visible et la meilleure arrive **en premier** | LU (**commentaire de lecteur**, non vérifié) | commentaire sous https://www.polygon.com/pokemon/477709/ (12/11/2024) |
| Couleur de lueur par rareté, durées | **non documenté** | — | — |

---

## 4. Ce que je n'ai pas pu vérifier

1. **Tout ce qui devait venir de la vidéo** (§0) : place de la main, part visible des cartes, zoom au
   toucher, animations de pioche, d'attaque, de dégâts, de K.O. et de fin de tour, emplacement du
   journal, durées.
2. **Aucune capture d'écran** de Hearthstone ni de Pocket n'a été vue. Les descriptions de 60fps.design,
   des notes japonaises et des slides de Grant sont des **comptes rendus** d'images, pas des images.
3. **Épique, violet ou rose** : les deux pages du wiki Hearthstone se contredisent (Card_pack contre
   Rarity). Je le signale sans trancher.
4. La source qui affirme que Pocket signale la rareté avant la révélation est faible (§3.2).
