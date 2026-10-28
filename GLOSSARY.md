# Glossaire du code

Les termes du **jeu** sont dans `docs/JEU.md` §3 : c'est l'autorité, et ce glossaire ne la
double pas. Ici, uniquement le vocabulaire du **code** — les mots qu'on emploie en lisant
`src/`, et qui ne sont pas des mots du jeu.

## Socle de faction

Le **socle de faction** est le code partagé par les dix fichiers `src/data/<faction>.ts` :
le constructeur des Planqués, la variante secrète, le dégradé et le glyphe par défaut.
Il vit dans `src/data/planque.ts` (`planqueBase`, `secretVariant`) et lit l'identité de la
faction dans `src/data/factions.ts` (`FACTION_META`). Un fichier de faction ne déclare donc
que ses cartes : ni constructeur, ni palette, ni glyphe local, ni vulnérabilité.

Le mot ne s'emploie pas pour parler du jeu : un « socle » n'est pas une carte, une faction
ni une règle. C'est pourquoi il n'entre pas dans `docs/JEU.md` §3.

| Ce que le socle porte | Où |
|---|---|
| `kind`, `faction` | `planqueBase(faction)` |
| `weakness` (Vulnérabilité) | `FACTION_META[faction].weakness` — source unique |
| `palette` (dégradé à 3 arrêts) | dérivée de `FACTION_META[faction].color` par `planquePalette` |
| `glyph` | `FACTION_META[faction].glyph`, surchargeable carte par carte |
| variantes `-star` / `-star2` / `-star3` / `-crown` | `secretVariant(cards, baseId, suffixe, glyph?)` |
