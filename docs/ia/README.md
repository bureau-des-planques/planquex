# L'IA de la Direction — les mesures et les essais

Les règles de l'IA vivent dans `AGENTS.md` §6 et le code dans `src/game/ia.ts`. **Ici, ce sont les
mesures** : ce qui a été essayé, ce que ça a donné, et ce qui reste à faire. Les actes datés sont
dans `docs/DECISIONS.md` ; les chiffres vivent ici.

| Document | Ce qu'il dit |
|---|---|
| `111-pesage.md` | **Le pesage mesuré** (#111) : le protocole (graines d'entraînement et de contrôle disjointes, seuil à 55 % et ratio à 1,15) et les premiers chiffres |
| `111-mesure.md` | **La remesure** (22/10/2026) : le niveau 2 glouton fait **44 %** contre le niveau 1. Le gain annoncé par #93 était un artefact. Aucune règle ni code changé |
| `111-essais-evaluation.md` | **Piste 1, évaluation enrichie** : cinq jeux de poids, tous sous le seuil. **Échec** (43,7 % au contrôle). `src/game/ia.ts` est resté intact |
| `111-essais-recherche-2-coups.md` | **Piste 2, recherche à deux coups** : ce qui a été retenu, le protocole d'équité, les pièges, et ce qui est réutilisable pour un niveau 3 |
| `111-recherche-pistes.md` | **La recherche bibliographique** : les pistes possibles (évaluation, recherche, PIMC, ISMCTS, MCTS, évaluation apprise), leurs coûts et leurs risques, avec les sources |

**Ce qui a été retenu** (D-084) : la **recherche à deux coups** est **le niveau 2 acté** de l'alpha.
Elle gagne **60,4 %** contre le niveau 1 sur des graines neuves (ratio 1,53), là où le glouton
faisait 44 %. Deux réserves, écrites ici : la mesure n'a été faite **que contre le niveau 1**
(jamais contre un humain), et des **pics de temps** dépassaient le budget (138 ms mesurés, 100 ms
visés) — ticket **#172** : cause écrite et budget borné (plafond de 800 nœuds + échéance de 60 ms,
repli sur le glouton), voir `111-essais-recherche-2-coups.md` §6.3. **L'écran joue encore le
niveau 1** : le passage se fait en une ligne, à trancher une fois #172 fusionné.

**Le niveau 3** (expectiminimax avec déterminisations, ticket #94) repart de
`111-essais-recherche-2-coups.md` : le pool des cartes inconnues, le tirage de monde, la
simulation de tour y sont décrits et réutilisables.
