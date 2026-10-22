# Inventaire du nommage — points à trancher

> Relevé le 19/10/2026, **avant** l'écriture des cartes du set : c'est le bon moment, parce
> que les noms des 8 Collègues, des 3 Objets et de 226 Planqués en dépendent.
> Ce document n'acte rien. Il liste ce qui existe, et signale les **incohérences**
> que j'ai trouvées — c'est à toi de dire lesquelles te gênent.
> Autorité : `AGENTS.md` §3 pour le vocabulaire, `docs/DECISIONS.md` pour les choix.
>
> ⚠️ **Ce document est l'« avant », pas l'état courant.** Il a été relevé le 19/10/2026 pour
> préparer D-024/D-026/D-027 et il en garde la trace. En particulier : **§1, §2 et §4 contiennent
> des noms périmés** (`MANAGER`, `HAPPINESS`, `TECHNICIEN`, `INTERIMAIRE`, la carte « Médecin-chef
> Cadre » — le code dit aujourd'hui `FACTION_META` avec `MANAGEMENT`/`QVT`/`ATELIER`/`INTERIM`,
> et `'Médecin-chef COMEX'` ; **§2** relevait les statuts `BURNOUT`, `BLOQUE`, `GELE`, que D-026
> a remplacés par `EPUISEMENT`, `SIESTE`, `IMMOBILISATION`), et **§6 est une liste de propositions**
> dont certaines ont été tranchées autrement (P1 proposait « Encadrement », D-024 a retenu
> **Management**). Pour l'état courant : `AGENTS.md` §3, `docs/DECISIONS.md`, et le tableau vivant
> `docs/CORRESPONDANCES.md`.

## 1. Les 10 factions — et leurs quatre façons d'être nommées

| Code | Nom affiché (`FACTION_META`) | Abréviation | Nature du nom | Type (mécanique) |
|---|---|---|---|---|
| `SSE` | **SSE** | `SSE` | un service | Plante |
| `MANAGER` | **Manager** | `MGR` | une personne | Feu |
| `HAPPINESS` | **Happiness Manager** | `HAP` | une personne, **en anglais** | Eau |
| `AMELIORATION` | **Amélioration continue** | `AC` | un domaine | Électricité |
| `RH` | **RH** | `RH` | un service | Psy |
| `TECHNICIEN` | **Technicien** | `TEC` | une personne | Combat |
| `DIRECTION` | **Direction** | `DIR` | un collectif | Obscurité |
| `SYNDICAT` | **Syndicat** | `SYN` | un collectif | Métal |
| `INTERIMAIRE` | **Intérimaire** | `INT` | un **statut**, pas une entité | Dragon |
| `SUPPORT` | **Service Support** | `SUP` | un service, **redondant** | Incolore |

Sourcé dans `src/data/index.ts` (`FACTION_META`), les noms dans `docs/FACTIONS.md`.

**Ce que j'y vois, par ordre d'importance :**

1. **Quatre registres mélangés.** « Manager » et « Technicien » sont des *personnes*,
   « SSE » et « RH » des *services*, « Direction » et « Syndicat » des *collectifs*,
   « Amélioration continue » un *domaine*. Rien n'oblige à un registre unique, mais
   ça se voit dans une grille de cartes.
2. **Chevauchement des « chefs » sur trois axes.** La faction `MANAGER` (carte
   signature : *Directeur général*), la faction `DIRECTION` (carte signature : *PDG*)
   **et le stade `COMEX`** désignent tous « la hiérarchie ». C'est le point qui me
   paraît le plus susceptible de te gêner.
3. **Anglais résiduel dans deux noms** : « Happiness Manager » et « Service
   Support » — alors que §3 impose le français à l'interface. Défendable comme
   satire du titre à la mode, mais c'est explicite ou ce n'est pas assumé.
4. **Abréviations hétérogènes** : trois lettres (`MGR`, `HAP`, `TEC`, `DIR`, `SYN`,
   `INT`, `SUP`), **deux** lettres (`AC`), et deux qui sont le nom entier (`SSE`, `RH`).
5. **« Service Support » dit deux fois la même chose**, et son `SUP` se confond avec
   « support » au sens technique.
6. **`INTERIMAIRE` est un statut, pas une faction** — c'est pour ça qu'il est le seul
   sans Vulnérabilité (Dragon, §3.2). Cohérent mécaniquement, bancal nominalement.

Deux observations supplémentaires, vérifiées dans les docs :

- **Une faction porte le nom d'une de ses cartes.** La faction `HAPPINESS` s'appelle
  « Happiness Manager », et la carte `Happiness Manager` est son **N+2**
  (`FACTIONS.md:111` : « Chargé QVT → Happiness Manager → Chief Happiness Officer »).
  Dans le Galérodex, « Happiness Manager » désignera donc à la fois un filtre de
  faction et une carte. Idem, en plus léger, pour `INTERIMAIRE` dont la carte
  signature est « Intérimaire légendaire ».
- **Le français et l'anglais cohabitent dans les entités elles-mêmes** :
  « Happiness Manager » (faction), « Chief Happiness Officer » (sa carte COMEX),
  « Service Support » (faction). Le reste est en français.

## 2. Stades, raretés, statuts

| Famille | Valeurs | Remarque |
|---|---|---|
| Stade (`Stage`) | `N+1`, `N+2`, `COMEX` | mélange une progression chiffrée et un acronyme — mais c'est lisible |
| Raretés **en code** | `1D` `2D` `3D` `4D` `1S` `2S` `3S` `COU` | `COU` = Couronne, trois lettres tirées du nom (D-024) |
| Raretés **hautes** (`CARD-SPEC.md` §1) | 3 étoiles (4 variantes) et Couronne (3 variantes) | portées depuis #87 par des variantes **re-raréfiées**, pas par de nouvelles cartes |
| Statuts *(relevé le 19/10/2026, **périmé**)* | `SURCHARGE`, ~~`BURNOUT`~~, ~~`BLOQUE`~~, ~~`GELE`~~, `DERIVE` | Noms d'alors ; D-026 a retenu `SURCHARGE`, `EPUISEMENT`, `SIESTE`, `IMMOBILISATION`, `DERIVE` (état courant : `AGENTS.md` §3.1, `docs/CORRESPONDANCES.md` §6) |
| `Keyword` (maison) | `priorityShift` → **« Changement de priorité »** | seule exception au standard (D-004) |

## 3. Vocabulaire de jeu : deux points de friction

7. **« Reprise de poste » est orphelin.** `AGENTS.md` §3.1 traduit *Mulligan* par
   « Reprise de poste »… mais **D-022 a supprimé la reprise de poste** : Pocket n'en
   a pas. Le terme n'existe plus dans le jeu. À supprimer de la table, ou à
   réaffecter (le choix de la relève après K.-O. ?).
8. **« Courrier » sert à deux choses.** Le **Courrier** est la main, et le **Bac à
   courrier** est le paquet. À l'écran on lit « Courrier 2 » pour la taille de main,
   juste à côté d'un bouton « Ouvrir un bac » : ça se confond.
9. **« Classeur » / « Galérodex » :** `AGENTS.md` §3.1 dit « ne pas dire Classeur
   seul » pour la collection, mais `PROPOSITION.md:194` et `:368` écrivent encore
   « Classeur / Galérodex ». Deux docs, deux règles.

## 4. Nommage des cartes

- **Identifiants** : kebab-case préfixé faction — `sse-medecin-travail`. Les variantes
  portent le suffixe de leur rareté : `-star` (`1S`), `-star2` (`2S`), `-star3` (`3S`),
  `-crown` (`COU`) — #87.
- **Marque du Cadre** : le **nom** affiché dit « **Cadre** » (`Médecin-chef Cadre`,
  corrigé le 19/10), mais l'**identifiant** garde `-ex` (`sse-medecin-chef-ex`) : c'est
  un identifiant de code **persisté** dans les sauvegardes, donc non renommable sans
  migration. Écart assumé, mais c'est un écart.
- **Noms d'attaques en double** : « Diagnostic » ×3 et « Protocole » ×3. Les trois
  occurrences de chaque viennent de la même ligne (Médecin-chef, Médecin-chef Cadre,
  Psychiatre) : volontaire ou pas ?

## 5. Ce que ce document n'invente pas

Aucun nom ne change sans ta réponse. Les 226 cartes de base se répartissent en
**215 Planqués + 8 Collègues + 3 Objets** (`CARD-SPEC.md` §1) : les 11 noms de
Collègues et d'Objets seront tirés de ce que tu auras tranché ici.

## 6. Propositions — **actées le 19/10/2026**

> Ces propositions ont toutes été **validées** en séance : le vocabulaire par **D-026**, les
> conventions de noms de cartes par **D-027**, le déroulé complet étant en §8. Ce qui suit reste
> pour mémoire — c'est la trace de ce qui a été arbitré, et les raisons de chaque choix.

Chaque proposition est chiffrée : **[gratuit]** = aucun identifiant existant ne bouge,
**[cartes]** = des noms de cartes changent, **[code]** = un code de faction change
(et donc le préfixe des identifiants).

> **Règle d'or du moment** : aucune carte n'existe en dehors de **SSE**. Renommer les
> neuf autres factions est **gratuit** aujourd'hui. Une fois les cartes écrites, chaque
> renommage devient une migration de sauvegarde.

### P1 — Les trois axes « chefs »

Le chevauchement est **voulu** (`FACTIONS.md:222` : la Direction, c'est « le COMEX »),
mais il produit trois collisions concrètes.

| Proposition | Détail | Coût |
|---|---|---|
| Faction `MANAGER` → **« Encadrement »** | Sépare l'encadrement de proximité (Feu) des dirigeants (`DIRECTION`) et du stade COMEX | **[code]** `manager-` → `encadrement-` (gratuit : 0 carte) |
| Cadre « Directeur général » → **« Chef des ventes »** | Garde le thème Feu (quotas, pression) sans reprendre « Directeur », déjà pris par Direction | **[cartes]** — **périmé, voir D-029** : la carte signature est « Responsable d'unité » |
| Carte N+1 « Ton N+1 » → **« Ton chef »** | Un nom de carte ne doit pas être un nom de stade | **[cartes]** |
| Carte N+1 « COMEX fantôme » → **« Plaque de porte »** | Même raison ; la plaque dit un nom, il n'y a personne derrière | **[cartes]** |

`DIRECTION` **garde son nom** : c'est bien le COMEX, et sa ligne (« Directeur adjoint »,
« PDG ») est déjà cohérente avec son identité.

### P2 — « Happiness Manager » (faction *et* carte)

| Proposition | Détail | Coût |
|---|---|---|
| Faction → **« QVT »** *(recommandé)* | Le service, pas le titre. La ligne existe déjà : « **Chargé QVT** → Happiness Manager → Chief Happiness Officer ». Sigle réel de 3 lettres, comme SSE et RH | **[code]** `happiness-` → `qvt-` (gratuit) |
| Faction → **« Bien-être »** | Plus explicite, moins corporate, abréviation `BIE` | **[code]** |

Les cartes ne changent pas : « Happiness Manager » redevient un **titre**, ce qu'il est.

### P3 — « Service Support »

| Proposition | Détail | Coût |
|---|---|---|
| Faction → **« Support »** *(recommandé)* | Supprime la redondance (« Service Service »), garde `SUP`, et les trois cartes de la ligne disent déjà « support ». Le code de faction ne bouge pas : seul le nom affiché change | **[gratuit]** |
| Garder tel quel | C'est bien le *helpdesk* : la redondance est défendable | — |

### P4 — « Intérimaire »

| Proposition | Détail | Coût |
|---|---|---|
| Faction → **« Intérim »** *(recommandé)* | Le **secteur**, pas la personne : les cartes gardent « Intérimaire », « Intérimaire confirmé », « Chef d'équipe intérimaire » — comme la ligne l'écrit déjà | **[code]** `interimaire-` → `interim-` (gratuit) |
| Faction → **« Renforts »** | Insiste sur « ils comblent les trous », colle au chaos multi-énergie | **[code]** |

### P5 — Abréviations hétérogènes

Pas de renommage : on **écrit la règle** qui rend l'ensemble cohérent.

> **L'abréviation est le sigle réel quand il existe (SSE, RH, AC, QVT) ; sinon, trois
> lettres tirées du nom (MGR, HAP, TEC, DIR, SYN, SUP).**

`AC` cesse d'être une anomalie : « Amélioration continue » a bien un sigle de deux
lettres. Coût : **[gratuit]**, une ligne dans `AGENTS.md` §3.2 (et dans `FACTION_META`).

### P6 — « Reprise de poste » orphelin

| Proposition | Détail | Coût |
|---|---|---|
| **Retirer** le terme *(recommandé)* | D-022 a supprimé la reprise de poste : le terme n'a plus de référent. « Relève » reste le seul mot pour l'après-K.O. | **[gratuit]** |
| Le réaffecter | « Reprise de poste » deviendrait le *titre de l'écran* de choix après K.O. — mais ça ferait deux mots pour une seule chose | **[gratuit]**, non recommandé |

### P7 — « Courrier » (main) contre « Bac à courrier » (paquet)

| Proposition | Détail | Coût |
|---|---|---|
| La main → **« Bannette »** *(recommandé)* | La bannette, c'est la corbeille à courrier **sur ton bureau** : le paquet reste « Bac à courrier », l'image est la même famille et les deux ne se confondent plus | **[gratuit]** : le code garde `hand`, seule l'interface change |
| Le paquet → « Tournée » | Renommer le paquet marche aussi, mais « bac » est déjà installé dans l'interface (« Ouvrir un bac ») | **[gratuit]** |

### P8 — Noms d'attaque en double

| Proposition | Détail | Coût |
|---|---|---|
| **Écrire la règle** | Une **ligne** garde ses noms d'attaque (le Cadre d'un Planqué garde les siens, comme le fait le jeu réel) ; **deux lignes différentes ne partagent pas un nom** | **[gratuit]** |
| Psychiatre : « Diagnostic » → **« Entretien »** | Garde le double sens (entretien d'embauche / entretien thérapeutique) et libère le doublon avec Médecin-chef | **[cartes]** |
| Responsable hygiène : « Protocole » → **« Désinfection »** | Plus concret, et libère le doublon | **[cartes]** |

Médecin-chef et son Cadre gardent « Diagnostic » et « Protocole » : c'est la **même
ligne**, donc la même identité mécanique.

## 7. Trouvé en chemin (hors des 8 points)

- **« Open-space » est aussi un nom de carte** (`FACTIONS.md:97`, un *Lieu* de la faction
  Manager) alors que c'est le terme du **Banc**. Aucune conséquence au lancement : les
  Lieux sont **hors périmètre** (D-020). À surveiller quand ils arriveront.
- Les 8 Collègues et 3 Objets du lancement sont **déjà esquissés** dans `FACTIONS.md`
  (un par faction, plus quelques autres). Leurs noms suivront les choix ci-dessus.

## 8. Session de nommage — état au 19/10/2026

**Acté dans `DECISIONS.md`** : D-024 (les 10 factions, les types, les deux règles), D-025
(référentiel : atelier MRO d'équipement optronique, nom du jeu conservé).

**Acté en séance, à consigner en fin de famille :**

- **Principe du vocabulaire** : chaque terme suit **le flux d'un équipement dans
  l'atelier** — il arrive, il est diagnostiqué, remis en état, essayé, remis en service.
- **« Café » et « Machine à café » restent** — décision explicite : l'image tient.
- **« NEUF / MRO » nomme les deux familles d'Objets** : matériel à installer / pièces et
  outillage de remise en état. Conséquence : un champ de plus sur les cartes Objet.
- **Le mot « bac » disparaît.** Le paquet de 5 cartes devient **l'Arrivage** (« ce que le
  camion a apporté, on ne choisit pas » — le mot *dit* la mécanique du tirage aléatoire),
  et les trois zones de cartes deviennent des **Viviers** (« le vivier Atelier » — le mot
  RH pour une réserve de candidats). La collision de `CORRESPONDANCES.md` §10 est résolue.
- **La règle du rire**, qui gouverne tous les termes restants : *un mot est bon quand
  c'est celui du système, appliqué à des gens, avec un sérieux imperturbable* — jamais un
  surnom inventé pour la circonstance. C'est ce qui départage « vivier » (des collègues
  comptés comme un stock) de « colis » (un mot d'objet, sans mordant).
- **Le nombre de viviers est ouvert** : le modèle porte un **champ `vivier` par carte**,
  extensible ; une nouvelle zone de site = un nouveau vivier. Le jeu de base fait de même
  (1 à 3 sous-paquets selon l'extension : Genetic Apex en a 3 — Pikachu, Charizard, Mewtwo —
  Space-Time Smackdown 2 — Dialga, Palkia —, Mega Rising 2).
- **Les trois viviers sont des lieux** — **l'Atelier**, **l'Étage**, **les Bureaux** — et ils
  le resteront : un futur vivier sera un lieu lui aussi (le Magasin, le Banc d'essai, les
  Extérieurs). C'est ce qui a écarté la Régie (un mode de facturation), les Moyens (une
  catégorie de ressources) et l'Intendance (une fonction) : ce sont des *fonctions*, pas des
  endroits.
- **« plateau » est écarté** du nommage de la main. Verdict de Bastien : la confusion avec
  *le plateau de jeu* est réelle, et c'est lui qui lira le mot à chaque carte. Le mot reste ce
  qu'il est — un mot de langue courante pour l'aire de jeu — et **la main reste à nommer**
  (lot 1 des stocks).
- **Le Chariot** remplace « Classeur » : le chariot d'atelier qu'on remplit et qu'on roule
  jusqu'au poste — la définition même d'un paquet de 20 cartes. **La Sacoche** est libérée
  par ce choix.
- **Le Rebut** remplace « Archive » (la pile de défausse), et **« mettre au rebut »**
  remplace le verbe « défausser » dans les textes de cartes. C'est le gain le plus large de
  la séance : le mot vient du **contrôle qualité** (le taux de rebut est un indicateur), il
  se lit sans jamais sonner faux, et il va servir dans les textes de cartes. **La Benne** reste
  disponible pour une carte — le contenant et l'état sont deux choses différentes.
- **Le score devient les Interventions.** Cohérent avec « il craque » : ce qu'on gagne, c'est
  une **intervention terminée**. Un COMEX en vaut 2.
- **Le banc (la file d'attente) devient le Rack.** « Banc » est écarté — dans un atelier de
  MRO, un banc c'est un **banc d'essai** — et « open-space » est le mot du bureau qu'on
  quitte. `rack` est un anglicisme, mais il est chez lui dans un atelier français, comme
  `management` et `audit` (D-024).
- **La main reste telle quelle.** Trois raisons, et une qui tranche : `AGENTS.md` §3.1 garde
  déjà « Ability → **Talent** » avec la mention *inchangé*, donc la règle n'est pas « tout
  détourner » ; le mot est déjà français et compris de tout joueur de cartes ; et dans un
  atelier, la main **est** l'outil du métier. C'est la raison qui tranche : garder « la
  main » **libère les mots d'équipement pour les Outils** — les Outils du jeu de base sont
  du matériel *porté* (Giant Cape, Rocky Helmet), donc chez nous une **Ceinture à outils**,
  des **Gants**, un **Casque**, des **Chaussures de sécurité**. La Ceinture serait volée au
  meilleur nom d'Outil du set si elle devenait la main.

### La règle du nom d'origine

> **On garde le nom d'origine quand le mot appartient au langage du jeu de cartes et qu'il
> ne dit rien du monde du travail ; on détourne quand le mot nomme une chose du travail.**

Ce qui reste donc **inchangé** : **la main**, **la pioche** (et « piocher », qui en français
familier veut déjà dire travailler dur — le mot travaille pour nous), **le Talent**,
**l'Objet**, **l'Outil** — ces deux derniers étant *déjà* les mots officiels français du jeu
de cartes. *« les dégâts » et « le K.O. » figuraient sur cette liste avant qu'on retrouve le
cadrage Stress / craquer : voir la section suivante.*

Ce qui est **détourné, et le mérite** : Pression (attaque), Moral (points de vie), Relève
(retraite), Café (énergie), Chariot (deck), Collègue (supporter), Planqué (Pokémon), COMEX
(ex), Heures (Primes), Rebut (défausse). Dans chaque cas, le mot détourné apporte quelque
chose que le mot d'origine n'avait pas.

Et deux cas où l'écart est **discutable** — traité en manche, et tranché : **Vulnérabilité**
est **conservée** (la règle dirait « Faiblesse », mais le mot de l'audit et du risque appliqué
à une machine gagne sa place), et **Lieu** reste en attente, pour l'extension qui dégèlera les
Lieux — « le Site » étant le meilleur candidat.

### Le cadrage Stress / Seuil / craquer

Trois mots retrouvés dans le legacy — `docs/RULES-4b.md:40-42` des versions abandonnées, lecture seule (`AGENTS.md` §9) — cités comme
**idées**, jamais comme règles (`AGENTS.md` §9) :

| Le jeu de base | Nous |
|---|---|
| points de vie | **le Seuil** — la limite avant la casse |
| dégâts subis | **le Stress** — ce que la Pression fait monter |
| K.O. | **craquer** — le salarié lâche, la carte quitte le jeu |
| — | l'échelle des stades est complète : **Entrant → N+1 → N+2**, et **COMEX** pour les ex |

C'est une **représentation**, pas une mécanique : `Stress = Seuil − Moral`, même calcul, même
valeur, même miroir. §4.1 bannit le *mécanisme* 4b — un compteur maison avec ses propres
règles — pas une façon d'afficher les points de vie. Conséquence : « Moral », « dégâts » et
« K.O. » quittent le vocabulaire, et les textes de cartes diront « **prend 10 de stress** »,
« **il craque** ».

Pourquoi c'est mieux : un moral qui *descend* décrit une victime ; un **stress qui monte
jusqu'à ce que le collègue craque** décrit ce que le système fait aux gens. C'est le punch up
exact — et c'est Bastien qui l'avait en tête.

L'idée du legacy pour la défausse — **le Placard**, « mettre au placard » — a été offerte et
non retenue : la pile garde **le Rebut**.

### L'étage du dessus : le **Marché**

Les trois viviers sont **à l'intérieur** d'un set, exactement comme les trois paquets de
*Genetic Apex* sont dans *Genetic Apex*. Le mot est trouvé : une extension est **un
Marché** — le contrat décroché, c'est-à-dire *pourquoi* le set existe. Les sets se
nomment donc « **Marché 01 — Optronique de bord** », « Marché 02 — Remise à niveau »…
*(C'est le même *Genetic Apex* — 226 ◊ + 60 ☆ — qui sert de modèle au set de lancement.)*

### Le site, tel que tu le décris (ton site réel)

| Zone | Qui y est |
|---|---|
| **l'Atelier** | techniciens **opto**, **méca**, **système** (électronique-informatique), et **essai** |
| **le Plateau** *(un étage)* | services support, en open-space : **responsable produit**, **gestionnaire**, **méthodes**, **qualité**, **flux**, **responsable process** |
| **les Bureaux** | **RH**, **paie**, **SSE** |
| **N+1** | le **RPO — responsable pôle** ; avec un **assistant RPO** dont « la fiche de poste dit *ingénieur méthodes atelier* » et qui « en réalité ne correspond à rien » |

### En discussion

- **Les trois stades.** Le mapping documenté (`AGENTS.md` §3.1) est *fidèle* — un `ex`
  n'est pas un stade dans le jeu de base, il existe à tous les stades. Mais sa **lecture**
  est bancale : une carte de base étiquetée « N+1 » laisse croire à une première
  promotion. Ton découpage — *base sans rang, puis N+1, N+2, et l'ex = COMEX* — corrige
  la lecture. Reste à savoir si **COMEX est un stade ou un statut**.

### Matériau pour les 215 noms de Planqués

Vocabulaire réel du site, à exploiter : **RPO**, **assistant RPO**, **responsable
produit**, **gestionnaire**, **méthodes**, **flux**, **process**, **qualité**, **opto**,
**méca**, **système**, **essai**, **banc**, **plateau**, **bureaux**.
