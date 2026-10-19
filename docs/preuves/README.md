# Preuves — captures qui rendent une règle « observée »

Ce dossier reçoit les **preuves primaires** : des captures d'écran horodatées, faites
dans l'application *Pokémon TCG Pocket* elle-même, là où sont écrites les règles
(« Astuces du jeu » / Tips / ゲームのヒント).

C'est le seul moyen de faire passer une ligne de `AGENTS.md` §4 de **supposé** à
**observé** — voir **O-012** dans `docs/DECISIONS.md` et la marche à suivre détaillée
dans `docs/PROTOCOLE-ASTUCES.md`.

## Convention

```
preuves/
└── astuces-<AAAA-MM-JJ>/
    ├── README.md          ← à remplir (modèle ci-dessous)
    ├── 01-menu-astuces.png
    ├── 02-tour.png
    ├── 03-zone-energie.png
    ├── 04-statuts.png
    ├── 05-ko-defaite.png
    └── 06-types-energie.png
```

Une date par lot, un dossier par lot. Ne pas écraser un lot précédent : une preuve
datée ne se remplace pas, elle se complète.

## Modèle de README à copier

```markdown
# Astuces de jeu — capturé le <AAAA-MM-JJ>

- **Application** : Pokémon TCG Pocket, version <x.y.z>
- **Appareil** : <modèle>, <OS et version>
- **Langue de l'interface** : <français / anglais / japonais>
- **Chemin** : Menu ☰ → Astuces du jeu → Règles de combat

| Fichier | Ce qu'on y voit | Ligne de `AGENTS.md` §4 concernée | Confirme ou contredit |
|---|---|---|---|
| `01-menu-astuces.png` | Entrée du menu | — | — |
| `02-tour.png` | Déroulement d'un tour | « Premier joueur », « Pression » | à remplir |
| `03-zone-energie.png` | Machine à café | « Machine à café », « Types de café » | à remplir |
| `04-statuts.png` | Conditions spéciales | « Statuts », « Ordre des statuts » | à remplir |
| `05-ko-defaite.png` | K.O., Primes, défaite | « Primes », « Défaite », « K.O. » | à remplir |
| `06-types-energie.png` | Édition du Classeur | « Types de café » (plafond de 3) | à remplir |

## Ce qui reste à trancher après cette capture

<à remplir — les lignes qui resteraient non observées, et pourquoi>
```

## Règle

**Une capture sans correspondance ne vaut rien.** Ce qui fait la valeur d'une
preuve, c'est le lien explicite entre l'image et la ligne de §4 qu'elle confirme ou
contredit. Recopier la formulation exacte du jeu dans la colonne « Ce qu'on y voit »
plutôt que la résumer.
