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
│   ├── README.md          ← à remplir (modèle ci-dessous)
│   ├── 01-menu-astuces.png
│   ├── 02-tour.png
│   ├── 03-zone-energie.png
│   ├── 04-statuts.png
│   ├── 05-ko-defaite.png
│   └── 06-types-energie.png
├── ui-<AAAA-MM-JJ>/
│   ├── README.md
│   ├── B01-accueil.png
│   └── C01-titre.png
└── regles-<AAAA-MM-JJ>/
    ├── README.md          ← verdict ligne par ligne, citations, niveaux de preuve
    └── (rapports bruts optionnels : a-deckgym.md, b-donnees-fr.md, …)
```

Une date par lot, un dossier par lot. **Ne pas écraser un lot précédent** : une preuve
datée ne se remplace pas, elle se complète.

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

```markdown
# Astuces de jeu — capturé le <AAAA-MM-JJ>

- **Application** : Pokémon TCG Pocket, version <x.y.z>
- **Appareil** : <modèle>, <OS et version>
- **Langue de l'interface** : <français / anglais / japonais / autre>
- **Note sur les intitulés** : <les libellés réels diffèrent-ils de ceux que le
  protocole listait ? lesquels, et comment ? >

| Fichier | Ce qu'on y voit — **formulation exacte du jeu** | Ligne de `AGENTS.md` §4 concernée | Confirme ou contredit |
|---|---|---|---|
| `01-menu-astuces.png` | <recopier l'intitulé réel de l'entrée> | — | — |
| `02-tour.png` | <recopier la phrase du jeu> | Premier joueur · Pression | à remplir |
| `03-zone-energie.png` | <recopier> | Machine à café · Types de café | à remplir |
| `04-statuts.png` | <recopier, **et l'ordre**> | Statuts · Ordre des statuts | à remplir |
| `05-ko-defaite.png` | <recopier> | Défaite · craquage · relève | à remplir |
| `06-types-energie.png` | <recopier, **et le nombre d'emplacements**> | Types de café (plafond) | à remplir |

## Ce qui reste non observé après ce lot

<les lignes de §4 qui n'ont pas de capture, et pourquoi : page absente, intitulé
introuvable, question hors des Astuces…>
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
