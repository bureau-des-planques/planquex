# Lot `references-ui-2026-10-27` — trois références d'interface (recherche documentaire)

Ce lot ne contient **aucune capture**. C'est un **lot de recherche** sur les sources **primaires**
des éditeurs, pour relire **nos** écrans et **notre** parcours — pas pour prouver une règle de combat.

Trois jeux voisins, trois questions différentes :

| Fichier | Ce qu'il contient | Pourquoi ce jeu |
|---|---|---|
| `pokemon-pocket.md` | Les écrans, les fonctionnalités, le quotidien du joueur, et **la part qui tient sans monétisation ni social** | c'est notre **miroir de règles** (D-018) : ce qu'il fait de plus que nous, et ce qu'on a le droit de ne pas copier |
| `hearthstone.md` | Le **deck builder** (filtres, compte permanent, courbe, état invalide), le **journal comme hub**, l'ouverture de paquets, et **l'état réel de la documentation d'accessibilité** | le jeu le plus documenté publiquement sur ces sujets, et le seul des trois dont l'éditeur publie ses chaînes d'interface |
| `yu-gi-oh.md` | La **lisibilité du plateau** en combat, le **journal** et le **rejeu** comme deux objets séparés, l'**import de Deck** et ses cartes manquantes, les filtres de collection | c'est la référence du **plateau chargé** : ce qu'on fait quand l'écran est petit et l'état complexe |

## Ce que ce lot prouve, et ce qu'il ne prouve pas

- **Prouve** : des **libellés exacts** publiés par les éditeurs (les chaînes du deck builder Hearthstone, les positions de boutons des FAQ Pokémon), des **chiffres** (seuils de testeurs, plafonds, cadences), des **comportements décrits par l'éditeur** (deck incomplet qui avertit sans bloquer, carte manquante grisée), et des **absences documentées** (« aucune déclaration d'accessibilité »).
- **Ne prouve pas** : la **composition visuelle** d'un écran. Aucun éditeur ne la publie ; pour l'image, la seule preuve reste une **capture datée** (`docs/CAPTURES-UI.md`, lot `ui-<AAAA-MM-JJ>/`).
- **Ne prouve pas** les règles de combat, et **ne les propose pas** : notre périmètre est fixé par D-018 (miroir de Pocket) et D-020 (ajouts 2025-2026 exclus). Les mécaniques propres à Hearthstone ou Yu-Gi-Oh (mana, chaînes, Extra Deck) sont hors sujet par construction.

## Ce que ce lot ne dit pas

Il ne tranche **aucun** périmètre. Ce qui est rangé « pas maintenant » par D-056 (économie, boutique, missions, succès, échanges, amis, cotisation, classement, notifications, anglais) le reste : le lot documente seulement ce que ces fonctionnalités **exigent** (le social, la monnaie), pour que le refus soit argumenté et pas esthétique.

## Convention à compléter

`docs/preuves/README.md` liste les usages du dossier. Le type **`references-ui-<AAAA-MM-JJ>/`** n'y figurait pas ; sa ligne est ajoutée par le même commit.
