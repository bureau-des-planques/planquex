# Preuves — captures qui rendent une règle « observée »

Ce dossier reçoit les **preuves primaires** : des captures d'écran horodatées, faites
dans l'application *Pokémon TCG Pocket* elle-même. Deux usages, deux dossiers :

| Dossier | Ce qu'il prouve | Protocole |
|---|---|---|
| `astuces-<AAAA-MM-JJ>/` | Les **règles** — les pages « Astuces du jeu ». Seul moyen de faire passer une ligne de `AGENTS.md` §4 de **supposé** à **observé** (O-012). | `docs/PROTOCOLE-ASTUCES.md` |
| `ui-<AAAA-MM-JJ>/` | La **structure de l'interface** — la composition des écrans de l'application d'origine, pour relire les nôtres. | `docs/CAPTURES-UI.md` |

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
└── ui-<AAAA-MM-JJ>/
    ├── README.md
    ├── B01-accueil.png
    └── C01-titre.png
```

Une date par lot, un dossier par lot. **Ne pas écraser un lot précédent** : une preuve
datée ne se remplace pas, elle se complète.

## Déjà capturé — le legacy

Quatre captures d'interface existent depuis le 18/10/2026 dans le projet legacy
(`../../grevomon-pocket/docs/`). Elles ne sont **pas** dans ce dossier, mais elles
couvrent déjà quatre écrans du lot B :

| Fichier | Écran | État |
|---|---|---|
| `screenshot-home.png` | Accueil / hub | existe |
| `screenshot-booster.png` | Ouverture d'un Arrivage | existe |
| `screenshot-collection.png` | Parc / collection | existe |
| `screenshot-card.png` | Fiche carte | existe |

**Ne pas les refaire** sans raison. Si un écran est repris, la nouvelle capture va
dans `ui-<date>/` et la raison est écrite dans le `README.md` du lot.

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
