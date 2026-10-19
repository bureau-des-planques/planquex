# Protocole — capturer les « Astuces de jeu » (preuve primaire)

> **À qui** : à toi, sur ton téléphone. Aucun outil du dépôt ne peut ouvrir
> l'application *Pokémon TCG Pocket* : sa seule source de règles normative est
> **interne** au jeu. C'est la dernière marche pour que ~15 lignes de
> `AGENTS.md` §4 passent de « supposé » à **observé**.
> Créé le 19/10/2026, après O-009 (voir `docs/DECISIONS.md` D-022).

## Pourquoi

Le support officiel le dit lui-même : « find more information about Pokémon TCG
Pocket's game rules in **Tips** or by tapping the question mark button ». Il
n'existe **aucune** version web des Règles de combat. Deux recherches successives
(19/10/2026) n'ont trouvé, pour le plafond de 3 types d'énergie, la reprise de
poste et le choix de la relève, que des sources **secondaires**.

## Ce qu'il faut capturer (6 captures)

| # | Chemin | Ce que ça prouve |
|---|---|---|
| 1 | Menu **☰** → *Astuces du jeu* (JP : メニュー → **ゲームのヒント**) → **Règles de combat** | La page d'entrée existe et sa formulation |
| 2 | La page **déroulement d'un tour** | Ordre des phases, premier joueur, pioche, attaque |
| 3 | La page **zone d'énergie** | 1 énergie/tour, types, incolore |
| 4 | La page **conditions spéciales** | Les 5 statuts **et leur ordre de résolution** |
| 5 | La page **K.O. / Primes / conditions de victoire** | Défaite quand plus aucun Pokémon, choix de la relève |
| 6 | L'éditeur de **Classeur**, écran de choix des types d'énergie | Le plafond « 3 » (capture des 3 emplacements) |

Bonus si tu tombes dessus en jouant : l'écran « **choisis un Planqué** » après un
K.O. (preuve la plus directe du point 3).

## Comment les ranger dans le dépôt

```
docs/preuves/astuces-<AAAA-MM-JJ>/
├── README.md          ← ce que montre chaque image, + version de l'app, appareil, langue
├── 01-menu-astuces.png
├── 02-tour.png
├── 03-zone-energie.png
├── 04-statuts.png
├── 05-ko-defaite.png
└── 06-types-energie.png
```

Le `README.md` doit contenir : **date**, **version de l'application**, **appareil**,
**langue** de l'interface, et pour chaque image la **ligne de `§4` qu'elle confirme
ou contredit**. Une capture sans cette correspondance ne vaut rien.

## Ce que ça débloque, ligne par ligne

| Ligne de §4 | Aujourd'hui | Après capture |
|---|---|---|
| Main de départ, pas de reprise de poste | Décidé (D-022), **non observé** | Observé |
| Ordre des statuts (Surcharge → Burn-out → Bloqué → Gelé) | Supposé | Observé |
| Évolution impossible au premier tour de **chaque** joueur | Supposé | Observé |
| Café non consommé par la Pression | Supposé | Observé |
| Relève payée en cafés | Supposé | Observé |
| Pioche vide ≠ défaite | Supposé | Observé |
| Défaite si plus aucun Planqué | Décidé (D-022), **non observé** | Observé |
| Qui choisit la relève | Décidé (D-022), **non observé** | Observé |
| Plafond de 3 types de café, ordre aléatoire | Supposé | Observé |
| Collègue 1 par tour, Objet illimité | Supposé | Observé |

## Règle de méthode

**Ne pas paraphraser.** La valeur de la preuve tient à la formulation exacte du
jeu. Une capture d'écran horodatée vaut mieux qu'un résumé — c'est précisément
le reproche qu'on fait aux sources secondaires.

Tant que ces captures n'existent pas, ces lignes restent marquées **non
vérifiées** dans `docs/MIROIR-2026-DELTAS.md`, même après D-022 : une décision
datée tranche ce qu'on **implémente**, elle ne prouve pas ce que fait le jeu.
