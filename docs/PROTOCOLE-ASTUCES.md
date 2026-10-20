# Protocole — capturer les « Astuces de jeu » (preuve primaire)

> **À qui** : à toi, sur ton téléphone. Aucun outil du dépôt ne peut ouvrir
> l'application *Pokémon TCG Pocket* : sa seule source de règles normative est
> **interne** au jeu. C'est la dernière marche pour que ~15 lignes de
> `AGENTS.md` §4 passent de « supposé » à **observé**.
> Créé le 19/10/2026, après O-009 (voir `docs/DECISIONS.md` D-022).
> **Réécrit le 19/10/2026** après une première tentative : les chemins de menu
> donnés d'origine ne correspondaient pas.

## 0. Comment lire ce document — et pourquoi il ne donne plus de chemins… mais en donne un, désormais sourcé

La première version donnait **un** chemin : *« Menu ☰ → Astuces du jeu (JP : メニュー
→ ゲームのヒント) → Règles de combat »*. Il est tombé à côté, pour trois raisons :

1. il supposait une **langue** (français, japonais en secours) ;
2. les intitulés des Astuces **changent d'une version à l'autre** ;
3. il décrivait une **arborescence**, pas un **contenu** — donc si l'entrée s'appelle
   autrement, rien ne permet de savoir qu'on est au bon endroit.

Cette histoire reste vraie et vaut la peine d'être gardée : elle explique **pourquoi** on a
changé de méthode. Mais elle ne doit plus servir de **renoncement**.

**Le principe demeure : on ne cherche pas un chemin, on cherche un contenu.**
Pour chaque capture, ce document donne :

- **ce que tu cherches**, décrit par ce que la page *dit* ;
- des **intitulés candidats** en français, anglais et japonais — l'un d'eux est
  probablement le bon, aucun n'est garanti ;
- **où ça se trouve probablement** ;
- et une case pour **l'intitulé réel** : celui que *tu* vois s'écrit dans le
  `README.md` du lot. C'est cette formulation qui fait la preuve, pas la mienne.

### Chemin in-app désormais sourcé (20/10/2026)

La source officielle indique le chemin suivant pour accéder aux règles de combat dans
l'application (article support `61745874022553`) :

> **Menu (bouton tout à droite en bas) > Astuces > À propos des règles de combat**
> et **> FAQ détaillée sur les combats**

Ce chemin est **daté** (consulté le 20/10/2026) et **sourcé** (support officiel). Il ne
remplace pas le principe « contenu avant chemin » : il sert de **point de départ
fiable** pour qui capture, sans garantir que les intitulés soient identiques dans ta
version. Les intitulés relevés le 20/10/2026 sont marqués **✔** dans le tableau §2, et
le détail des sources est dans `docs/preuves/regles-2026-10-20/README.md`.

### Où chercher, en général

Trois portes donnent presque toujours accès aux règles de combat :

- le **menu** de l'écran principal (☰ ou l'icône d'engrenage) → une entrée d'aide
  ou de paramètres ;
- un bouton **« ? »** pendant un combat, souvent en haut à droite — il ouvre
  directement les règles de combat ;
- la page **profil / paramètres** → « Aide », « Centre d'aide », « Comment jouer ».

Si ton interface est en japonais : メニュー → **ゲームのヒント** (Astuces du jeu).

### Si une page n'existe pas dans ta version

**Note-le, c'est un résultat.** « La page X n'existe pas » ou « elle s'appelle Y »
devient une **note datée** dans `docs/DECISIONS.md` — pas un échec. Une preuve qui
**contredit** `§4` vaut plus qu'une preuve qui la confirme : c'est celle qui évite
d'implémenter une règle inventée.

---

## 1. Avant de commencer

```
docs/preuves/astuces-<AAAA-MM-JJ>/
├── README.md              ← à remplir (modèle en fin de document)
├── 01-menu-astuces.png
├── 02-tour.png
├── 03-zone-energie.png
├── 04-statuts.png
├── 05-ko-defaite.png
└── 06-types-energie.png
```

Une date par lot, un dossier par lot. **Ne pas écraser un lot précédent** : une
preuve datée ne se remplace pas, elle se complète.

À noter une fois pour tout le lot : **date**, **version de l'application** (elle est
quelque part dans les paramètres), **modèle d'appareil et version d'OS**, **langue
de l'interface**. Sans ces quatre-là, une capture est inexploitable dans six mois.

---

## 2. Les 6 captures du lot A

> **Deux colonnes, deux langues.** « Intitulés candidats » emploie les mots de **l'app** —
> c'est ce que tu chercheras à l'écran. La dernière colonne désigne **nos** lignes de
> `AGENTS.md` §4 : elle garde le vocabulaire du projet (*Chariot*, *café*, *Rack*…), et ce
> n'est **pas** ce qu'il faut chercher dans l'app.
> Les intitulés marqués **✔ relevé le 20/10/2026** sont ceux qui ont été vus sur l'écran.

| # | Fichier | Ce que tu cherches (par le contenu) | Intitulé dans l'app — **à chercher tel quel** | Ligne de `§4` que ça prouve |
|---|---|---|---|---|
| 1 | `01-menu-astuces.png` | **L'entrée qui mène à l'aide**, avec son intitulé visible | FR **« Astuces »** ✔ puis **« À propos des règles de combat »** ✔ · EN « Tips » / « About Battle Rules » · JP ゲームのヒント | — (elle prouve l'accès, pas une règle) |
| 2 | `02-tour.png` | Une page qui décrit **le déroulé d'un tour** : qui commence, ce qu'on pioche, quand on attache, quand on attaque | FR **« Déroulement d'un tour »** ✔ · EN « Turn flow », « How to play » · JP ターンの流れ | Premier joueur · Pression (1/tour, café non consommé) · Évolution impossible au premier tour |
| 3 | `03-zone-energie.png` | Une page qui décrit la **zone d'énergie** : combien par tour, l'attachement, l'incolore | FR **« zone Énergie »** ✔ · EN « Energy Zone » · JP エネルギーゾーン | Machine à café (1 généré + 1 attaché) · Types de café · incolore accepte tout |
| 4 | `04-statuts.png` | Une page qui liste les **conditions spéciales** — leur nom, leur effet, **et l'ordre** dans lequel elles se résolvent | FR **« Contrôle Pokémon et États Spéciaux »** ✔ · EN « Special Conditions » · JP 特殊状態 | Statuts et **ordre des statuts** · cumul |
| 5 | `05-ko-defaite.png` | Une page sur le **K.O., les points et la victoire** : combien de points pour gagner, ce qui arrive quand un Pokémon est K.O., qui choisit le suivant | FR **« Mettre un Pokémon K.O. et issue d'un combat »** ✔ · EN « Knock Out », « Victory » · JP きぜつ / 勝敗 | Défaite (3 Interventions, ou plus aucun Planqué) · craquage · **qui fournit la relève** |
| 6 | `06-types-energie.png` | L'écran **d'édition du deck**, là où on **choisit les types d'Énergie** de la zone Énergie — et le **nombre** qu'on peut en prendre | FR « deck » (l'app dit **deck**, vu ✔ dans « Déroulement d'un tour ») · EN « deck » · JP デッキ | **Types de café : le plafond de 3** ← la ligne la plus importante du lot |

### Le bonus qui vaut de l'or

Si tu tombes dessus en jouant : **l'écran où l'on choisit le nouveau Pokémon après un K.O.**
C'est la preuve la plus directe qu'**un joueur choisit sa relève** — une ligne que
D-022 a tranchée sans source. Range-la en `07-releve.png`.

Deux autres, si elles se présentent sans effort :

- l'écran de **validité du deck** (20 cartes, max 2 par nom) → `08-deck-valide.png` ;
- l'écran de **main de départ** s'il propose quelque chose (remélange ? choix ?) →
  `09-main-depart.png`. C'est la question de la « reprise de poste », que D-022 dit
  absente — une capture qui le **confirme** clôt O-009 pour de bon.

---

## 3. Ranger le lot

Le `README.md` du dossier doit contenir : **date**, **version de l'application**,
**appareil**, **langue**, et pour chaque image la **ligne de `§4` qu'elle confirme ou
contredit** — en **recopiant la formulation exacte du jeu**, pas un résumé.

Le modèle prêt à remplir est dans `docs/preuves/README.md` §« Modèle de README ».
Le guide de terrain pour le téléphone est dans `docs/CAPTURES.html`.

---

## 4. Ce que ça débloque, ligne par ligne

| Ligne de `AGENTS.md` §4 | Aujourd'hui | Après capture |
|---|---|---|
| Main de départ, **pas de reprise de poste** | Décidé (D-022), non observé | Observé |
| Premier joueur : ne pioche pas, n'attache pas de café | Supposé | Observé |
| Ordre des statuts (Surcharge → Épuisement → Sieste → Immobilisation) | Supposé | Observé |
| Statuts **cumulables** | Supposé | Observé |
| Évolution impossible au premier tour de **chaque** joueur | Supposé | Observé |
| Café **non consommé** par la Pression | Supposé | Observé |
| Machine à café : slot occupé → pas de nouveau café | Supposé | Observé |
| Défaite si plus aucun Planqué | Décidé (D-022), non observé | Observé |
| **Qui choisit la relève** | Décidé (D-022), non observé | Observé |
| **Plafond de 3 types de café**, ordre aléatoire | Supposé — **bloque le ticket #30** | Observé |
| Collègue 1 par tour, Objet illimité | Supposé | Observé |

**Le plafond de 3 est la ligne la plus urgente du lot** : le ticket #30 (le type de
café) s'arrête délibérément avant de le graver, justement parce qu'aucune source ne
le soutient. Ces deux captures (n° 3 et n° 6) le débloquent.

---

## 5. Règle de méthode

**Ne pas paraphraser.** La valeur de la preuve tient à la formulation exacte du jeu.
Une capture horodatée vaut mieux qu'un résumé — c'est précisément le reproche qu'on
fait aux sources secondaires.

Tant que ces captures n'existent pas, ces lignes restent marquées **non vérifiées**
dans `docs/MIROIR-2026-DELTAS.md`, même après D-022 : une décision datée tranche ce
qu'on **implémente**, elle ne prouve pas ce que fait le jeu.
