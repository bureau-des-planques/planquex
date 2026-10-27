# Preuves — captures qui rendent une règle « observée »

Ce dossier reçoit les **preuves primaires** : des captures d'écran horodatées, faites
dans l'application *Pokémon TCG Pocket* elle-même — et, pour les deux derniers usages, des
captures de **notre** application. **Un usage, un dossier** :

| Dossier | Ce qu'il prouve | Protocole |
|---|---|---|
| `astuces-<AAAA-MM-JJ>/` | Les **règles** — les pages « Astuces du jeu ». Seul moyen de faire passer une ligne de `AGENTS.md` §4 de **supposé** à **observé** (O-012). | `docs/PROTOCOLE-ASTUCES.md` |
| `ui-<AAAA-MM-JJ>/` | La **structure de l'interface** — la composition des écrans de l'application d'origine, pour relire les nôtres. | `docs/CAPTURES-UI.md` |
| `regles-<AAAA-MM-JJ>/` | La **recherche documentaire** — verdict ligne par ligne contre `AGENTS.md` §4, avec citations exactes, niveaux de preuve (primaire / transcription / secondaire) et URL. **Ne contient pas de capture** : c'est un lot de recherche, qui peut ne contenir **aucune preuve primaire**, et doit alors le dire explicitement (§0 du README du lot). | `docs/preuves/regles-<date>/README.md` (modèle implicite : méthode §0, verdict §2, sources §5) |
| `jalons-<AAAA-MM-JJ>/` | La **recherche documentaire sur les jalons** — ce que les plateformes (Steam, Play, Apple, Xbox) et les studios exigent réellement d'une **alpha** et d'une **bêta**, et comment le travail s'organise autour (production en parallèle, canaux de build, gel de contenu). **Pas une preuve de règle du jeu** : un lot de recherche, qui peut ne contenir aucune preuve primaire et doit alors le dire. | `README.md` du lot (méthode §0, trois niveaux de preuve, sources non trouvées §7) |
| `finition-<étape>-<AAAA-MM-JJ>/` | Les **captures de notre propre application** à la fin d'une étape (D-060, critère 4) : taille d'un téléphone, **avant** et **après** la passe, avec les états provoqués. Ce ne sont pas des preuves de règle. | `README.md` du lot (comment chaque image a été prise, ce qu'elle ne prouve pas) |
| `combat-ui-<AAAA-MM-JJ>/` | Les **captures de notre écran de combat** avant/après la refonte **D-093** (#194) : l'état daté, la taille de téléphone, et les mesures de hauteur que `npm run capturer` contrôle. Pas des preuves de règle non plus. | `README.md` du lot |
| `main-64px-<AAAA-MM-JJ>/` | Un **défaut de mise en page précis** de notre écran de combat, avant/après, à 420 × 900 **et** à 360 px — ici le nom de la carte de main à 64 px (#233, D-094) : la composition de l'écran, pas la règle du jeu. | `README.md` du lot |
| `feuille-lignes-<AAAA-MM-JJ>/` | Un **anti-pattern d'écran précis** de notre feuille de route, avant/après, à 420 × 900 **et** à 1280 px — ici les trois `line-length` de #236 : le compte du détecteur, pas la règle du jeu. | `README.md` du lot |
| `prototype-<AAAA-MM-JJ>/` | Le **banc d'essai DEV** des saynètes d'attaque (`src/prototype/scene.html`, D-098, réparé par D-101) : il **se rend**, la scène y joue, et il n'est **pas** dans le bundle. Ce n'est pas un écran de l'application et ce n'est pas une preuve de règle. | `README.md` du lot |

Le guide de terrain, utilisable **sur le téléphone**, est `docs/CAPTURES.html`.

## Convention

```
preuves/
├── astuces-<AAAA-MM-JJ>/
│   ├── README.md                    ← transcrit le jeu MOT POUR MOT
│   ├── 01-menu-astuces.png          le menu « Astuces »
│   ├── 02-regles-de-combat.png      les 7 sous-entrées de « À propos des règles de combat »
│   ├── 03-zones-de-combat.png
│   ├── 04-preparation-dun-combat.png
│   ├── 05-deroulement-dun-tour.png
│   ├── 06-ko-et-issue-dun-combat.png
│   ├── 07-controle-pokemon-etats-speciaux.png
│   ├── 08-tours-et-temps-imparti.png
│   └── 09-erreurs-de-connexion.png
└── regles-<AAAA-MM-JJ>/
    ├── README.md                    ← verdict ligne par ligne, citations, niveaux de preuve
    └── (rapports bruts optionnels : a-deckgym.md, b-donnees-fr.md, …)
```

Un lot « ui » suit la même règle (`ui-<AAAA-MM-JJ>/`, avec `B01-accueil.png`…).

**Une exception, celle de #208** : `ui-2026-10-26/` ne documente pas l'application d'origine
mais **la nôtre**, avant/après la passe d'anti-patterns — le ticket demandait ce dossier-là.
Ses images ne sont pas des preuves de structure de référence : elles se lisent comme un lot
`finition-*` (ce qui a changé, et ce que ça ne prouve pas).

**Les noms suivent les écrans réels de l'app**, pas la liste du protocole : le protocole
visait 6 captures, l'app en a **9**. Un fichier = un écran, numéroté dans l'ordre du menu.

Une date par lot, un dossier par lot. **Ne pas écraser un lot précédent** : une preuve
datée ne se remplace pas, elle se complète.

### Lire une capture de l'app

Les écrans de règles font jusqu'à **8 600 px de haut**. Rendues entières, elles sont
**illisibles** — et une capture illisible n'est pas une preuve. Il faut les **découper en
tranches d'environ 1 500 px** avant de transcrire, sinon on paraphrase de mémoire :

```bash
python3 - <<'PY'
from PIL import Image; import glob, math, os
for p in sorted(glob.glob("*.png")):
    im = Image.open(p).convert("RGB"); W, H = im.size
    n = max(1, math.ceil(H / 1500)); h = math.ceil(H / n)
    for i in range(n):
        im.crop((0, i*h, W, min(H, i*h+h))).save(f"/tmp/crops/{os.path.splitext(p)[0]}__{i+1}sur{n}.png")
PY
```

## État au 20/10/2026

Le lot `astuces-2026-10-20/` est **rangé et transcrit** : **12 lignes** de `AGENTS.md` §4
sont passées de « supposé » à **observé**, et **2 ont été corrigées** (D-030). Les lignes
non capturées sont **établies par le lot de recherche** `regles-2026-10-20/`, qui fait foi au
même titre (D-034) : **plus aucune capture n'est requise** pour `AGENTS.md` §4, et O-014 est
tranché sans essai en jeu.

## État au 25/10/2026 — le lot de combat

`combat-ui-2026-10-25/` est le lot **« avant »** de la refonte de l'écran de combat (D-093,
#194). Il ne remplace pas `finition-alpha-2026-10-23/` : la refonte ouvrira son **après** à
côté de cet avant, et c'est à ce lot-ci qu'il se comparera. La garde de hauteur de
`npm run capturer` mesure désormais la main, la **barre d'action** et la **piste
d'Interventions** — cette dernière mordra à partir de **#190**, la barre à partir de **#191**.

## État au 27/10/2026 — l'« avant » de la refonte de la vague 1

`combat-ui-2026-10-27/avant/` est l'**avant** de la refonte de la vague 1 (D-116, #264,
tâche T1 #284) : l'écran de combat **tel qu'il est après D-093**, c'est-à-dire avec des
cartes au plateau et un éventail en main, à 420 × 900 et 1280 × 800. Ce n'est pas un second
« avant D-093 » : cet état-là reste `combat-ui-2026-10-25/avant/`, et il n'est plus l'écran
du dépôt. T3–T12 s'y compareront par leur `apres/`.

## Attention — les captures du legacy ne sont PAS des preuves

`docs/screenshot-*.png` (4 images) et `design/qa/`
(20 images) des **versions abandonnées** (`AGENTS.md` §9) sont des captures de **notre propre ancienne application**, pas de
*Pokémon TCG Pocket*. La preuve est dans le script qui les produit :
`scripts/screenshots.mjs`, dans le même dossier, pilote Chromium contre
`http://localhost:4173` — le `vite preview` de cette application — et photographie
**ses** routes (`/`, `/boosters`, `/collection`, `/wonder`, `/shop`, `/missions`,
`/profile`, `/deck`, `/battle`).

Conséquence, à ne pas confondre :

- elles **ne comptent pas** comme preuve : ni pour les règles (lot A), ni pour la
  structure de l'application de référence (lot B) ;
- elles restent utiles comme **idées d'UI** — `AGENTS.md` §9 l'autorise — à condition
  de se rappeler que leur vocabulaire est l'ancien (« Galère », et des routes comme
  `/boosters` ou `/wonder` qui ne sont plus nos termes).

**Le lot B n'est donc pas couvert** : les écrans de `docs/CAPTURES-UI.md` sont tous
à capturer dans l'application de référence.

## Modèle de README — lot « astuces »

Le modèle **rempli** est `astuces-2026-10-20/README.md` : c'est lui qu'il faut copier, pas
un squelette vide. Ce qu'il doit contenir :

```markdown
# Astuces de jeu — capturé le <AAAA-MM-JJ>

- **Application** : Pokémon TCG Pocket, version <x.y.z>
- **Appareil** : <modèle>, <OS et version>
- **Langue de l'interface** : <français / anglais / japonais / autre>
- **Chemin** : menu du bas → « Astuces » → « À propos des règles de combat »

## Les entrées réelles du menu
<la liste des sous-entrées, dans l'ordre affiché par l'app>

## Transcription, page par page
<une section par fichier, avec le texte du jeu RECOPIÉ, pas résumé>

## Verdict, ligne par ligne contre `AGENTS.md` §4
| Ligne de §4 | Capture | Verdict |
|---|---|---|
| <la règle> | `05` | ✅ observé / ⚠️ §4 est faux / ❔ non observé |

## Règles absentes de §4 et désormais observées
## Vocabulaire relevé dans l'app
## Sources web complémentaires
## Reste à capturer
```

## Modèle de README — lot « ui »

```markdown
# Interface — capturé le <AAAA-MM-JJ>

- **Application / version** : <…>
- **Appareil / OS** : <…>
- **Langue** : <…>

| Fichier | Écran et état | Ce que ça nous apprend pour notre écran |
|---|---|---|
| `B01-accueil.png` | Accueil, plein | <la hiérarchie, les raccourcis, la place de la devise> |
| `B06-combat-plateau.png` | Combat, en cours | <la disposition exacte du plateau> |
```

## Règle

**Une capture sans correspondance ne vaut rien.** Ce qui fait la valeur d'une preuve,
c'est le lien explicite entre l'image et la ligne qu'elle confirme ou contredit.
Recopier la **formulation exacte** du jeu dans la colonne « Ce qu'on y voit » plutôt
que la résumer : c'est la paraphrase qui a rendu les sources secondaires inutilisables.

Et une capture qui **contredit** `§4` vaut plus qu'une qui la confirme : c'est celle
qui empêche d'implémenter une règle inventée. Elle donne lieu à une **décision
datée** dans `docs/DECISIONS.md`, jamais à une correction silencieuse.
