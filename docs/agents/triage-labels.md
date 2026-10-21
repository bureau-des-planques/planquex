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

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
