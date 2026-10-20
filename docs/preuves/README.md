# Preuves — captures qui rendent une règle « observée »

Ce dossier reçoit les **preuves primaires** : des captures d'écran horodatées, faites
dans l'application *Pokémon TCG Pocket* elle-même. **Trois usages, trois dossiers** :

| Dossier | Ce qu'il prouve | Protocole |
|---|---|---|
| `astuces-<AAAA-MM-JJ>/` | Les **règles** — les pages « Astuces du jeu ». Seul moyen de faire passer une ligne de `AGENTS.md` §4 de **supposé** à **observé** (O-012). | `docs/PROTOCOLE-ASTUCES.md` |
| `ui-<AAAA-MM-JJ>/` | La **structure de l'interface** — la composition des écrans de l'application d'origine, pour relire les nôtres. | `docs/CAPTURES-UI.md` |
| `regles-<AAAA-MM-JJ>/` | La **recherche documentaire** — verdict ligne par ligne contre `AGENTS.md` §4, avec citations exactes, niveaux de preuve (primaire / transcription / secondaire) et URL. **Ne contient pas de capture** : c'est un lot de recherche, qui peut ne contenir **aucune preuve primaire**, et doit alors le dire explicitement (§0 du README du lot). | `docs/preuves/regles-<date>/README.md` (modèle implicite : méthode §0, verdict §2, sources §5) |

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
sont passées de « supposé » à **observé**, et **2 ont été corrigées** (D-030). Restent à
capturer : l'**écran d'édition du deck** (le plafond des types d'Énergie — il débloque le
ticket #30), la **main de départ** (son nombre de cartes), et un **test en jeu** pour O-014.

## Attention — les captures du legacy ne sont PAS des preuves

`grevomon-pocket/docs/screenshot-*.png` (4 images) et `grevomon-pocket/design/qa/`
(20 images) sont des captures de **notre propre ancienne application**, pas de
*Pokémon TCG Pocket*. La preuve est dans le script qui les produit :
`../../grevomon-pocket/scripts/screenshots.mjs` pilote Chromium contre
`http://localhost:4173` — le `vite preview` de `grevomon-pocket` — et photographie
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
