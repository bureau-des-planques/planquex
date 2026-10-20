# Astuces de jeu — capturé le 2026-10-20

> **Lot en cours de rangement.** Les transcriptions ci-dessous sont faites à la lecture
> directe des captures ; **les fichiers `.png` ne sont pas encore dans ce dossier** (voir
> §« À faire » en bas). Tant qu'ils n'y sont pas, ce README est une correspondance, pas
> encore une preuve au sens de `docs/preuves/README.md`.

- **Application** : Pokémon TCG Pocket, version **à relever** (Paramètres)
- **Appareil** : **à relever** (Android, ratio 880 × 1980)
- **Langue de l'interface** : **français**
- **Note sur les intitulés** : l'entrée réelle du menu s'appelle **« Astuces »**, et la
  section de règles **« À propos des règles de combat »** — pas « Règles de combat » ni
  « Astuces du jeu ». Le protocole (`docs/PROTOCOLE-ASTUCES.md`) listait « Astuces du jeu » :
  c'est l'intitulé du **menu** qui porte ce sens, la sous-section porte l'autre.

## 1. Accès aux règles — l'entrée existe et est nommée

L'écran « Astuces » (capture `01-menu-astuces.png`) liste, sous **« À propos des règles de
combat »** :

| Sous-entrée |
|---|
| Zones de combat |
| Préparation d'un combat |
| **Déroulement d'un tour** |
| **Mettre un Pokémon K.O. et issue d'un combat** |
| **Contrôle Pokémon et États Spéciaux** |
| Nombre maximum de tours et temps imparti |
| Erreurs de connexion pendant les combats |

C'est le chemin qu'annonçait le support officiel (article « I want to know more about the
battle rules » : *Menu (bouton tout à droite en bas) > Tips > About Battle Rules*).

## 2. Correspondance — ce que chaque capture prouve

| Fichier | Ce qu'on y voit — **formulation exacte du jeu** | Ligne de `AGENTS.md` §4 | Verdict |
|---|---|---|---|
| `01-menu-astuces.png` | « Astuces » → « À propos des règles de combat » : *Zones de combat · Préparation d'un combat · Déroulement d'un tour · Mettre un Pokémon K.O. et issue d'un combat · Contrôle Pokémon et États Spéciaux · Nombre maximum de tours et temps imparti · Erreurs de connexion pendant les combats* | — (prouve l'accès et les intitulés) | ✅ accès prouvé |
| `02-tour.png` | « Déroulement d'un tour » → « Le début d'un tour » : *« Lorsque votre tour commence, vous piochez une carte de votre deck et l'ajoutez à votre main. De l'Énergie est ensuite générée dans votre zone Énergie. La zone Énergie affiche l'Énergie qui vient d'être générée et celle qui sera générée après. »* · « Remarque : durant le premier tour de la personne qui joue en premier, **aucune Énergie n'est générée** dans la zone Énergie. » · « Placer un Pokémon sur le Banc » : *« Le Banc a **trois emplacements**, et tant qu'il y a des emplacements vides, vous pouvez y placer autant de Pokémon que vous le souhaitez n'importe quand pendant votre tour. »* | Premier joueur · Rack 3 places | ✅ Rack 3 confirmé · ⚠️ premier joueur : **contredit** (voir §3) |
| `03-zone-energie.png` | « Attacher de l'Énergie aux Pokémon » : *« Tant que vous disposez d'Énergie dans votre zone Énergie, vous pouvez en attacher **autant que vous le souhaitez** à vos Pokémon durant votre tour. Vous pouvez choisir d'attacher de l'Énergie à votre Pokémon Actif ou à vos Pokémon de Banc. De plus, il est possible d'attacher au Pokémon un type d'Énergie différent du sien. »* | Machine à café · Types de café | ⚠️ **contredit** « 1 attachement par tour » (voir §3) |
| `04-attaques.png` | « Utiliser les attaques de vos Pokémon » : *« Seul le Pokémon Actif peut utiliser des attaques. »* · *« Vous ne pouvez pas utiliser une attaque si vous n'avez pas attaché le nombre d'Énergies requis sur le Pokémon. »* · *« Si un type d'Énergie particulier est indiqué à côté de l'attaque, il faudra attacher les Énergies correspondantes au Pokémon. En revanche, les symboles d'Énergie Incolore indiquent que n'importe quel type d'Énergie peut être utilisé. »* · *« Le Pokémon garde les Énergies qui lui sont attachées après avoir utilisé l'attaque, sauf si le texte de la carte indique autrement. »* · *« **N'appliquez pas la Faiblesse aux Pokémon de Banc.** »* · *« **Une fois l'attaque lancée, votre tour est terminé.** »* | Pression 1/tour · café non consommé · Vulnérabilité · incolore | ✅ café non consommé · ✅ 1 Pression (tour terminé) · ✅ Faiblesse +20 (et **pas sur le Banc**) |
| `05-evolution.png` | « Faire évoluer vos Pokémon » : *« Vous ne pouvez pas faire évoluer un Pokémon pendant le même tour où il a été mis en jeu. »* · Remarques : *« Il est impossible de faire évoluer un Pokémon lors du **premier tour de la partie, qu'on joue en premier ou en deuxième**. »* · *« Lorsqu'un Pokémon évolue, tous les effets d'attaques […] ou les États Spéciaux qui l'affectent disparaissent. »* | Évolution impossible au premier tour de **chaque** joueur | ✅ **confirmé**, explicitement |
| `06-retraite.png` | « Battre en retraite » : *« Votre Pokémon Actif peut battre en retraite et échanger sa place avec un Pokémon de votre Banc. »* · *« vous devez défausser une Énergie de votre Pokémon Actif pour chaque symbole d'Énergie Incolore listé dans son **Coût de Retraite**. Les Énergies défaussées peuvent être de n'importe quel type. »* · *« Échangez ensuite le Pokémon qui bat en retraite contre un de vos Pokémon de Banc, et placez ce dernier sur le **Poste Actif**. »* · Remarques : *« Vous ne pouvez battre en retraite qu'une fois par tour. »* · *« Après avoir battu en retraite, le Pokémon garde tous les dégâts subis ainsi que toutes les Énergies qui lui sont encore attachées. »* | Rotation · relève | ✅ Rotation = défausse du coût, confirmé |
| `07-cartes-dresseur.png` | « Jouer des cartes Dresseur » : *« Vous pouvez jouer les cartes Dresseur dans votre main. Elles seront défaussées ensuite. Remarque : vous ne pouvez jouer qu'**une seule carte Supporter par tour**. »* | Objet illimité · Collègue 1/tour | ✅ **confirmé** (seul le Supporter est limité) |
| `08-carte-detail.png` | Fiche de carte (Stari) : *Pokémon · Base · Type 🌊 · PV 50 · **Faiblesse ⚡ + 20** · Retraite ★ · Série A* | Vulnérabilité +20 | ✅ confirmé (le **+20** est écrit sur la carte) |

## 3. Ce que ce lot **contredit** dans `AGENTS.md` §4 — à trancher par une décision datée

Deux lignes du tableau §4 ne résistent pas à la capture. Elles ne se corrigent **pas** en
silence (`AGENTS.md` §1.4) : il faut une décision datée dans `docs/DECISIONS.md`.

1. **« Machine à café : 1 café généré par tour, **1 attachement par tour** »** — faux.
   Le jeu écrit : *« vous pouvez en attacher **autant que vous le souhaitez** »* tant qu'il
   reste de l'Énergie dans la zone. La zone **accumule** donc l'Énergie non attachée, et
   l'attachement n'est pas limité à 1. La règle « 1 par tour » est celle du **TCG physique**,
   pas de Pocket — même erreur de provenance que la « reprise de poste ».
   Corollaire : « si le slot du haut est occupé, pas de nouveau café » devient douteux — la
   capture dit seulement que la zone *affiche* l'Énergie générée et la suivante.

2. **« Premier joueur : **ne pioche pas** »** — non soutenu. Le jeu ne pose qu'**une** seule
   restriction au premier tour du premier joueur : *« aucune Énergie n'est générée dans la
   zone Énergie »*. La règle générale (« Lorsque votre tour commence, vous piochez une
   carte ») n'est assortie d'aucune exception de pioche. À vérifier en jeu, mais la capture
   pointe dans le sens inverse de §4.

## 4. Ce qui reste **non observé** après ce lot

| Ligne de `AGENTS.md` §4 | Pourquoi |
|---|---|
| Statuts et **ordre des statuts** (Surcharge → Épuisement → Sieste → Immobilisation) · cumul | La sous-entrée **« Contrôle Pokémon et États Spéciaux »** existe mais son contenu n'est **pas capturé** |
| Défaite (3 Interventions, ou plus aucun Planqué) · craquage · **qui fournit la relève** | La sous-entrée **« Mettre un Pokémon K.O. et issue d'un combat »** existe mais son contenu n'est **pas capturé** |
| **Plafond de 3 types de café** (bloque le ticket #30) | Se capture dans l'**éditeur de Chariot** — pas encore fait |
| Main de départ **5** · main maximale **10** | Aucune capture |
| Pas de défaite par pioche vide | Aucune capture |

## À faire pour clore ce lot

1. Ranger les fichiers dans **ce** dossier, aux noms du tableau §2
   (`01-menu-astuces.png` … `08-carte-detail.png`).
2. Compléter la version de l'app et le modèle d'appareil (en-tête).
3. Capturer les trois manquants : **« Contrôle Pokémon et États Spéciaux »**,
   **« Mettre un Pokémon K.O. et issue d'un combat »**, et l'**éditeur de Chariot**
   (types d'énergie).
4. Vérifier en jeu la question de la **pioche du premier joueur** (§3, point 2).
