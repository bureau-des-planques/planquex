# Modes futurs — rangés hors du mode standard

> **Rien dans ce document ne fait autorité.** Le mode standard est défini par
> `AGENTS.md` §4 : miroir de *Pokémon TCG Pocket* (état 2026, D-018) plus le seul
> mot-clé maison **« Changement de priorité »** (D-004). Décision de rangement : **D-019**.

## Pourquoi ce fichier existe

Les règles maison `RULES-4b` étaient présentées dans `AGENTS.md` §4.1 et
`PROPOSITION.md` §3.1, au milieu des règles du **standard**. Résultat : des audits
ont attribué au standard des règles qui n'en font pas partie, et une contradiction
apparente a été signalée sur la fin de partie quand plus aucun Planqué n'est en jeu
(voir `docs/MIROIR-2026-DELTAS.md`, « à vérifier »). Elles sont donc rangées ici.

Origine : moteur de `../grevomon-pocket/` (legacy, `RULES-4b`). Voir `AGENTS.md` §9.

## Mode « Café » (ex-`RULES-4b`)

Statut : **non acté, non implémenté, hors périmètre de lancement**. Il n'est ni un
mode par défaut, ni une référence pour le code.

| Règle 4b telle que documentée à l'époque | Valeur |
|---|---|
| Classeur | **12 cartes** |
| Main de départ | **4 cartes** |
| Café | non consommé par la Pression |
| Résistance | **−20** |
| Défaite | si l'Open-space est vide |

### ⚠️ Ne pas confondre avec le standard

Ces trois points **sont** des règles du standard, et non des restes de 4b, même si
elles y ressemblent :

- Le **café n'est pas consommé** par la Pression (règle de Pocket, §4).
- La **Résistance n'existe pas** (règle de Pocket, §4) — ce n'est pas « −20 ».
- La **pioche vide ne fait pas perdre** (règle de Pocket, §4).

## Autres modes envisagés

| Mode | Statut |
|---|---|
| Mode Carrière, draft, scellé | Envisagés, listés « nuls sur le standard » dans `PROPOSITION.md` §3.6 |
| Mode « Café » ci-dessus | Parké, sans échéance |

Toute réactivation d'un de ces modes demandera une **décision datée** dans
`docs/DECISIONS.md` et une mise à jour de `AGENTS.md`.
