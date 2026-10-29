# Accents — une ligne par faction

> **La table des accents d'illustration** (D-046, `docs/SPEC-ILLUSTRATIONS.md` §3) : dix
> lignes, **et elles seules**. L'accent n'est **jamais** recopié sur une ligne de sujet
> (`SUJETS-flow.md`) : deux sources pour la même couleur, c'est exactement ce que D-046
> supprime.
>
> **La source canonique est `FACTION_META.color`** (`src/data/factions.ts`) : c'est elle qui
> pilote le dégradé de la carte (`planquePalette`). Les mots ci-dessous en sont
> **ré-dérivés** — la dérivation est **codée** dans `scripts/ressources/illustration-vague.test.ts`
> (teinte en degrés, puis saturation), donc changer une couleur dans `src/data` **fait
> échouer** la garde tant que l'accent n'a pas suivi. Une couleur et son illustration ne
> peuvent plus se contredire.

## Le format

```text
| `FACTION` | accent |
```

La clé est le **code de faction** (`Faction`, `src/data/types.ts`) — le même que la première
partie de l'`id` d'une carte (`sse-…`, `direction-…`, `docs/JEU.md` §5). C'est ce préfixe que
`scripts/ressources/illustration-vague.sh` lit pour résoudre l'accent d'une carte : aucun accent n'est
donc saisi carte par carte.

Le prompt final reste : `<socle aplati> <sujet>, muted <accent> accent.`

## La table

| Faction | Accent |
|---|---|
| `SSE` | emerald green |
| `MANAGEMENT` | burnt orange |
| `QVT` | turquoise blue |
| `AMELIORATION` | electric yellow |
| `RH` | violet purple |
| `ATELIER` | rust bronze |
| `DIRECTION` | slate blue |
| `SYNDICAT` | brick red |
| `INTERIM` | periwinkle blue |
| `SUPPORT` | teal |

## Ce que D-046 a changé (Q15)

Quatre accents ont bougé avec la couleur de leur faction, et six sont conservés — la
liste est **prose**, volontairement : un second tableau à clé de faction serait lu comme
une seconde table par `accent_de()` (constaté : deux accents pour `DIRECTION`).

- `DIRECTION` — *deep indigo* → **slate blue** ;
- `SYNDICAT` — *steel grey* → **brick red** ;
- `INTERIM` — *teal and gold* → **periwinkle blue** ;
- `SUPPORT` — *silver white* → **teal**.

Conséquence assumée : `support-responsable-support`, installée en argent-blanc, est **à
refaire** en teal (la couleur de sa faction).
