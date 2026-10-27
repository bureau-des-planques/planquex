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

Seule exception, **gardée parce qu'elle sert** : `documentation` — sept tickets la portent. Les sept
autres étiquettes que GitHub installe par défaut (`accessibility`, `duplicate`, `good first issue`,
`help wanted`, `invalid`, `question`) ont été **retirées** le 21/10/2026 : elles n'avaient jamais
servi, et elles encombraient le filtre. Une étiquette qui revient se recrée en une commande.

**Cinq états** :

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

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
  critères : chaque testeur a joué une partie complète, plus aucun bug qui casse la boucle,
  Journée d'intégration finie. L'**UI** ne la bloque pas — le light suffit à inviter (D-116) —
  et la **décision sur les illustrations** en est sortie, puisqu'elle reste un critère de beta
  (D-063). Un ticket d'UI ou d'illustration se range donc en `beta`, pas en `alpha`.
- L'étape est une **échéance**, pas une priorité : elle dit *où* on en a besoin, pas *quand*
  on le fait. Une étape plus tardive ne déclasse pas un ticket d'alpha qui bloque un testeur.
- Une étape se **change** dans le ticket (commentaire + `--remove-label`/`--add-label`), jamais
  silencieusement : c'est une décision de périmètre.
- Au passage d'une étape à la suivante, les tickets `alpha` encore ouverts sont **relus**
  avant d'être repris (`docs/VERSIONS.md`) : une étape close ne doit rien laisser derrière
  elle sans le dire.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
