# Triage Labels

The skills speak in terms of **five canonical triage roles** and **two categories**. Ce fichier
les mappe sur les étiquettes réellement employées dans le tracker du projet.

**Deux catégories** — tout ticket trié en porte exactement une, avec son état :

| Rôle (mattpocock/skills) | Notre étiquette | Sens |
| --- | --- | --- |
| `bug` | `bug` | quelque chose est cassé |
| `enhancement` | `enhancement` | une fonctionnalité ou une amélioration |

Le **domaine** (art, IA, infra, PvP, UI…) n'est pas une étiquette : il est porté par le
**préfixe du titre** (`PvP — …`, `Infra — …`), et lisible dans la liste. On filtre par
`gh issue list --search "PvP in:title"` plutôt que par une étiquette de plus à tenir.

Seule exception, **gardée parce qu'elle sert** : `documentation` — sept tickets l'ont portée, tous
fermés au 27/10/2026. Les sept autres étiquettes que GitHub installe par défaut (`accessibility`,
`duplicate`, `good first issue`, `help wanted`, `invalid`, `question`) ont été **retirées** le
21/10/2026 : elles n'avaient jamais servi, et elles encombraient le filtre. Une étiquette qui
revient se recrée en une commande.

**Cinq états** :

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | **Une décision manque** — choix de conception, jugement, orientation — ou le ticket dépend d'un autre travail : un humain tranche, puis l'agent exécute |
| `needs-info`               | `needs-info`         | **On attend une information de la personne qui a signalé** : on lui écrit ce qui manque, et le ticket revient en `needs-triage` dès sa réponse |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | **Geste qu'aucun agent ne peut faire** : appareil réel, écoute, compte, clé, serveur, fusion — jamais un travail qui se termine par du code |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

**Ce que l'état dit, et ce qu'il ne dit pas** (**D-129**, 27/10/2026). Les états disent **qui agit**, pas où en est le travail :

- `needs-triage` — **une décision manque**. Ce n'est pas « quelqu'un doit coder » : c'est « personne ne sait encore quoi coder ». Un **choix de conception, un jugement, une orientation** en font partie : on tranche, on l'écrit dans le ticket, puis un agent exécute. Un ticket **bloqué par un autre travail** porte aussi `needs-triage`, et **dit son bloqueur dans le corps** (« Bloqué par #251 ») : il n'existe pas d'étiquette `blocked`, qui serait une liste de plus à tenir.
- `ready-for-agent` — **spécifié**, un agent peut le prendre tel quel et rendre ses preuves.
- `ready-for-human` — un **geste** qu'aucun agent ne peut faire : créer un serveur, poser un secret, valider un compte, mesurer sur un téléphone réel, écouter un son dans une vraie fin de combat, fusionner une PR. Rare, et jamais pour dire « c'est du code, mais je préfère le faire moi-même » : un travail qui se termine par du code n'est pas `ready-for-human`, il est `needs-triage` (la décision manque encore) ou `ready-for-agent`.
- `needs-info` — **on attend une information de la personne qui a signalé** : un testeur arrivé par le formulaire, par le comité (post-it IP/OUF, #400) ou par Discord. On y poste deux listes — « ce qui est établi » et « ce qu'il nous faut de @rapporteur » —, avec des questions précises, et le ticket **repasse en `needs-triage` dès que la réponse arrive** (la transition de la compétence amont). Un ticket de **mainteneur** qui attend un arbitrage n'est jamais `needs-info` : il n'y a personne à qui écrire, ni personne à attendre.

Avant D-129, douze tickets portaient `ready-for-human` alors que neuf n'attendaient qu'une décision : le label faisait croire que douze tickets attendaient une personne, et le travail ne démarrait pas.

**La frontière « décision / geste », et pourquoi ces lignes existent** (01/11/2026). D-129 liste **trois** états ; `needs-info` survit à D-062 mais D-129 ne dit rien de lui, et sa seule définition était une phrase anglaise sans sujet. Son seul usage mesurable est celui de trois tickets (#554, #555, #556, le 31/10/2026), les trois fois pour une **décision interne** ou une mesure, jamais pour un rapport de testeur incomplet — et `gh issue list --state all --label needs-info` en rend **0** le 01/11/2026, la mesure portant sur les étiquettes posées, pas sur l'historique des retraits. Et deux formulations nées dans ce document plutôt que dans l'acte — « trancher une orientation » ici, « une décision, un prototype » dans `CONTRIBUTING.md` — même responsabilité : elles envoyaient des décisions dans un état où aucun agent ne vient les chercher. D'où les trois lignes ci-dessus : une décision est `needs-triage`, un geste est `ready-for-human`, et `needs-info` n'attend qu'un **rapporteur**.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

**Tout ticket ouvert porte les deux** (Bastien, 27/10/2026) : exactement une **catégorie** et
exactement un **état**. Mesuré le 27/10/2026 : **35 tickets ouverts, 35 catégories, 35 états** —
`ready-for-agent` 16, `ready-for-human` 18, `needs-triage` 1, `needs-info` 0, `wontfix` 0. Mesuré
le 01/11/2026, après le triage des trois tickets sans étiquette (#560, #566, #569) et des trois
`needs-info` : **22 tickets ouverts, 22 catégories, 22 états** — `ready-for-agent` 14,
`ready-for-human` 4, `needs-triage` 4, `needs-info` 0, `wontfix` 0 ; par étape, `alpha` 5,
`beta` 13, et 4 sans étape. Un ticket neuf reçoit donc `needs-triage` et sa catégorie à la
création (`gh issue create --label`), et non « rien » en attendant.

**Les cartes wayfinder en portent aussi.** Le skill `wayfinder` écrit qu'une carte et ses tickets
ne portent **que** des étiquettes `wayfinder:` ; ici, c'est l'inverse qui a été choisi : #264 et
ses tickets #267, #268 et #269 portent leur catégorie et leur état comme les autres, pour qu'un
seul filtre lise « tout ce qui est ouvert ». L'état dit alors qui attend quoi : `ready-for-human`
pour un **geste** de Bastien (réagir au prototype d'ouverture de paquet, valider une manipulation)
et `needs-triage` pour une **décision** qu'il tranche et qu'un agent exécute ensuite (les
grillings, le transfert d'organisation), `ready-for-agent` pour la carte elle-même, dont une
session peut prendre le prochain ticket de la frontière.

**Étape du projet** — une troisième dimension, **orthogonale** aux catégories et aux états.
Elle dit **à quelle étape du produit** le ticket doit être livré, pour qu'on puisse filtrer
« ce qui bloque la prochaine version » sans lire chaque titre. Elle suit `docs/VERSIONS.md` et
D-048 :

| Étiquette | Sens | Exemple dans le tracker |
|---|---|---|
| `alpha` | nécessaire pour **sortir de l'alpha** : le solo **joué par des testeurs**, la boucle qui tient — contenu incomplet, casse assumée (D-048, D-117) | le guide d'installation (#300), les problèmes connus (#299) |
| `beta` | nécessaire pour le **PvP jouable**, l'**URL stable**, le périmètre solo complet et les **bases illustrées** (D-048, D-063) | le PvP par code (D-049), les tâches d'UI du combat (#284 à #295) |
| `release` | nécessaire pour **1.0.0** : le reste de `PROPOSITION.md` §5.1 (classé, économie…) | l'échelon classé |

Règles de triage :

- **Un ticket porte au plus une étape.** Un ticket qui n'en a pas (dette, outillage hors
  jeu) n'est pas bloquant pour une étape : il n'en reçoit pas.
- **Ce qui ne bloque pas l'alpha ne porte pas `alpha`** (D-117). La sortie d'alpha a **trois**
  critères : cinq testeurs distincts de nous ont terminé au moins une partie complète, plus aucun bug qui casse la boucle,
  Journée d'intégration finie. L'**UI** ne la bloque pas — le light suffit à inviter (D-116) —
  et la **décision sur les illustrations** en est sortie, puisqu'elle reste un critère de beta
  (D-063). Un ticket d'UI ou d'illustration se range donc en `beta`, pas en `alpha`.
- Le label d'étape dit **à quel jalon le ticket appartient**, pas quand on peut le travailler :
  un ticket `beta` se travaille pendant l'alpha, et c'est arrivé (vague 1 du combat, #284 à #295).
  L'étape est une **échéance**, pas une priorité : elle dit *où* on en a besoin, pas *quand*
  on le fait. Une étape plus tardive ne déclasse pas un ticket d'alpha qui bloque un testeur.
- Une étape se **change** dans le ticket (commentaire + `--remove-label`/`--add-label`), jamais
  silencieusement : c'est une décision de périmètre.
- Au passage d'une étape à la suivante, les tickets `alpha` encore ouverts sont **relus**
  avant d'être repris (`docs/VERSIONS.md`) : une étape close ne doit rien laisser derrière
  elle sans le dire.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
